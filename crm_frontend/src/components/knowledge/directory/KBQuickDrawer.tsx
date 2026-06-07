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
import { PmsPropertySections } from "./PmsPropertySections";
import {
  fetchPmsHotelDetails,
  hasKbOverviewContent,
  pmsAmenitiesSections,
  pmsCitySections,
  pmsField,
  pmsHasAnyDetails,
  pmsOverviewSections,
} from "@/lib/pmsHotelDetails";

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

function hasKbRooms(content: IPropertyDirectoryContent | null | undefined): boolean {
  return (content?.rooms?.length ?? 0) > 0;
}

function hasKbAmenities(content: IPropertyDirectoryContent | null | undefined): boolean {
  if (!content?.amenities) return false;
  const am = content.amenities;
  const groups = [
    am.room,
    am.hotel,
    am.safety,
    am.safetySecurity,
    am.property,
    am.propertyAmenities,
  ];
  return groups.some((g) => (g?.length ?? 0) > 0);
}

function hasKbCity(content: IPropertyDirectoryContent | null | undefined): boolean {
  if (!content) return false;
  const ci = content.cityInfo;
  const cg = content.cityGuide;
  const lists = [
    ci?.restaurants,
    ci?.shopping,
    ci?.nightlife,
    ci?.attractions,
    ci?.importantPlaces,
    ci?.streetFood,
    cg?.restaurants,
    cg?.shopping,
    cg?.nightlife,
    cg?.attractions,
    cg?.importantPlaces,
    cg?.streetFood,
  ];
  return lists.some((l) => (l?.length ?? 0) > 0);
}

function tierLabel(
  tier: string | undefined,
  entry?: HotelDirectoryEntry | null
): string {
  if (entry?.directoryTierLabel) return entry.directoryTierLabel;
  if (entry?.tier === "LUXURIA") return "Luxuria";
  if (entry?.tier === "SELECT") return "Select";
  if (entry?.tier === "HOSTEL") return "Hostel";
  if (tier === "LUXURIA") return "Luxuria";
  if (tier === "SELECT") return "Select";
  if (tier === "HOSTEL") return "Hostel";
  return entry?.tier || tier || "—";
}

export function KBQuickDrawer({
  propertyId,
  isOpen,
  onClose,
  defaultTab = "overview",
}: KBQuickDrawerProps) {
  const [cache, setCache] = useState<HotelDirectoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pmsDetails, setPmsDetails] = useState<Record<string, unknown> | null>(null);
  const [pmsTier, setPmsTier] = useState<string | undefined>();
  const [pmsLoading, setPmsLoading] = useState(false);
  const [pmsError, setPmsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    setPmsDetails(null);
    setPmsTier(undefined);
    setPmsError(null);
  }, [isOpen, propertyId]);

  const entry = useMemo(
    () => cache?.find((e) => e.propertyId === propertyId) ?? null,
    [cache, propertyId]
  );

  const content = entry?.content ?? null;
  const kbOverview = hasKbOverviewContent(content);

  useEffect(() => {
    if (!isOpen || loading || cache === null) return;
    if (kbOverview && hasKbRooms(content) && hasKbAmenities(content) && hasKbCity(content)) {
      return;
    }
    let cancelled = false;
    setPmsLoading(true);
    setPmsError(null);
    void fetchPmsHotelDetails(propertyId)
      .then((j) => {
        if (cancelled) return;
        const details =
          j.details && typeof j.details === "object" ? j.details : {};
        setPmsDetails(details);
        if (j.tier) setPmsTier(j.tier);
        if (j.error) setPmsError(j.error);
      })
      .catch(() => {
        if (!cancelled) {
          setPmsDetails({});
          setPmsError("Could not load hotel details from PMS.");
        }
      })
      .finally(() => {
        if (!cancelled) setPmsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, loading, cache, propertyId, kbOverview, content]);

  const usingPms =
    !kbOverview ||
    !hasKbRooms(content) ||
    !hasKbAmenities(content) ||
    !hasKbCity(content);
  const showPmsBadge = usingPms && pmsHasAnyDetails(pmsDetails);

  const tierBadge = tierLabel(pmsTier, entry);
  const propertyTitle =
    entry?.propertyName?.trim() ||
    pmsField(pmsDetails, "Hotel_Name") ||
    "Property";

  const highlights = (content?.buildingHighlights ?? []).filter(Boolean);
  const pmsPhone =
    pmsField(pmsDetails, "Phone") || pmsField(pmsDetails, "Reservation_Phone");
  const pmsEmail = pmsField(pmsDetails, "Email");
  const pmsWebsite = pmsField(pmsDetails, "Website");
  const pmsAddress = [
    pmsField(pmsDetails, "Address"),
    pmsField(pmsDetails, "City"),
    pmsField(pmsDetails, "State"),
    pmsField(pmsDetails, "Zipcode"),
    pmsField(pmsDetails, "Country"),
  ]
    .filter(Boolean)
    .join(", ");

  const tabDefault =
    defaultTab === "overview"
      ? "overview"
      : defaultTab === "rooms"
        ? "rooms"
        : defaultTab === "amenities"
          ? "amenities"
          : "city";

  const overviewEmpty =
    !phoneFromContent(content) &&
    !emailFromContent(content) &&
    !content?.address &&
    highlights.length === 0 &&
    !pmsPhone &&
    !pmsEmail &&
    !pmsAddress &&
    pmsOverviewSections(pmsDetails ?? {}).length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        overlayClassName="z-[200]"
        className="z-[210] w-full sm:max-w-[420px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left space-y-1">
          <SheetTitle className="text-base font-semibold leading-tight pr-8">
            {propertyTitle}
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
            {showPmsBadge ? (
              <Badge variant="secondary" className="text-[11px] rounded-sm">
                From PMS
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {loading && !entry && !pmsDetails ? (
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
                {pmsLoading && !pmsDetails && !kbOverview ? (
                  <p className="text-sm text-muted-foreground mb-4">
                    Loading from PMS…
                  </p>
                ) : null}
                {pmsError && !pmsHasAnyDetails(pmsDetails) && !kbOverview ? (
                  <p className="text-sm text-muted-foreground mb-4">{pmsError}</p>
                ) : null}

                <TabsContent value="overview" className="mt-0 space-y-4">
                  {kbOverview ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="space-y-2 text-sm">
                        {pmsPhone ? (
                          <p>
                            <span className="text-muted-foreground">📞 </span>
                            {pmsPhone}
                          </p>
                        ) : null}
                        {pmsEmail ? (
                          <p className="break-all">
                            <span className="text-muted-foreground">✉ </span>
                            {pmsEmail}
                          </p>
                        ) : null}
                        {pmsWebsite ? (
                          <p className="break-all">
                            <span className="text-muted-foreground">🌐 </span>
                            <a
                              href={pmsWebsite.startsWith("http") ? pmsWebsite : `https://${pmsWebsite}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline"
                            >
                              {pmsWebsite}
                            </a>
                          </p>
                        ) : null}
                        {pmsAddress ? (
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            {pmsAddress}
                          </p>
                        ) : null}
                      </div>
                      <PmsPropertySections sections={pmsOverviewSections(pmsDetails ?? {})} />
                    </>
                  )}
                  {overviewEmpty ? (
                    <p className="text-sm text-muted-foreground">
                      No directory details yet for this property.
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="rooms" className="mt-0">
                  {hasKbRooms(content) ? (
                    <DirectoryDetailPanel content={content} tabOnly="rooms" />
                  ) : pmsField(pmsDetails, "Hotel_Description") ? (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        From PMS
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Room types are available when booking or sending a quotation.
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {pmsField(pmsDetails, "Hotel_Description")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No room details available.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="amenities" className="mt-0">
                  {hasKbAmenities(content) ? (
                    <DirectoryDetailPanel content={content} tabOnly="amenities" />
                  ) : (
                    <PmsPropertySections
                      sections={pmsAmenitiesSections(pmsDetails ?? {})}
                    />
                  )}
                </TabsContent>

                <TabsContent value="city" className="mt-0">
                  {hasKbCity(content) ? (
                    <DirectoryDetailPanel content={content} tabOnly="city" />
                  ) : (
                    <PmsPropertySections sections={pmsCitySections(pmsDetails ?? {})} />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
