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

export interface LeadTripDetails {
    checkInDate?: string;
    checkOutDate?: string;
    roomsRequested?: number;
    guests?: LeadGuests;
    occasion?: string;
}

interface EditLeadDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentDetails: LeadTripDetails;
    onSave: (details: LeadTripDetails) => Promise<void>;
}

export function EditLeadDetailsDialog({
    open,
    onOpenChange,
    currentDetails,
    onSave,
}: EditLeadDetailsDialogProps) {
    const [checkInDate, setCheckInDate] = useState("");
    const [checkOutDate, setCheckOutDate] = useState("");
    const [rooms, setRooms] = useState("1");
    const [adults, setAdults] = useState("1");
    const [children, setChildren] = useState("0");
    const [occasion, setOccasion] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<{ dates?: string }>({});

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
            setErrors({});
        }
    }, [open, currentDetails]);

    const validateForm = () => {
        const newErrors: { dates?: string } = {};

        if (checkInDate && checkOutDate) {
            if (new Date(checkInDate) >= new Date(checkOutDate)) {
                newErrors.dates = "Check-out date must be after check-in date";
            }
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
