import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { LeadGuests } from "@/services/leads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomFieldDefinition } from "@/services/customFields";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HotelBookingSection } from "./leads/HotelBookingSection";

export interface LeadTripDetails {
    checkInDate?: string;
    checkOutDate?: string;
    roomsRequested?: number;
    guests?: LeadGuests;
    occasion?: string;
    customData?: Record<string, any>;
    propertyId?: string;
    roomTypeId?: string;
    roomTypeName?: string;
    ratePlanId?: string;
    ratePlanName?: string;
    estimatedRate?: number;
    estimatedRoomNights?: number;
    estimatedRevenue?: number;
    budget?: number | string;
    customerType?: string;
    bookingWindow?: string;
    notes?: string;
    source?: string;
    leadType?: string;
    heatLevel?: string;
}

interface EditLeadDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentDetails: LeadTripDetails;
    customFields?: any[];
    onSave: (details: LeadTripDetails) => Promise<void>;
    /** PATCH keys this user may change (from GET /leads/:id). If omitted, all fields are editable. */
    editableFieldKeys?: string[];
}

export function EditLeadDetailsDialog({
    open,
    onOpenChange,
    currentDetails,
    customFields = [],
    onSave,
    editableFieldKeys,
}: EditLeadDetailsDialogProps) {
    const can = (key: string) =>
        editableFieldKeys === undefined ? true : editableFieldKeys.includes(key);
    const canBooking =
        can("hotels") ||
        can("checkIn") ||
        can("checkOut") ||
        can("roomTypeId") ||
        can("estimatedRate") ||
        can("adults") ||
        can("children");
    const [checkInDate, setCheckInDate] = useState("");
    const [checkOutDate, setCheckOutDate] = useState("");
    const [rooms, setRooms] = useState("1");
    const [adults, setAdults] = useState("1");
    const [children, setChildren] = useState("0");
    const [occasion, setOccasion] = useState("");
    const [customData, setCustomData] = useState<Record<string, any>>({});
    const [budget, setBudget] = useState("");
    const [customerType, setCustomerType] = useState("");
    const [bookingWindow, setBookingWindow] = useState("");
    const [notes, setNotes] = useState("");
    const [source, setSource] = useState("");
    const [heatLevel, setHeatLevel] = useState("");
    // PMS Booking Fields
    const [propertyId, setPropertyId] = useState("");
    const [roomTypeId, setRoomTypeId] = useState("");
    const [roomTypeName, setRoomTypeName] = useState("");
    const [ratePlanId, setRatePlanId] = useState("");
    const [ratePlanName, setRatePlanName] = useState("");
    const [estimatedRate, setEstimatedRate] = useState<number | undefined>();
    const [estimatedRoomNights, setEstimatedRoomNights] = useState<number | undefined>();
    const [estimatedRevenue, setEstimatedRevenue] = useState<number | undefined>();

    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{ dates?: string, custom?: string }>({});

    // Initialize fields when dialog opens
    useEffect(() => {
        if (open) {
            // Format dates for input type="date" (YYYY-MM-DD)
            const formatDate = (dateString?: string) => {
                if (!dateString) return "";
                try {
                    return new Date(dateString).toISOString().split('T')[0];
                } catch (e) {
                    return "";
                }
            };

            setCheckInDate(formatDate(currentDetails.checkInDate));
            setCheckOutDate(formatDate(currentDetails.checkOutDate));
            setRooms(String(currentDetails.roomsRequested || 1));
            setAdults(String(currentDetails.guests?.adults || 1));
            setChildren(String(currentDetails.guests?.children || 0));
            setOccasion(currentDetails.occasion || "");
            setCustomData(currentDetails.customData || {});
            setBudget(currentDetails.budget != null ? String(currentDetails.budget) : "");
            setCustomerType(currentDetails.customerType || "");
            setBookingWindow(currentDetails.bookingWindow || "");
            setNotes(currentDetails.notes || "");
            setSource(currentDetails.source || "");
            setHeatLevel(currentDetails.heatLevel || "");
            setPropertyId(currentDetails.propertyId || "");
            setRoomTypeId(currentDetails.roomTypeId || "");
            setRoomTypeName(currentDetails.roomTypeName || "");
            setRatePlanId(currentDetails.ratePlanId || "");
            setRatePlanName(currentDetails.ratePlanName || "");
            setEstimatedRate(currentDetails.estimatedRate);
            setEstimatedRoomNights(currentDetails.estimatedRoomNights);
            setEstimatedRevenue(currentDetails.estimatedRevenue);
            setErrors({});
        }
    }, [open, currentDetails]);

    const validateForm = () => {
        const newErrors: { dates?: string, custom?: string } = {};

        if (checkInDate && checkOutDate) {
            if (new Date(checkInDate) >= new Date(checkOutDate)) {
                newErrors.dates = "Check-out date must be after check-in date";
            }
        }

        // Validate required custom fields
        const missingCustomRequired = customFields.filter(f => (f.isRequired || f.is_required) && !customData[f.slug || f.fieldName]);
        if (missingCustomRequired.length > 0) {
            newErrors.custom = `Please fill in required fields: ${missingCustomRequired.map(f => f.name || f.label).join(", ")}`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        try {
            setIsSaving(true);
            await onSave({
                checkInDate: checkInDate ? new Date(checkInDate).toISOString() : undefined,
                checkOutDate: checkOutDate ? new Date(checkOutDate).toISOString() : undefined,
                roomsRequested: parseInt(rooms) || 1,
                guests: {
                    adults: parseInt(adults) || 1,
                    children: parseInt(children) || 0,
                },
                occasion: occasion || undefined,
                budget: budget ? Number(budget) : undefined,
                customerType: customerType || undefined,
                bookingWindow: bookingWindow || undefined,
                notes: notes || undefined,
                source: source || undefined,
                heatLevel: heatLevel || undefined,
                customData: Object.keys(customData).length > 0 ? customData : undefined,
                propertyId: propertyId || undefined,
                roomTypeId: roomTypeId || undefined,
                roomTypeName: roomTypeName || undefined,
                ratePlanId: ratePlanId || undefined,
                ratePlanName: ratePlanName || undefined,
                estimatedRate: estimatedRate,
                estimatedRoomNights: estimatedRoomNights,
                estimatedRevenue: estimatedRevenue,
            });
            onOpenChange(false);
        } catch (error) {
            // Error handling is done in parent component
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Trip Details</DialogTitle>
                    <DialogDescription>
                        Update travel dates, occupancy, and other trip information.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="checkIn">Check-in Date</Label>
                            <Input
                                id="checkIn"
                                type="date"
                                value={checkInDate}
                                onChange={(e) => setCheckInDate(e.target.value)}
                                disabled={!canBooking}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="checkOut">Check-out Date</Label>
                            <Input
                                id="checkOut"
                                type="date"
                                value={checkOutDate}
                                onChange={(e) => setCheckOutDate(e.target.value)}
                                min={checkInDate}
                                disabled={!canBooking}
                            />
                        </div>
                    </div>
                    {errors.dates && (
                        <p className="text-sm text-red-500">{errors.dates}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="rooms">Rooms</Label>
                            <Input
                                id="rooms"
                                type="number"
                                min="1"
                                value={rooms}
                                onChange={(e) => setRooms(e.target.value)}
                                disabled={!canBooking}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="adults">Adults</Label>
                            <Input
                                id="adults"
                                type="number"
                                min="1"
                                value={adults}
                                onChange={(e) => setAdults(e.target.value)}
                                disabled={!canBooking}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="children">Children</Label>
                            <Input
                                id="children"
                                type="number"
                                min="0"
                                value={children}
                                onChange={(e) => setChildren(e.target.value)}
                                disabled={!canBooking}
                            />
                        </div>
                    </div>

                    {propertyId && (
                        <div className="pt-2">
                            <HotelBookingSection
                                propertyId={propertyId}
                                readOnly={!canBooking}
                                value={{
                                    checkIn: checkInDate,
                                    checkOut: checkOutDate,
                                    roomTypeId,
                                    roomTypeName,
                                    ratePlanId,
                                    ratePlanName,
                                    adults: parseInt(adults) || 1,
                                    children: parseInt(children) || 0,
                                    estimatedRate,
                                    estimatedRoomNights,
                                    estimatedRevenue
                                }}
                                onChange={(patch) => {
                                    if (patch.checkIn !== undefined) setCheckInDate(patch.checkIn);
                                    if (patch.checkOut !== undefined) setCheckOutDate(patch.checkOut);
                                    if (patch.roomTypeId !== undefined) setRoomTypeId(patch.roomTypeId);
                                    if (patch.roomTypeName !== undefined) setRoomTypeName(patch.roomTypeName);
                                    if (patch.ratePlanId !== undefined) setRatePlanId(patch.ratePlanId);
                                    if (patch.ratePlanName !== undefined) setRatePlanName(patch.ratePlanName);
                                    if (patch.adults !== undefined) setAdults(String(patch.adults));
                                    if (patch.children !== undefined) setChildren(String(patch.children));
                                    if (patch.estimatedRate !== undefined) setEstimatedRate(patch.estimatedRate);
                                    if (patch.estimatedRoomNights !== undefined) setEstimatedRoomNights(patch.estimatedRoomNights);
                                    if (patch.estimatedRevenue !== undefined) setEstimatedRevenue(patch.estimatedRevenue);
                                }}
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="budget">Budget</Label>
                        <Input
                            id="budget"
                            type="number"
                            placeholder="e.g., 700000"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            disabled={!can("budget")}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="customerType">Customer Type</Label>
                        <Select value={customerType} onValueChange={setCustomerType} disabled={!can("customerType")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select customer type (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="B2C">B2C</SelectItem>
                                <SelectItem value="B2B">B2B</SelectItem>
                                <SelectItem value="Corporate">Corporate</SelectItem>
                                <SelectItem value="Influencer">Influencer</SelectItem>
                                <SelectItem value="NRI">NRI</SelectItem>
                                <SelectItem value="HNI">HNI</SelectItem>
                                <SelectItem value="Reference">Reference</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bookingWindow">Booking Window</Label>
                        <Select value={bookingWindow} onValueChange={setBookingWindow} disabled={!can("bookingWindow")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select booking window (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Within 5 hrs">Within 5 hrs</SelectItem>
                                <SelectItem value="Within 24 hrs">Within 24 hrs</SelectItem>
                                <SelectItem value="Yet to decide">Yet to decide</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            disabled={!can("notes")}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="source">Lead Source</Label>
                        <Select value={source} onValueChange={setSource} disabled={!can("source")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select source (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DIRECT_CALL">Direct Call</SelectItem>
                                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                <SelectItem value="BRAND_WEBSITE">Website</SelectItem>
                                <SelectItem value="EMAIL">Email</SelectItem>
                                <SelectItem value="TRAVEL_AGENT">Travel Agent</SelectItem>
                                <SelectItem value="OTA">OTA</SelectItem>
                                <SelectItem value="REFERRAL">Referral</SelectItem>
                                <SelectItem value="MANUAL">Manual</SelectItem>
                                <SelectItem value="IVR">IVR</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="heatLevel">Heat Level</Label>
                        <Select value={heatLevel} onValueChange={setHeatLevel} disabled={!can("heatLevel")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select heat level (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="HOT">Hot</SelectItem>
                                <SelectItem value="WARM">Warm</SelectItem>
                                <SelectItem value="COLD">Cold</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="occasion">Occasion</Label>
                        <Select value={occasion} onValueChange={setOccasion} disabled={!canBooking}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select occasion (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="leisure">Leisure</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                                <SelectItem value="honeymoon">Honeymoon</SelectItem>
                                <SelectItem value="anniversary">Anniversary</SelectItem>
                                <SelectItem value="birthday">Birthday</SelectItem>
                                <SelectItem value="wedding">Wedding</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {customFields.length > 0 && (
                        <div className="border-t border-slate-200 mt-2 pt-4">
                            <h4 className="text-sm font-semibold mb-3">Additional Information</h4>
                            {!can("customData") && (
                                <p className="text-xs text-muted-foreground mb-2">You don&apos;t have permission to edit additional fields.</p>
                            )}
                            <div className="grid gap-4">
                                {customFields.map(field => {
                                    const fieldSlug = field.slug || field.fieldName;
                                    const fieldName = field.name || field.label;
                                    const isRequired = field.isRequired || field.is_required;
                                    const dataType = (field.dataType || field.type || "").toUpperCase();

                                    return (
                                        <div key={field._id || fieldSlug} className="grid gap-2">
                                            <Label className="flex gap-1">
                                                {fieldName} {isRequired && <span className="text-red-500">*</span>}
                                            </Label>
                                            {dataType === "TEXT" && (
                                                <Input
                                                    placeholder={fieldName}
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: e.target.value }))}
                                                    disabled={!can("customData")}
                                                />
                                            )}
                                            {dataType === "NUMBER" && (
                                                <Input
                                                    type="number"
                                                    placeholder={fieldName}
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: Number(e.target.value) || "" }))}
                                                    disabled={!can("customData")}
                                                />
                                            )}
                                            {dataType === "TEXTAREA" && (
                                                <Textarea
                                                    placeholder={fieldName}
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: e.target.value }))}
                                                    disabled={!can("customData")}
                                                />
                                            )}
                                            {dataType === "DATE" && (
                                                <Input
                                                    type="date"
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: e.target.value }))}
                                                    disabled={!can("customData")}
                                                />
                                            )}
                                            {dataType === "BOOLEAN" && (
                                                <div className="flex items-center h-10 space-x-2">
                                                    <Switch
                                                        checked={!!customData[fieldSlug]}
                                                        onCheckedChange={checked => setCustomData(prev => ({ ...prev, [fieldSlug]: checked }))}
                                                        disabled={!can("customData")}
                                                    />
                                                </div>
                                            )}
                                            {dataType === "DROPDOWN" && (
                                                <Select
                                                    value={customData[fieldSlug] || ""}
                                                    onValueChange={value => setCustomData(prev => ({ ...prev, [fieldSlug]: value }))}
                                                    disabled={!can("customData")}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={`Select ${fieldName}`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {field.options?.map((opt: any) => {
                                                            const val = typeof opt === "string" ? opt : opt.value;
                                                            const lbl = typeof opt === "string" ? opt : opt.label;
                                                            return (
                                                                <SelectItem key={val} value={val}>{lbl}</SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {errors.custom && (
                        <p className="text-sm text-red-500">{errors.custom}</p>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={
                            isSaving ||
                            (editableFieldKeys !== undefined && editableFieldKeys.length === 0)
                        }
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
