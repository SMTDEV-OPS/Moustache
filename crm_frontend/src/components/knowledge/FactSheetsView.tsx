import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Edit, Trash2, Plus, Eye } from "lucide-react";
import {
  getKnowledgeBaseItems,
  deleteKnowledgeBaseItem,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
  type IFactSheetContent,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { FactSheetEditor } from "./FactSheetEditor";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface FactSheetsViewProps {
  propertyId: string;
  searchQuery?: string;
  canManage?: boolean;
}

/** Detects new IFactSheetContent shape vs legacy flat string map. */
function isStructuredFactSheetContent(raw: unknown): raw is IFactSheetContent {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    Array.isArray(o.roomCategories) ||
    Array.isArray(o.inHouseRules) ||
    Array.isArray(o.generalInfo) ||
    Array.isArray(o.hotelAmenities) ||
    Array.isArray(o.roomAmenities) ||
    (o.pocDetails != null && typeof o.pocDetails === "object") ||
    typeof o.checkInTime === "string" ||
    typeof o.checkOutTime === "string" ||
    Array.isArray(o.nearbyAttractions) ||
    Array.isArray(o.additionalCharges)
  );
}

function hasStructuredData(c: IFactSheetContent): boolean {
  return !!(
    (c.roomCategories && c.roomCategories.length) ||
    (c.inHouseRules && c.inHouseRules.length) ||
    (c.generalInfo && c.generalInfo.length) ||
    (c.hotelAmenities && c.hotelAmenities.length) ||
    (c.roomAmenities && c.roomAmenities.length) ||
    c.pocDetails?.frontDeskPhone ||
    c.pocDetails?.frontDeskEmail ||
    c.pocDetails?.gmName ||
    c.pocDetails?.gmPhone ||
    c.checkInTime ||
    c.checkOutTime ||
    (c.nearbyAttractions && c.nearbyAttractions.length) ||
    (c.additionalCharges && c.additionalCharges.length) ||
    c.propertyAddress ||
    c.mapLocation ||
    c.specialRemarks
  );
}

function FactSheetCardPreview({ content }: { content: Record<string, unknown> | undefined }) {
  if (!content || Object.keys(content).length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Empty fact sheet</p>
        <p className="mt-1">
          Click <strong>Edit</strong> to open the structured editor (rooms, rules, amenities, POC, etc.).
        </p>
      </div>
    );
  }

  if (isStructuredFactSheetContent(content)) {
    const c = content;
    const lines: string[] = [];
    if (c.roomCategories?.length) lines.push(`${c.roomCategories.length} room categor${c.roomCategories.length === 1 ? "y" : "ies"}`);
    if (c.generalInfo?.length) lines.push(`${c.generalInfo.length} general info line(s)`);
    if (c.hotelAmenities?.length) lines.push(`${c.hotelAmenities.length} hotel amenit${c.hotelAmenities.length === 1 ? "y" : "ies"}`);
    if (c.inHouseRules?.length) lines.push(`${c.inHouseRules.length} house rule(s)`);
    if (c.nearbyAttractions?.length) lines.push(`${c.nearbyAttractions.length} nearby attraction(s)`);
    if (c.checkInTime || c.checkOutTime) {
      lines.push(`Check-in / out: ${c.checkInTime || "—"} / ${c.checkOutTime || "—"}`);
    }

    return (
      <div className="space-y-3">
        <Badge variant="secondary" className="font-normal">
          Structured fact sheet
        </Badge>
        {hasStructuredData(c) ? (
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {lines.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Template ready — use <strong>Edit</strong> to add structured fields used in quotations.
          </p>
        )}
      </div>
    );
  }

  const entries = Object.entries(content).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );
  if (entries.length === 0) {
    return <p className="text-muted-foreground">No details available</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="border-l-4 pl-4" style={{ borderColor: "#059669" }}>
          <div className="text-sm text-muted-foreground font-medium">{key}</div>
          <div className="text-foreground">{String(value)}</div>
        </div>
      ))}
    </div>
  );
}

function FactSheetViewer({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: KnowledgeBaseItem | null;
}) {
  const raw = (item?.content ?? undefined) as Record<string, unknown> | undefined;
  const structured = raw && isStructuredFactSheetContent(raw) ? raw : null;

  const section = (title: string, body: React.ReactNode) => (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {body}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{item?.title ?? "Fact Sheet"}</DialogTitle>
          <DialogDescription>
            Read-only preview. Use <strong>Edit</strong> to change values.
          </DialogDescription>
        </DialogHeader>

        {!raw || Object.keys(raw).length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This fact sheet is empty.
          </div>
        ) : structured ? (
          <div className="space-y-6">
            {section(
              "Location & times",
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Address</div>
                  <div className="text-foreground whitespace-pre-line">
                    {structured.propertyAddress || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Map</div>
                  {structured.mapLocation ? (
                    <a
                      className="text-primary underline break-all"
                      href={structured.mapLocation}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {structured.mapLocation}
                    </a>
                  ) : (
                    <div className="text-foreground">—</div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground">Check-in</div>
                  <div className="text-foreground">{structured.checkInTime || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Check-out</div>
                  <div className="text-foreground">{structured.checkOutTime || "—"}</div>
                </div>
              </div>
            )}

            <Separator />

            {section(
              "Room categories",
              structured.roomCategories?.length ? (
                <div className="space-y-2">
                  {structured.roomCategories.map((rc, idx) => (
                    <div key={idx} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">{rc.name}</div>
                      <div className="mt-1 text-muted-foreground">
                        {rc.capacity != null ? `Capacity: ${rc.capacity}` : null}
                        {rc.sizesqft != null ? `${rc.capacity != null ? " · " : ""}Size: ${rc.sizesqft} sq ft` : null}
                        {rc.isAC ? ` · AC` : ""}{rc.isDorm ? ` · Dorm` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )
            )}

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              {section(
                "In-house rules",
                structured.inHouseRules?.length ? (
                  <ul className="list-inside list-disc text-sm text-muted-foreground space-y-1">
                    {structured.inHouseRules.map((x, i) => (
                      <li key={`${i}-${x}`}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )
              )}
              {section(
                "Additional charges",
                structured.additionalCharges?.length ? (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {structured.additionalCharges.map((c, i) => (
                      <li key={`${i}-${c.item}`}>
                        {c.item}
                        {c.amount ? ` — ${c.amount}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )
              )}
              {section(
                "Nearby attractions",
                structured.nearbyAttractions?.length ? (
                  <ul className="list-inside list-disc text-sm text-muted-foreground space-y-1">
                    {structured.nearbyAttractions.map((x, i) => (
                      <li key={`${i}-${x}`}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )
              )}
              {section(
                "Nearby restaurants",
                structured.nearbyRestaurants?.length ? (
                  <ul className="list-inside list-disc text-sm text-muted-foreground space-y-1">
                    {structured.nearbyRestaurants.map((x, i) => (
                      <li key={`${i}-${x}`}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )
              )}
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              {section(
                "General info",
                structured.generalInfo?.length ? (
                  <ul className="list-inside list-disc text-sm text-muted-foreground space-y-1">
                    {structured.generalInfo.map((x, i) => (
                      <li key={`${i}-${x}`}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )
              )}
              {section(
                "Amenities",
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Room amenities</div>
                    {structured.roomAmenities?.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {structured.roomAmenities.map((x, i) => (
                          <Badge key={`${i}-${x}`} variant="secondary" className="font-normal">
                            {x}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Hotel amenities</div>
                    {structured.hotelAmenities?.length ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {structured.hotelAmenities.map((x, i) => (
                          <Badge key={`${i}-${x}`} variant="secondary" className="font-normal">
                            {x}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {section(
              "POC details",
              structured.pocDetails ? (
                <div className="grid gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Front desk phone</div>
                    <div className="text-foreground">{structured.pocDetails.frontDeskPhone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Front desk email</div>
                    <div className="text-foreground">{structured.pocDetails.frontDeskEmail || "—"}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">GM name</div>
                      <div className="text-foreground">{structured.pocDetails.gmName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">GM phone</div>
                      <div className="text-foreground">{structured.pocDetails.gmPhone || "—"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )
            )}

            {structured.specialRemarks ? (
              <>
                <Separator />
                {section(
                  "Special remarks",
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {structured.specialRemarks}
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="secondary" className="font-normal">
              Legacy content
            </Badge>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const FactSheetsView = ({
  propertyId,
  searchQuery = "",
  canManage = false,
}: FactSheetsViewProps) => {
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [viewingItem, setViewingItem] = useState<KnowledgeBaseItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadItems();
  }, [propertyId, searchQuery]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await getKnowledgeBaseItems({
        propertyId,
        type: "FACTSHEET",
        search: searchQuery || undefined,
      });
      setItems(data);
    } catch (error) {
      console.error("Failed to load fact sheets:", error);
      toast.error("Failed to load fact sheets");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this fact sheet?")) {
      return;
    }

    try {
      await deleteKnowledgeBaseItem(id);
      toast.success("Fact sheet deleted");
      loadItems();
    } catch (error) {
      console.error("Failed to delete fact sheet:", error);
      toast.error("Failed to delete fact sheet");
    }
  };

  const handleDownload = (fileId: string, filename: string) => {
    const url = getFileDownloadUrl(fileId);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading fact sheets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Fact Sheets
          </h2>
          <p className="text-muted-foreground">
            Structured fact sheets power the Send Quotation dialog. Open a card and click <strong>Edit</strong> to
            manage rooms, rules, amenities, and POC.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsCreating(true)}
            className="rounded-none px-8 py-6"
            style={{ backgroundColor: "#0F172A", color: "white" }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add fact sheet
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="rounded-sm border border-slate-200 p-8">
          <div className="text-center text-muted-foreground">
            <p>No fact sheets found.</p>
            {canManage && (
              <p className="mt-2 text-sm">
                Click &quot;Add fact sheet&quot; to create one, or run the property seed script to insert empty
                templates.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {items.map((item) => {
            const rawContent = item.content as Record<string, unknown> | undefined;

            return (
              <Card key={item._id} className="rounded-sm border border-slate-200 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="border-b border-slate-100 p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl" style={{ color: "#059669" }}>
                      {item.title}
                    </CardTitle>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingItem(item)}
                          className="rounded-none"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                          className="rounded-none"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item._id)}
                          className="rounded-none text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <FactSheetCardPreview content={rawContent} />

                  {item.files.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-medium text-foreground mb-3">Attachments</h4>
                      <div className="space-y-2">
                        {item.files.map((file) => (
                          <Button
                            key={file._id}
                            variant="outline"
                            onClick={() => handleDownload(file._id, file.originalName)}
                            className="w-full justify-start rounded-none"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {file.originalName}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isCreating || editingItem) && (
        <FactSheetEditor
          propertyId={propertyId}
          item={editingItem || undefined}
          onClose={() => {
            setIsCreating(false);
            setEditingItem(null);
          }}
          onSave={() => {
            setIsCreating(false);
            setEditingItem(null);
            loadItems();
          }}
        />
      )}

      <FactSheetViewer
        open={!!viewingItem}
        onOpenChange={(o) => {
          if (!o) setViewingItem(null);
        }}
        item={viewingItem}
      />
    </div>
  );
};
