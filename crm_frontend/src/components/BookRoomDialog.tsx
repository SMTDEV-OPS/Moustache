import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { RoomBookingCard } from "@/components/booking/RoomBookingCard";
import { BookingReviewSummary } from "@/components/booking/BookingReviewSummary";
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
import {
  buildRateFieldsFromPms,
  mealPlanOptionsForRoomType,
  resolveRatePlanForSelection,
  useEzeeRatesForProperty,
} from "@/services/ezeeRates";
import { useAuth } from "@/context/AuthContext";

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

/** Radix Select requires non-empty `value`; maps to no `sourceId` in the booking API. */
const BOOKING_SOURCE_DIRECT = "__direct__";
const BUSINESS_SOURCE_NONE = "__business_source_none__";
const BUSINESS_SOURCE_HOLIDAYS_UNLIMITED_ID = "29680000000000001858";
const GUEST_GENDER_UNSET = "__gender_unset__";

function defaultOccupancyCaps(): Pick<RoomRow, "baseAdultOccupancy" | "maxAdultOccupancy" | "maxChildOccupancy"> {
  return { baseAdultOccupancy: 1, maxAdultOccupancy: 10, maxChildOccupancy: 5 };
}

type BookStep = 1 | 2 | 3 | 4 | "done";

const WIZARD_STEPS: { n: 1 | 2 | 3 | 4; label: string }[] = [
  { n: 1, label: "Dates" },
  { n: 2, label: "Rooms" },
  { n: 3, label: "Guest" },
  { n: 4, label: "Review" },
];

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

/** Scales PMS pre-tax nightly rates (InsertBooking `baserate` / RoomList) by discount %. */
function computeDiscountedRates(
  match: AvailableRoomRow,
  nights: number,
  discountPercent: number
): { ratePerNight: number; nightlyRates: RoomRow["nightlyRates"] } {
  const d = Math.min(100, Math.max(0, discountPercent));
  const factor = 1 - d / 100;
  const rawNights = match.nightlyRates ?? [];
  if (rawNights.length > 0) {
    const nightlyRates = rawNights.map((n) => ({
      date: n.date,
      rate: Math.round(n.rate * factor * 100) / 100,
      extraAdult: n.extraAdult ?? 0,
      extraChild: n.extraChild ?? 0,
    }));
    const total = nightlyRates.reduce((s, n) => s + n.rate, 0);
    const ratePerNight = nights > 0 ? Math.round((total / nights) * 100) / 100 : 0;
    return { ratePerNight, nightlyRates };
  }
  const base = nights > 0 ? match.totalBeforeTax / nights : 0;
  const ratePerNight = Math.round(base * factor * 100) / 100;
  return { ratePerNight, nightlyRates: [] };
}

function buildInitialRoomRows(lead: LeadDetail["lead"], hotelId: string): RoomRow[] {
  const firstItin = lead?.itineraries?.find((it: any) => {
    const pid = typeof it?.propertyId === "string" ? it.propertyId : it?.propertyId?._id;
    return pid && String(pid) === String(hotelId);
  });
  const reqs: any[] = Array.isArray(firstItin?.roomsRequested) ? firstItin.roomsRequested : [];
  const caps = defaultOccupancyCaps();
  const t = Date.now();
  const rows: RoomRow[] = [];

  for (const req of reqs) {
    const qty = Math.max(1, Number(req?.quantity) || 1);
    for (let q = 0; q < qty; q++) {
      rows.push({
        id: `room-${rows.length + 1}-${t}`,
        roomTypeId: req.roomTypeId || undefined,
        roomTypeName: req.roomTypeName || undefined,
        rateTypeId: req.mealPlanId || req.ratePlanId || undefined,
        planName: req.mealPlanName || req.ratePlanName || undefined,
        adults: Math.min(Math.max(1, Number(req.adults) || 1), caps.maxAdultOccupancy),
        children: Math.max(0, Number(req.children) || 0),
        ratePerNight: Number(req.estimatedRate) || 0,
        nightlyRates: [],
        ...caps,
      });
    }
  }

  if (rows.length === 0) {
    return Array.from({ length: 1 }).map((_, idx) => ({
      id: `room-${idx + 1}-${t}`,
      adults: Math.min(Math.max(1, caps.baseAdultOccupancy), caps.maxAdultOccupancy),
      children: 0,
      ratePerNight: 0,
      nightlyRates: [],
      ...caps,
    }));
  }
  return rows;
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
  const { user, can } = useAuth();
  const discountCap = useMemo(() => {
    if (user?.isAdmin) return 20;
    if (can("leads.manage") || can("settings.manage") || can("quotations.manage")) return 20;
    return 15;
  }, [user?.isAdmin, can]);

  const [step, setStep] = useState<BookStep>(1);
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const [physicalRooms, setPhysicalRooms] = useState<{ roomId: string; roomName: string }[]>([]);
  const [physicalRoomsLoading, setPhysicalRoomsLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [available, setAvailable] = useState<AvailableRoomRow[]>([]);
  const [channelSources, setChannelSources] = useState<EzeeChannelSource[]>([]);
  const [sourceId, setSourceId] = useState<string>(BOOKING_SOURCE_DIRECT);
  const [businessSourceId, setBusinessSourceId] = useState<string>(BUSINESS_SOURCE_NONE);
  const [promotionCode, setPromotionCode] = useState("");
  const [lockedPromoCode, setLockedPromoCode] = useState<string | null>(null);
  const [promoError, setPromoError] = useState("");
  /** Extra % off pre-tax nightly rates (after any PMS promotion); sent to eZee via lower `baserate`. */
  const [bookingDiscountPercent, setBookingDiscountPercent] = useState(0);
  const prevBookingDiscountRef = useRef(bookingDiscountPercent);
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

  const { mapping: ezeeMapping, rateMap: ezeeRateMap } = useEzeeRatesForProperty(
    hotel.hotelId,
    checkIn,
    checkOut
  );

  useEffect(() => {
    if (!open || !ezeeMapping || !ezeeRateMap) return;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.roomTypeId || r.roomRateId) return r;
        const mealId = r.rateTypeId || mealPlanOptionsForRoomType(ezeeMapping, r.roomTypeId, r.roomTypeName)[0]?.id;
        if (!mealId) return r;
        const patch = buildRateFieldsFromPms(ezeeMapping, ezeeRateMap, r.roomTypeId, r.roomTypeName, mealId);
        if (!patch.estimatedRate && !r.ratePerNight) return r;
        return {
          ...r,
          rateTypeId: patch.mealPlanId || r.rateTypeId,
          planName: patch.mealPlanName || patch.ratePlanName || r.planName,
          ratePerNight: r.ratePerNight || patch.estimatedRate || 0,
        };
      })
    );
  }, [open, ezeeMapping, ezeeRateMap]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setActiveRoomIdx(0);
    setError(null);
    setBookingRef("");
    setReadBack(null);
    setSourceId(BOOKING_SOURCE_DIRECT);
    setBusinessSourceId(BUSINESS_SOURCE_NONE);
    setPromotionCode("");
    setLockedPromoCode(null);
    setPromoError("");
    setBookingDiscountPercent(0);
    prevBookingDiscountRef.current = 0;
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

  useEffect(() => {
    if (!open || nights <= 0) return;

    const prevDisc = prevBookingDiscountRef.current;
    const disc = bookingDiscountPercent;
    const discountChanged = prevDisc !== disc;
    prevBookingDiscountRef.current = disc;

    const applyFromPlan = () => {
      setRows((prevRows) =>
        prevRows.map((r) => {
          if (!r.roomRateId) return r;
          const match = available.find((x) => x.roomRateId === r.roomRateId);
          if (!match) return r;
          const { ratePerNight, nightlyRates } = computeDiscountedRates(match, nights, disc);
          return { ...r, ratePerNight, nightlyRates };
        })
      );
    };

    if (disc > 0) {
      applyFromPlan();
      return;
    }
    if (discountChanged) {
      applyFromPlan();
    }
  }, [bookingDiscountPercent, available, nights, open]);

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

  const plansForRoomType = (roomTypeId?: string) => {
    const fromAvail = available
      .filter((r) => String(r.roomTypeId) === String(roomTypeId))
      .sort((a, b) => a.planName.localeCompare(b.planName));
    if (fromAvail.length > 0 || !roomTypeId || !ezeeMapping) return fromAvail;

    const mealOpts = mealPlanOptionsForRoomType(ezeeMapping, roomTypeId);
    return mealOpts.map((mp) => {
      const plan = resolveRatePlanForSelection(ezeeMapping, roomTypeId, undefined, mp.id);
      const patch = buildRateFieldsFromPms(ezeeMapping, ezeeRateMap, roomTypeId, undefined, mp.id);
      const nightly = nights > 0 ? (patch.estimatedRate || 0) * nights : 0;
      return {
        roomTypeId,
        roomRateId: `fallback_${roomTypeId}_${mp.id}`,
        rateTypeId: mp.id,
        roomTypeName: "",
        planName: mp.name,
        availableRooms: 1,
        totalBeforeTax: nightly,
        totalTax: 0,
        baseAdultOccupancy: 1,
        maxAdultOccupancy: 10,
        maxChildOccupancy: 5,
        nightlyRates: [],
      } as AvailableRoomRow;
    });
  };

  const resetRowToPms = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId || !r.roomTypeId || !ezeeMapping || !ezeeRateMap) return r;
        const mealId = r.rateTypeId || mealPlanOptionsForRoomType(ezeeMapping, r.roomTypeId, r.roomTypeName)[0]?.id;
        if (!mealId) return r;
        const patch = buildRateFieldsFromPms(ezeeMapping, ezeeRateMap, r.roomTypeId, r.roomTypeName, mealId);
        const match = r.roomRateId ? available.find((x) => x.roomRateId === r.roomRateId) : undefined;
        if (match) {
          const { ratePerNight, nightlyRates } = computeDiscountedRates(match, nights, bookingDiscountPercent);
          return { ...r, ratePerNight, nightlyRates, rateTypeId: patch.mealPlanId || r.rateTypeId, planName: patch.mealPlanName || r.planName };
        }
        return {
          ...r,
          rateTypeId: patch.mealPlanId || r.rateTypeId,
          planName: patch.mealPlanName || patch.ratePlanName || r.planName,
          ratePerNight: patch.estimatedRate || 0,
        };
      })
    );
  };

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
        const { ratePerNight, nightlyRates } = computeDiscountedRates(first, nights, bookingDiscountPercent);
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
          nightlyRates,
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
        const match =
          available.find((x) => x.roomRateId === roomRateId) ||
          plansForRoomType(r.roomTypeId).find((x) => x.roomRateId === roomRateId);
        if (!match) return r;
        const { ratePerNight, nightlyRates } = computeDiscountedRates(match, nights, bookingDiscountPercent);
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
          nightlyRates,
          baseAdultOccupancy: baseAdult,
          maxAdultOccupancy: maxAdult,
          maxChildOccupancy: maxChild,
          adults,
          children,
        };
      })
    );
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((r) => r.id === rowId);
      const next = prev.filter((r) => r.id !== rowId);
      setActiveRoomIdx((i) => Math.min(i >= idx ? Math.max(0, i - 1) : i, next.length - 1));
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const caps = defaultOccupancyCaps();
      const next = [
        ...prev,
        {
          id: `room-${prev.length + 1}-${Date.now()}`,
          adults: Math.min(Math.max(1, caps.baseAdultOccupancy), caps.maxAdultOccupancy),
          children: 0,
          ratePerNight: 0,
          nightlyRates: [],
          ...caps,
        },
      ];
      if (next.length > 2) setActiveRoomIdx(next.length - 1);
      return next;
    });
  };

  const displayedRoomIdx = rows.length > 2 ? activeRoomIdx : 0;
  const displayedRow = rows[displayedRoomIdx];

  useEffect(() => {
    if (!displayedRow?.roomTypeId || !hotel.hotelId) {
      setPhysicalRooms([]);
      return;
    }
    setPhysicalRoomsLoading(true);
    fetchPhysicalRooms({
      hotelId: hotel.hotelId,
      roomTypeId: displayedRow.roomTypeId,
      fromDate: checkIn,
      toDate: checkOut,
    })
      .then(setPhysicalRooms)
      .catch(() => setPhysicalRooms([]))
      .finally(() => setPhysicalRoomsLoading(false));
  }, [displayedRow?.roomTypeId, hotel.hotelId, checkIn, checkOut]);

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
    const manualDiscountSavings =
      bookingDiscountPercent > 0
        ? rows.reduce((sum, r) => {
            if (!r.roomRateId || nights <= 0) return sum;
            const plan = available.find((x) => x.roomRateId === r.roomRateId);
            if (!plan) return sum;
            const listNights = plan.nightlyRates ?? [];
            let listTotal = listNights.reduce((s, n) => s + n.rate, 0);
            if (listTotal <= 0) listTotal = plan.totalBeforeTax ?? 0;
            const curNights = r.nightlyRates ?? [];
            const curTotal =
              curNights.length > 0 ? curNights.reduce((s, n) => s + n.rate, 0) : (Number(r.ratePerNight) || 0) * nights;
            return sum + Math.max(0, listTotal - curTotal);
          }, 0)
        : 0;
    return {
      roomCharges,
      taxes,
      due: roomCharges + taxes,
      totalPromotionSavings,
      manualDiscountSavings,
    };
  }, [rows, nights, available, bookingDiscountPercent]);

  const canContinueFromStep1 = nights > 0 && !!checkIn && !!checkOut;
  const canContinueFromStep2 =
    nights > 0 && rows.every((r) => r.roomTypeId && r.roomRateId && r.rateTypeId && r.ratePerNight > 0);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const canContinueFromStep3 =
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

  const renderStepper = () => {
    if (step === "done") return null;
    const current = step as 1 | 2 | 3 | 4;
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {WIZARD_STEPS.map(({ n, label }, i) => {
          const done = n < current;
          const active = n === current;
          return (
            <div key={n} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground text-xs">—</span> : null}
              <Badge
                variant={active ? "default" : done ? "secondary" : "outline"}
                className="gap-1 font-normal"
              >
                {done ? <Check className="h-3 w-3" /> : <span>{n}</span>}
                {label}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFooter = () => {
    if (step === "done") {
      return (
        <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      );
    }

    if (step === 1) {
      return (
        <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background flex-row justify-between sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => setStep(2)} disabled={!canContinueFromStep1}>
            Continue
          </Button>
        </DialogFooter>
      );
    }

    if (step === 2) {
      return (
        <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background flex-row flex-wrap gap-2 justify-between sm:justify-between">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              Due <span className="font-semibold text-foreground">{money(pricing.due)}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addRow} disabled={loadingRooms}>
              Add room
            </Button>
            <Button type="button" onClick={() => setStep(3)} disabled={!canContinueFromStep2 || loadingRooms}>
              {loadingRooms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continue
            </Button>
          </div>
        </DialogFooter>
      );
    }

    if (step === 3) {
      return (
        <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background flex-row justify-between sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button type="button" onClick={() => setStep(4)} disabled={!canContinueFromStep3}>
            Continue
          </Button>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="px-6 py-4 shrink-0 border-t bg-background flex-row justify-between sm:justify-between">
        <Button type="button" variant="outline" onClick={() => setStep(3)}>
          Back
        </Button>
        <Button type="button" onClick={confirmBooking} disabled={confirming}>
          {confirming ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Confirm booking
        </Button>
      </DialogFooter>
    );
  };

  const roomsToShow =
    rows.length > 2 ? [rows[displayedRoomIdx]].filter(Boolean) : rows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100vw-2rem,960px)] max-h-[min(90vh,720px)] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Book room · {hotel.hotelName}</DialogTitle>
          {renderStepper()}
        </DialogHeader>

        {error ? (
          <div className="mx-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shrink-0">{error}</div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-2">
          {step === 1 ? (
            <div className="space-y-4 max-w-lg">
              <div className="grid grid-cols-3 gap-3">
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
                  <Input value={String(nights || 0)} readOnly className="bg-muted/40" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Booking source</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BUSINESS_SOURCE_NONE}>Not specified</SelectItem>
                      <SelectItem value={BUSINESS_SOURCE_HOLIDAYS_UNLIMITED_ID}>HOLIDAYS UNLIMITED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3 h-full flex flex-col min-h-0">
              <div className="flex flex-wrap items-end gap-3 shrink-0">
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs">Promotion code</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={promotionCode}
                      onChange={(e) => {
                        setPromotionCode(e.target.value);
                        setPromoError("");
                        if (lockedPromoCode) setLockedPromoCode(null);
                      }}
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={!promotionCode.trim() || loadingRooms}
                      onClick={() => void handleApplyPromo()}
                    >
                      Apply
                    </Button>
                  </div>
                  {promoError ? <p className="text-xs text-red-600">{promoError}</p> : null}
                  {lockedPromoCode ? <p className="text-xs text-green-600">Applied: {lockedPromoCode}</p> : null}
                </div>
                <div className="space-y-1 w-28">
                  <Label className="text-xs">Discount %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={discountCap}
                    step={0.5}
                    className="h-9"
                    value={String(bookingDiscountPercent)}
                    onChange={(e) => {
                      const v = Math.min(discountCap, Math.max(0, Number(e.target.value || 0)));
                      setBookingDiscountPercent(Number.isFinite(v) ? v : 0);
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">max {discountCap}%</p>
                </div>
              </div>

              {rows.length > 2 ? (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {rows.map((r, idx) => (
                    <Button
                      key={r.id}
                      type="button"
                      size="sm"
                      variant={idx === activeRoomIdx ? "default" : "outline"}
                      onClick={() => setActiveRoomIdx(idx)}
                    >
                      Room {idx + 1}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="flex-1 min-h-0 overflow-hidden">
                {roomsToShow.map((r) => {
                  const idx = rows.findIndex((x) => x.id === r.id);
                  return (
                    <RoomBookingCard
                      key={r.id}
                      row={r}
                      rowIndex={idx}
                      hotelId={hotel.hotelId}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      loadingRooms={loadingRooms}
                      canRemove={rows.length > 1}
                      roomTypeOptions={roomTypeOptions}
                      plans={plansForRoomType(r.roomTypeId)}
                      checkAvailability={checkAvailability}
                      lockedPromoCode={lockedPromoCode}
                      available={available}
                      ezeeMapping={ezeeMapping}
                      ezeeRateMap={ezeeRateMap}
                      physicalRooms={physicalRooms}
                      physicalRoomsLoading={physicalRoomsLoading}
                      onChooseRoomType={(v) => chooseRoomType(r.id, v)}
                      onChoosePlan={(v) => choosePlan(r.id, v)}
                      onResetPms={() => resetRowToPms(r.id)}
                      onRemove={() => removeRow(r.id)}
                      onAdultsChange={(n) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, adults: n } : x)))
                      }
                      onChildrenChange={(n) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, children: n } : x)))
                      }
                      onRateChange={(n) =>
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ratePerNight: n } : x)))
                      }
                      onPhysicalRoomChange={(roomId, roomName) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id ? { ...x, physicalRoomId: roomId, physicalRoomName: roomName } : x
                          )
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="h-full overflow-y-auto pr-1 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Title *</Label>
                  <Select value={guestTitle} onValueChange={setGuestTitle}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
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
                  <Label className="text-xs">First name *</Label>
                  <Input className="h-9" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last name *</Label>
                  <Input className="h-9" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input className="h-9" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone *</Label>
                  <Input className="h-9" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+91 …" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender *</Label>
                  <Select value={guestGender} onValueChange={setGuestGender}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GUEST_GENDER_UNSET}>Select gender</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date of birth *</Label>
                  <Input className="h-9" type="date" value={guestDateOfBirth} onChange={(e) => setGuestDateOfBirth(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nationality *</Label>
                  <Input className="h-9" value={guestNationality} onChange={(e) => setGuestNationality(e.target.value)} placeholder="e.g. India" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Country *</Label>
                  <Input className="h-9" value={guestCountry} onChange={(e) => setGuestCountry(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City *</Label>
                  <Input className="h-9" value={guestCity} onChange={(e) => setGuestCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">State</Label>
                  <Input className="h-9" value={guestState} onChange={(e) => setGuestState(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Postal code</Label>
                  <Input className="h-9" value={guestZipcode} onChange={(e) => setGuestZipcode(e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2 lg:col-span-4">
                  <Label className="text-xs">Street address</Label>
                  <Input className="h-9" value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} />
                </div>
                <div className="space-y-1 col-span-2 lg:col-span-4">
                  <Label className="text-xs">Special request</Label>
                  <Textarea value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} rows={2} />
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <BookingReviewSummary
              hotelName={hotel.hotelName}
              checkIn={checkIn}
              checkOut={checkOut}
              nights={nights}
              rows={rows}
              guestTitle={guestTitle}
              guestFirstName={guestFirstName}
              guestLastName={guestLastName}
              guestPhone={guestPhone}
              guestEmail={guestEmail}
              guestCity={guestCity}
              guestState={guestState}
              guestCountry={guestCountry}
              lockedPromoCode={lockedPromoCode}
              bookingDiscountPercent={bookingDiscountPercent}
              pricing={pricing}
              formatMoney={money}
            />
          ) : null}

          {step === "done" ? (
            <div className="rounded-md border p-4 space-y-3">
              <div className="text-sm font-semibold">Booking confirmed</div>
              <div className="text-sm text-muted-foreground">eZee reference</div>
              <div className="text-lg font-semibold">{bookingRef}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const data = await readEzeeBooking({ hotelId: hotel.hotelId, bookingRef });
                    setReadBack(data);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to read booking");
                  }
                }}
              >
                View booking details
              </Button>
              {readBack ? (
                <pre className="max-h-[200px] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(readBack, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}

