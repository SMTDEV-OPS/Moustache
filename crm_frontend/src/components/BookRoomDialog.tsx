import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import type { LeadDetail } from "@/services/leads";
import {
  fetchAvailableRooms,
  fetchEzeeRoomInfo,
  fetchPhysicalRooms,
  type AvailableRoomRow,
  type EzeeChannelSource,
  createEzeeBooking,
  readEzeeBooking,
} from "@/services/ezeeBooking";

type HotelChoice = {
  hotelId: string;
  hotelName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
};

type RoomRow = {
  id: string;
  roomTypeId?: string;
  roomRateId?: string; // critical
  rateTypeId?: string;
  roomTypeName?: string;
  planName?: string;
  adults: number;
  children: number;
  ratePerNight: number;
  nightlyRates: { date: string; rate: number; extraAdult?: number; extraChild?: number }[];
  baseAdultOccupancy: number;
  maxAdultOccupancy: number;
  maxChildOccupancy: number;
  physicalRoomId?: string;
  physicalRoomName?: string;
};

const NONE_PHYSICAL = "__none_physical__";
/** Radix Select requires non-empty `value`; maps to no `sourceId` in the booking API. */
const BOOKING_SOURCE_DIRECT = "__direct__";
const BUSINESS_SOURCE_NONE = "__business_source_none__";
const BUSINESS_SOURCE_HOLIDAYS_UNLIMITED_ID = "29680000000000001858";
const GUEST_GENDER_UNSET = "__gender_unset__";

function defaultOccupancyCaps(): Pick<RoomRow, "baseAdultOccupancy" | "maxAdultOccupancy" | "maxChildOccupancy"> {
  return { baseAdultOccupancy: 1, maxAdultOccupancy: 10, maxChildOccupancy: 5 };
}

function PhysicalRoomSelect({
  hotelId,
  roomTypeId,
  fromDate,
  toDate,
  value,
  onChange,
}: {
  hotelId: string;
  roomTypeId: string;
  fromDate: string;
  toDate: string;
  value?: string;
  onChange: (roomId: string | undefined, roomName: string | undefined) => void;
}) {
  const [rooms, setRooms] = useState<{ roomId: string; roomName: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roomTypeId) return;
    setLoading(true);
    fetchPhysicalRooms({ hotelId, roomTypeId, fromDate, toDate })
      .then(setRooms)
      .catch(() => setRooms([]))
      .finally(() => setLoading(false));
  }, [hotelId, roomTypeId, fromDate, toDate]);

  if (loading) {
    return <span className="text-xs text-muted-foreground">Loading rooms…</span>;
  }
  if (rooms.length === 0) {
    return <span className="text-xs text-muted-foreground">No physical rooms</span>;
  }

  return (
    <Select
      value={value && rooms.some((r) => r.roomId === value) ? value : NONE_PHYSICAL}
      onValueChange={(val) => {
        if (val === NONE_PHYSICAL) {
          onChange(undefined, undefined);
          return;
        }
        const hit = rooms.find((r) => r.roomId === val);
        if (hit) onChange(hit.roomId, hit.roomName);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Room no." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_PHYSICAL}>Not specified</SelectItem>
        {rooms.map((r) => (
          <SelectItem key={r.roomId} value={r.roomId}>
            {r.roomName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  const d = Math.round((b - a) / 86400000);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function ymdRange(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const d = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function checkAvailability(entry: AvailableRoomRow, checkIn: string, checkOut: string): boolean {
  const byDate = entry.availableByDate;
  if (!byDate || Object.keys(byDate).length === 0) return (entry.availableRooms ?? 0) > 0;
  const nights = ymdRange(checkIn, checkOut);
  return nights.every((date) => {
    const v = (byDate as any)[date];
    if (v === undefined || v === null || v === "") return true;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n > 0 : true;
  });
}

function money(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function buildInitialRoomRows(lead: LeadDetail["lead"], hotelId: string): RoomRow[] {
  const firstItin = lead?.itineraries?.find((it: any) => {
    const pid = typeof it?.propertyId === "string" ? it.propertyId : it?.propertyId?._id;
    return pid && String(pid) === String(hotelId);
  });
  const reqs: any[] = Array.isArray(firstItin?.roomsRequested) ? firstItin.roomsRequested : [];
  const count = Math.max(1, reqs.reduce((sum, r) => sum + (Number(r?.quantity) || 0), 0));
  const caps = defaultOccupancyCaps();
  const t = Date.now();
  return Array.from({ length: count }).map((_, idx) => ({
    id: `room-${idx + 1}-${t}`,
    adults: Math.min(Math.max(1, caps.baseAdultOccupancy), caps.maxAdultOccupancy),
    children: 0,
    ratePerNight: 0,
    nightlyRates: [],
    ...caps,
  }));
}

export function BookRoomDialog({
  open,
  onOpenChange,
  lead,
  hotel,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadDetail["lead"];
  hotel: HotelChoice;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [available, setAvailable] = useState<AvailableRoomRow[]>([]);
  const [channelSources, setChannelSources] = useState<EzeeChannelSource[]>([]);
  const [sourceId, setSourceId] = useState<string>(BOOKING_SOURCE_DIRECT);
  const [businessSourceId, setBusinessSourceId] = useState<string>(BUSINESS_SOURCE_NONE);
  const [promotionCode, setPromotionCode] = useState("");
  const [lockedPromoCode, setLockedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState(hotel.checkIn);
  const [checkOut, setCheckOut] = useState(hotel.checkOut);
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut]);

  const initialGuestName = String(lead?.contactDetails?.name || "").trim();
  const [guestTitle, setGuestTitle] = useState("Mr");
  const [guestFirstName, setGuestFirstName] = useState(initialGuestName.split(" ")[0] || "");
  const [guestLastName, setGuestLastName] = useState(initialGuestName.split(" ").slice(1).join(" ") || "");
  const [guestEmail, setGuestEmail] = useState(String(lead?.contactDetails?.email || "").trim());
  const [guestPhone, setGuestPhone] = useState(String(lead?.contactDetails?.phone || "").trim());
  const [guestGender, setGuestGender] = useState<string>(GUEST_GENDER_UNSET);
  const [guestDateOfBirth, setGuestDateOfBirth] = useState("");
  const [guestNationality, setGuestNationality] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestCountry, setGuestCountry] = useState("India");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestState, setGuestState] = useState("");
  const [guestZipcode, setGuestZipcode] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");

  const [bookingRef, setBookingRef] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [readBack, setReadBack] = useState<any>(null);

  const [rows, setRows] = useState<RoomRow[]>(() => buildInitialRoomRows(lead, hotel.hotelId));

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setBookingRef("");
    setReadBack(null);
    setSourceId(BOOKING_SOURCE_DIRECT);
    setBusinessSourceId(BUSINESS_SOURCE_NONE);
    setPromotionCode("");
    setLockedPromoCode(null);
    setPromoError("");
    setGuestGender(GUEST_GENDER_UNSET);
    setGuestDateOfBirth("");
    setGuestNationality("");
    setGuestCity("");
    setGuestCountry("India");
    setGuestAddress("");
    setGuestState("");
    setGuestZipcode("");
  }, [open]);

  useEffect(() => {
    if (!open || !hotel.hotelId) return;
    fetchEzeeRoomInfo(hotel.hotelId)
      .then((d) => setChannelSources(d.channelSources ?? []))
      .catch(() => setChannelSources([]));
  }, [open, hotel.hotelId]);

  useEffect(() => {
    if (!open) return;
    if (!hotel.hotelId || !checkIn || !checkOut) return;
    if (nights <= 0) return;
    if (lockedPromoCode) return;
    setLoadingRooms(true);
    setError(null);
    fetchAvailableRooms({ hotelId: hotel.hotelId, fromDate: checkIn, toDate: checkOut })
      .then((data) => setAvailable(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rooms"))
      .finally(() => setLoadingRooms(false));
  }, [open, hotel.hotelId, checkIn, checkOut, nights, lockedPromoCode]);

  const handleApplyPromo = async () => {
    const code = promotionCode.trim();
    setPromoError("");
    if (!code) return;
    setLoadingRooms(true);
    const refetchBase = async () => {
      const base = await fetchAvailableRooms({
        hotelId: hotel.hotelId,
        fromDate: checkIn,
        toDate: checkOut,
      });
      setAvailable(base);
    };
    try {
      const data = await fetchAvailableRooms({
        hotelId: hotel.hotelId,
        fromDate: checkIn,
        toDate: checkOut,
        promotionCode: code,
      });
      if (!data?.length) {
        setPromoError("No rooms available with this promotion code.");
        setLockedPromoCode(null);
        await refetchBase();
        return;
      }
      const anyDiscounted = data.some((r) => r.isDiscounted);
      if (!anyDiscounted) {
        setPromoError("Promotion code not recognised or not applicable.");
        setLockedPromoCode(null);
        await refetchBase();
        return;
      }
      setAvailable(data);
      setLockedPromoCode(code);
      setRows(buildInitialRoomRows(lead, hotel.hotelId));
    } catch {
      setPromoError("Failed to apply promotion code. Please try again.");
      setLockedPromoCode(null);
      try {
        await refetchBase();
      } catch {
        /* ignore */
      }
    } finally {
      setLoadingRooms(false);
    }
  };

  const roomTypeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; minAvail: number; anyUnavailable: boolean }>();
    for (const r of available) {
      const id = String(r.roomTypeId);
      if (!id) continue;
      const prev = map.get(id);
      const name = String(r.roomTypeName || `Room ${id}`).trim();
      const minAvail = Number(r.availableRooms) || 0;
      const ok = checkAvailability(r, checkIn, checkOut);
      if (!prev) map.set(id, { id, name, minAvail, anyUnavailable: !ok });
      else
        map.set(id, {
          ...prev,
          minAvail: Math.max(prev.minAvail, minAvail),
          anyUnavailable: prev.anyUnavailable || !ok,
        });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [available, checkIn, checkOut]);

  const plansForRoomType = (roomTypeId?: string) =>
    available
      .filter((r) => String(r.roomTypeId) === String(roomTypeId))
      .sort((a, b) => a.planName.localeCompare(b.planName));

  const capsForRoomTypeId = (roomTypeId: string) => {
    const entries = available.filter((a) => String(a.roomTypeId) === String(roomTypeId));
    const first = entries[0];
    const baseAdult = Number(first?.baseAdultOccupancy) > 0 ? Number(first?.baseAdultOccupancy) : 1;
    let maxAdult = entries.reduce((m, e) => Math.max(m, Number(e.maxAdultOccupancy) || 0), 0);
    if (maxAdult < 1) maxAdult = 10;
    maxAdult = Math.max(maxAdult, baseAdult, 1);
    let maxChild = entries.reduce((m, e) => Math.max(m, Number(e.maxChildOccupancy) || 0), 0);
    if (maxChild < 0) maxChild = 0;
    if (maxChild === 0 && entries.length === 0) maxChild = 5;
    return { baseAdultOccupancy: baseAdult, maxAdultOccupancy: maxAdult, maxChildOccupancy: maxChild };
  };

  const chooseRoomType = (rowId: string, roomTypeId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const caps = capsForRoomTypeId(roomTypeId);
        const plans = plansForRoomType(roomTypeId);
        const first = plans[0];
        if (!first) {
          return {
            ...r,
            roomTypeId,
            roomRateId: undefined,
            rateTypeId: undefined,
            roomTypeName: undefined,
            planName: undefined,
            ratePerNight: 0,
            physicalRoomId: undefined,
            physicalRoomName: undefined,
            ...caps,
            adults: Math.min(Math.max(1, caps.baseAdultOccupancy), caps.maxAdultOccupancy),
            children: 0,
          };
        }
        const ratePerNight = nights > 0 ? Math.round((first.totalBeforeTax / nights) * 100) / 100 : 0;
        const planCaps = {
          baseAdultOccupancy: Number(first.baseAdultOccupancy) > 0 ? Number(first.baseAdultOccupancy) : caps.baseAdultOccupancy,
          maxAdultOccupancy: Math.max(
            caps.maxAdultOccupancy,
            Number(first.maxAdultOccupancy) || 0,
            Number(first.baseAdultOccupancy) || 1
          ),
          maxChildOccupancy: Math.max(caps.maxChildOccupancy, Number(first.maxChildOccupancy) || 0),
        };
        planCaps.maxAdultOccupancy = Math.max(planCaps.maxAdultOccupancy, planCaps.baseAdultOccupancy, 1);
        const adults = Math.min(Math.max(1, planCaps.baseAdultOccupancy), planCaps.maxAdultOccupancy);
        return {
          ...r,
          roomTypeId,
          roomRateId: first.roomRateId,
          rateTypeId: first.rateTypeId,
          roomTypeName: first.roomTypeName,
          planName: first.planName,
          ratePerNight,
          nightlyRates: (first.nightlyRates ?? []).map((n) => ({
            date: n.date,
            rate: n.rate,
            extraAdult: n.extraAdult ?? 0,
            extraChild: n.extraChild ?? 0,
          })),
          physicalRoomId: undefined,
          physicalRoomName: undefined,
          ...planCaps,
          adults,
          children: 0,
        };
      })
    );
  };

  const choosePlan = (rowId: string, roomRateId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const match = available.find((x) => x.roomRateId === roomRateId);
        if (!match) return r;
        const ratePerNight = nights > 0 ? Math.round((match.totalBeforeTax / nights) * 100) / 100 : 0;
        const baseAdult =
          Number(match.baseAdultOccupancy) > 0 ? Number(match.baseAdultOccupancy) : r.baseAdultOccupancy || 1;
        let maxAdult = Math.max(r.maxAdultOccupancy || 1, Number(match.maxAdultOccupancy) || 0, baseAdult);
        if (maxAdult < 1) maxAdult = 10;
        maxAdult = Math.max(maxAdult, baseAdult);
        const maxChild = Math.max(r.maxChildOccupancy ?? 0, Number(match.maxChildOccupancy) || 0);
        let adults = Math.min(Math.max(1, r.adults), maxAdult);
        adults = Math.max(1, Math.min(adults, maxAdult));
        let children = Math.min(Math.max(0, r.children), maxChild);
        return {
          ...r,
          roomTypeId: match.roomTypeId,
          roomRateId: match.roomRateId,
          rateTypeId: match.rateTypeId,
          roomTypeName: match.roomTypeName,
          planName: match.planName,
          ratePerNight,
          nightlyRates: (match.nightlyRates ?? []).map((n) => ({
            date: n.date,
            rate: n.rate,
            extraAdult: n.extraAdult ?? 0,
            extraChild: n.extraChild ?? 0,
          })),
          baseAdultOccupancy: baseAdult,
          maxAdultOccupancy: maxAdult,
          maxChildOccupancy: maxChild,
          adults,
          children,
        };
      })
    );
  };

  const removeRow = (rowId: string) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));
  const addRow = () =>
    setRows((prev) => {
      const caps = defaultOccupancyCaps();
      return [
        ...prev,
        {
          id: `room-${prev.length + 1}-${Date.now()}`,
          adults: Math.min(Math.max(1, caps.baseAdultOccupancy), caps.maxAdultOccupancy),
          children: 0,
          ratePerNight: 0,
          ...caps,
        },
      ];
    });

  const pricing = useMemo(() => {
    const roomCharges = rows.reduce((sum, r) => sum + (Number(r.ratePerNight) || 0) * nights, 0);
    // Tax estimate: proportional to selected plan totals (best-effort while allowing editable base rate).
    const taxes = rows.reduce((sum, r) => {
      const plan = r.roomRateId ? available.find((x) => x.roomRateId === r.roomRateId) : undefined;
      if (!plan || nights <= 0) return sum;
      const base = plan.totalBeforeTax || 0;
      const tax = plan.totalTax || 0;
      if (base <= 0) return sum + tax;
      const ratio = tax / base;
      return sum + (Number(r.ratePerNight) || 0) * nights * ratio;
    }, 0);
    const totalPromotionSavings = rows.reduce((sum, r) => {
      const plan = r.roomRateId ? available.find((x) => x.roomRateId === r.roomRateId) : undefined;
      const amt = plan?.discount?.discountAmount;
      return sum + (typeof amt === "number" && Number.isFinite(amt) ? amt : 0);
    }, 0);
    return {
      roomCharges,
      taxes,
      due: roomCharges + taxes,
      totalPromotionSavings,
    };
  }, [rows, nights, available]);

  const canContinueFromStep1 = nights > 0 && rows.every((r) => r.roomTypeId && r.roomRateId && r.rateTypeId && r.ratePerNight > 0);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const canContinueFromStep2 =
    !!guestFirstName.trim() &&
    !!guestLastName.trim() &&
    emailOk &&
    guestPhone.trim().length >= 7 &&
    guestGender !== GUEST_GENDER_UNSET &&
    !!guestDateOfBirth &&
    !!guestNationality.trim() &&
    !!guestCity.trim() &&
    !!guestCountry.trim();

  const confirmBooking = async () => {
    setConfirming(true);
    setError(null);
    try {
      const payloadRooms = rows.map((r) => {
        const pid = String(r.physicalRoomId || "").trim();
        const tid = String(r.roomTypeId || "").trim();
        const physicalRoomId = pid && pid !== tid ? pid : undefined;
        const physicalRoomName = physicalRoomId ? r.physicalRoomName : undefined;
        return {
          roomTypeId: r.roomTypeId!,
          rateTypeId: r.rateTypeId!,
          roomRateId: r.roomRateId!,
          roomTypeName: r.roomTypeName || "Room",
          planName: r.planName || "Plan",
          adults: r.adults,
          children: r.children,
          baseRate: r.ratePerNight,
          extraAdultRate: 0,
          extraChildRate: 0,
          nightlyRates: r.nightlyRates,
          ...(physicalRoomId ? { physicalRoomId, physicalRoomName } : {}),
        };
      });
      const resp = await createEzeeBooking({
        hotelId: hotel.hotelId,
        leadId: (lead as any)._id || (lead as any).id,
        checkIn,
        checkOut,
        paymentMode: "0",
        guestTitle,
        guestFirstName,
        guestLastName,
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        guestGender: guestGender as "Male" | "Female",
        guestDateOfBirth,
        guestNationality: guestNationality.trim(),
        guestCity: guestCity.trim(),
        guestCountry: guestCountry.trim(),
        ...(guestAddress.trim() ? { guestAddress: guestAddress.trim() } : {}),
        ...(guestState.trim() ? { guestState: guestState.trim() } : {}),
        ...(guestZipcode.trim() ? { guestZipcode: guestZipcode.trim() } : {}),
        specialRequest,
        ...(sourceId && sourceId !== BOOKING_SOURCE_DIRECT ? { sourceId } : {}),
        ...(businessSourceId && businessSourceId !== BUSINESS_SOURCE_NONE ? { businessSourceId } : {}),
        ...(lockedPromoCode ? { promotionCode: lockedPromoCode } : {}),
        rooms: payloadRooms,
      });
      setBookingRef(resp.bookingRef);
      setStep("done");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>
            Book room · {hotel.hotelName}
            {step !== "done" ? <span className="ml-2 text-sm font-normal text-muted-foreground">Step {step} of 3</span> : null}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                <div className="space-y-1">
                  <Label>Check-in</Label>
                  <Input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      setPromotionCode("");
                      setLockedPromoCode(null);
                      setPromoError("");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Check-out</Label>
                  <Input
                    type="date"
                    value={checkOut}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      setPromotionCode("");
                      setLockedPromoCode(null);
                      setPromoError("");
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nights</Label>
                  <Input value={String(nights || 0)} readOnly />
                </div>
                <div className="space-y-1">
                  <Label>Rooms</Label>
                  <Input value={String(rows.length)} readOnly />
                </div>
                <div className="space-y-1">
                  <Label>Reservation type</Label>
                  <Select value="confirm">
                    <SelectTrigger>
                      <SelectValue placeholder="Confirm Booking" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirm">Confirm Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Booking source</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BOOKING_SOURCE_DIRECT}>Direct</SelectItem>
                      {channelSources.map((s) => (
                        <SelectItem key={s.channelId} value={s.channelId}>
                          {s.channelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Business source</Label>
                  <Select value={businessSourceId} onValueChange={setBusinessSourceId}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BUSINESS_SOURCE_NONE}>Not specified</SelectItem>
                      <SelectItem value={BUSINESS_SOURCE_HOLIDAYS_UNLIMITED_ID}>HOLIDAYS UNLIMITED</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Sent to eZee as Source_Id when set; overrides booking source.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1 max-w-md">
                <Label className="text-xs text-muted-foreground">Promotion code</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Enter code"
                    value={promotionCode}
                    onChange={(e) => {
                      setPromotionCode(e.target.value);
                      setPromoError("");
                      if (lockedPromoCode) setLockedPromoCode(null);
                    }}
                    className="w-40"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!promotionCode.trim() || loadingRooms}
                    onClick={() => void handleApplyPromo()}
                  >
                    Apply
                  </Button>
                  {lockedPromoCode ? (
                    <span className="text-xs text-green-600 self-center">Applied</span>
                  ) : null}
                </div>
                {promoError ? <p className="text-xs text-red-600">{promoError}</p> : null}
              </div>

              <div className="rounded-md border">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                  <div className="col-span-2">Room type</div>
                  <div className="col-span-2">Rate type / Meal plan</div>
                  <div className="col-span-2">Room no.</div>
                  <div className="col-span-2">Guests</div>
                  <div className="col-span-2 text-right">Rate ₹ (per night)</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {rows.map((r) => {
                  const plans = plansForRoomType(r.roomTypeId);
                  return (
                    <div key={r.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-t items-center">
                      <div className="col-span-2">
                        <Select value={r.roomTypeId || ""} onValueChange={(v) => chooseRoomType(r.id, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingRooms ? "Loading…" : "Select"} />
                          </SelectTrigger>
                          <SelectContent>
                            {roomTypeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate">{opt.name}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {opt.minAvail} avail
                                    {opt.anyUnavailable ? <span className="text-amber-700"> · some nights unavailable</span> : null}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Select value={r.roomRateId || ""} onValueChange={(v) => choosePlan(r.id, v)} disabled={!r.roomTypeId}>
                          <SelectTrigger>
                            <SelectValue placeholder={!r.roomTypeId ? "Select room type" : "Select"} />
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((p) => {
                              const ok = checkAvailability(p, checkIn, checkOut);
                              return (
                                <SelectItem key={p.roomRateId} value={p.roomRateId} disabled={!ok}>
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="truncate">{p.planName}</span>
                                    {!ok ? (
                                      <span className="text-xs text-amber-700 whitespace-nowrap">Unavailable</span>
                                    ) : null}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        {r.roomTypeId && hotel.hotelId ? (
                          <PhysicalRoomSelect
                            hotelId={hotel.hotelId}
                            roomTypeId={r.roomTypeId}
                            fromDate={checkIn}
                            toDate={checkOut}
                            value={r.physicalRoomId}
                            onChange={(roomId, roomName) =>
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, physicalRoomId: roomId, physicalRoomName: roomName } : x)))
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      <div className="col-span-2 flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={String(r.adults)}
                            onValueChange={(val) =>
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, adults: Number(val) } : x)))
                            }
                          >
                            <SelectTrigger className="w-[4.5rem]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: r.maxAdultOccupancy || 10 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                  {n === r.baseAdultOccupancy ? " (base)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={String(r.children)}
                            onValueChange={(val) =>
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, children: Number(val) } : x)))
                            }
                            disabled={!r.roomTypeId}
                          >
                            <SelectTrigger className="w-[4.5rem]">
                              <SelectValue placeholder="0" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: (r.maxChildOccupancy ?? 5) + 1 }, (_, i) => i).map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {r.roomTypeId ? (
                          <p className="text-xs text-muted-foreground">
                            Max {r.maxAdultOccupancy} adults · Max {r.maxChildOccupancy} children
                          </p>
                        ) : null}
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(r.ratePerNight || 0)}
                          onChange={(e) =>
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ratePerNight: Number(e.target.value) || 0 } : x)))
                          }
                        />
                        {lockedPromoCode && r.roomRateId ? (() => {
                          const selectedPlan = available.find((a) => a.roomRateId === r.roomRateId);
                          const d = selectedPlan?.discount;
                          if (!d) return null;
                          return (
                            <div className="text-xs text-green-600 mt-1">
                              {d.promotionName ? `${d.promotionName} — ` : ""}
                              {d.discountPercentage > 0 ? `${d.discountPercentage}% off` : "Promo applied"}
                              {d.couponCode ? ` (${d.couponCode})` : ""}
                            </div>
                          );
                        })() : null}
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(r.id)} aria-label="Remove room">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={addRow} disabled={loadingRooms}>
                  Add room
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button type="button" onClick={() => setStep(2)} disabled={!canContinueFromStep1 || loadingRooms}>
                    {loadingRooms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Continue
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 h-fit">
              <div className="text-sm font-semibold">Billing summary</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Check-in</span>
                  <span>{checkIn}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Check-out</span>
                  <span>{checkOut}</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between">
                  <span>Room charges</span>
                  <span>{money(pricing.roomCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (est.)</span>
                  <span>{money(pricing.taxes)}</span>
                </div>
                {lockedPromoCode && pricing.totalPromotionSavings > 0 ? (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Est. savings (promo)</span>
                    <span>{money(pricing.totalPromotionSavings)}</span>
                  </div>
                ) : null}
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Due amount</span>
                  <span>{money(pricing.due)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="text-sm font-medium">Guest details</div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>
                  Title <span className="text-red-500">*</span>
                </Label>
                <Select value={guestTitle} onValueChange={setGuestTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>
                  First name <span className="text-red-500">*</span>
                </Label>
                <Input value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div className="space-y-1">
                <Label>
                  Last name <span className="text-red-500">*</span>
                </Label>
                <Input value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} autoComplete="family-name" />
              </div>
              <div className="space-y-1">
                <Label>
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1">
                <Label>
                  Phone number <span className="text-red-500">*</span>
                </Label>
                <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} autoComplete="tel" placeholder="+91 …" />
              </div>
              <div className="space-y-1">
                <Label>
                  Gender <span className="text-red-500">*</span>
                </Label>
                <Select value={guestGender} onValueChange={setGuestGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GUEST_GENDER_UNSET}>Select gender</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>
                  Date of birth <span className="text-red-500">*</span>
                </Label>
                <Input type="date" value={guestDateOfBirth} onChange={(e) => setGuestDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>
                  Nationality <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={guestNationality}
                  onChange={(e) => setGuestNationality(e.target.value)}
                  placeholder="e.g. India"
                  autoComplete="country-name"
                />
              </div>
            </div>
            <div className="text-sm font-medium pt-2">Address</div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input value={guestCountry} onChange={(e) => setGuestCountry(e.target.value)} autoComplete="country-name" />
              </div>
              <div className="space-y-1">
                <Label>
                  City <span className="text-red-500">*</span>
                </Label>
                <Input value={guestCity} onChange={(e) => setGuestCity(e.target.value)} autoComplete="address-level2" placeholder="Enter city" />
              </div>
              <div className="space-y-1">
                <Label>State / region</Label>
                <Input value={guestState} onChange={(e) => setGuestState(e.target.value)} autoComplete="address-level1" />
              </div>
              <div className="space-y-1">
                <Label>Postal code</Label>
                <Input value={guestZipcode} onChange={(e) => setGuestZipcode(e.target.value)} autoComplete="postal-code" />
              </div>
              <div className="space-y-1 lg:col-span-4">
                <Label>Street address</Label>
                <Input value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} autoComplete="street-address" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Special request</Label>
              <Textarea value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} disabled={!canContinueFromStep2}>
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Review</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {hotel.hotelName} · {checkIn} → {checkOut} · {nights} night{nights === 1 ? "" : "s"}
              </div>
              {lockedPromoCode ? (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Promotion code</span>
                  <span className="font-medium text-green-600">{lockedPromoCode}</span>
                </div>
              ) : null}
              {businessSourceId && businessSourceId !== BUSINESS_SOURCE_NONE ? (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Business source (eZee Source_Id)</span>
                  <span className="font-medium">HOLIDAYS UNLIMITED</span>
                </div>
              ) : null}
              <div className="mt-4 space-y-2">
                {rows.map((r, idx) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        Room {idx + 1}: {r.roomTypeName || r.roomTypeId} · {r.planName}
                      </div>
                      <div className="text-muted-foreground">
                        {r.adults} adult{r.adults === 1 ? "" : "s"}, {r.children} child{r.children === 1 ? "" : "ren"} · {money(r.ratePerNight)} / night
                      </div>
                    </div>
                    <div className="font-medium">{money(r.ratePerNight * nights)}</div>
                  </div>
                ))}
              </div>
              <div className="h-px bg-border my-3" />
              <div className="flex justify-between text-sm">
                <span>Guest</span>
                <span className="font-medium">
                  {guestTitle} {guestFirstName} {guestLastName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Contact</span>
                <span className="text-muted-foreground">{[guestPhone, guestEmail].filter(Boolean).join(" · ") || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gender</span>
                <span className="font-medium">{guestGender !== GUEST_GENDER_UNSET ? guestGender : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date of birth</span>
                <span className="font-medium">{guestDateOfBirth || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Nationality</span>
                <span className="font-medium">{guestNationality || "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium">
                  {[guestCity, guestState, guestCountry].filter(Boolean).join(", ") || "—"}
                </span>
              </div>
              <div className="h-px bg-border my-3" />
              {lockedPromoCode && pricing.totalPromotionSavings > 0 ? (
                <div className="flex justify-between text-sm text-green-600 mb-2">
                  <span>Est. savings (promo)</span>
                  <span>{money(pricing.totalPromotionSavings)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-semibold">
                <span>Grand total (est.)</span>
                <span>{money(pricing.due)}</span>
              </div>
              {specialRequest?.trim() ? (
                <div className="mt-3 text-sm">
                  <div className="text-muted-foreground">Special request</div>
                  <div className="mt-1">{specialRequest}</div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Edit
              </Button>
              <Button type="button" onClick={confirmBooking} disabled={confirming}>
                {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm booking
              </Button>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <div className="text-sm font-semibold">Booking confirmed</div>
              <div className="mt-1 text-sm text-muted-foreground">eZee reference</div>
              <div className="mt-1 text-lg font-semibold">{bookingRef}</div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const data = await readEzeeBooking({ hotelId: hotel.hotelId, bookingRef });
                      setReadBack(data);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed to read booking");
                    }
                  }}
                >
                  View booking
                </Button>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
              {readBack ? (
                <pre className="mt-3 max-h-[240px] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(readBack, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

