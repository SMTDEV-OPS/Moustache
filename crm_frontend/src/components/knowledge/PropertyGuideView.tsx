import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowUp,
  Wifi,
  Car,
  Utensils,
  Dumbbell,
  Waves,
  Sparkles,
  X,
} from "lucide-react";
import {
  fetchPropertyKnowledgeBundle,
  fetchPublicPropertyKnowledgeBundle,
  type MergedPropertyKnowledge,
} from "@/lib/propertyKnowledge";
import {
  KnowledgeContactCards,
  KnowledgeDriveCard,
  KnowledgeProse,
  KnowledgeRateTable,
  KnowledgeList,
} from "./KnowledgeContentBlocks";
import { PropertyGuideShareBar } from "./PropertyGuideShareBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "contact", label: "Contact" },
  { id: "rooms", label: "Rooms & rates" },
  { id: "amenities", label: "Amenities" },
  { id: "experiences", label: "Experiences" },
  { id: "story", label: "Selling story" },
  { id: "photos", label: "Photos" },
  { id: "policies", label: "Policies" },
] as const;

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  wifi: Wifi,
  parking: Car,
  restaurant: Utensils,
  gym: Dumbbell,
  pool: Waves,
  spa: Sparkles,
};

function amenityIcon(name: string) {
  const key = name.toLowerCase();
  for (const [k, Icon] of Object.entries(AMENITY_ICONS)) {
    if (key.includes(k)) return Icon;
  }
  return Sparkles;
}

function guideHasContent(d: MergedPropertyKnowledge): boolean {
  return !!(
    d.contact.phone ||
    d.contact.email ||
    d.contact.website ||
    d.roomCategories ||
    d.rates.length ||
    d.amenities.length ||
    d.facilities.length ||
    d.attractions ||
    d.tours ||
    d.experienceNotes ||
    d.speciality ||
    d.marketingPitch ||
    d.policies.length ||
    d.galleryUrls.length ||
    d.mediaLinks.photosDriveUrl
  );
}

interface PropertyGuideViewProps {
  propertyId?: string;
  propertyName?: string;
  propertyCode?: string;
  shareToken?: string;
  searchQuery?: string;
  canManage?: boolean;
  mode?: "crm" | "public";
}

export function PropertyGuideView({
  propertyId,
  propertyName: propertyNameProp,
  propertyCode: propertyCodeProp,
  shareToken,
  canManage = false,
  mode = "crm",
}: PropertyGuideViewProps) {
  const [data, setData] = useState<MergedPropertyKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const bundle =
        mode === "public" && shareToken
          ? await fetchPublicPropertyKnowledgeBundle(shareToken)
          : await fetchPropertyKnowledgeBundle(propertyId!, {
              name: propertyNameProp,
              code: propertyCodeProp,
            });
      setData(bundle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [propertyId, propertyNameProp, propertyCodeProp, shareToken, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const coverUrl = useMemo(
    () => data?.galleryUrls[0]?.url || data?.thumbnailUrl,
    [data]
  );

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading property guide…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-destructive mx-6">
        {error}
      </div>
    );
  }

  if (!data || !guideHasContent(data)) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center space-y-3 mx-6">
        <p className="text-muted-foreground">No property guide yet for this hotel.</p>
        {canManage && mode === "crm" && (
          <Button variant="outline" size="sm" asChild>
            <Link to={CRM_PATHS.setupPropertyGuide}>Edit property guide</Link>
          </Button>
        )}
      </div>
    );
  }

  const d = data;
  const locationLabel =
    d.location || [d.city, d.state].filter(Boolean).join(", ") || undefined;

  return (
    <div ref={printRef} className="pb-16">
      <div className="relative h-56 md:h-72 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
          <p className="text-xs font-medium uppercase tracking-widest opacity-80 mb-1">
            Property guide
          </p>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {d.propertyName}
          </h2>
          {locationLabel && <p className="mt-1 opacity-90">{locationLabel}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {d.propertyType && (
              <Badge className="bg-white/20 text-white border-0">{d.propertyType}</Badge>
            )}
            {d.propertyCode && (
              <Badge variant="outline" className="font-mono text-xs border-white/40 text-white">
                {d.propertyCode}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {d.galleryUrls.length > 1 && (
        <div className="no-print flex gap-2 overflow-x-auto px-4 py-3 border-b border-border bg-muted/20">
          {d.galleryUrls.map((g) => (
            <button
              key={g.fileId}
              type="button"
              onClick={() => setLightboxUrl(g.url)}
              className="shrink-0 h-16 w-24 rounded-md overflow-hidden border border-border focus:ring-2 ring-ring"
            >
              <img src={g.url} alt={g.caption || ""} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {mode === "crm" && (
        <PropertyGuideShareBar
          guideId={d.guideId}
          propertyName={d.propertyName}
          shareToken={d.shareToken}
          shareEnabled={d.shareEnabled}
          printRootRef={printRef}
          canManage={canManage}
        />
      )}

      <nav className="no-print sticky top-12 z-10 flex gap-1 overflow-x-auto border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#kb-${s.id}`}
            className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-10 px-6 py-8 max-w-5xl mx-auto">
        {d.lastUpdated && (
          <p className="text-xs text-muted-foreground -mb-4">
            Last updated {format(new Date(d.lastUpdated), "d MMM yyyy")}
          </p>
        )}

        <Section id="contact" title="Contact">
          <KnowledgeContactCards {...d.contact} />
        </Section>

        <Section id="rooms" title="Rooms & rack rates">
          {d.roomCategories && (
            <KnowledgeProse text={d.roomCategories} className="mb-4 text-muted-foreground" />
          )}
          <KnowledgeRateTable rates={d.rates} />
        </Section>

        <Section id="amenities" title="Amenities & facilities">
          {d.amenities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3">Amenities</h4>
              <div className="flex flex-wrap gap-2">
                {d.amenities.map((a, i) => {
                  const Icon = amenityIcon(a);
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {a}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {d.facilities.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Facilities</h4>
              <KnowledgeList items={d.facilities} />
            </div>
          )}
        </Section>

        <Section id="experiences" title="Experiences & location">
          <div className="grid gap-6 lg:grid-cols-2">
            {d.attractions && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Nearby attractions</CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeProse text={d.attractions} />
                </CardContent>
              </Card>
            )}
            {d.tours && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Special tours</CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeProse text={d.tours} />
                </CardContent>
              </Card>
            )}
          </div>
          {d.experienceNotes && (
            <div className="mt-4">
              <KnowledgeProse text={d.experienceNotes} />
            </div>
          )}
        </Section>

        <Section id="story" title="Selling story">
          <div className="grid gap-4 lg:grid-cols-2">
            {d.speciality && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Speciality</CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeProse text={d.speciality} />
                </CardContent>
              </Card>
            )}
            {d.marketingPitch && (
              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Marketing pitch</CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeProse text={d.marketingPitch} />
                </CardContent>
              </Card>
            )}
          </div>
        </Section>

        <Section id="photos" title="Photos">
          {d.galleryUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {d.galleryUrls.map((g) => (
                <button
                  key={g.fileId}
                  type="button"
                  className="aspect-video rounded-lg overflow-hidden border border-border"
                  onClick={() => setLightboxUrl(g.url)}
                >
                  <img src={g.url} alt={g.caption || ""} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : d.mediaLinks.photosDriveUrl ? (
            <KnowledgeDriveCard url={d.mediaLinks.photosDriveUrl} />
          ) : (
            <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
          )}
        </Section>

        <Section id="policies" title="Policies & training">
          {d.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policies on file.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {d.policies.map((p, i) => (
                <AccordionItem key={i} value={`policy-${i}`}>
                  <AccordionTrigger className="text-sm font-medium">
                    {p.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <KnowledgeProse text={p.body} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Section>
      </div>

      {showScrollTop && mode === "crm" && (
        <Button
          type="button"
          size="icon"
          className="no-print fixed bottom-6 right-6 z-30 h-11 w-11 rounded-full shadow-lg"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`kb-${id}`} className="scroll-mt-28">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </section>
  );
}
