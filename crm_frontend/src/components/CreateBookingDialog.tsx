import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, Hotel } from "lucide-react";
import { format } from "date-fns";
import { checkAvailability, getRates, createBooking, RoomAvailability, RoomRate } from "@/services/pms";
import { LeadDetail } from "@/services/leads";

interface CreateBookingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    lead: LeadDetail["lead"];
    onSuccess: () => void;
}

export function CreateBookingDialog({
    isOpen,
    onClose,
    lead,
    onSuccess,
}: CreateBookingDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [availableRooms, setAvailableRooms] = useState<RoomAvailability[]>([]);
    const [rates, setRates] = useState<RoomRate[]>([]);

    // Form State
    const firstItinerary = lead.itineraries?.[0];
    const [checkInDate, setCheckInDate] = useState(firstItinerary?.checkInDate ? format(new Date(firstItinerary.checkInDate), "yyyy-MM-dd") : "");
    const [checkOutDate, setCheckOutDate] = useState(firstItinerary?.checkOutDate ? format(new Date(firstItinerary.checkOutDate), "yyyy-MM-dd") : "");
    const [selectedRoomType, setSelectedRoomType] = useState<string>("");
    const [selectedRatePlan, setSelectedRatePlan] = useState<string>("");
    const [adults, setAdults] = useState(lead.guests?.adults || 1);
    const [children, setChildren] = useState(lead.guests?.children || 0);
    const [price, setPrice] = useState<number>(0);

    const propertyId = typeof lead.propertyId === 'string' ? lead.propertyId : (lead.propertyId as any)?._id;

    useEffect(() => {
        if (isOpen && propertyId && checkInDate && checkOutDate) {
            handleCheckAvailability();
        }
    }, [isOpen, propertyId]);

    const handleCheckAvailability = async () => {
        if (!propertyId || !checkInDate || !checkOutDate) {
            toast({ title: "Missing Info", description: "Please ensure dates and property are set", variant: "destructive" });
            return;
        }

        setIsChecking(true);
        try {
            const [inventory, roomRates] = await Promise.all([
                checkAvailability(propertyId, checkInDate, checkOutDate),
                getRates(propertyId, checkInDate, checkOutDate)
            ]);
            setAvailableRooms(inventory);
            setRates(roomRates);

            // Auto-select first available option if none selected
            if (inventory.length > 0 && !selectedRoomType) {
                setSelectedRoomType(inventory[0].roomTypeId);
            }
        } catch (error) {
            toast({
                title: "Availability Check Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
        } finally {
            setIsChecking(false);
        }
    };

    const handleCreateBooking = async () => {
        if (!selectedRoomType || !price) {
            toast({ title: "Incomplete", description: "Please select a room and verify price", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            // Find rate plan ID corresponding to the selected room/price/date if not explicitly selected
            // For MVP, we might just assume the first matching rate plan for the room type or let user select.
            // Since UI for rate plan selection isn't fully expanded here, we'll try to infer or require it.

            const ratePlan = rates.find(r => r.roomTypeId === selectedRoomType);
            // Ideally we should let user select specific rate plan if multiple exist

            await createBooking(propertyId, {
                leadId: lead.id,
                roomTypeId: selectedRoomType,
                ratePlanId: selectedRatePlan || ratePlan?.ratePlanId || "DEFAULT",
                checkInDate,
                checkOutDate,
                price,
                occupancy: { adults, children },
                guestDetails: {
                    firstName: lead.contactDetails.name.split(" ")[0],
                    lastName: lead.contactDetails.name.split(" ").slice(1).join(" ") || "Guest",
                    email: lead.contactDetails.email,
                    phone: lead.contactDetails.phone,
                }
            });

            toast({ title: "Success", description: "Booking created successfully!" });
            onSuccess();
            onClose();
        } catch (error) {
            toast({
                title: "Booking Failed",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate estimated price when room type changes
    useEffect(() => {
        if (selectedRoomType && rates.length > 0) {
            const rate = rates.find(r => r.roomTypeId === selectedRoomType);
            if (rate) {
                setPrice(rate.baseRate); // Simplified: mostly likely need to sum up across days
                // If we have proper rate plan logic, we'd filter rates by plan and date range
                setSelectedRatePlan(rate.ratePlanId);
            }
        }
    }, [selectedRoomType, rates]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Create PMS Booking</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Check-in</Label>
                            <Input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Check-out</Label>
                            <Input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={handleCheckAvailability} disabled={isChecking}>
                            {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
                            Check Availability
                        </Button>
                    </div>

                    {/* Room Selection */}
                    <div className="space-y-2">
                        <Label>Room Type</Label>
                        <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Room" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRooms.map((room, idx) => (
                                    <SelectItem key={`${room.roomTypeId}-${idx}`} value={room.roomTypeId}>
                                        {room.roomTypeName || room.roomTypeId} ({room.availableCount} available)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Adults</Label>
                            <Input type="number" min={1} value={adults} onChange={e => setAdults(parseInt(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Children</Label>
                            <Input type="number" min={0} value={children} onChange={e => setChildren(parseInt(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Total Price</Label>
                            <Input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value))} />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleCreateBooking} disabled={isLoading || !selectedRoomType}>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Confirm Booking
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
