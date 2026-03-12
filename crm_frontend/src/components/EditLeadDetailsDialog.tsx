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

export interface LeadTripDetails {
    checkInDate?: string;
    checkOutDate?: string;
    roomsRequested?: number;
    guests?: LeadGuests;
    occasion?: string;
    customData?: Record<string, any>;
}

interface EditLeadDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentDetails: LeadTripDetails;
    customFields?: any[];
    onSave: (details: LeadTripDetails) => Promise<void>;
}

export function EditLeadDetailsDialog({
    open,
    onOpenChange,
    currentDetails,
    customFields = [],
    onSave,
}: EditLeadDetailsDialogProps) {
    const [checkInDate, setCheckInDate] = useState("");
    const [checkOutDate, setCheckOutDate] = useState("");
    const [rooms, setRooms] = useState("1");
    const [adults, setAdults] = useState("1");
    const [children, setChildren] = useState("0");
    const [occasion, setOccasion] = useState("");
    const [customData, setCustomData] = useState<Record<string, any>>({});
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
                customData: Object.keys(customData).length > 0 ? customData : undefined,
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
            <DialogContent className="sm:max-w-[425px]">
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
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="occasion">Occasion</Label>
                        <Select value={occasion} onValueChange={setOccasion}>
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
                                                />
                                            )}
                                            {dataType === "NUMBER" && (
                                                <Input
                                                    type="number"
                                                    placeholder={fieldName}
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: Number(e.target.value) || "" }))}
                                                />
                                            )}
                                            {dataType === "TEXTAREA" && (
                                                <Textarea
                                                    placeholder={fieldName}
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: e.target.value }))}
                                                />
                                            )}
                                            {dataType === "DATE" && (
                                                <Input
                                                    type="date"
                                                    value={customData[fieldSlug] || ""}
                                                    onChange={e => setCustomData(prev => ({ ...prev, [fieldSlug]: e.target.value }))}
                                                />
                                            )}
                                            {dataType === "BOOLEAN" && (
                                                <div className="flex items-center h-10 space-x-2">
                                                    <Switch
                                                        checked={!!customData[fieldSlug]}
                                                        onCheckedChange={checked => setCustomData(prev => ({ ...prev, [fieldSlug]: checked }))}
                                                    />
                                                </div>
                                            )}
                                            {dataType === "DROPDOWN" && (
                                                <Select
                                                    value={customData[fieldSlug] || ""}
                                                    onValueChange={value => setCustomData(prev => ({ ...prev, [fieldSlug]: value }))}
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
                    <Button onClick={handleSave} disabled={isSaving}>
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
