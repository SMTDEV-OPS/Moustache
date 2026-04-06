import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HotelBookingSection } from "@/components/leads/HotelBookingSection";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

import type { Lead, LeadContactDetails, LeadGuests } from "@/services/leads";
import { listProperties, type Property } from "@/services/properties";
import { getRoomCatalogue, syncRoomCatalogue, type RoomCatalogue, resolveRoomTypeDisplayName } from "@/services/pms";
import { useToast } from "@/hooks/use-toast";

type CustomFieldLike = {
  _id?: string;
  slug?: string;
  fieldName?: string;
  name?: string;
  label?: string;
  isRequired?: boolean;
  is_required?: boolean;
  dataType?: string;
  type?: string;
  options?: any[];
};

export interface EditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  /** Admin fields / custom fields definitions used for dynamic form controls */
  customFields?: CustomFieldLike[];
  /** PATCH keys the current user may change (from GET /leads/:id). If omitted, all fields are editable. */
  editableFieldKeys?: string[];
  /** Persist changes. The dialog will only include allowed keys. */
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

function isoDateInput(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  customFields = [],
  editableFieldKeys,
  onSave,
}: EditLeadDialogProps) {
  const { toast } = useToast();
  const can = (key: string) => (editableFieldKeys === undefined ? true : editableFieldKeys.includes(key));

  const normalizeHeatLevel = (value: string | undefined | null): string => {
    const v = String(value ?? "").trim();
    if (!v) return "";
    const upper = v.toUpperCase().replace(/\s+/g, "_");
    if (upper === "HOT" || upper === "WARM" || upper === "COLD" || upper === "NOT_INTERESTED") return upper;
    // Common title-case values from older UI
    if (v === "Hot" || v === "Warm" || v === "Cold") return v.toUpperCase();
    if (v === "Not Interested") return "NOT_INTERESTED";
    return v; // leave as-is; backend will reject and show helpful message
  };

  const canAny = editableFieldKeys === undefined ? true : editableFieldKeys.length > 0;

  const canContact = can("contactDetails");
  const canTrip =
    can("hotels") ||
    can("checkIn") ||
    can("checkOut") ||
    can("roomTypeId") ||
    can("estimatedRate") ||
    can("adults") ||
    can("children");
  const canBusiness = can("budget") || can("bookingWindow") || can("customerType") || can("source") || can("heatLevel") || can("notes");
  const canCustom = can("customData");

  // --- Contact (contactDetails) ---
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // --- Trip / Hotels ---
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [catalogueByPropertyId, setCatalogueByPropertyId] = useState<Record<string, RoomCatalogue>>({});
  const [syncingByPropertyId, setSyncingByPropertyId] = useState<Record<string, boolean>>({});
  type RoomReq = {
    roomTypeId: string;
    roomTypeName?: string;
    quantity: string;
    adults: string;
    children: string;
    notes?: string;
  };
  type HotelDraft = {
    propertyId: string;
    hotelName?: string;
    checkInDate: string;
    checkOutDate: string;
    roomsRequested: RoomReq[];
  };
  const [hotels, setHotels] = useState<HotelDraft[]>([
    { propertyId: "", hotelName: "", checkInDate: "", checkOutDate: "", roomsRequested: [{ roomTypeId: "", roomTypeName: "", quantity: "1", adults: "1", children: "0" }] },
  ]);

  // --- Business ---
  const [budget, setBudget] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [bookingWindow, setBookingWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [heatLevel, setHeatLevel] = useState("");

  // --- Custom ---
  const [customData, setCustomData] = useState<Record<string, any>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ contact?: string; dates?: string; custom?: string }>({});

  const initialGuests: LeadGuests | undefined = (lead as any).guests;
  const initialOcc: string | undefined = (lead as any).occasion;

  // Initialize form when opened / lead changes.
  useEffect(() => {
    if (!open) return;

    const cd = (lead as any).contactDetails as LeadContactDetails | undefined;
    setContactName(cd?.name || "");
    setContactPhone(cd?.phone || "");
    setContactEmail(cd?.email || "");

    const itins = (lead.itineraries || []) as any[];
    if (itins.length > 0) {
      setHotels(
        itins.map((it) => ({
          propertyId: (it.propertyId && typeof it.propertyId === "object" ? it.propertyId._id : it.propertyId) || "",
          hotelName: it.hotelName || "",
          checkInDate: isoDateInput(it.checkInDate),
          checkOutDate: isoDateInput(it.checkOutDate),
          roomsRequested:
            (Array.isArray(it.roomsRequested) && it.roomsRequested.length > 0
              ? it.roomsRequested
              : [{ roomTypeId: it.roomCategory || "", roomTypeName: it.roomCategory || "", quantity: 1, adults: 1, children: 0 }]
            ).map((r: any) => ({
              roomTypeId: String(r.roomTypeId || ""),
              roomTypeName: r.roomTypeName || "",
              quantity: String(r.quantity ?? 1),
              adults: String(r.adults ?? 1),
              children: String(r.children ?? 0),
              notes: r.notes || "",
            })),
        }))
      );
    } else {
      setHotels([{ propertyId: "", hotelName: "", checkInDate: "", checkOutDate: "", roomsRequested: [{ roomTypeId: "", roomTypeName: "", quantity: "1", adults: "1", children: "0" }] }]);
    }

    setBudget(lead.budget != null ? String(lead.budget) : "");
    setCustomerType(lead.customerType || "");
    setBookingWindow(lead.bookingWindow || "");
    setNotes(lead.notes || "");
    setSource(lead.source || "");
    setHeatLevel(normalizeHeatLevel(lead.heatLevel) || "");

    setCustomData((lead.customData as any) || {});
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead.id]);

  // Load properties for hotel dropdown
  useEffect(() => {
    if (!open) return;
    listProperties().then(setAllProperties).catch(() => setAllProperties([]));
  }, [open]);

  // Load room catalogues for selected hotels
  useEffect(() => {
    if (!open) return;
    const ids = hotels.map((h) => h.propertyId).filter(Boolean);
    ids.forEach((id) => {
      if (catalogueByPropertyId[id]) return;
      getRoomCatalogue(id)
        .then((cat) => setCatalogueByPropertyId((prev) => (prev[id] ? prev : { ...prev, [id]: cat })))
        .catch(() => setCatalogueByPropertyId((prev) => (prev[id] ? prev : { ...prev, [id]: { roomTypes: [], ratePlans: [] } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hotels]);

  const syncCatalogueForProperty = async (propertyId: string) => {
    if (!propertyId) return;
    setSyncingByPropertyId((prev) => ({ ...prev, [propertyId]: true }));
    try {
      const cat = await syncRoomCatalogue(propertyId);
      setCatalogueByPropertyId((prev) => ({ ...prev, [propertyId]: cat }));
      toast({ title: "PMS room catalogue updated" });
    } catch (e) {
      toast({
        title: "Could not sync PMS catalogue",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSyncingByPropertyId((prev) => ({ ...prev, [propertyId]: false }));
    }
  };

  const requiredCustom = useMemo(() => {
    return customFields.filter((f) => (f.isRequired || f.is_required) && (f.slug || f.fieldName));
  }, [customFields]);

  const validate = () => {
    const next: typeof errors = {};

    if (canContact) {
      if (!contactName.trim()) next.contact = "Guest name is required";
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
        next.contact = "Please enter a valid email address";
      }
    }

    if (can("hotels")) {
      for (const h of hotels) {
        if (h.checkInDate && h.checkOutDate && new Date(h.checkInDate) >= new Date(h.checkOutDate)) {
          next.dates = "Check-out date must be after check-in date";
          break;
        }
      }
    }

    if (canCustom && requiredCustom.length > 0) {
      const missing = requiredCustom.filter((f) => {
        const key = (f.slug || f.fieldName) as string;
        const v = customData[key];
        return v === undefined || v === null || v === "";
      });
      if (missing.length > 0) {
        next.custom = `Please fill in required fields: ${missing
          .map((f) => f.name || f.label || f.slug || f.fieldName)
          .join(", ")}`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPatch = (): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};

    if (can("contactDetails")) {
      patch.contactDetails = {
        name: contactName.trim(),
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      } satisfies LeadContactDetails;
    }

    if (can("hotels")) {
      patch.hotels = hotels.map((h) => ({
        propertyId: h.propertyId || undefined,
        hotelName:
          h.hotelName ||
          allProperties.find((p) => p._id === h.propertyId)?.name ||
          undefined,
        checkInDate: h.checkInDate ? new Date(h.checkInDate).toISOString() : undefined,
        checkOutDate: h.checkOutDate ? new Date(h.checkOutDate).toISOString() : undefined,
        roomsRequested: (h.roomsRequested || [])
          .filter((r) => !!r.roomTypeId)
          .map((r) => ({
            roomTypeId: r.roomTypeId || undefined,
            roomTypeName: r.roomTypeName || undefined,
            quantity: Number(r.quantity) || 1,
            adults: Number(r.adults) || 1,
            children: Number(r.children) || 0,
            notes: r.notes || undefined,
          })),
      }));
    }

    if (can("budget") && budget.trim() !== "") patch.budget = Number(budget);
    if (can("customerType") && customerType) patch.customerType = customerType;
    if (can("bookingWindow") && bookingWindow) patch.bookingWindow = bookingWindow;
    if (can("notes")) patch.notes = notes;
    // Backend enum doesn't include OTA; persist it as BRAND_WEBSITE (same approach as create-lead flows).
    if (can("source") && source) patch.source = source === "OTA" ? "BRAND_WEBSITE" : source;
    if (can("heatLevel") && heatLevel) patch.heatLevel = normalizeHeatLevel(heatLevel);

    if (can("customData")) {
      patch.customData = Object.keys(customData).length > 0 ? customData : {};
    }

    // Root hotel booking fields are legacy; prefer itineraries. Leave untouched here.

    return patch;
  };

  const handleSave = async () => {
    if (!canAny) return;
    if (!validate()) return;

    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setErrors({ contact: "You don't have permission to update any fields in this form." });
      return;
    }

    try {
      setIsSaving(true);
      await onSave(patch);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const anyTabEnabled = {
    contact: canContact,
    trip: canTrip,
    business: canBusiness,
    custom: canCustom,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>Update the lead fields you have access to.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="contact" disabled={!anyTabEnabled.contact}>
              Contact
            </TabsTrigger>
            <TabsTrigger value="trip" disabled={!anyTabEnabled.trip}>
              Trip / Hotels
            </TabsTrigger>
            <TabsTrigger value="business" disabled={!anyTabEnabled.business}>
              Business
            </TabsTrigger>
            <TabsTrigger value="custom" disabled={!anyTabEnabled.custom}>
              Additional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="mt-4 space-y-4">
            {!canContact && (
              <p className="text-xs text-muted-foreground">You don&apos;t have permission to edit contact details.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="lead-contact-name">Guest Name</Label>
                <Input
                  id="lead-contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={!canContact}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-contact-phone">Phone</Label>
                <Input
                  id="lead-contact-phone"
                  placeholder="+919876543210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={!canContact}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-contact-email">Email</Label>
                <Input
                  id="lead-contact-email"
                  type="email"
                  placeholder="guest@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!canContact}
                />
              </div>
            </div>
            {errors.contact && <p className="text-sm text-red-500">{errors.contact}</p>}
          </TabsContent>

          <TabsContent value="trip" className="mt-4 space-y-4">
            {!canTrip && (
              <p className="text-xs text-muted-foreground">You don&apos;t have permission to edit trip/hotel details.</p>
            )}
            {errors.dates && <p className="text-sm text-red-500">{errors.dates}</p>}

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Hotel booking details</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!can("hotels")}
                onClick={() =>
                  setHotels((prev) => [
                    ...prev,
                    {
                      propertyId: "",
                      hotelName: "",
                      checkInDate: "",
                      checkOutDate: "",
                      roomsRequested: [{ roomTypeId: "", roomTypeName: "", quantity: "1", adults: "1", children: "0" }],
                    },
                  ])
                }
              >
                Add Hotel
              </Button>
            </div>

            <div className="space-y-4">
              {hotels.map((h, hotelIdx) => {
                const cat = h.propertyId ? catalogueByPropertyId[h.propertyId] : undefined;
                const roomTypes = cat?.roomTypes || [];
                const hotelOptions = allProperties.map((p) => ({ value: p._id, label: p.name }));

                return (
                  <div key={hotelIdx} className="rounded-lg border bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Hotel {hotelIdx + 1}</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!h.propertyId || !!syncingByPropertyId[h.propertyId]}
                          onClick={() => syncCatalogueForProperty(h.propertyId)}
                        >
                          {syncingByPropertyId[h.propertyId] ? "Syncing…" : "Sync catalogue"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!can("hotels") || hotels.length <= 1}
                          onClick={() => setHotels((prev) => prev.filter((_, i) => i !== hotelIdx))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Hotel Name</Label>
                        <SearchableSelect
                          options={hotelOptions.length ? hotelOptions : [{ value: "", label: "No PMS hotels available", disabled: true }]}
                          value={h.propertyId}
                          placeholder="Select Hotel"
                          disabled={!can("hotels") || !hotelOptions.length}
                          onValueChange={(val) => {
                            setHotels((prev) => {
                              const copy = [...prev];
                              const selected = allProperties.find((p) => p._id === val);
                              copy[hotelIdx] = {
                                ...copy[hotelIdx],
                                propertyId: val,
                                hotelName: selected?.name || "",
                                roomsRequested: [{ roomTypeId: "", roomTypeName: "", quantity: "1", adults: "1", children: "0" }],
                              };
                              return copy;
                            });
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Check-in Date</Label>
                          <Input
                            type="date"
                            value={h.checkInDate}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHotels((prev) => {
                                const copy = [...prev];
                                copy[hotelIdx] = { ...copy[hotelIdx], checkInDate: v };
                                return copy;
                              });
                            }}
                            disabled={!can("hotels")}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Check-out Date</Label>
                          <Input
                            type="date"
                            value={h.checkOutDate}
                            min={h.checkInDate}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHotels((prev) => {
                                const copy = [...prev];
                                copy[hotelIdx] = { ...copy[hotelIdx], checkOutDate: v };
                                return copy;
                              });
                            }}
                            disabled={!can("hotels")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">Rooms requested</div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!can("hotels")}
                          onClick={() =>
                            setHotels((prev) => {
                              const copy = [...prev];
                              const rr = copy[hotelIdx].roomsRequested || [];
                              copy[hotelIdx] = {
                                ...copy[hotelIdx],
                                roomsRequested: [...rr, { roomTypeId: "", roomTypeName: "", quantity: "1", adults: "1", children: "0" }],
                              };
                              return copy;
                            })
                          }
                        >
                          Add Room Type
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {(h.roomsRequested || []).map((r, roomIdx) => {
                          const orphanLabel = resolveRoomTypeDisplayName(r.roomTypeId, r.roomTypeName, roomTypes);
                          const canRemove = (h.roomsRequested || []).length > 1;
                          return (
                            <div key={roomIdx} className="grid gap-3 rounded-md border p-3 md:grid-cols-6">
                              <div className="md:col-span-2 grid gap-2">
                                <Label className="text-xs">Room Type</Label>
                                <Select
                                  value={r.roomTypeId}
                                  onValueChange={(val) => {
                                    const picked = roomTypes.find((x) => x.roomTypeId === val);
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = [...(copy[hotelIdx].roomsRequested || [])];
                                      rr[roomIdx] = { ...rr[roomIdx], roomTypeId: val, roomTypeName: picked?.roomTypeName || rr[roomIdx].roomTypeName };
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr };
                                      return copy;
                                    });
                                  }}
                                  disabled={!can("hotels") || !h.propertyId}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={h.propertyId ? "Select room type" : "Select a hotel first"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {!!r.roomTypeId && !roomTypes.some((x) => x.roomTypeId === r.roomTypeId) && (
                                      <SelectItem value={r.roomTypeId}>{orphanLabel}</SelectItem>
                                    )}
                                    {roomTypes.map((rt) => (
                                      <SelectItem key={rt.roomTypeId} value={rt.roomTypeId}>
                                        {resolveRoomTypeDisplayName(rt.roomTypeId, rt.roomTypeName, roomTypes)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2">
                                <Label className="text-xs">Qty</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={r.quantity}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = [...(copy[hotelIdx].roomsRequested || [])];
                                      rr[roomIdx] = { ...rr[roomIdx], quantity: v };
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr };
                                      return copy;
                                    });
                                  }}
                                  disabled={!can("hotels")}
                                />
                              </div>

                              <div className="grid gap-2">
                                <Label className="text-xs">Adults</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={r.adults}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = [...(copy[hotelIdx].roomsRequested || [])];
                                      rr[roomIdx] = { ...rr[roomIdx], adults: v };
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr };
                                      return copy;
                                    });
                                  }}
                                  disabled={!can("hotels")}
                                />
                              </div>

                              <div className="grid gap-2">
                                <Label className="text-xs">Children</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={r.children}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = [...(copy[hotelIdx].roomsRequested || [])];
                                      rr[roomIdx] = { ...rr[roomIdx], children: v };
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr };
                                      return copy;
                                    });
                                  }}
                                  disabled={!can("hotels")}
                                />
                              </div>

                              <div className="md:col-span-6 grid gap-2">
                                <Label className="text-xs">Notes</Label>
                                <Input
                                  value={r.notes || ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = [...(copy[hotelIdx].roomsRequested || [])];
                                      rr[roomIdx] = { ...rr[roomIdx], notes: v };
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr };
                                      return copy;
                                    });
                                  }}
                                  disabled={!can("hotels")}
                                />
                              </div>

                              <div className="md:col-span-6 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!can("hotels") || !canRemove}
                                  onClick={() =>
                                    setHotels((prev) => {
                                      const copy = [...prev];
                                      const rr = (copy[hotelIdx].roomsRequested || []).filter((_, i) => i !== roomIdx);
                                      copy[hotelIdx] = { ...copy[hotelIdx], roomsRequested: rr.length ? rr : copy[hotelIdx].roomsRequested };
                                      return copy;
                                    })
                                  }
                                >
                                  Remove Room Type
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="business" className="mt-4 space-y-4">
            {!canBusiness && (
              <p className="text-xs text-muted-foreground">You don&apos;t have permission to edit business fields.</p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="lead-budget">Budget</Label>
              <Input
                id="lead-budget"
                type="number"
                placeholder="e.g., 700000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={!can("budget")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lead-customerType">Customer Type</Label>
              <Select value={customerType} onValueChange={setCustomerType} disabled={!can("customerType")}>
                <SelectTrigger id="lead-customerType">
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
              <Label htmlFor="lead-bookingWindow">Booking Window</Label>
              <Select value={bookingWindow} onValueChange={setBookingWindow} disabled={!can("bookingWindow")}>
                <SelectTrigger id="lead-bookingWindow">
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
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={!can("notes")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lead-source">Lead Source</Label>
              <Select value={source} onValueChange={setSource} disabled={!can("source")}>
                <SelectTrigger id="lead-source">
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
              <Label htmlFor="lead-heat">Heat Level</Label>
              <Select value={heatLevel} onValueChange={setHeatLevel} disabled={!can("heatLevel")}>
                <SelectTrigger id="lead-heat">
                  <SelectValue placeholder="Select heat level (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOT">Hot</SelectItem>
                  <SelectItem value="WARM">Warm</SelectItem>
                  <SelectItem value="COLD">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4 space-y-4">
            {!canCustom && (
              <p className="text-xs text-muted-foreground">You don&apos;t have permission to edit additional fields.</p>
            )}
            {customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional fields configured.</p>
            ) : (
              <div className="grid gap-4">
                {customFields.map((field) => {
                  const fieldSlug = (field.slug || field.fieldName) as string;
                  const fieldName = field.name || field.label || fieldSlug;
                  const isRequired = field.isRequired || field.is_required;
                  const dataType = String((field.dataType || field.type || "")).toUpperCase();

                  if (!fieldSlug) return null;

                  return (
                    <div key={field._id || fieldSlug} className="grid gap-2">
                      <Label className="flex gap-1">
                        {fieldName} {isRequired && <span className="text-red-500">*</span>}
                      </Label>
                      {dataType === "TEXT" && (
                        <Input
                          placeholder={fieldName}
                          value={customData[fieldSlug] || ""}
                          onChange={(e) => setCustomData((prev) => ({ ...prev, [fieldSlug]: e.target.value }))}
                          disabled={!canCustom}
                        />
                      )}
                      {dataType === "NUMBER" && (
                        <Input
                          type="number"
                          placeholder={fieldName}
                          value={customData[fieldSlug] || ""}
                          onChange={(e) =>
                            setCustomData((prev) => ({ ...prev, [fieldSlug]: Number(e.target.value) || "" }))
                          }
                          disabled={!canCustom}
                        />
                      )}
                      {dataType === "TEXTAREA" && (
                        <Textarea
                          placeholder={fieldName}
                          value={customData[fieldSlug] || ""}
                          onChange={(e) => setCustomData((prev) => ({ ...prev, [fieldSlug]: e.target.value }))}
                          disabled={!canCustom}
                        />
                      )}
                      {dataType === "DATE" && (
                        <Input
                          type="date"
                          value={customData[fieldSlug] || ""}
                          onChange={(e) => setCustomData((prev) => ({ ...prev, [fieldSlug]: e.target.value }))}
                          disabled={!canCustom}
                        />
                      )}
                      {dataType === "BOOLEAN" && (
                        <div className="flex items-center h-10 space-x-2">
                          <Switch
                            checked={!!customData[fieldSlug]}
                            onCheckedChange={(checked) => setCustomData((prev) => ({ ...prev, [fieldSlug]: checked }))}
                            disabled={!canCustom}
                          />
                        </div>
                      )}
                      {dataType === "DROPDOWN" && (
                        <Select
                          value={customData[fieldSlug] || ""}
                          onValueChange={(value) => setCustomData((prev) => ({ ...prev, [fieldSlug]: value }))}
                          disabled={!canCustom}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${fieldName}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(field.options || []).map((opt: any) => {
                              const val = typeof opt === "string" ? opt : opt.value;
                              const lbl = typeof opt === "string" ? opt : opt.label;
                              return (
                                <SelectItem key={String(val)} value={String(val)}>
                                  {String(lbl)}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {errors.custom && <p className="text-sm text-red-500">{errors.custom}</p>}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !canAny}>
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

