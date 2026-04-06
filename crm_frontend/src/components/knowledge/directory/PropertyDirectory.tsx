import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getHotelDirectory,
  searchHotelDirectory,
  type HotelDirectoryEntry,
  type DirectorySearchHit,
} from "@/services/knowledgeBase";
import { PERMISSIONS } from "@/constants/permissions";
import { toast } from "sonner";
import { Search, Pencil, ChevronRight } from "lucide-react";
import { DirectoryDetailPanel } from "./DirectoryDetailPanel";
import { PropertyCompareModal } from "./PropertyCompareModal";
import { PropertyDirectoryEditor } from "./PropertyDirectoryEditor";
import { ExcelImportButton } from "./ExcelImportButton";

type TierFilter = "ALL" | "HOSTEL" | "SELECT" | "LUXURIA" | "COWORK";

interface PropertyDirectoryProps {
  isAdmin?: boolean;
  permissions?: string[];
}

export function PropertyDirectory({
  isAdmin,
  permissions = [],
}: PropertyDirectoryProps) {
  const canManage =
    !!isAdmin || permissions.includes(PERMISSIONS.KNOWLEDGE_BASE.MANAGE);

  const [entries, setEntries] = useState<HotelDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [deepResults, setDeepResults] = useState<DirectorySearchHit[]>([]);
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");
  const [regionFilter, setRegionFilter] = useState<string | "ALL">("ALL");
  const [detailEntry, setDetailEntry] = useState<HotelDirectoryEntry | null>(null);
  const [editEntry, setEditEntry] = useState<HotelDirectoryEntry | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHotelDirectory();
      setEntries(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load hotel directory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedQ.length < 2) {
      setDeepResults([]);
      return;
    }
    let cancelled = false;
    void searchHotelDirectory(debouncedQ)
      .then((r) => {
        if (!cancelled) setDeepResults(r);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          toast.error("Directory search failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) s.add(e.region);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const clientFiltered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return entries.filter((e) => {
      if (tierFilter === "COWORK") {
        if (e.directoryTierLabel?.toLowerCase() !== "cowork") return false;
      } else if (tierFilter !== "ALL" && e.tier !== tierFilter) {
        return false;
      }
      if (regionFilter !== "ALL" && e.region !== regionFilter) return false;
      if (!q) return true;
      return (
        e.propertyName.toLowerCase().includes(q) ||
        e.propertyCode.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q)
      );
    });
  }, [entries, searchInput, tierFilter, regionFilter]);

  const visibleEntries = useMemo(() => {
    const byId = new Map<string, HotelDirectoryEntry>();
    for (const e of clientFiltered) byId.set(e.propertyId, e);
    if (debouncedQ.length >= 2) {
      for (const hit of deepResults) {
        if (!byId.has(hit.propertyId)) {
          const full = entries.find((x) => x.propertyId === hit.propertyId);
          if (full) byId.set(hit.propertyId, full);
        }
      }
    }
    return Array.from(byId.values());
  }, [clientFiltered, deepResults, debouncedQ, entries]);

  const reasonsById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const h of deepResults) m.set(h.propertyId, h.matchReasons);
    return m;
  }, [deepResults]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.message("You can compare up to 3 properties");
        return prev;
      }
      return [...prev, id];
    });
  };

  const compareEntries = useMemo(
    () =>
      compareIds
        .map((id) => entries.find((e) => e.propertyId === id))
        .filter((e): e is HotelDirectoryEntry => !!e),
    [compareIds, entries]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading directory…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Hotel Directory
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Browse structured property cards, search amenities and rooms, compare
            hotels.
          </p>
        </div>
        <ExcelImportButton canManage={canManage} onImported={() => void load()} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="rounded-sm border border-border lg:w-56 shrink-0">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-sm font-medium">Region</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1 max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => setRegionFilter("ALL")}
              className={`w-full text-left text-sm px-3 py-2 rounded-sm transition-colors ${
                regionFilter === "ALL"
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted"
              }`}
            >
              All regions
            </button>
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegionFilter(r)}
                className={`w-full text-left text-sm px-3 py-2 rounded-sm transition-colors ${
                  regionFilter === r
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, code, region — deep content search after 300ms…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 rounded-sm h-11"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", "HOSTEL", "SELECT", "LUXURIA", "COWORK"] as const).map(
              (t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tierFilter === t ? "default" : "outline"}
                  size="sm"
                  className="rounded-sm text-xs"
                  onClick={() => setTierFilter(t)}
                >
                  {t === "ALL" ? "All tiers" : t === "COWORK" ? "Cowork" : t}
                </Button>
              )
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleEntries.map((e) => {
              const reasons = reasonsById.get(e.propertyId);
              const highlights = e.content?.buildingHighlights?.slice(0, 2) ?? [];
              return (
                <Card
                  key={e.propertyId}
                  className="rounded-sm border border-border shadow-sm flex flex-col"
                >
                  <CardHeader className="pb-2 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold leading-tight">
                          {e.propertyName}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          {e.propertyCode}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 cursor-pointer">
                        <Checkbox
                          checked={compareIds.includes(e.propertyId)}
                          onCheckedChange={() => toggleCompare(e.propertyId)}
                        />
                        Compare
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="rounded-sm text-xs">
                        {e.directoryTierLabel || e.tier}
                      </Badge>
                      <Badge variant="secondary" className="rounded-sm text-xs">
                        {e.region}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                    {highlights.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                        {highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    )}
                    {reasons && reasons.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Why matched
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {reasons.slice(0, 4).map((r) => (
                            <Badge
                              key={r}
                              variant="secondary"
                              className="font-normal text-[11px] rounded-sm max-w-full whitespace-normal text-left h-auto py-1"
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-sm text-xs"
                        onClick={() => setDetailEntry(e)}
                      >
                        View details
                      </Button>
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-sm text-xs"
                          onClick={() => setEditEntry(e)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {visibleEntries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No properties match your filters.
            </p>
          )}
        </div>
      </div>

      {compareIds.length >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 flex items-center justify-center gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-muted-foreground">
            {compareIds.length} properties selected
          </p>
          <Button
            className="rounded-sm"
            onClick={() => setCompareOpen(true)}
          >
            Compare {compareIds.length} properties
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-sm text-muted-foreground"
            onClick={() => setCompareIds([])}
          >
            Clear
          </Button>
        </div>
      )}

      <Dialog open={!!detailEntry} onOpenChange={(o) => !o && setDetailEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-sm border border-border">
          <DialogHeader>
            <DialogTitle>{detailEntry?.propertyName}</DialogTitle>
            {detailEntry ? (
              <p className="text-sm text-muted-foreground">
                {detailEntry.propertyCode} · {detailEntry.tier} · {detailEntry.region}
              </p>
            ) : null}
          </DialogHeader>
          {detailEntry ? (
            <DirectoryDetailPanel content={detailEntry.content} />
          ) : null}
        </DialogContent>
      </Dialog>

      <PropertyCompareModal
        open={compareOpen}
        onOpenChange={setCompareOpen}
        entries={compareEntries}
      />

      <PropertyDirectoryEditor
        open={!!editEntry}
        onOpenChange={(o) => !o && setEditEntry(null)}
        entry={editEntry}
        onSaved={() => void load()}
      />
    </div>
  );
}
