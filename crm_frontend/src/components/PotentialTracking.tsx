import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Plus, Trash2, Edit, TrendingUp, TrendingDown,
    Target, MapPin, BarChart3, PieChart, RefreshCw, ArrowRight
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AccountPotential,
    getAccountPotentials,
    saveAccountPotential,
    getPotentialSummary,
    getMarketSearch,
    type MarketSearchResult,
    LocationType,
    SegmentType
} from "@/services/accountPotentials";
import { syncPotentialFromPms } from "@/services/pmsIntegration";
import { MAJOR_INDIAN_CITIES, INDIAN_STATES, CITIES_BY_STATE } from "@/constants/accountData";

interface PotentialTrackingProps {
    accountId: string;
    /** When true, only the add/edit dialog is rendered (for embedding in wizard post-save). */
    renderOnlyAddDialog?: boolean;
    /** Called after successfully saving when in renderOnlyAddDialog mode. */
    onSuccess?: () => void;
    /** Called when dialog is closed in renderOnlyAddDialog mode. */
    onCancel?: () => void;
}

const SEGMENT_FIELDS: Record<string, string[]> = {
    LUXURY: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential", "fbPotential", "spaPotential"],
    UPPER_UPSCALE: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential", "fbPotential", "spaPotential"],
    UPSCALE: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential"],
    MID_SEGMENT: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential"],
    BUDGET: ["fitPotential", "groupPotential", "banquetPotential"],
    GUEST_HOUSE: ["fitPotential", "groupPotential", "banquetPotential"],
};

const FIELD_LABELS: Record<string, { label: string; color: string; type: "room" | "event" }> = {
    fitPotential: { label: "FIT Potential", color: "blue", type: "room" },
    groupPotential: { label: "Group Potential", color: "emerald", type: "room" },
    longStayPotential: { label: "Long Stay Potential", color: "amber", type: "room" },
    banquetPotential: { label: "Banquet Potential", color: "purple", type: "event" },
    fbPotential: { label: "F&B Potential", color: "rose", type: "event" },
    spaPotential: { label: "Spa & Wellness", color: "teal", type: "event" },
};

const emptyRoomPotential = { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 };
const emptyEventPotential = { events: 0, revenue: 0, actualEvents: 0, actualRevenue: 0 };

const LOCATION_OPTIONS: { value: LocationType; label: string }[] = [
    { value: "CBD", label: "CBD" },
    { value: "MICRO_MARKET", label: "Micro Market" },
    { value: "INDUSTRIAL_BELT", label: "Industrial Belt" },
    { value: "NORTH_GEO", label: "North Geo" },
    { value: "SOUTH_GEO", label: "South Geo" },
    { value: "CUSTOM", label: "Custom" },
];

const SEGMENT_OPTIONS: { value: SegmentType; label: string }[] = [
    { value: "LUXURY", label: "Luxury" },
    { value: "UPPER_UPSCALE", label: "Upper Upscale" },
    { value: "UPSCALE", label: "Upscale" },
    { value: "MID_SEGMENT", label: "Mid Segment" },
    { value: "BUDGET", label: "Budget" },
    { value: "GUEST_HOUSE", label: "Guest House" },
];

const SEGMENT_COLORS: Record<string, { border: string; header: string }> = {
    LUXURY: { border: "border-l-amber-500", header: "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/30" },
    UPPER_UPSCALE: { border: "border-l-purple-500", header: "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-800/30" },
    UPSCALE: { border: "border-l-blue-500", header: "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30" },
    MID_SEGMENT: { border: "border-l-emerald-500", header: "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30" },
    BUDGET: { border: "border-l-slate-500", header: "bg-slate-50/60 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/30" },
    GUEST_HOUSE: { border: "border-l-teal-500", header: "bg-teal-50/60 dark:bg-teal-950/20 border-teal-200/50 dark:border-teal-800/30" },
};

export const PotentialTracking = ({ accountId, renderOnlyAddDialog, onSuccess, onCancel }: PotentialTrackingProps) => {
    const { toast } = useToast();
    const [allPotentials, setAllPotentials] = useState<AccountPotential[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncingPms, setIsSyncingPms] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showYoY, setShowYoY] = useState(false);

    const [formData, setFormData] = useState<Partial<AccountPotential>>({
        city: "",
        location: "CBD",
        segment: "LUXURY",
        year: selectedYear,
        fitPotential: { ...emptyRoomPotential },
        groupPotential: { ...emptyRoomPotential },
        longStayPotential: { ...emptyRoomPotential },
        banquetPotential: { ...emptyEventPotential },
        fbPotential: { ...emptyEventPotential },
        spaPotential: { ...emptyEventPotential },
        competitors: [],
        remarks: "",
    });
    type ComboRow = { id: string; location: LocationType; segment: SegmentType };
    const [comboRows, setComboRows] = useState<ComboRow[]>([{ id: "1", location: "CBD", segment: "LUXURY" }]);
    const [comboData, setComboData] = useState<Record<string, Partial<AccountPotential>>>({});
    const [dialogStateFilter, setDialogStateFilter] = useState<string>("");
    const [marketSearchLocation, setMarketSearchLocation] = useState<LocationType>("CBD");
    const [marketSearchSegment, setMarketSearchSegment] = useState<SegmentType>("LUXURY");
    const [marketSearchCity, setMarketSearchCity] = useState<string>("");
    const [marketSearchResults, setMarketSearchResults] = useState<MarketSearchResult[] | null>(null);
    const [marketSearchLoading, setMarketSearchLoading] = useState(false);
    const [actualDrillDownOpen, setActualDrillDownOpen] = useState(false);

    const potentials = useMemo(() => allPotentials.filter(p => p.year === selectedYear), [allPotentials, selectedYear]);
    const prevYearPotentials = useMemo(() => allPotentials.filter(p => p.year === selectedYear - 1), [allPotentials, selectedYear]);

    useEffect(() => {
        loadData();
    }, [accountId, selectedYear]);

    useEffect(() => {
        if (renderOnlyAddDialog) {
            setFormData({
                city: "",
                year: selectedYear,
                remarks: "",
            });
            setComboRows([{ id: "1", location: "CBD", segment: "LUXURY" }]);
            setComboData({
                "1": {
                    fitPotential: { ...emptyRoomPotential },
                    groupPotential: { ...emptyRoomPotential },
                    longStayPotential: { ...emptyRoomPotential },
                    banquetPotential: { ...emptyEventPotential },
                    fbPotential: { ...emptyEventPotential },
                    spaPotential: { ...emptyEventPotential },
                    competitors: [],
                },
            });
            setIsDialogOpen(true);
        }
    }, [renderOnlyAddDialog]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [data, summaryData] = await Promise.all([
                getAccountPotentials(accountId),
                getPotentialSummary(accountId, selectedYear)
            ]);
            setAllPotentials(data);
            setSummary(summaryData);
        } catch (err) {
            toast({ title: "Error", description: "Failed to load potential data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePmsSync = async () => {
        try {
            setIsSyncingPms(true);
            const result = await syncPotentialFromPms(accountId);
            toast({
                title: result.status === "placeholder" ? "PMS Integration" : "Sync Complete",
                description: result.message,
            });
        } catch (err: any) {
            toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsSyncingPms(false);
        }
    };

    const handleOpenDialog = (potential?: AccountPotential) => {
        if (potential) {
            setFormData({
                city: potential.city,
                year: potential.year,
                remarks: potential.remarks,
            });
            const rowId = "1";
            setComboRows([{ id: rowId, location: potential.location, segment: potential.segment }]);
            setComboData({
                [rowId]: {
                    fitPotential: potential.fitPotential || { ...emptyRoomPotential },
                    groupPotential: potential.groupPotential || { ...emptyRoomPotential },
                    longStayPotential: potential.longStayPotential || { ...emptyRoomPotential },
                    banquetPotential: potential.banquetPotential || { ...emptyEventPotential },
                    fbPotential: potential.fbPotential || { ...emptyEventPotential },
                    spaPotential: potential.spaPotential || { ...emptyEventPotential },
                    competitors: potential.competitors || [],
                },
            });
        } else {
            setFormData({
                city: "",
                year: selectedYear,
                remarks: "",
            });
            setComboRows([{ id: "1", location: "CBD", segment: "LUXURY" }]);
            setComboData({
                "1": {
                    fitPotential: { ...emptyRoomPotential },
                    groupPotential: { ...emptyRoomPotential },
                    longStayPotential: { ...emptyRoomPotential },
                    banquetPotential: { ...emptyEventPotential },
                    fbPotential: { ...emptyEventPotential },
                    spaPotential: { ...emptyEventPotential },
                    competitors: [],
                },
            });
        }
        setIsDialogOpen(true);
    };

    const getComboFormData = (rowId: string): Partial<AccountPotential> => {
        const base = comboData[rowId] || {
            fitPotential: { ...emptyRoomPotential },
            groupPotential: { ...emptyRoomPotential },
            longStayPotential: { ...emptyRoomPotential },
            banquetPotential: { ...emptyEventPotential },
            fbPotential: { ...emptyEventPotential },
            spaPotential: { ...emptyEventPotential },
            competitors: [],
        };
        return base;
    };

    const updateComboData = (rowId: string, updates: Partial<AccountPotential>) => {
        setComboData(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), ...updates } }));
    };

    const addRow = () => {
        const id = `row-${Date.now()}`;
        setComboRows(prev => [...prev, { id, location: "CBD", segment: "LUXURY" }]);
        setComboData(prev => ({
            ...prev,
            [id]: {
                fitPotential: { ...emptyRoomPotential },
                groupPotential: { ...emptyRoomPotential },
                longStayPotential: { ...emptyRoomPotential },
                banquetPotential: { ...emptyEventPotential },
                fbPotential: { ...emptyEventPotential },
                spaPotential: { ...emptyEventPotential },
                competitors: [],
            },
        }));
    };

    const removeRow = (rowId: string) => {
        if (comboRows.length <= 1) return;
        setComboRows(prev => prev.filter(r => r.id !== rowId));
        setComboData(prev => {
            const next = { ...prev };
            delete next[rowId];
            return next;
        });
    };

    const updateRow = (rowId: string, updates: Partial<{ location: LocationType; segment: SegmentType }>) => {
        setComboRows(prev => prev.map(r => r.id === rowId ? { ...r, ...updates } : r));
    };

    const handleSubmit = async () => {
        if (!formData.city) {
            toast({ title: "Error", description: "City is required", variant: "destructive" });
            return;
        }
        if (comboRows.length === 0) {
            toast({ title: "Error", description: "Add at least one Location/Segment combination", variant: "destructive" });
            return;
        }
        try {
            setIsSubmitting(true);
            for (const row of comboRows) {
                const data = getComboFormData(row.id);
                const payload: Omit<AccountPotential, "id"> = {
                    city: formData.city!,
                    year: formData.year ?? selectedYear,
                    location: row.location,
                    segment: row.segment,
                    remarks: formData.remarks,
                    fitPotential: data.fitPotential || { ...emptyRoomPotential },
                    groupPotential: data.groupPotential || { ...emptyRoomPotential },
                    longStayPotential: data.longStayPotential || { ...emptyRoomPotential },
                    banquetPotential: data.banquetPotential || { ...emptyEventPotential },
                    fbPotential: data.fbPotential || { ...emptyEventPotential },
                    spaPotential: data.spaPotential || { ...emptyEventPotential },
                    competitors: data.competitors || [],
                };
                await saveAccountPotential(accountId, payload);
            }
            toast({ title: "Success", description: `${comboRows.length} potential record(s) saved` });
            setIsDialogOpen(false);
            if (renderOnlyAddDialog) {
                onSuccess?.();
            } else {
                loadData();
            }
        } catch (err) {
            toast({ title: "Error", description: "Failed to save data", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getSegmentFields = (segment: string): string[] => SEGMENT_FIELDS[segment] || SEGMENT_FIELDS.LUXURY;

    const renderProgressBar = (actual: number = 0, target: number = 0, label: string) => {
        const percentage = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>{label}</span>
                    <span>{percentage}% Achieved</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percentage > 80 ? "bg-emerald-500" : percentage > 40 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground">&#8377;{actual.toLocaleString()}</span>
                    <span className="text-muted-foreground">Potential: &#8377;{target.toLocaleString()}</span>
                </div>
            </div>
        );
    };

    const getRevenueFromPotential = (pot: AccountPotential, fieldKey: string): { actual: number; target: number } => {
        const data = (pot as any)[fieldKey];
        if (!data) return { actual: 0, target: 0 };
        if (fieldKey === "banquetPotential" || fieldKey === "fbPotential" || fieldKey === "spaPotential") {
            return { actual: data.actualRevenue || 0, target: data.revenue || 0 };
        }
        return { actual: data.actualRoomRevenue || 0, target: data.roomRevenue || 0 };
    };

    const renderRoomPotentialFields = (fieldKey: string, colorClass: string, rowId: string) => {
        const combo = getComboFormData(rowId);
        const data = (combo as any)[fieldKey] || emptyRoomPotential;
        const updateField = (updates: any) => updateComboData(rowId, { [fieldKey]: { ...data, ...updates } });
        return (
            <div key={fieldKey} className={`p-3 rounded-lg space-y-3 ${colorClass === "blue" ? "bg-blue-50/50 dark:bg-blue-950/20" : colorClass === "emerald" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : colorClass === "amber" ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-muted/50"}`}>
                <Label className="font-bold block border-b pb-1 uppercase text-[10px] tracking-widest">{FIELD_LABELS[fieldKey]?.label}</Label>
                <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">Potential RN</Label><Input type="number" value={data.roomNights} onChange={(e) => updateField({ roomNights: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Potential Rev(&#8377;)</Label><Input type="number" value={data.roomRevenue} onChange={(e) => updateField({ roomRevenue: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Act RN</Label><Input type="number" value={data.actualRoomNights} onChange={(e) => updateField({ actualRoomNights: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Act Rev(&#8377;)</Label><Input type="number" value={data.actualRoomRevenue} onChange={(e) => updateField({ actualRoomRevenue: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                </div>
            </div>
        );
    };

    const renderEventPotentialFields = (fieldKey: string, colorClass: string, rowId: string) => {
        const combo = getComboFormData(rowId);
        const data = (combo as any)[fieldKey] || emptyEventPotential;
        const updateField = (updates: any) => updateComboData(rowId, { [fieldKey]: { ...data, ...updates } });
        return (
            <div key={fieldKey} className={`p-3 rounded-lg space-y-3 ${colorClass === "purple" ? "bg-purple-50/50 dark:bg-purple-950/20" : colorClass === "rose" ? "bg-rose-50/50 dark:bg-rose-950/20" : colorClass === "teal" ? "bg-teal-50/50 dark:bg-teal-950/20" : "bg-muted/50"}`}>
                <Label className="font-bold block border-b pb-1 uppercase text-[10px] tracking-widest">{FIELD_LABELS[fieldKey]?.label}</Label>
                <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">Potential Events</Label><Input type="number" value={data.events} onChange={(e) => updateField({ events: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Potential Rev(&#8377;)</Label><Input type="number" value={data.revenue} onChange={(e) => updateField({ revenue: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Act Events</Label><Input type="number" value={data.actualEvents} onChange={(e) => updateField({ actualEvents: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Act Rev(&#8377;)</Label><Input type="number" value={data.actualRevenue} onChange={(e) => updateField({ actualRevenue: parseInt(e.target.value) || 0 })} className="h-8" /></div>
                </div>
            </div>
        );
    };

    // YoY comparison data - group by city (multiple records per city now)
    const yoyData = useMemo(() => {
        if (!showYoY) return [];
        const cityMap = new Map<string, { currTotal: number; prevTotal: number }>();
        const addToTotal = (city: string, year: "curr" | "prev", amt: number) => {
            const entry = cityMap.get(city) || { currTotal: 0, prevTotal: 0 };
            if (year === "curr") entry.currTotal += amt;
            else entry.prevTotal += amt;
            cityMap.set(city, entry);
        };
        potentials.forEach(p => {
            const amt = (p.fitPotential?.actualRoomRevenue || 0) + (p.groupPotential?.actualRoomRevenue || 0) +
                (p.longStayPotential?.actualRoomRevenue || 0) + (p.banquetPotential?.actualRevenue || 0);
            addToTotal(p.city, "curr", amt);
        });
        prevYearPotentials.forEach(p => {
            const amt = (p.fitPotential?.actualRoomRevenue || 0) + (p.groupPotential?.actualRoomRevenue || 0) +
                (p.longStayPotential?.actualRoomRevenue || 0) + (p.banquetPotential?.actualRevenue || 0);
            addToTotal(p.city, "prev", amt);
        });
        return Array.from(cityMap.entries()).map(([city, { currTotal, prevTotal }]) => {
            const growth = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0;
            return { city, currTotal, prevTotal, growth };
        });
    }, [potentials, prevYearPotentials, showYoY]);

    // Summary totals across all cities
    const totalSummary = useMemo(() => {
        let totalTarget = 0;
        let totalActual = 0;
        for (const pot of potentials) {
            totalTarget += (pot.fitPotential?.roomRevenue || 0) + (pot.groupPotential?.roomRevenue || 0) +
                (pot.longStayPotential?.roomRevenue || 0) + (pot.banquetPotential?.revenue || 0);
            totalActual += (pot.fitPotential?.actualRoomRevenue || 0) + (pot.groupPotential?.actualRoomRevenue || 0) +
                (pot.longStayPotential?.actualRoomRevenue || 0) + (pot.banquetPotential?.actualRevenue || 0);
        }
        const segments = new Set(potentials.map(p => p.segment));
        return { totalTarget, totalActual, pct: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0, segments: Array.from(segments) };
    }, [potentials]);

    const runMarketSearch = async () => {
        setMarketSearchLoading(true);
        setMarketSearchResults(null);
        try {
            const list = await getMarketSearch(marketSearchLocation, marketSearchSegment, marketSearchCity || undefined);
            setMarketSearchResults(list);
        } catch {
            toast({ title: "Search failed", variant: "destructive" });
        } finally {
            setMarketSearchLoading(false);
        }
    };

    if (isLoading && !summary && !renderOnlyAddDialog) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
        {!renderOnlyAddDialog && (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Market Potential Tracking</h3>
                    <p className="text-sm text-muted-foreground">City-wise revenue targets and achievement</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePmsSync}
                        disabled={isSyncingPms}
                        className="text-xs"
                    >
                        {isSyncingPms ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                        Import from PMS
                    </Button>
                    <Button
                        variant={showYoY ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowYoY(!showYoY)}
                        className="text-xs"
                    >
                        <BarChart3 className="mr-1.5 h-3 w-3" />
                        YoY Compare
                    </Button>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[2023, 2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleOpenDialog()} variant="default" className="rounded-none">
                        <Plus className="mr-2 h-4 w-4" /> Add Potential
                    </Button>
                </div>
            </div>

            {/* Market search: hotels by Location + Segment */}
            <Card className="border-border">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Find hotels in this market</CardTitle>
                    <CardDescription>Select location and segment to list accounts (hotels) with potential for that market.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">Location</Label>
                        <Select value={marketSearchLocation} onValueChange={(v: LocationType) => setMarketSearchLocation(v)}>
                            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {LOCATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Segment</Label>
                        <Select value={marketSearchSegment} onValueChange={(v: SegmentType) => setMarketSearchSegment(v)}>
                            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {SEGMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">City (optional)</Label>
                        <Select value={marketSearchCity || "__all__"} onValueChange={(v) => setMarketSearchCity(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All cities</SelectItem>
                                {MAJOR_INDIAN_CITIES.slice(0, 30).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button size="sm" onClick={runMarketSearch} disabled={marketSearchLoading}>
                        {marketSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Search
                    </Button>
                    {marketSearchResults && (
                        <div className="w-full mt-2 text-sm text-muted-foreground">
                            {marketSearchResults.length} hotel(s): {marketSearchResults.map(h => h.accountName).join(", ")}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Summary Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Total Potential {selectedYear}</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold">&#8377;{totalSummary.totalTarget.toLocaleString()}</h4>
                            <Target className="h-6 w-6 opacity-50 mb-1" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setActualDrillDownOpen(true)}>
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Actual</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold text-foreground">&#8377;{totalSummary.totalActual.toLocaleString()}</h4>
                            <div className="flex flex-col items-end">
                                <span className={`text-xs font-bold flex items-center ${totalSummary.pct > 60 ? "text-emerald-600" : "text-amber-600"}`}>
                                    {Math.round(totalSummary.pct)}%
                                    {totalSummary.pct > 50 ? <TrendingUp className="h-3 w-3 ml-1" /> : <TrendingDown className="h-3 w-3 ml-1" />}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Click to view by property</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Cities Covered</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold text-foreground">{potentials.length}</h4>
                            <MapPin className="h-6 w-6 text-muted-foreground mb-1" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Segments</p>
                        <div className="flex items-end justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                                {totalSummary.segments.length > 0 ? totalSummary.segments.map(s => {
                                    const c = SEGMENT_COLORS[s];
                                    return (
                                        <Badge key={s} variant="outline" className={`text-[10px] ${c ? `border-l-4 ${c.border}` : ""}`}>
                                            {s.replace(/_/g, " ")}
                                        </Badge>
                                    );
                                }) : <span className="text-sm text-muted-foreground">None</span>}
                            </div>
                            <PieChart className="h-6 w-6 text-muted-foreground mb-1 shrink-0" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* YoY Comparison */}
            {showYoY && yoyData.length > 0 && (
                <Card className="border-border">
                    <CardHeader>
                        <CardTitle className="text-base">Year-over-Year Comparison ({selectedYear - 1} vs {selectedYear})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {yoyData.map(item => (
                                <div key={item.city} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                                    <span className="font-medium text-sm w-32 truncate">{item.city}</span>
                                    <div className="flex-1 flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-32 text-right">&#8377;{item.prevTotal.toLocaleString()}</span>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="text-xs font-medium w-32">&#8377;{item.currTotal.toLocaleString()}</span>
                                    </div>
                                    <Badge className={`text-xs ${item.growth > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : item.growth < 0 ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-muted text-muted-foreground"}`}>
                                        {item.growth > 0 ? "+" : ""}{Math.round(item.growth)}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Potential Records per City */}
            <div className="grid grid-cols-1 gap-4">
                {potentials.map(pot => {
                    const fields = getSegmentFields(pot.segment);
                    const segColors = SEGMENT_COLORS[pot.segment] || SEGMENT_COLORS.LUXURY;
                    return (
                        <Card key={pot.id} className={`border-border overflow-hidden group border-l-4 ${segColors.border}`}>
                            <div className={`border-b p-4 flex justify-between items-center ${segColors.header}`}>
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 bg-background border border-border rounded flex items-center justify-center text-muted-foreground shadow-sm">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground">{pot.city}</h4>
                                        <div className="flex gap-2 mt-0.5">
                                            <Badge variant="outline" className="text-[10px] h-4 leading-none bg-blue-50/50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">{pot.location}</Badge>
                                            <Badge variant="outline" className="text-[10px] h-4 leading-none bg-amber-50/50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">{pot.segment}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(pot)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                </Button>
                            </div>
                            <CardContent className="p-6">
                                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(fields.length, 4)} gap-8`}>
                                    {fields.filter(fk => FIELD_LABELS[fk]).map(fieldKey => {
                                        const meta = FIELD_LABELS[fieldKey]!;
                                        const { actual, target } = getRevenueFromPotential(pot, fieldKey);
                                        return <div key={fieldKey}>{renderProgressBar(actual, target, meta.label)}</div>;
                                    })}
                                </div>
                                {pot.remarks && (
                                    <div className="mt-6 pt-4 border-t border-border flex items-start gap-2">
                                        <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5" />
                                        <p className="text-xs text-muted-foreground italic">"{pot.remarks}"</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {potentials.length === 0 && (
                <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed border-border">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No potential data for {selectedYear}</p>
                    <Button variant="link" onClick={() => handleOpenDialog()} className="text-primary mt-1">
                        Start tracking for this year
                    </Button>
                </div>
            )}

            {/* Actual drill-down dialog */}
            <Dialog open={actualDrillDownOpen} onOpenChange={setActualDrillDownOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Actual by property (city / segment)</DialogTitle>
                        <CardDescription>Revenue actuals by market for {selectedYear}</CardDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 min-h-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-2 font-medium">City</th>
                                    <th className="text-left py-2 font-medium">Location</th>
                                    <th className="text-left py-2 font-medium">Segment</th>
                                    <th className="text-right py-2 font-medium">Actual (&#8377;)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {potentials.map((p) => {
                                    const actual = (p.fitPotential?.actualRoomRevenue || 0) + (p.groupPotential?.actualRoomRevenue || 0) + (p.longStayPotential?.actualRoomRevenue || 0) + (p.banquetPotential?.actualRevenue || 0) + (p.fbPotential?.actualRevenue || 0) + (p.spaPotential?.actualRevenue || 0);
                                    return (
                                        <tr key={p.id} className="border-b border-border/50">
                                            <td className="py-2">{p.city}</td>
                                            <td className="py-2">{p.location}</td>
                                            <td className="py-2">{p.segment}</td>
                                            <td className="text-right py-2 font-mono">&#8377;{actual.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>

            </div>
        )}

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open && renderOnlyAddDialog) onCancel?.();
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b shrink-0">
                        <DialogTitle>Market Potential Details - {formData.city || "New City"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label>State (filter cities)</Label>
                                    <Select value={dialogStateFilter || "__all__"} onValueChange={(v) => setDialogStateFilter(v === "__all__" ? "" : v)}>
                                        <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All states</SelectItem>
                                            {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Select City *</Label>
                                    <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                                        <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
                                        <SelectContent>
                                            {(() => {
                                                const baseList = dialogStateFilter ? (CITIES_BY_STATE[dialogStateFilter] || MAJOR_INDIAN_CITIES) : MAJOR_INDIAN_CITIES;
                                                const list = formData.city && !baseList.includes(formData.city) ? [...baseList, formData.city].sort() : baseList;
                                                return list.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>);
                                            })()}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input type="number" value={formData.year ?? selectedYear} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || selectedYear })} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="font-semibold">Location & Segment combinations</Label>
                                <p className="text-xs text-muted-foreground">Add one combination at a time. Use &quot;Add another&quot; for more.</p>
                                {comboRows.map((row) => {
                                    const fields = getSegmentFields(row.segment);
                                    return (
                                        <Card key={row.id} className="border-border overflow-hidden">
                                            <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Location</Label>
                                                        <Select value={row.location} onValueChange={(v: LocationType) => updateRow(row.id, { location: v })}>
                                                            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {LOCATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Segment</Label>
                                                        <Select value={row.segment} onValueChange={(v: SegmentType) => updateRow(row.id, { segment: v })}>
                                                            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {SEGMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                {comboRows.length > 1 && (
                                                    <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                                                    </Button>
                                                )}
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {fields.filter(fk => FIELD_LABELS[fk]).map(fieldKey => {
                                                        const meta = FIELD_LABELS[fieldKey]!;
                                                        return meta.type === "room"
                                                            ? renderRoomPotentialFields(fieldKey, meta.color, row.id)
                                                            : renderEventPotentialFields(fieldKey, meta.color, row.id);
                                                    })}
                                                </div>
                                                {/* Competition per segment */}
                                                <div className="pt-4 border-t border-border space-y-2">
                                                    <Label className="font-semibold text-sm">Competition</Label>
                                                    {((getComboFormData(row.id).competitors) || []).map((comp: { brandName?: string; rates?: string; marketShare?: number }, idx: number) => (
                                                        <div key={idx} className="flex flex-wrap items-center gap-2 p-2 rounded bg-muted/50">
                                                            <Input placeholder="Brand name" className="flex-1 min-w-[120px] h-8" value={comp.brandName || ""} onChange={(e) => {
                                                                const list = [...(getComboFormData(row.id).competitors || [])];
                                                                list[idx] = { ...list[idx], brandName: e.target.value };
                                                                updateComboData(row.id, { competitors: list });
                                                            }} />
                                                            <Input placeholder="Rates" className="w-32 h-8" value={comp.rates || ""} onChange={(e) => {
                                                                const list = [...(getComboFormData(row.id).competitors || [])];
                                                                list[idx] = { ...list[idx], rates: e.target.value };
                                                                updateComboData(row.id, { competitors: list });
                                                            }} />
                                                            <Input type="number" placeholder="Share %" className="w-20 h-8" value={comp.marketShare ?? ""} onChange={(e) => {
                                                                const list = [...(getComboFormData(row.id).competitors || [])];
                                                                list[idx] = { ...list[idx], marketShare: e.target.value ? Number(e.target.value) : undefined };
                                                                updateComboData(row.id, { competitors: list });
                                                            }} />
                                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => {
                                                                const list = (getComboFormData(row.id).competitors || []).filter((_: any, i: number) => i !== idx);
                                                                updateComboData(row.id, { competitors: list });
                                                            }}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => {
                                                        const list = [...(getComboFormData(row.id).competitors || []), { brandName: "", rates: "", marketShare: undefined }];
                                                        updateComboData(row.id, { competitors: list });
                                                    }}>
                                                        <Plus className="h-3 w-3 mr-1" /> Add competitor
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                                <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full border-dashed">
                                    <Plus className="h-4 w-4 mr-2" /> Add another Location / Segment
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Competition & Strategy Remarks (shared)</Label>
                                <Input value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Main competitors, market share goals, etc." />
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-3 bg-background">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} variant="default">
                            {isSubmitting ? "Saving..." : "Save Market Data"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
