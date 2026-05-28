import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CRM_PATHS } from "@/navigation/crmPaths";
import {
  fetchKnowledgeHub,
  searchKnowledgeHub,
  type HubPropertyItem,
  type KnowledgeSearchResult,
} from "@/services/knowledgeBase";
import { cn } from "@/lib/utils";

interface KnowledgeHubLandingProps {
  onSelectProperty: (propertyId: string, sectionHash?: string) => void;
  canManage?: boolean;
}

export function KnowledgeHubLanding({ onSelectProperty, canManage }: KnowledgeHubLandingProps) {
  const [hubItems, setHubItems] = useState<HubPropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const loadHub = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchKnowledgeHub();
      setHubItems(items);
    } catch {
      setHubItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void searchKnowledgeHub(q)
        .then((res) => {
          setSearchResults(res);
          setSearchOpen(true);
        })
        .catch(() => setSearchResults({ properties: [], matches: [] }))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pickResult = (propertyId: string, sectionId?: string) => {
    setSearchOpen(false);
    setQuery("");
    onSelectProperty(propertyId, sectionId ? `kb-${sectionId}` : undefined);
  };

  const showDropdown = searchOpen && query.trim().length >= 2;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse property guides, search across hotels, and open detailed factsheets
        </p>
      </div>

      <div ref={containerRef} className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search hotels, amenities, rates, policies…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setSearchOpen(true);
          }}
          onFocus={() => query.trim().length >= 2 && setSearchOpen(true)}
          className="h-12 pl-12 text-base"
        />
        {showDropdown && (
          <Card className="absolute z-50 mt-2 w-full max-h-80 overflow-y-auto border shadow-lg">
            {searching ? (
              <p className="p-4 text-sm text-muted-foreground">Searching…</p>
            ) : (
              <>
                {searchResults?.properties && searchResults.properties.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                      Properties
                    </p>
                    {searchResults.properties.map((p) => (
                      <button
                        key={`${p.propertyId}-${p.sectionId || "main"}`}
                        type="button"
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted"
                        onClick={() => pickResult(p.propertyId, p.sectionId)}
                      >
                        <span className="text-sm font-medium">{p.propertyName}</span>
                        {p.city && (
                          <span className="text-xs text-muted-foreground">{p.city}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults?.matches && searchResults.matches.length > 0 && (
                  <div className="border-t p-2">
                    <p className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                      In guide
                    </p>
                    {searchResults.matches.map((m, i) => (
                      <button
                        key={`${m.propertyId}-${m.sectionId}-${i}`}
                        type="button"
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted"
                        onClick={() => pickResult(m.propertyId, m.sectionId)}
                      >
                        <span className="text-sm font-medium">
                          {m.propertyName} · {m.label}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {m.snippet}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!searching &&
                  !searchResults?.properties?.length &&
                  !searchResults?.matches?.length && (
                    <p className="p-4 text-sm text-muted-foreground">No results</p>
                  )}
              </>
            )}
          </Card>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading properties…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {hubItems.map((item) => (
            <button
              key={item.propertyId}
              type="button"
              onClick={() => onSelectProperty(item.propertyId)}
              className="group text-left"
            >
              <Card
                className={cn(
                  "overflow-hidden border transition-shadow hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <div className="aspect-video relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Building2 className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  {!item.hasGuide && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 text-[10px]"
                    >
                      No guide yet
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  {(item.city || item.state) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[item.city, item.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {canManage && (
        <p className="text-sm text-muted-foreground">
          Admin:{" "}
          <Link to={CRM_PATHS.setupPropertyGuide} className="text-primary hover:underline">
            Edit property guides
          </Link>
        </p>
      )}
    </div>
  );
}
