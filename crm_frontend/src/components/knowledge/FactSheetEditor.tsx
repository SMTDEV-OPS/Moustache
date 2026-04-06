import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileUploader } from "./FileUploader";
import {
  createKnowledgeBaseItem,
  updateKnowledgeBaseItem,
  uploadFiles,
  deleteFile,
  getFileDownloadUrl,
  type KnowledgeBaseItem,
  type IFactSheetContent,
} from "@/services/knowledgeBase";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface FactSheetEditorProps {
  propertyId: string;
  item?: KnowledgeBaseItem;
  onClose: () => void;
  onSave: () => void;
}

function normalizeContent(raw: Record<string, unknown> | undefined): IFactSheetContent {
  if (!raw || typeof raw !== "object") return {};
  const c = raw as IFactSheetContent & Record<string, unknown>;
  if (
    Array.isArray(c.roomCategories) ||
    Array.isArray(c.inHouseRules) ||
    Array.isArray(c.generalInfo) ||
    c.checkInTime != null ||
    c.pocDetails != null
  ) {
    return { ...c };
  }
  const lines: string[] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (k && v != null && String(v).trim()) {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  return { generalInfo: lines.length ? lines : undefined };
}

const emptyRoomRow = () => ({
  name: "",
  capacity: undefined as number | undefined,
  sizesqft: undefined as number | undefined,
  isAC: false,
  isDorm: false,
});

export const FactSheetEditor = ({
  propertyId,
  item,
  onClose,
  onSave,
}: FactSheetEditorProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<IFactSheetContent>({});
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState(item?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tagInput, setTagInput] = useState({
    general: "",
    roomAmenities: "",
    hotelAmenities: "",
  });

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      setForm(normalizeContent(item.content as Record<string, unknown> | undefined));
      setExistingFiles(item.files || []);
    } else {
      setTitle("");
      setDescription("");
      setForm({});
      setExistingFiles([]);
    }
    setNewFiles([]);
  }, [item]);

  const updateForm = (patch: Partial<IFactSheetContent>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const addTag = (field: "generalInfo" | "roomAmenities" | "hotelAmenities", raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const list = [...(form[field] ?? []), t];
    updateForm({ [field]: list });
    const key =
      field === "generalInfo"
        ? "general"
        : field === "roomAmenities"
          ? "roomAmenities"
          : "hotelAmenities";
    setTagInput((s) => ({ ...s, [key]: "" }));
  };

  const removeTag = (field: "generalInfo" | "roomAmenities" | "hotelAmenities", index: number) => {
    const list = [...(form[field] ?? [])];
    list.splice(index, 1);
    updateForm({ [field]: list.length ? list : undefined });
  };

  const handleRemoveExistingFile = async (fileId: string) => {
    if (!item) return;
    try {
      await deleteFile(item._id, fileId);
      setExistingFiles(existingFiles.filter((f) => f._id !== fileId));
      toast.success("File removed");
    } catch (error) {
      console.error("Failed to remove file:", error);
      toast.error("Failed to remove file");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Fact sheet title is required");
      return;
    }

    try {
      setIsSubmitting(true);

      const content = { ...form } as Record<string, unknown>;

      let savedItem: KnowledgeBaseItem;

      if (item) {
        savedItem = await updateKnowledgeBaseItem(item._id, {
          title,
          description: description || undefined,
          content,
        });

        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      } else {
        savedItem = await createKnowledgeBaseItem({
          type: "FACTSHEET",
          propertyId,
          title,
          description: description || undefined,
          content,
        });

        if (newFiles.length > 0) {
          savedItem = await uploadFiles(savedItem._id, newFiles);
        }
      }

      toast.success(
        item ? "Fact sheet updated successfully" : "Fact sheet created successfully"
      );
      onSave();
    } catch (error) {
      console.error("Failed to save fact sheet:", error);
      toast.error(
        item ? "Failed to update fact sheet" : "Failed to create fact sheet"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomCategories = form.roomCategories ?? [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-sm">
        <DialogHeader>
          <DialogTitle
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {item ? "Edit Fact Sheet" : "Create Fact Sheet"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update structured property details for quotations and knowledge base."
              : "Fill in the details to create a new fact sheet."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Basic information</h3>
            <div className="space-y-2">
              <Label htmlFor="title">Fact sheet title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Property Name — Fact Sheet"
                className="rounded-none h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-none"
              />
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Location & times</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property address</Label>
                <Textarea
                  value={form.propertyAddress ?? ""}
                  onChange={(e) => updateForm({ propertyAddress: e.target.value || undefined })}
                  rows={2}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Map URL</Label>
                <Input
                  value={form.mapLocation ?? ""}
                  onChange={(e) => updateForm({ mapLocation: e.target.value || undefined })}
                  placeholder="Google Maps link"
                  className="rounded-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Check-in</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={form.checkInTime ?? ""}
                  onChange={(e) => updateForm({ checkInTime: e.target.value || undefined })}
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutTime">Check-out</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={form.checkOutTime ?? ""}
                  onChange={(e) => updateForm({ checkOutTime: e.target.value || undefined })}
                  className="rounded-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Room categories</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({ roomCategories: [...roomCategories, emptyRoomRow()] })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add category
              </Button>
            </div>
            {roomCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No room categories yet.</p>
            ) : (
              <div className="space-y-3">
                {roomCategories.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 items-end border border-slate-200 p-3 bg-slate-50"
                  >
                    <div className="space-y-1 lg:col-span-2">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const next = [...roomCategories];
                          next[index] = { ...next[index], name: e.target.value };
                          updateForm({ roomCategories: next });
                        }}
                        className="rounded-none h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sq ft</Label>
                      <Input
                        type="number"
                        value={row.sizesqft ?? ""}
                        onChange={(e) => {
                          const next = [...roomCategories];
                          const v = e.target.value;
                          next[index] = {
                            ...next[index],
                            sizesqft: v === "" ? undefined : parseInt(v, 10),
                          };
                          updateForm({ roomCategories: next });
                        }}
                        className="rounded-none h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Capacity</Label>
                      <Input
                        type="number"
                        value={row.capacity ?? ""}
                        onChange={(e) => {
                          const next = [...roomCategories];
                          const v = e.target.value;
                          next[index] = {
                            ...next[index],
                            capacity: v === "" ? undefined : parseInt(v, 10),
                          };
                          updateForm({ roomCategories: next });
                        }}
                        className="rounded-none h-9"
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id={`ac-${index}`}
                        checked={!!row.isAC}
                        onCheckedChange={(c) => {
                          const next = [...roomCategories];
                          next[index] = { ...next[index], isAC: c === true };
                          updateForm({ roomCategories: next });
                        }}
                      />
                      <Label htmlFor={`ac-${index}`} className="text-xs font-normal">
                        AC
                      </Label>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <Checkbox
                        id={`dorm-${index}`}
                        checked={!!row.isDorm}
                        onCheckedChange={(c) => {
                          const next = [...roomCategories];
                          next[index] = { ...next[index], isDorm: c === true };
                          updateForm({ roomCategories: next });
                        }}
                      />
                      <Label htmlFor={`dorm-${index}`} className="text-xs font-normal">
                        Dorm
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => {
                        const next = roomCategories.filter((_, i) => i !== index);
                        updateForm({ roomCategories: next.length ? next : undefined });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">In-house rules</h3>
            <div className="space-y-2">
              {(form.inHouseRules ?? []).map((rule, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={rule}
                    onChange={(e) => {
                      const next = [...(form.inHouseRules ?? [])];
                      next[index] = e.target.value;
                      updateForm({ inHouseRules: next });
                    }}
                    className="rounded-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const next = (form.inHouseRules ?? []).filter((_, i) => i !== index);
                      updateForm({ inHouseRules: next.length ? next : undefined });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({ inHouseRules: [...(form.inHouseRules ?? []), ""] })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add rule
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Paste multiple (one per line)</Label>
              <Textarea
                rows={3}
                placeholder="One rule per line…"
                className="rounded-none text-sm"
                onBlur={(e) => {
                  const lines = e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  if (lines.length === 0) return;
                  e.target.value = "";
                  updateForm({
                    inHouseRules: [...(form.inHouseRules ?? []), ...lines],
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Additional charges</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({
                    additionalCharges: [
                      ...(form.additionalCharges ?? []),
                      { item: "", amount: "" },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {(form.additionalCharges ?? []).map((row, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Item"
                  value={row.item}
                  onChange={(e) => {
                    const next = [...(form.additionalCharges ?? [])];
                    next[index] = { ...next[index], item: e.target.value };
                    updateForm({ additionalCharges: next });
                  }}
                  className="rounded-none flex-1"
                />
                <Input
                  placeholder="Amount"
                  value={row.amount ?? ""}
                  onChange={(e) => {
                    const next = [...(form.additionalCharges ?? [])];
                    next[index] = { ...next[index], amount: e.target.value };
                    updateForm({ additionalCharges: next });
                  }}
                  className="rounded-none w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = (form.additionalCharges ?? []).filter((_, i) => i !== index);
                    updateForm({ additionalCharges: next.length ? next : undefined });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nearby attractions</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({
                    nearbyAttractions: [...(form.nearbyAttractions ?? []), ""],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {(form.nearbyAttractions ?? []).map((line, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) => {
                    const next = [...(form.nearbyAttractions ?? [])];
                    next[index] = e.target.value;
                    updateForm({ nearbyAttractions: next });
                  }}
                  className="rounded-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = (form.nearbyAttractions ?? []).filter((_, i) => i !== index);
                    updateForm({ nearbyAttractions: next.length ? next : undefined });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Nearby restaurants</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({
                    nearbyRestaurants: [...(form.nearbyRestaurants ?? []), ""],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {(form.nearbyRestaurants ?? []).map((line, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) => {
                    const next = [...(form.nearbyRestaurants ?? [])];
                    next[index] = e.target.value;
                    updateForm({ nearbyRestaurants: next });
                  }}
                  className="rounded-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = (form.nearbyRestaurants ?? []).filter((_, i) => i !== index);
                    updateForm({ nearbyRestaurants: next.length ? next : undefined });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">POC details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Front desk phone</Label>
                <Input
                  value={form.pocDetails?.frontDeskPhone ?? ""}
                  onChange={(e) =>
                    updateForm({
                      pocDetails: {
                        ...form.pocDetails,
                        frontDeskPhone: e.target.value || undefined,
                      },
                    })
                  }
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Front desk email</Label>
                <Input
                  value={form.pocDetails?.frontDeskEmail ?? ""}
                  onChange={(e) =>
                    updateForm({
                      pocDetails: {
                        ...form.pocDetails,
                        frontDeskEmail: e.target.value || undefined,
                      },
                    })
                  }
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label>GM name</Label>
                <Input
                  value={form.pocDetails?.gmName ?? ""}
                  onChange={(e) =>
                    updateForm({
                      pocDetails: {
                        ...form.pocDetails,
                        gmName: e.target.value || undefined,
                      },
                    })
                  }
                  className="rounded-none"
                />
              </div>
              <div className="space-y-2">
                <Label>GM phone</Label>
                <Input
                  value={form.pocDetails?.gmPhone ?? ""}
                  onChange={(e) =>
                    updateForm({
                      pocDetails: {
                        ...form.pocDetails,
                        gmPhone: e.target.value || undefined,
                      },
                    })
                  }
                  className="rounded-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">General info</h3>
              <div className="flex flex-wrap gap-2">
                {(form.generalInfo ?? []).map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button
                      type="button"
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                      onClick={() => removeTag("generalInfo", i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput.general}
                  onChange={(e) => setTagInput((s) => ({ ...s, general: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag("generalInfo", tagInput.general);
                    }
                  }}
                  placeholder="Add tag, Enter"
                  className="rounded-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTag("generalInfo", tagInput.general)}
                >
                  Add
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Room amenities</h3>
              <div className="flex flex-wrap gap-2">
                {(form.roomAmenities ?? []).map((t, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button
                      type="button"
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                      onClick={() => removeTag("roomAmenities", i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput.roomAmenities}
                  onChange={(e) =>
                    setTagInput((s) => ({ ...s, roomAmenities: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag("roomAmenities", tagInput.roomAmenities);
                    }
                  }}
                  placeholder="Add tag, Enter"
                  className="rounded-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTag("roomAmenities", tagInput.roomAmenities)}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Hotel amenities</h3>
            <div className="flex flex-wrap gap-2">
              {(form.hotelAmenities ?? []).map((t, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  {t}
                  <button
                    type="button"
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    onClick={() => removeTag("hotelAmenities", i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput.hotelAmenities}
                onChange={(e) =>
                  setTagInput((s) => ({ ...s, hotelAmenities: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag("hotelAmenities", tagInput.hotelAmenities);
                  }
                }}
                placeholder="Add tag, Enter"
                className="rounded-none max-w-md"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag("hotelAmenities", tagInput.hotelAmenities)}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Promotions & offers</h3>
            <div className="space-y-2">
              {(form.promotionsAndOffers ?? []).map((line, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={line}
                    onChange={(e) => {
                      const next = [...(form.promotionsAndOffers ?? [])];
                      next[index] = e.target.value;
                      updateForm({ promotionsAndOffers: next });
                    }}
                    className="rounded-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const next = (form.promotionsAndOffers ?? []).filter(
                        (_, i) => i !== index
                      );
                      updateForm({ promotionsAndOffers: next.length ? next : undefined });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({
                    promotionsAndOffers: [...(form.promotionsAndOffers ?? []), ""],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add line
              </Button>
            </div>
          </div>

          <div className="space-y-4 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Property policy</h3>
            <div className="space-y-2">
              {(form.propertyPolicy ?? []).map((line, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={line}
                    onChange={(e) => {
                      const next = [...(form.propertyPolicy ?? [])];
                      next[index] = e.target.value;
                      updateForm({ propertyPolicy: next });
                    }}
                    className="rounded-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const next = (form.propertyPolicy ?? []).filter((_, i) => i !== index);
                      updateForm({ propertyPolicy: next.length ? next : undefined });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                onClick={() =>
                  updateForm({ propertyPolicy: [...(form.propertyPolicy ?? []), ""] })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add rule
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold">Special remarks</h3>
            <Textarea
              value={form.specialRemarks ?? ""}
              onChange={(e) => updateForm({ specialRemarks: e.target.value || undefined })}
              rows={4}
              className="rounded-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Files (PDF, images, etc.)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload files that can be downloaded as the complete fact sheet
            </p>
            <FileUploader
              files={newFiles}
              onFilesChange={setNewFiles}
              maxFiles={10}
              maxSizeMB={50}
            />
          </div>

          {existingFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Existing files</Label>
              <div className="space-y-2">
                {existingFiles.map((file) => (
                  <div
                    key={file._id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-sm bg-slate-50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {file.originalName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = getFileDownloadUrl(file._id);
                          window.open(url, "_blank");
                        }}
                        className="rounded-none"
                      >
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveExistingFile(file._id)}
                        className="rounded-none text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim()}
              className="rounded-none px-8 py-6"
              style={{ backgroundColor: "#0F172A", color: "white" }}
            >
              {isSubmitting
                ? "Saving..."
                : item
                  ? "Update Fact Sheet"
                  : "Create Fact Sheet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
