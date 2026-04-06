import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  getHotelDirectory,
  type HotelDirectoryEntry,
  type IPropertyDirectoryContent,
} from "@/services/knowledgeBase";
import { DirectoryDetailPanel } from "./DirectoryDetailPanel";

export type KBQuickDrawerTab = "overview" | "rooms" | "amenities" | "city";

export interface KBQuickDrawerProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: KBQuickDrawerTab;
}

function phoneFromContent(c: IPropertyDirectoryContent | null | undefined) {
  const contact = c?.contact;
  if (!contact) return "";
  return (
    contact.frontDesk ||
    contact.frontDeskPhone ||
    contact.managerPhone ||
    ""
  );
}

function emailFromContent(c: IPropertyDirectoryContent | null | undefined) {
  return c?.contact?.email || c?.contact?.frontDeskEmail || "";
}

export function KBQuickDrawer({
  propertyId,
  isOpen,
  onClose,
  defaultTab = "overview",
}: KBQuickDrawerProps) {
  const [cache, setCache] = useState<HotelDirectoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (cache !== null) return;
    let cancelled = false;
    setLoading(true);
    void getHotelDirectory()
      .then((rows) => {
        if (!cancelled) setCache(rows);
      })
      .catch(() => {
        if (!cancelled) setCache([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, cache]);

  const entry = useMemo(
    () => cache?.find((e) => e.propertyId === propertyId) ?? null,
    [cache, propertyId]
  );

  const content = entry?.content ?? null;
  const tierBadge =
    entry?.directoryTierLabel ||
    (entry?.tier === "LUXURIA"
      ? "Luxuria"
      : entry?.tier === "SELECT"
        ? "Select"
        : entry?.tier === "HOSTEL"
          ? "Hostel"
          : entry?.tier || "—");

  const highlights = (content?.buildingHighlights ?? []).filter(Boolean);
  const tabDefault =
    defaultTab === "overview"
      ? "overview"
      : defaultTab === "rooms"
        ? "rooms"
        : defaultTab === "amenities"
          ? "amenities"
          : "city";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        overlayClassName="z-[200]"
        className="z-[210] w-full sm:max-w-[420px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left space-y-1">
          <SheetTitle className="text-base font-semibold leading-tight pr-8">
            {entry?.propertyName ?? "Property"}
          </SheetTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[11px] rounded-sm">
              {tierBadge}
            </Badge>
            {entry?.region ? (
              <Badge variant="secondary" className="text-[11px] rounded-sm">
                {entry.region}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {loading && !entry ? (
            <p className="text-sm text-muted-foreground px-5 py-6">
              Loading directory…
            </p>
          ) : (
            <Tabs
              key={`${propertyId}-${tabDefault}`}
              defaultValue={tabDefault}
              className="flex flex-col flex-1 min-h-0"
            >
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/30 px-2 h-10 shrink-0">
                <TabsTrigger value="overview" className="text-xs rounded-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="rooms" className="text-xs rounded-sm">
                  Rooms
                </TabsTrigger>
                <TabsTrigger value="amenities" className="text-xs rounded-sm">
                  Amenities
                </TabsTrigger>
                <TabsTrigger value="city" className="text-xs rounded-sm">
                  City
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <div className="space-y-2 text-sm">
                    {phoneFromContent(content) ? (
                      <p>
                        <span className="text-muted-foreground">📞 </span>
                        {phoneFromContent(content)}
                      </p>
                    ) : null}
                    {emailFromContent(content) ? (
                      <p className="break-all">
                        <span className="text-muted-foreground">✉ </span>
                        {emailFromContent(content)}
                      </p>
                    ) : null}
                    {content?.address ? (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {content.address}
                        {content.landmark ? ` · ${content.landmark}` : ""}
                      </p>
                    ) : null}
                    {content?.contact?.mapLink ? (
                      <a
                        href={content.contact.mapLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline"
                      >
                        Open in Maps
                      </a>
                    ) : null}
                  </div>
                  {highlights.length > 0 ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                        Highlights
                      </p>
                      <p className="text-sm text-foreground leading-snug">
                        {highlights.join(" · ")}
                      </p>
                    </div>
                  ) : null}
                  {!phoneFromContent(content) &&
                  !emailFromContent(content) &&
                  highlights.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No directory details yet for this property.
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="rooms" className="mt-0">
                  <DirectoryDetailPanel content={content} tabOnly="rooms" />
                </TabsContent>
                <TabsContent value="amenities" className="mt-0">
                  <DirectoryDetailPanel content={content} tabOnly="amenities" />
                </TabsContent>
                <TabsContent value="city" className="mt-0">
                  <DirectoryDetailPanel content={content} tabOnly="city" />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
