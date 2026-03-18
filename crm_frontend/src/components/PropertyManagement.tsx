import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  getProperty,
  listProperties,
  listPropertyReservations,
  syncPropertyPms,
  updateProperty,
  type Property,
  type Reservation,
  type ReservationStatus,
  type UpdatePropertyInput,
} from "@/services/properties";

type ReservationTab = "ALL" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
type DateRangePreset = "LAST_30" | "NEXT_30" | "THIS_MONTH" | "CUSTOM";

function toYmd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatDateShort(isoOrDate: string | Date): { top: string; year: string } {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const top = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(d);
  return { top, year: String(d.getFullYear()) };
}

const inr = new Intl.NumberFormat("en-IN");

function formatMoney(amount?: number): string {
  if (!amount) return "—";
  return `₹${inr.format(Math.round(amount))}`;
}

function formatMoneyCompact(amount?: number): string {
  if (!amount) return "₹0";
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${inr.format(Math.round(amount))}`;
}

function hoursSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function relativeAgo(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getGuest(res: Reservation): { name: string; phone?: string } {
  const g = res.guestId as any;
  if (!g) return { name: "Guest" };
  if (typeof g === "string") return { name: "Guest" };
  return { name: g.name || "Guest", phone: g.phone };
}

function getLeadId(res: Reservation): string | null {
  const l = res.leadId as any;
  if (!l) return null;
  if (typeof l === "string") return l;
  return l._id || null;
}

function pmsDotColor(property: Property): string {
  if (property.pmsProvider !== "EZEE") return "#e5e7eb";
  const h = hoursSince(property.lastSyncedAt);
  if (h === null) return "#e5e7eb";
  if (h < 1) return "#22c55e";
  return "#f59e0b";
}

function statusBadgeStyle(status: ReservationStatus): { bg: string; text: string } {
  if (status === "CONFIRMED") return { bg: "#d1fae5", text: "#065f46" };
  if (status === "CHECKED_IN") return { bg: "#dbeafe", text: "#1e40af" };
  if (status === "CHECKED_OUT") return { bg: "#f3f4f6", text: "#374151" };
  if (status === "CANCELLED") return { bg: "#fef2f2", text: "#ef4444" };
  return { bg: "#f3f4f6", text: "#374151" };
}

function sourceBadgeStyle(source: "PMS" | "MANUAL"): { bg: string; text: string; label: string } {
  if (source === "PMS") return { bg: "#ede9fe", text: "#5b21b6", label: "PMS" };
  return { bg: "#f3f4f6", text: "#374151", label: "Manual" };
}

function isPmsReservation(res: Reservation): boolean {
  return !!res.pmsReservationId;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const PropertyManagement = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const [property, setProperty] = useState<Property | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);

  const [datePreset, setDatePreset] = useState<DateRangePreset>("NEXT_30");
  const [customFrom, setCustomFrom] = useState<string>(toYmd(addDays(new Date(), -30)));
  const [customTo, setCustomTo] = useState<string>(toYmd(addDays(new Date(), 30)));

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);

  const [statusTab, setStatusTab] = useState<ReservationTab>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const [showAuthKey, setShowAuthKey] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<UpdatePropertyInput>({
    name: "",
    location: { city: "" },
    status: "ACTIVE",
    pmsProvider: "NONE",
    pmsConfig: { hotelCode: "", authCode: "" },
  });

  const activeRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "LAST_30") return { from: toYmd(addDays(now, -30)), to: toYmd(now) };
    if (datePreset === "NEXT_30") return { from: toYmd(addDays(now, -30)), to: toYmd(addDays(now, 30)) };
    if (datePreset === "THIS_MONTH") return { from: toYmd(startOfMonth(now)), to: toYmd(endOfMonth(now)) };
    return { from: customFrom, to: customTo };
  }, [datePreset, customFrom, customTo]);

  const loadProperties = async () => {
    try {
      setIsLoadingProperties(true);
      setPropertiesError(null);
      const data = await listProperties();
      setProperties(data || []);
      if (!data?.length) {
        setSelectedPropertyId(null);
        setProperty(null);
        setReservations([]);
        return;
      }

      const hasSelected =
        !!selectedPropertyId && data.some((p) => p._id === selectedPropertyId);
      if (!hasSelected) setSelectedPropertyId(data[0]._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load properties";
      setPropertiesError(message);
      toast.error(message);
    } finally {
      setIsLoadingProperties(false);
    }
  };

  const loadSelectedProperty = async (id: string): Promise<Property | null> => {
    try {
      setIsLoadingProperty(true);
      const p = await getProperty(id);
      setProperty(p);
      return p;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load property";
      toast.error(message);
      setProperty(null);
      return null;
    } finally {
      setIsLoadingProperty(false);
    }
  };

  const loadReservations = async (id: string) => {
    try {
      setIsLoadingReservations(true);
      const data = await listPropertyReservations(id, { from: activeRange.from, to: activeRange.to });
      setReservations(data || []);
      setExpanded({});
      setPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load reservations";
      toast.error(message);
      setReservations([]);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  useEffect(() => {
    void loadProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) return;
    (async () => {
      const p = await loadSelectedProperty(selectedPropertyId);
      if (!p) return;
      await loadReservations(selectedPropertyId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    void loadReservations(selectedPropertyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRange.from, activeRange.to]);

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => {
      const city = p.location?.city?.toLowerCase() || "";
      return p.name.toLowerCase().includes(q) || city.includes(q) || p.code.toLowerCase().includes(q);
    });
  }, [properties, searchQuery]);

  const statusFiltered = useMemo(() => {
    if (statusTab === "ALL") return reservations;
    return reservations.filter((r) => r.status === statusTab);
  }, [reservations, statusTab]);

  const pageCount = Math.max(1, Math.ceil(statusFiltered.length / pageSize));
  const currentPage = clamp(page, 1, pageCount);
  const pageRows = statusFiltered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const kpis = useMemo(() => {
    const now = new Date();
    const next7 = addDays(now, 7).getTime();
    const start = startOfMonth(now).getTime();
    const end = endOfMonth(now).getTime();

    let upcoming = 0;
    let activeGuests = 0;
    let monthRevenue = 0;

    for (const r of reservations) {
      const checkIn = new Date(r.checkInDate).getTime();
      if (r.status === "CONFIRMED" && checkIn >= now.getTime() && checkIn <= next7) upcoming++;
      if (r.status === "CHECKED_IN") activeGuests++;
      if (r.status !== "CANCELLED" && checkIn >= start && checkIn <= end) monthRevenue += r.totalAmount || 0;
    }

    return {
      upcoming,
      activeGuests,
      monthRevenue,
    };
  }, [reservations]);

  const revenueBars = useMemo(() => {
    const now = new Date();
    const months: Array<{ key: string; label: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d);
      months.push({ key, label, total: 0 });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const r of reservations) {
      const d = new Date(r.checkInDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) continue;
      if (r.status === "CANCELLED") continue;
      bucket.total += r.totalAmount || 0;
    }
    const max = Math.max(1, ...months.map((m) => m.total));
    return months.map((m) => ({
      ...m,
      heightPx: (m.total / max) * 100,
    }));
  }, [reservations]);

  const syncBadge = useMemo(() => {
    if (!property?.lastSyncedAt) return { label: "Never synced", ok: false, ago: null as string | null };
    return { label: "Synced", ok: true, ago: relativeAgo(property.lastSyncedAt) };
  }, [property?.lastSyncedAt]);

  const onSyncNow = async () => {
    if (!selectedPropertyId) return;
    try {
      setIsSyncing(true);
      await syncPropertyPms(selectedPropertyId);
      await Promise.all([loadSelectedProperty(selectedPropertyId), loadReservations(selectedPropertyId), loadProperties()]);
      toast.success("Sync started and data refreshed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sync PMS";
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const openEdit = () => {
    if (!property) return;
    setEditForm({
      name: property.name || "",
      location: { city: property.location?.city || "" },
      status: property.status || "ACTIVE",
      pmsProvider: property.pmsProvider || "NONE",
      pmsConfig: {
        hotelCode: property.pmsConfig?.hotelCode || "",
        authCode: property.pmsConfig?.authCode || "",
      },
    });
    setShowAuthKey(false);
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    if (!property) return;
    try {
      setIsSaving(true);
      const payload: UpdatePropertyInput = {
        name: editForm.name?.trim() || undefined,
        location: editForm.location?.city?.trim() ? { city: editForm.location.city.trim() } : undefined,
        status: editForm.status,
        pmsProvider: editForm.pmsProvider,
        pmsConfig: editForm.pmsProvider === "EZEE" ? editForm.pmsConfig : undefined,
      };
      await updateProperty(property._id, payload);
      toast.success("Property updated");
      setIsEditOpen(false);
      await Promise.all([loadSelectedProperty(property._id), loadProperties()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save property";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full" style={{ padding: 24 }}>
      <PageHeader title="Properties" subtitle="Manage hotel properties and PMS sync status" />

      {propertiesError && (
        <div
          className="mb-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            color: "var(--text)",
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{propertiesError}</div>
          <div style={{ marginTop: 8 }}>
            <Button variant="outline" size="sm" onClick={loadProperties}>
              Retry
            </Button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 0,
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--surface)",
          minHeight: 600,
        }}
      >
        {/* Left: property list */}
        <div
          style={{
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.5}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search properties..."
                className="pl-8"
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoadingProperties ? (
              <div className="flex items-center justify-center" style={{ padding: 20 }}>
                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading properties…
                </div>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No properties found.</div>
            ) : (
              filteredProperties.map((p) => {
                const active = p._id === selectedPropertyId;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setSelectedPropertyId(p._id)}
                    className="w-full text-left"
                    style={{
                      height: 52,
                      padding: "8px 16px",
                      borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer",
                      background: active ? "#f0f0ff" : "transparent",
                      borderLeft: active ? "2px solid #4f46e5" : "2px solid transparent",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget.style.background = "#f9fafb");
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget.style.background = "transparent");
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", lineHeight: 1.1 }}>
                        {p.name}
                      </div>
                      <div
                        aria-label="PMS sync status"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: pmsDotColor(p),
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {p.location?.city || "—"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: dashboard */}
        <div style={{ minHeight: 0, overflowY: "auto" }}>
          {!selectedPropertyId ? (
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Select a property.</div>
          ) : isLoadingProperty && !property ? (
            <div className="flex items-center justify-center" style={{ padding: 24 }}>
              <div className="flex items-center gap-2" style={{ color: "var(--text-muted)", fontSize: 13 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading dashboard…
              </div>
            </div>
          ) : (
            <>
              {/* Header strip */}
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  background: "var(--surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
                      {property?.name || "Property"}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{property?.location?.city || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {syncBadge.ok ? (
                      <CheckCircle size={14} strokeWidth={1.5} style={{ color: "#22c55e" }} />
                    ) : (
                      <AlertCircle size={14} strokeWidth={1.5} style={{ color: "#f59e0b" }} />
                    )}
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {syncBadge.ok ? `${syncBadge.label}${syncBadge.ago ? ` ${syncBadge.ago}` : ""}` : syncBadge.label}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={onSyncNow} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync Now
                  </Button>
                </div>
              </div>

              {/* KPI strip */}
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "var(--surface)" }}>
                {[
                  { value: String(kpis.upcoming), label: "Upcoming Check-ins" },
                  { value: String(kpis.activeGuests), label: "Active Guests" },
                  { value: formatMoney(kpis.monthRevenue), label: "This Month Revenue" },
                  { value: "—", label: "Occupancy Rate" },
                ].map((s, idx, arr) => (
                  <div
                    key={s.label}
                    style={{
                      flex: 1,
                      padding: 16,
                      borderRight: idx === arr.length - 1 ? "none" : "1px solid #f3f4f6",
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
                {/* Reservations + chart */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Reservations</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Select value={datePreset} onValueChange={(v: DateRangePreset) => setDatePreset(v)}>
                        <SelectTrigger className="h-9 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LAST_30">Last 30 days</SelectItem>
                          <SelectItem value="NEXT_30">Next 30 days</SelectItem>
                          <SelectItem value="THIS_MONTH">This month</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {datePreset === "CUSTOM" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <div style={{ flex: 1 }}>
                        <Label style={{ fontSize: 12, color: "var(--text-muted)" }}>From</Label>
                        <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <Label style={{ fontSize: 12, color: "var(--text-muted)" }}>To</Label>
                        <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* Filter tabs */}
                  <div style={{ display: "flex", gap: 18, marginTop: 12, borderBottom: "1px solid var(--border)" }}>
                    {(["ALL", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as ReservationTab[]).map((t) => {
                      const active = statusTab === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setStatusTab(t)}
                          style={{
                            padding: "10px 0",
                            fontSize: 13,
                            color: active ? "#4f46e5" : "var(--text-muted)",
                            borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
                            fontWeight: 500,
                          }}
                        >
                          {t === "ALL" ? "All" : t.replace("_", " ").replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>

                  {/* Table */}
                  <div
                    style={{
                      marginTop: 12,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ background: "var(--surface)" }}>
                          <tr style={{ borderBottom: "1px solid var(--border)" }}>
                            {["GUEST", "CHECK-IN", "CHECK-OUT", "ROOMS", "AMOUNT", "STATUS", "SOURCE"].map((h) => (
                              <th
                                key={h}
                                style={{
                                  textAlign: "left",
                                  fontSize: 11,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: "var(--text-faint)",
                                  padding: "10px 12px",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingReservations ? (
                            <tr>
                              <td colSpan={7} style={{ padding: 16 }}>
                                <div className="flex items-center gap-2" style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading reservations…
                                </div>
                              </td>
                            </tr>
                          ) : statusFiltered.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: 32, textAlign: "center" }}>
                                <div className="flex flex-col items-center" style={{ gap: 10, color: "#9ca3af" }}>
                                  <Calendar size={32} strokeWidth={1.5} />
                                  <div style={{ fontSize: 13 }}>No reservations in this period</div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            pageRows.map((r) => {
                              const guest = getGuest(r);
                              const leadId = getLeadId(r);
                              const checkIn = formatDateShort(r.checkInDate);
                              const checkOut = formatDateShort(r.checkOutDate);
                              const statusStyle = statusBadgeStyle(r.status);
                              const source = sourceBadgeStyle(isPmsReservation(r) ? "PMS" : "MANUAL");
                              const isOpen = !!expanded[r._id];
                              return (
                                <>
                                  <tr
                                    key={r._id}
                                    onClick={() => toggleExpanded(r._id)}
                                    style={{
                                      borderBottom: "1px solid var(--border-light)",
                                      cursor: "pointer",
                                    }}
                                    onMouseEnter={(e) => {
                                      (e.currentTarget.style.background = "#f9fafb");
                                    }}
                                    onMouseLeave={(e) => {
                                      (e.currentTarget.style.background = "transparent");
                                    }}
                                  >
                                    <td style={{ padding: "12px 12px" }}>
                                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                                        {guest.name}
                                      </div>
                                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                                        {guest.phone || "—"}
                                        {leadId && (
                                          <>
                                            {" "}
                                            <Link
                                              to={`/leads/${leadId}`}
                                              onClick={(e) => e.stopPropagation()}
                                              style={{
                                                marginLeft: 8,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                padding: "2px 8px",
                                                borderRadius: 6,
                                                background: "#f0f0ff",
                                                color: "#4f46e5",
                                                fontSize: 11,
                                                fontWeight: 500,
                                              }}
                                            >
                                              Lead
                                            </Link>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: "12px 12px" }}>
                                      <div style={{ fontSize: 13, color: "var(--text)" }}>{checkIn.top}</div>
                                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{checkIn.year}</div>
                                    </td>
                                    <td style={{ padding: "12px 12px" }}>
                                      <div style={{ fontSize: 13, color: "var(--text)" }}>{checkOut.top}</div>
                                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{checkOut.year}</div>
                                    </td>
                                    <td style={{ padding: "12px 12px", fontSize: 13, color: "#374151" }}>
                                      {r.roomsBooked ? `${r.roomsBooked}` : "—"}
                                    </td>
                                    <td style={{ padding: "12px 12px", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                                      {formatMoney(r.totalAmount)}
                                    </td>
                                    <td style={{ padding: "12px 12px" }}>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          padding: "2px 8px",
                                          borderRadius: 6,
                                          background: statusStyle.bg,
                                          color: statusStyle.text,
                                          fontSize: 12,
                                          fontWeight: 500,
                                        }}
                                      >
                                        {r.status.replace("_", " ").replace("_", " ")}
                                      </span>
                                    </td>
                                    <td style={{ padding: "12px 12px" }}>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          padding: "2px 8px",
                                          borderRadius: 6,
                                          background: source.bg,
                                          color: source.text,
                                          fontSize: 12,
                                          fontWeight: 500,
                                        }}
                                      >
                                        {source.label}
                                      </span>
                                    </td>
                                  </tr>
                                  {isOpen && (
                                    <tr key={`${r._id}-expanded`} style={{ background: "#f9fafb" }}>
                                      <td colSpan={7} style={{ padding: 12 }}>
                                        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                                          Reservation details
                                        </div>
                                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                            <div>
                                              <span style={{ color: "var(--text)" }}>Rate plan:</span> {r.ratePlan || "—"}
                                            </div>
                                            <div style={{ marginTop: 6 }}>
                                              <span style={{ color: "var(--text)" }}>PMS reservation:</span>{" "}
                                              {r.pmsReservationId || "—"}
                                            </div>
                                          </div>
                                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                            <div>
                                              <span style={{ color: "var(--text)" }}>Cancellation reason:</span>{" "}
                                              {r.cancellationReason || "—"}
                                            </div>
                                            <div style={{ marginTop: 6 }}>
                                              <span style={{ color: "var(--text)" }}>Amendments:</span>{" "}
                                              {r.amendmentHistory?.length ? r.amendmentHistory.length : "—"}
                                            </div>
                                          </div>
                                        </div>
                                        {r.amendmentHistory?.length ? (
                                          <div style={{ marginTop: 10 }}>
                                            <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 6 }}>
                                              AMENDMENT HISTORY
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                              {r.amendmentHistory.slice(-5).map((a, idx) => (
                                                <div
                                                  key={`${r._id}-am-${idx}`}
                                                  style={{
                                                    fontSize: 12,
                                                    color: "var(--text-muted)",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                  }}
                                                >
                                                  <div style={{ minWidth: 0 }}>
                                                    <span style={{ color: "var(--text)" }}>{a.field}</span>:{" "}
                                                    {String(a.oldValue)} → {String(a.newValue)}
                                                  </div>
                                                  <div style={{ flexShrink: 0 }}>{new Date(a.changedAt).toLocaleString()}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {statusFiltered.length > 0 && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          padding: "10px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Page {currentPage} of {pageCount}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                            Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= pageCount}
                            onClick={() => setPage(currentPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Revenue chart */}
                  <div
                    style={{
                      marginTop: 16,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Monthly Revenue</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 100, marginTop: 16 }}>
                      {revenueBars.map((b) => (
                        <div
                          key={b.key}
                          title={formatMoneyCompact(b.total)}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-end",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              height: Math.max(4, b.heightPx),
                              background: "#4f46e5",
                              borderRadius: "4px 4px 0 0",
                            }}
                          />
                          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>{b.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Property details */}
                <div>
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Property Details</div>

                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>PMS Provider</div>
                        <div style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                          {property?.pmsProvider === "EZEE" ? "Ezee" : "None"}
                          {property?.pmsProvider === "EZEE" && <Link2 size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Hotel Code</div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text)",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            background: "#f9fafb",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {property?.pmsConfig?.hotelCode || "—"}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Auth Key</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: "var(--text)",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              background: "#f9fafb",
                              padding: "2px 6px",
                              borderRadius: 4,
                              maxWidth: 160,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {showAuthKey ? property?.pmsConfig?.authCode || "—" : property?.pmsConfig?.authCode ? "••••••••" : "—"}
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowAuthKey((v) => !v)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: "var(--text-muted)",
                            }}
                          >
                            {showAuthKey ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                            {showAuthKey ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Last Synced</div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>
                          {property?.lastSyncedAt ? new Date(property.lastSyncedAt).toLocaleString() : "Never"}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Reservations</div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>{reservations.length}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <Button variant="outline" size="sm" onClick={openEdit}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Property
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit modal */}
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Edit Property</DialogTitle>
                  </DialogHeader>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 6 }}>
                    <div>
                      <Label>Property Name</Label>
                      <Input value={editForm.name || ""} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>

                    <div>
                      <Label>Location/City</Label>
                      <Input
                        value={editForm.location?.city || ""}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, location: { ...(p.location || {}), city: e.target.value } }))
                        }
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Label>Is Active</Label>
                      <Switch
                        checked={(editForm.status || "ACTIVE") === "ACTIVE"}
                        onCheckedChange={(checked) => setEditForm((p) => ({ ...p, status: checked ? "ACTIVE" : "INACTIVE" }))}
                      />
                    </div>

                    <div>
                      <Label>PMS Provider</Label>
                      <Select
                        value={editForm.pmsProvider || "NONE"}
                        onValueChange={(v: "NONE" | "EZEE") =>
                          setEditForm((p) => ({
                            ...p,
                            pmsProvider: v,
                            pmsConfig: v === "EZEE" ? p.pmsConfig : undefined,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="EZEE">Ezee</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editForm.pmsProvider === "EZEE" && (
                      <>
                        <div>
                          <Label>Hotel Code</Label>
                          <Input
                            value={editForm.pmsConfig?.hotelCode || ""}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                pmsConfig: { ...(p.pmsConfig || {}), hotelCode: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Auth Key</Label>
                          <Input
                            type={showAuthKey ? "text" : "password"}
                            value={editForm.pmsConfig?.authCode || ""}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                pmsConfig: { ...(p.pmsConfig || {}), authCode: e.target.value },
                              }))
                            }
                          />
                          <div style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => setShowAuthKey((v) => !v)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}
                            >
                              {showAuthKey ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                              {showAuthKey ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                      <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button onClick={saveEdit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
