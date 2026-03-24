import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createLead, getLeadContactInfo, listLeads, type Lead } from "@/services/leads";
import { listProperties, type Property } from "@/services/properties";

interface AccountLeadsProps {
  accountId: string;
  isSystemAdmin?: boolean;
}

interface HotelRoomForm {
  roomCategory: string;
  roomPreference: string;
  numberOfGuests: string;
}

interface HotelForm {
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  roomCategory: string;
  roomPreference: string;
  numberOfGuests: string;
  rooms: HotelRoomForm[];
}

const LEAD_TYPES = [
  "STAY",
  "MICE",
  "WEDDING",
  "EVENT",
  "DINING",
  "SPA",
  "OTHER",
];

const LEAD_SOURCES = [
  "DIRECT_CALL",
  "EMAIL",
  "WHATSAPP",
  "REFERRAL",
  "WALK_IN",
  "SOCIAL",
  "MANUAL",
];

function getLeadAccountId(lead: Lead): string | undefined {
  if (!lead.accountId) return undefined;
  if (typeof lead.accountId === "string") return lead.accountId;
  return lead.accountId.id || lead.accountId._id;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function getStatusBadgeClass(status?: string) {
  const key = (status || "").toUpperCase();
  if (key === "NEW") return "bg-blue-100 text-blue-800 border-blue-200";
  if (key === "CONTACTED") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "QUALIFIED") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (key === "CONVERTED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (key === "CLOSED" || key === "LOST") return "bg-red-100 text-red-800 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getHeatBadgeClass(heat?: string) {
  const key = (heat || "").toUpperCase();
  if (key === "HOT") return "bg-red-100 text-red-800 border-red-200";
  if (key === "WARM") return "bg-amber-100 text-amber-800 border-amber-200";
  if (key === "COLD") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function AccountLeads({ accountId, isSystemAdmin }: AccountLeadsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [hotelOptions, setHotelOptions] = useState<Property[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    guestContactNumber: "",
    guestEmail: "",
    leadType: "STAY",
    source: "MANUAL",
    bookingSource: "",
    alternateContact: "",
    occupation: "",
    specialRequests: "",
    corporateBooking: "no",
    companyName: "",
    gstin: "",
    estimatedValue: "",
    notes: "",
    hotels: [
      {
        hotelName: "",
        checkInDate: "",
        checkOutDate: "",
        roomCategory: "",
        roomPreference: "",
        numberOfGuests: "",
        rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
      },
    ] as HotelForm[],
  });

  const accountLeads = useMemo(
    () => leads.filter((lead) => getLeadAccountId(lead) === accountId),
    [leads, accountId]
  );

  const loadLeads = async () => {
    setLoading(true);
    try {
      // listLeads query currently has no accountId filter in LeadListQuery,
      // so account-scoping is done client-side.
      const data = await listLeads();
      setLeads(data);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeads();
  }, [accountId]);

  useEffect(() => {
    const loadHotels = async () => {
      try {
        const properties = await listProperties();
        setHotelOptions(properties);
      } catch {
        setHotelOptions([]);
      }
    };
    void loadHotels();
  }, []);

  const addHotel = () => {
    setForm((prev) => ({
      ...prev,
      hotels: [
        ...prev.hotels,
        {
          hotelName: "",
          checkInDate: "",
          checkOutDate: "",
          roomCategory: "",
          roomPreference: "",
          numberOfGuests: "",
          rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
        },
      ],
    }));
  };

  const removeHotel = (hotelIndex: number) => {
    setForm((prev) => ({
      ...prev,
      hotels:
        prev.hotels.length > 1
          ? prev.hotels.filter((_, idx) => idx !== hotelIndex)
          : prev.hotels,
    }));
  };

  const updateHotel = (hotelIndex: number, patch: Partial<HotelForm>) => {
    setForm((prev) => ({
      ...prev,
      hotels: prev.hotels.map((hotel, idx) =>
        idx === hotelIndex ? { ...hotel, ...patch } : hotel
      ),
    }));
  };

  const addRoom = (hotelIndex: number) => {
    setForm((prev) => ({
      ...prev,
      hotels: prev.hotels.map((hotel, idx) =>
        idx === hotelIndex
          ? {
              ...hotel,
              rooms: [
                ...hotel.rooms,
                { roomCategory: "", roomPreference: "", numberOfGuests: "" },
              ],
            }
          : hotel
      ),
    }));
  };

  const removeRoom = (hotelIndex: number, roomIndex: number) => {
    setForm((prev) => ({
      ...prev,
      hotels: prev.hotels.map((hotel, idx) =>
        idx === hotelIndex
          ? {
              ...hotel,
              rooms:
                hotel.rooms.length > 1
                  ? hotel.rooms.filter((_, ridx) => ridx !== roomIndex)
                  : hotel.rooms,
            }
          : hotel
      ),
    }));
  };

  const updateRoom = (
    hotelIndex: number,
    roomIndex: number,
    patch: Partial<HotelRoomForm>
  ) => {
    setForm((prev) => ({
      ...prev,
      hotels: prev.hotels.map((hotel, idx) =>
        idx === hotelIndex
          ? {
              ...hotel,
              rooms: hotel.rooms.map((room, ridx) =>
                ridx === roomIndex ? { ...room, ...patch } : room
              ),
            }
          : hotel
      ),
    }));
  };

  const handleCreateLead = async () => {
    const fullName = [form.firstName, form.middleName, form.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({
        title: "Validation",
        description: "Guest first name and last name are required",
        variant: "destructive",
      });
      return;
    }
    if (!form.guestContactNumber.trim() && !form.guestEmail.trim()) {
      toast({
        title: "Validation",
        description: "Guest contact number or email is required",
        variant: "destructive",
      });
      return;
    }
    if (!form.leadType.trim() || !form.source.trim()) {
      toast({
        title: "Validation",
        description: "Lead type and source are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const hotelsPayload = form.hotels
        .filter(
          (h) =>
            h.hotelName.trim() ||
            h.checkInDate.trim() ||
            h.checkOutDate.trim() ||
            h.rooms.some(
              (r) =>
                r.roomCategory.trim() ||
                r.roomPreference.trim() ||
                r.numberOfGuests.trim()
            ) ||
            h.roomCategory.trim() ||
            h.roomPreference.trim() ||
            h.numberOfGuests.trim()
        )
        .map((hotel) => {
          const selectedProperty = hotelOptions.find(
            (property) => property.name === hotel.hotelName
          );
          const rooms = (hotel.rooms || [])
            .filter(
              (r) =>
                r.roomCategory.trim() ||
                r.roomPreference.trim() ||
                r.numberOfGuests.trim()
            )
            .map((r) => ({
              roomCategory: r.roomCategory.trim() || undefined,
              roomPreference: r.roomPreference.trim() || undefined,
              numberOfGuests: r.numberOfGuests.trim() || undefined,
            }));
          return {
            hotelName: hotel.hotelName.trim() || undefined,
            propertyId: selectedProperty?._id || undefined,
            checkInDate: hotel.checkInDate || undefined,
            checkOutDate: hotel.checkOutDate || undefined,
            roomCategory: hotel.roomCategory.trim() || undefined,
            roomPreference: hotel.roomPreference.trim() || undefined,
            numberOfGuests: hotel.numberOfGuests.trim() || undefined,
            rooms: rooms.length > 0 ? rooms : undefined,
          };
        });

      await createLead({
        accountId,
        source: form.source.trim(),
        leadType: form.leadType.trim(),
        bookingSource: form.bookingSource.trim() || undefined,
        guestContact: {
          name: fullName,
          phone: form.guestContactNumber.trim() || undefined,
          email: form.guestEmail.trim() || undefined,
        },
        alternateContact: form.alternateContact.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        specialRequests: form.specialRequests.trim() || undefined,
        isCorporateBooking: form.corporateBooking === "yes",
        companyName: form.companyName.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
        estimatedValue: form.estimatedValue.trim() || undefined,
        notes: form.notes.trim() || undefined,
        hotels: hotelsPayload.length > 0 ? hotelsPayload : undefined,
      });
      toast({ title: "Success", description: "Lead created" });
      setIsDialogOpen(false);
      setForm({
        firstName: "",
        middleName: "",
        lastName: "",
        guestContactNumber: "",
        guestEmail: "",
        leadType: "STAY",
        source: "MANUAL",
        bookingSource: "",
        alternateContact: "",
        occupation: "",
        specialRequests: "",
        corporateBooking: "no",
        companyName: "",
        gstin: "",
        estimatedValue: "",
        notes: "",
        hotels: [
          {
            hotelName: "",
            checkInDate: "",
            checkOutDate: "",
            roomCategory: "",
            roomPreference: "",
            numberOfGuests: "",
            rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
          },
        ],
      });
      await loadLeads();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to create lead",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {accountLeads.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>No leads yet for this account.</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
              Add Lead
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Number</TableHead>
                <TableHead>Guest / Contact</TableHead>
                <TableHead>Lead Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Heat Level</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountLeads.map((lead) => {
                const contact = getLeadContactInfo(lead);
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <TableCell className="font-medium">{lead.leadNumber || "—"}</TableCell>
                    <TableCell>{contact.name || "—"}</TableCell>
                    <TableCell>{lead.leadType || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(lead.status)}>
                        {lead.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getHeatBadgeClass(lead.heatLevel)}>
                        {lead.heatLevel || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.source || "—"}</TableCell>
                    <TableCell>{formatDate(lead.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/leads/${lead.id}`);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isSystemAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete is not available in this view"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Guest First Name *</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label>Guest Middle Name</Label>
                <Input
                  value={form.middleName}
                  onChange={(e) => setForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  placeholder="Middle name"
                />
              </div>
              <div className="space-y-2">
                <Label>Guest Last Name *</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Guest Contact Number</Label>
              <Input
                value={form.guestContactNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, guestContactNumber: e.target.value }))}
                placeholder="+91..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest Email</Label>
                <Input
                  value={form.guestEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, guestEmail: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Alternate Contact</Label>
                <Input
                  value={form.alternateContact}
                  onChange={(e) => setForm((prev) => ({ ...prev, alternateContact: e.target.value }))}
                  placeholder="Optional alternate number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead Type</Label>
                <Select
                  value={form.leadType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, leadType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, source: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Booking Source</Label>
                <Input
                  value={form.bookingSource}
                  onChange={(e) => setForm((prev) => ({ ...prev, bookingSource: e.target.value }))}
                  placeholder="Optional booking source"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Value</Label>
                <Input
                  value={form.estimatedValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimatedValue: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Occupation</Label>
              <Input
                value={form.occupation}
                onChange={(e) => setForm((prev) => ({ ...prev, occupation: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Special Requests</Label>
              <Textarea
                value={form.specialRequests}
                onChange={(e) => setForm((prev) => ({ ...prev, specialRequests: e.target.value }))}
                placeholder="Optional special requests"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Corporate Booking</Label>
                <Select
                  value={form.corporateBooking}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, corporateBooking: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => setForm((prev) => ({ ...prev, gstin: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-4 border rounded-md p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Hotel Details</h3>
                <Button type="button" variant="outline" size="sm" onClick={addHotel}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Hotel
                </Button>
              </div>

              {form.hotels.map((hotel, hotelIndex) => (
                <div key={`hotel-${hotelIndex}`} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Hotel {hotelIndex + 1}</p>
                    {form.hotels.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeHotel(hotelIndex)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2 col-span-1">
                      <Label>Hotel Name</Label>
                      <Select
                        value={hotel.hotelName}
                        onValueChange={(value) => updateHotel(hotelIndex, { hotelName: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select hotel" />
                        </SelectTrigger>
                        <SelectContent>
                          {hotelOptions.length > 0 ? (
                            hotelOptions.map((property) => (
                              <SelectItem key={property._id} value={property.name}>
                                {property.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-hotels" disabled>
                              No properties available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Check In</Label>
                      <Input
                        type="date"
                        value={hotel.checkInDate}
                        onChange={(e) =>
                          updateHotel(hotelIndex, { checkInDate: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Check Out</Label>
                      <Input
                        type="date"
                        value={hotel.checkOutDate}
                        onChange={(e) =>
                          updateHotel(hotelIndex, { checkOutDate: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Room Category (fallback)</Label>
                      <Input
                        value={hotel.roomCategory}
                        onChange={(e) =>
                          updateHotel(hotelIndex, { roomCategory: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Room Preference (fallback)</Label>
                      <Input
                        value={hotel.roomPreference}
                        onChange={(e) =>
                          updateHotel(hotelIndex, { roomPreference: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Guests (fallback)</Label>
                      <Input
                        value={hotel.numberOfGuests}
                        onChange={(e) =>
                          updateHotel(hotelIndex, { numberOfGuests: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Rooms</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addRoom(hotelIndex)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Room
                      </Button>
                    </div>

                    {hotel.rooms.map((room, roomIndex) => (
                      <div
                        key={`hotel-${hotelIndex}-room-${roomIndex}`}
                        className="grid grid-cols-4 gap-3 rounded-md border p-2"
                      >
                        <div className="space-y-1">
                          <Label>Room Category</Label>
                          <Input
                            value={room.roomCategory}
                            onChange={(e) =>
                              updateRoom(hotelIndex, roomIndex, {
                                roomCategory: e.target.value,
                              })
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Room Preference</Label>
                          <Input
                            value={room.roomPreference}
                            onChange={(e) =>
                              updateRoom(hotelIndex, roomIndex, {
                                roomPreference: e.target.value,
                              })
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Guests</Label>
                          <Input
                            value={room.numberOfGuests}
                            onChange={(e) =>
                              updateRoom(hotelIndex, roomIndex, {
                                numberOfGuests: e.target.value,
                              })
                            }
                            placeholder="Optional"
                          />
                        </div>
                        <div className="flex items-end justify-end">
                          {hotel.rooms.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeRoom(hotelIndex, roomIndex)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLead} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
