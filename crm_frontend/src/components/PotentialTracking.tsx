import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Plus, Edit, TrendingUp, TrendingDown,
    Target, MapPin, BarChart3, RefreshCw, ArrowRight,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
    getPotentialSummary,
    getMarketSearch,
    type MarketSearchResult,
    type LocationType,
    type SegmentType,
} from "@/services/accountPotentials";
import { syncPotentialFromPms } from "@/services/pmsIntegration";
import { MAJOR_INDIAN_CITIES } from "@/constants/accountData";
import { ProfileSection } from "@/components/accounts/AccountProfileSections";
import { PotentialWizard } from "@/components/potential/PotentialWizard";
import {
    FIELD_LABELS,
    LOCATION_OPTIONS,
    SEGMENT_OPTIONS,
    SEGMENT_COLORS,
    getSegmentFields,
} from "@/components/potential/potentialConstants";

interface PotentialTrackingProps {
    accountId: string;
    /** When true, only the add/edit dialog is rendered (for embedding in wizard post-save). */
    renderOnlyAddDialog?: boolean;
    /** Called after successfully saving when in renderOnlyAddDialog mode. */
    onSuccess?: () => void;
    /** Called when dialog is closed in renderOnlyAddDialog mode. */
    onCancel?: () => void;
}

export const PotentialTracking = ({ accountId, renderOnlyAddDialog, onSuccess, onCancel }: PotentialTrackingProps) => {
    const { toast } = useToast();
    const [allPotentials, setAllPotentials] = useState<AccountPotential[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingPotential, setEditingPotential] = useState<AccountPotential | null>(null);
    const [isSyncingPms, setIsSyncingPms] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showYoY, setShowYoY] = useState(false);

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
        if (renderOnlyAddDialog) setIsWizardOpen(true);
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

    const handleOpenWizard = (potential?: AccountPotential) => {
        setEditingPotential(potential ?? null);
        setIsWizardOpen(true);
    };

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

    if (renderOnlyAddDialog) {
        return (
            <PotentialWizard
                open={isWizardOpen}
                onOpenChange={(open) => {
                    setIsWizardOpen(open);
                    if (!open) onCancel?.();
                }}
                accountId={accountId}
                selectedYear={selectedYear}
                onSuccess={() => {
                    setIsWizardOpen(false);
                    onSuccess?.();
                }}
            />
        );
    }

    if (isLoading && !summary) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Market potential</h3>
                    <p className="text-sm text-text-muted">City-wise revenue targets and achievement</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePmsSync}
                        disabled={isSyncingPms}
                        className="h-8 text-xs"
                    >
                        {isSyncingPms ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                        PMS import
                    </Button>
                    <Button
                        variant={showYoY ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowYoY(!showYoY)}
                        className="h-8 text-xs"
                    >
                        <BarChart3 className="mr-1.5 h-3 w-3" />
                        YoY
                    </Button>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] h-8 border-0 bg-transparent"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[2023, 2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleOpenWizard()} className="h-8">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add potential
                    </Button>
                </div>
            </div>

            <ProfileSection title="Find hotels in this market">
                <p className="text-sm text-text-muted mb-3">Search by location and segment to see other accounts in this market.</p>
                <div className="flex flex-wrap items-end gap-3">
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
                        <div className="w-full text-sm text-text-muted">
                            {marketSearchResults.length} hotel(s): {marketSearchResults.map(h => h.accountName).join(", ")}
                        </div>
                    )}
                </div>
            </ProfileSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-border bg-surface shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-center min-h-[100px]">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Target {selectedYear}</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-xl font-semibold text-foreground">₹{totalSummary.totalTarget.toLocaleString("en-IN")}</h4>
                            <Target className="h-5 w-5 text-text-muted shrink-0" />
                        </div>
                    </CardContent>
                </Card>
                <Card
                    className="border-border bg-surface shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setActualDrillDownOpen(true)}
                >
                    <CardContent className="p-4 flex flex-col justify-center min-h-[100px]">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Actual</p>
                        <div className="flex items-end justify-between gap-2">
                            <h4 className="text-xl font-semibold text-foreground">₹{totalSummary.totalActual.toLocaleString("en-IN")}</h4>
                            <span className={`text-xs font-semibold flex items-center shrink-0 ${totalSummary.pct > 60 ? "text-emerald-600" : "text-amber-600"}`}>
                                {Math.round(totalSummary.pct)}%
                                {totalSummary.pct > 50 ? <TrendingUp className="h-3 w-3 ml-0.5" /> : <TrendingDown className="h-3 w-3 ml-0.5" />}
                            </span>
                        </div>
                        <p className="text-[10px] text-text-muted mt-1">View breakdown</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-center min-h-[100px]">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Records</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-xl font-semibold text-foreground">{potentials.length}</h4>
                            <MapPin className="h-5 w-5 text-text-muted" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-center min-h-[100px]">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Segments</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {totalSummary.segments.length > 0 ? totalSummary.segments.map(s => (
                                <Badge key={s} variant="outline" className="text-[10px]">
                                    {s.replace(/_/g, " ")}
                                </Badge>
                            )) : <span className="text-sm text-text-muted">—</span>}
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
                                <Button variant="outline" size="sm" onClick={() => handleOpenWizard(pot)}>
                                    <Edit className="h-4 w-4 mr-1.5" /> Edit
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
                <Card className="border-border border-dashed bg-surface">
                    <CardContent className="py-16 text-center">
                        <TrendingUp className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-foreground">No potential data for {selectedYear}</p>
                        <p className="text-sm text-text-muted mt-1 mb-4">Add city-level targets to track performance.</p>
                        <Button onClick={() => handleOpenWizard()}>
                            <Plus className="h-4 w-4 mr-2" /> Add potential
                        </Button>
                    </CardContent>
                </Card>
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

            <PotentialWizard
                open={isWizardOpen}
                onOpenChange={setIsWizardOpen}
                accountId={accountId}
                selectedYear={selectedYear}
                editPotential={editingPotential}
                onSuccess={loadData}
            />
        </>
    );
};
