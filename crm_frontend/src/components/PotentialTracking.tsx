import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, Plus, Trash2, Edit, TrendingUp, TrendingDown,
    Target, Building2, MapPin, BarChart3, PieChart
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
    LocationType,
    SegmentType
} from "@/services/accountPotentials";
import { MAJOR_INDIAN_CITIES } from "@/constants/accountData";

interface PotentialTrackingProps {
    accountId: string;
}

export const PotentialTracking = ({ accountId }: PotentialTrackingProps) => {
    const { toast } = useToast();
    const [potentials, setPotentials] = useState<AccountPotential[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [formData, setFormData] = useState<Partial<AccountPotential>>({
        city: "",
        location: "CBD",
        segment: "LUXURY",
        year: selectedYear,
        fitPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
        groupPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
        longStayPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
        banquetPotential: { events: 0, revenue: 0, actualEvents: 0, actualRevenue: 0 },
        competitors: [],
        remarks: "",
    });

    useEffect(() => {
        loadData();
    }, [accountId, selectedYear]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [data, summaryData] = await Promise.all([
                getAccountPotentials(accountId),
                getPotentialSummary(accountId, selectedYear)
            ]);
            setPotentials(data.filter(p => p.year === selectedYear));
            setSummary(summaryData);
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to load potential data",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDialog = (potential?: AccountPotential) => {
        if (potential) {
            setFormData(potential);
        } else {
            setFormData({
                city: "",
                location: "CBD",
                segment: "LUXURY",
                year: selectedYear,
                fitPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
                groupPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
                longStayPotential: { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 },
                banquetPotential: { events: 0, revenue: 0, actualEvents: 0, actualRevenue: 0 },
                competitors: [],
                remarks: "",
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.city) {
            toast({ title: "Error", description: "City is required", variant: "destructive" });
            return;
        }

        try {
            setIsSubmitting(true);
            await saveAccountPotential(accountId, formData as Omit<AccountPotential, "id">);
            toast({ title: "Success", description: "Potential record saved" });
            setIsDialogOpen(false);
            loadData();
        } catch (err) {
            toast({ title: "Error", description: "Failed to save data", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderProgressBar = (actual: number = 0, target: number = 0, label: string) => {
        const percentage = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{label}</span>
                    <span>{percentage}% Achieved</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${percentage > 80 ? 'bg-emerald-500' : percentage > 40 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-900">₹{actual.toLocaleString()}</span>
                    <span className="text-slate-400">Target: ₹{target.toLocaleString()}</span>
                </div>
            </div>
        );
    };

    if (isLoading && !summary) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Market Potential Tracking</h3>
                    <p className="text-sm text-slate-500">City-wise revenue targets and achievement</p>
                </div>
                <div className="flex gap-2">
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleOpenDialog()} className="bg-slate-900 hover:bg-slate-800 text-white rounded-none">
                        <Plus className="mr-2 h-4 w-4" /> Add Potential
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-900 text-white border-0 shadow-lg">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Potential {selectedYear}</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold">₹{(summary?.totalPotentialRevenue || 0).toLocaleString()}</h4>
                            <Target className="h-6 w-6 text-slate-700 opacity-50 mb-1" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Actual Realized</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold text-slate-900">₹{(summary?.totalActualRevenue || 0).toLocaleString()}</h4>
                            <div className="flex flex-col items-end">
                                <span className={`text-xs font-bold flex items-center ${summary?.penetrationRate > 60 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {Math.round(summary?.penetrationRate || 0)}%
                                    {summary?.penetrationRate > 50 ? <TrendingUp className="h-3 w-3 ml-1" /> : <TrendingDown className="h-3 w-3 ml-1" />}
                                </span>
                                <span className="text-[10px] text-slate-400">Penetration</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cities Covered</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-2xl font-bold text-slate-900">{potentials.length}</h4>
                            <MapPin className="h-6 w-6 text-slate-200 mb-1" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200">
                    <CardContent className="p-4 flex flex-col justify-center h-28">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Market Segment</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-xl font-bold text-slate-900 truncate">LUXURY</h4>
                            <PieChart className="h-6 w-6 text-slate-200 mb-1" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {potentials.map(pot => (
                    <Card key={pot.id} className="border-slate-200 overflow-hidden group">
                        <div className="border-b border-slate-100 bg-slate-50/50 p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-600 shadow-sm">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">{pot.city}</h4>
                                    <div className="flex gap-2 mt-0.5">
                                        <Badge variant="outline" className="text-[10px] h-4 leading-none bg-blue-50/50 text-blue-700 border-blue-100">{pot.location}</Badge>
                                        <Badge variant="outline" className="text-[10px] h-4 leading-none bg-amber-50/50 text-amber-700 border-amber-100">{pot.segment}</Badge>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(pot)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit className="h-4 w-4 mr-2" /> Edit Details
                            </Button>
                        </div>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {renderProgressBar(pot.fitPotential.actualRoomRevenue, pot.fitPotential.roomRevenue, "FIT Segment")}
                                {renderProgressBar(pot.groupPotential.actualRoomRevenue, pot.groupPotential.roomRevenue, "Group Segment")}
                                {renderProgressBar(pot.longStayPotential.actualRoomRevenue, pot.longStayPotential.roomRevenue, "Long Stay")}
                                {renderProgressBar(pot.banquetPotential.actualRevenue, pot.banquetPotential.revenue, "Banquet")}
                            </div>
                            {pot.remarks && (
                                <div className="mt-6 pt-4 border-t border-slate-50 flex items-start gap-2">
                                    <BarChart3 className="h-4 w-4 text-slate-300 mt-0.5" />
                                    <p className="text-xs text-slate-500 italic">"{pot.remarks}"</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {potentials.length === 0 && (
                <div className="text-center py-20 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No potential data for {selectedYear}</p>
                    <Button variant="link" onClick={() => handleOpenDialog()} className="text-primary mt-1">
                        Start tracking for this year
                    </Button>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Market Potential Details - {formData.city || "New City"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select City</Label>
                                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                                    <SelectTrigger><SelectValue placeholder="City" /></SelectTrigger>
                                    <SelectContent>
                                        {MAJOR_INDIAN_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Location Type</Label>
                                <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v as LocationType })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CBD">CBD</SelectItem>
                                        <SelectItem value="MICRO_MARKET">Micro Market</SelectItem>
                                        <SelectItem value="INDUSTRIAL_BELT">Industrial Belt</SelectItem>
                                        <SelectItem value="NORTH_GEO">North Geo</SelectItem>
                                        <SelectItem value="SOUTH_GEO">South Geo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Target Segment</Label>
                                <Select value={formData.segment} onValueChange={(v) => setFormData({ ...formData, segment: v as SegmentType })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LUXURY">Luxury</SelectItem>
                                        <SelectItem value="UPPER_UPSCALE">Upper Upscale</SelectItem>
                                        <SelectItem value="UPSCALE">Upscale</SelectItem>
                                        <SelectItem value="MID_SEGMENT">Mid Segment</SelectItem>
                                        <SelectItem value="BUDGET">Budget</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Revenue Targets (FIT/Group) */}
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50/50 rounded-lg space-y-3">
                                <Label className="text-blue-700 font-bold block border-b border-blue-100 pb-1 uppercase text-[10px] tracking-widest">FIT Potential</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Room Nights</Label>
                                        <Input type="number" value={formData.fitPotential?.roomNights} onChange={(e) => setFormData({ ...formData, fitPotential: { ...formData.fitPotential!, roomNights: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Revenue (₹)</Label>
                                        <Input type="number" value={formData.fitPotential?.roomRevenue} onChange={(e) => setFormData({ ...formData, fitPotential: { ...formData.fitPotential!, roomRevenue: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-emerald-50/50 rounded-lg space-y-3">
                                <Label className="text-emerald-700 font-bold block border-b border-emerald-100 pb-1 uppercase text-[10px] tracking-widest">Group Potential</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Room Nights</Label>
                                        <Input type="number" value={formData.groupPotential?.roomNights} onChange={(e) => setFormData({ ...formData, groupPotential: { ...formData.groupPotential!, roomNights: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Revenue (₹)</Label>
                                        <Input type="number" value={formData.groupPotential?.roomRevenue} onChange={(e) => setFormData({ ...formData, groupPotential: { ...formData.groupPotential!, roomRevenue: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Targets (Long Stay/Banquet) */}
                        <div className="space-y-4">
                            <div className="p-3 bg-amber-50/50 rounded-lg space-y-3">
                                <Label className="text-amber-700 font-bold block border-b border-amber-100 pb-1 uppercase text-[10px] tracking-widest">Long Stay Potential</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Room Nights</Label>
                                        <Input type="number" value={formData.longStayPotential?.roomNights} onChange={(e) => setFormData({ ...formData, longStayPotential: { ...formData.longStayPotential!, roomNights: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Revenue (₹)</Label>
                                        <Input type="number" value={formData.longStayPotential?.roomRevenue} onChange={(e) => setFormData({ ...formData, longStayPotential: { ...formData.longStayPotential!, roomRevenue: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-purple-50/50 rounded-lg space-y-3">
                                <Label className="text-purple-700 font-bold block border-b border-purple-100 pb-1 uppercase text-[10px] tracking-widest">Banquet Potential</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Events</Label>
                                        <Input type="number" value={formData.banquetPotential?.events} onChange={(e) => setFormData({ ...formData, banquetPotential: { ...formData.banquetPotential!, events: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Revenue (₹)</Label>
                                        <Input type="number" value={formData.banquetPotential?.revenue} onChange={(e) => setFormData({ ...formData, banquetPotential: { ...formData.banquetPotential!, revenue: parseInt(e.target.value) } })} className="h-8" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-3 space-y-2">
                            <Label>Competition & Strategy Remarks</Label>
                            <Input value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Main competitors, market share goals, etc." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-slate-900 text-white">
                            {isSubmitting ? "Saving..." : "Save Market Data"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
