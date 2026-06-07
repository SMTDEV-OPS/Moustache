import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createQuotation, listQuotations, type Quotation, type SendVia } from "@/services/quotations";
import type { Lead, LeadDetail } from "@/services/leads";
import type { LeadBooking } from "@/services/leadBookings";
import { isItineraryPendingForBookings, itineraryPropertyIdFromRaw } from "@/lib/pendingTravel";
import { listEmailAccounts, type EmailAccount } from "@/services/email";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  type EzeeSeparateSourceMapping,
} from "@/services/pms";
import {
  type EzeeRatesLookupMap,
  mealPlanOptionsForRoomType,
  pmsRatePatchFromLookup,
  rateLookupKey,
  resolveEzeeRoomType,
  resolveRatePlanForSelection,
  roomTypeOptionsFromMapping,
} from "@/services/ezeeRates";
import { fetchAvailableRooms, type AvailableRoomRow } from "@/services/ezeeBooking";
import { QuotationPreview, type QuotationFormat, type QuotationPreviewRow } from "@/components/quotation/QuotationPreview";
import { FileText, Mail, MessageCircle, Send, Clock, CheckCircle, AlertTriangle, Eye, RotateCcw } from "lucide-react";

type ItineraryLike = {
  propertyId?: string | { _id: string; name?: string };
  hotelName?: string;
  hotelAddress?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomsRequested?: {
    roomTypeId?: string;
    roomTypeName?: string;
    quantity?: number;
    adults?: number;
    children?: number;
  }[];
};

function formatTaxPercentLabel(n: number): string {
  const x = Number(n) || 0;
  if (!Number.isFinite(x)) return "0";
  const rounded = Math.round(x * 100) / 100;
  if (Number.isInteger(rounded)) return String(Math.round(rounded));
  const s = rounded.toFixed(2).replace(/\.?0+$/, "");
  return s;
}

type RoomRowDraft = {
  rowId: string;
  roomTypeId?: string;
  roomTypeName?: string;
  /** RateTypeID (Meal plan) */
  mealPlanId?: string;
  mealPlanName?: string;
  ratePlanId?: string;
  ratePlanName?: string;
  extraAdultRate?: number;
  extraChildRate?: number;
  rateUnavailable?: boolean;
  adults: number;
  children: number;
  baseRate: number | "";
  extraAdult: number | "";
  extraChild: number | "";
  discountPercent: number;
};

/** Match eZee RoomList row to quotation row (room + meal plan); disambiguate by plan label when needed. */
function pickAvailableRowForQuotationRow(available: AvailableRoomRow[], row: RoomRowDraft): AvailableRoomRow | undefined {
  const rt = String(row.roomTypeId || "").trim();
  const mp = String(row.mealPlanId || "").trim();
  if (!rt || !mp || !available.length) return undefined;
  const candidates = available.filter(
    (a) => String(a.roomTypeId).trim() === rt && String(a.rateTypeId).trim() === mp
  );
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const wantPlan = normName(row.ratePlanName || row.mealPlanName);
  if (wantPlan) {
    const named = candidates.find((c) => normName(c.planName) === wantPlan);
    if (named) return named;
  }
  return candidates[0];
}

type HotelQuoteDraft = {
  propertyId?: string;
  hotelName?: string;
  hotelAddress?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights: number;
  baseRateOptionsByKey?: Record<string, number[]>;
  rows: RoomRowDraft[];
};

type PmsStayTaxTotals = { totalBeforeTax: number; totalTax: number };

/**
 * Tax matches live booking: when PMS RoomList totals exist, tax scales with pre-tax rate after discount
 * (same ratio as totalTax/totalBeforeTax for the stay). Otherwise GST slab on discounted nightly rate.
 */
function computeQuotationRowTotals(
  baseRate: number,
  discountPercent: number,
  nights: number,
  discountCap: number,
  pmsStayTotals?: PmsStayTaxTotals | null
) {
  const disc = Math.min(discountCap, Math.max(0, discountPercent));
  const discountedNightlyRate = baseRate * (1 - disc / 100);
  const n = Math.max(1, nights);
  let taxPerNight: number;
  let taxPercent: number;
  if (pmsStayTotals && pmsStayTotals.totalBeforeTax > 0) {
    const ratio = pmsStayTotals.totalTax / pmsStayTotals.totalBeforeTax;
    taxPerNight = discountedNightlyRate * ratio;
    taxPercent =
      discountedNightlyRate > 0 ? Math.round((taxPerNight / discountedNightlyRate) * 10000) / 100 : 0;
  } else {
    taxPercent = discountedNightlyRate > 7499 ? 18 : 5;
    taxPerNight = (discountedNightlyRate * taxPercent) / 100;
  }
  const discountAmountPerNight = baseRate - discountedNightlyRate;
  return {
    discountedNightlyRate,
    taxPercent,
    taxPerNight,
    taxTotal: taxPerNight * n,
    discountAmountPerNight,
    discountAmountTotal: discountAmountPerNight * n,
    discountedSubtotal: discountedNightlyRate * n,
    roomTotal: (discountedNightlyRate + taxPerNight) * n,
  };
}

type QuotationDraft = {
  id: string;
  label: string;
  hotelQuotes: HotelQuoteDraft[];
  sent?: boolean;
};

interface SendQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  leadDetail?: LeadDetail | null;
  leadBookings?: LeadBooking[];
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  propertyName?: string;
  onQuotationSent?: () => void;
}

export const SendQuotationDialog = ({
  open,
  onOpenChange,
  lead,
  leadDetail,
  leadBookings = [],
  guestName,
  guestEmail,
  guestPhone,
  propertyName, // kept for back-compat; not relied on for multi-hotel quoting
  onQuotationSent,
}: SendQuotationDialogProps) => {
  const { toast } = useToast();
  const { user, can } = useAuth();

  const [activeTab, setActiveTab] = useState<"create" | "history">("create");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [quotationHistory, setQuotationHistory] = useState<Quotation[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const [sendVia, setSendVia] = useState<SendVia>("EMAIL");
  const [recipientName, setRecipientName] = useState<string>(guestName || "");
  const [recipientEmail, setRecipientEmail] = useState<string>(guestEmail || "");
  const [recipientPhone, setRecipientPhone] = useState<string>(guestPhone || "");

  const [activeDraftIdx, setActiveDraftIdx] = useState(0);
  const [quoteView, setQuoteView] = useState<"build" | "preview">("build");
  const [drafts, setDrafts] = useState<QuotationDraft[]>([]);
  const [ezeeMappingByPropertyId, setEzeeMappingByPropertyId] = useState<Record<string, EzeeSeparateSourceMapping>>({});
  const [ezeeErrorByPropertyId, setEzeeErrorByPropertyId] = useState<Record<string, string>>({});
  const [ezeeRateMapByPropertyId, setEzeeRateMapByPropertyId] = useState<Record<string, EzeeRatesLookupMap>>({});
  const [ezeeRateErrorByPropertyId, setEzeeRateErrorByPropertyId] = useState<Record<string, string>>({});
  const [availableRoomsByPropertyId, setAvailableRoomsByPropertyId] = useState<Record<string, AvailableRoomRow[]>>({});
  const [hotelDetailsByPropertyId, setHotelDetailsByPropertyId] = useState<Record<string, Record<string, unknown>>>({});
  const [hotelDetailsTierByPropertyId, setHotelDetailsTierByPropertyId] = useState<
    Record<string, QuotationFormat>
  >({});
  const [hotelDetailsErrorByPropertyId, setHotelDetailsErrorByPropertyId] = useState<Record<string, string>>({});
  const [hotelDetailsLoading, setHotelDetailsLoading] = useState(false);

  const discountCap = useMemo(() => {
    if (user?.isAdmin) return 20;
    // TL / managers generally have manage permissions
    if (can("leads.manage") || can("settings.manage") || can("quotations.manage")) return 20;
    return 15;
  }, [user?.isAdmin, can]);

  useEffect(() => {
    if (guestName) setRecipientName(guestName);
    if (guestEmail) setRecipientEmail(guestEmail);
    if (guestPhone) setRecipientPhone(guestPhone);
  }, [guestName, guestEmail, guestPhone]);

  const leadForDialog = (leadDetail?.lead ?? lead) as any;
  const itineraries: ItineraryLike[] = useMemo(() => {
    const raw: any[] = Array.isArray(leadForDialog?.itineraries) ? leadForDialog.itineraries : [];
    return raw.filter((it) =>
      isItineraryPendingForBookings(itineraryPropertyIdFromRaw(it), leadBookings)
    );
  }, [leadForDialog, leadBookings]);

  const uniquePropertyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const it of itineraries) {
      const pid =
        typeof it?.propertyId === "object" && it?.propertyId
          ? String((it.propertyId as any)._id)
          : it?.propertyId
            ? String(it.propertyId)
            : "";
      if (pid) ids.add(pid);
    }
    return Array.from(ids);
  }, [itineraries]);

  const ezeeMappingReadyKey = useMemo(
    () =>
      uniquePropertyIds
        .map((pid) => {
          const m = ezeeMappingByPropertyId[pid];
          return m ? `${pid}:${m.ratePlans?.length ?? 0}:${m.rateTypes?.length ?? 0}` : `${pid}:pending`;
        })
        .join("|"),
    [uniquePropertyIds, ezeeMappingByPropertyId]
  );

  const ezeeRatesReadyKey = useMemo(
    () =>
      uniquePropertyIds
        .map((pid) => {
          const m = ezeeRateMapByPropertyId[pid];
          return m ? `${pid}:${Object.keys(m).length}` : `${pid}:pending`;
        })
        .join("|"),
    [uniquePropertyIds, ezeeRateMapByPropertyId]
  );

  function nightsBetween(checkIn?: string, checkOut?: string) {
    if (!checkIn || !checkOut) return 1;
    const cin = new Date(checkIn);
    const cout = new Date(checkOut);
    const diff = Math.ceil((cout.getTime() - cin.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  function buildHotelQuoteDraft(it: ItineraryLike): HotelQuoteDraft {
    const pid =
      typeof it?.propertyId === "object" && it?.propertyId
        ? String((it.propertyId as any)._id)
        : it?.propertyId
          ? String(it.propertyId)
          : undefined;
    const hotelName =
      it?.hotelName ||
      (typeof it?.propertyId === "object" && it?.propertyId ? (it.propertyId as any).name : undefined) ||
      propertyName ||
      undefined;
    const nights = nightsBetween(it.checkInDate, it.checkOutDate);
    const rr = Array.isArray(it.roomsRequested) ? it.roomsRequested : [];
    const rows: RoomRowDraft[] = [];
    for (const r of rr) {
      const qty = Math.max(1, Number(r.quantity ?? 1));
      const adults = Math.max(0, Number(r.adults ?? (leadForDialog?.guests?.adults ?? 1)));
      const children = Math.max(0, Number(r.children ?? (leadForDialog?.guests?.children ?? 0)));
      for (let i = 0; i < qty; i++) {
        rows.push({
          rowId: crypto.randomUUID(),
          roomTypeId: r.roomTypeId ? String(r.roomTypeId) : undefined,
          roomTypeName: r.roomTypeName ? String(r.roomTypeName) : undefined,
          adults,
          children,
          baseRate: "",
          extraAdult: "",
          extraChild: "",
          discountPercent: 0,
        });
      }
    }
    if (rows.length === 0) {
      rows.push({
        rowId: crypto.randomUUID(),
        adults: Math.max(0, Number(leadForDialog?.guests?.adults ?? 1)),
        children: Math.max(0, Number(leadForDialog?.guests?.children ?? 0)),
        baseRate: "",
        extraAdult: "",
        extraChild: "",
        discountPercent: 0,
      });
    }
    const mapping = pid ? ezeeMappingByPropertyId[pid] : undefined;
    const rtOptions = roomTypeOptionsFromMapping(mapping);
    const rateMap = pid ? ezeeRateMapByPropertyId[pid] : undefined;

    return {
      propertyId: pid,
      hotelName,
      hotelAddress: it.hotelAddress,
      checkInDate: it.checkInDate,
      checkOutDate: it.checkOutDate,
      nights,
      baseRateOptionsByKey: {},
      rows: rows.map((r) => {
        const resolvedRoom = resolveEzeeRoomType(mapping, r.roomTypeId, r.roomTypeName);
        const initRoomTypeId = resolvedRoom?.id || (rtOptions.length === 1 ? rtOptions[0].id : r.roomTypeId);
        const initRoomTypeName =
          resolvedRoom?.name ||
          (initRoomTypeId ? rtOptions.find((x) => x.id === initRoomTypeId)?.name : undefined) ||
          r.roomTypeName;

        const mealOpts = mealPlanOptionsForRoomType(mapping, initRoomTypeId, initRoomTypeName);
        const initMealPlanId = mealOpts[0]?.id;
        const initMealPlanName = mealOpts[0]?.name;
        const plan = resolveRatePlanForSelection(mapping, initRoomTypeId, initRoomTypeName, initMealPlanId);
        const key = rateLookupKey(initRoomTypeId, plan?.ratePlanId);
        const hit = key && rateMap ? rateMap[key] : undefined;
        const autoBase = r.baseRate === "";
        return {
          ...r,
          rowId: r.rowId || crypto.randomUUID(),
          roomTypeId: initRoomTypeId,
          roomTypeName: initRoomTypeName,
          mealPlanId: initMealPlanId,
          mealPlanName: initMealPlanName,
          ratePlanId: plan?.ratePlanId,
          ratePlanName: plan?.ratePlanName,
          ...(autoBase
            ? pmsRatePatchFromLookup(key, rateMap)
            : {
                extraAdultRate: hit?.extraAdult,
                extraChildRate: hit?.extraChild,
                rateUnavailable: !!key && !hit,
              }),
        };
      }),
    };
  }

  /** Always one quotation draft per hotel itinerary (separate quotations only). */
  function rebuildSeparateDrafts() {
    const hotelQuotes = itineraries.map(buildHotelQuoteDraft);
    setDrafts(
      hotelQuotes.map((hq, idx) => ({
        id: `q${idx + 1}`,
        label: hq.hotelName || `Hotel ${idx + 1}`,
        hotelQuotes: [hq],
        sent: false,
      }))
    );
    setActiveDraftIdx(0);
    setQuoteView("build");
  }

  // Load quotation history + email accounts + PMS meal plans when dialog opens
  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setActiveDraftIdx(0);
      setHotelDetailsByPropertyId({});
      setHotelDetailsTierByPropertyId({});
      setHotelDetailsErrorByPropertyId({});
      setHotelDetailsLoading(false);
      setAvailableRoomsByPropertyId({});
      return;
    }
    if (lead?.id) {
      void loadQuotationHistory();
      void loadEmailAccounts();
    }
    if (uniquePropertyIds.length === 0) {
      setDrafts([]);
      return;
    }
    let cancelled = false;

    // eZee API 1 (room-info): RoomTypes, RateTypes, RatePlans
    (async () => {
      const out: Record<string, EzeeSeparateSourceMapping> = {};
      const errs: Record<string, string> = {};
      await Promise.all(
        uniquePropertyIds.map(async (pid) => {
          try {
            const qs = new URLSearchParams({ hotelId: pid });
            const res = await fetch(`${API_BASE_URL}/api/ezee/room-info?${qs.toString()}`, {
              headers: withAuthHeaders(),
            });
            if (!res.ok) throw new Error("room-info failed");
            out[pid] = (await res.json()) as EzeeSeparateSourceMapping;
          } catch {
            out[pid] = { roomTypes: [], rateTypes: [], ratePlans: [] };
            errs[pid] = "Could not fetch room plans from PMS. Enter details manually.";
          }
        })
      );
      if (cancelled) return;
      setEzeeMappingByPropertyId((prev) => ({ ...prev, ...out }));
      setEzeeErrorByPropertyId((prev) => ({ ...prev, ...errs }));
    })();

    // eZee API 2 (rates + RoomList): same date range as booking — rates map + tax breakdown per plan
    ;(async () => {
      const out: Record<string, EzeeRatesLookupMap> = {};
      const availOut: Record<string, AvailableRoomRow[]> = {};
      const errs: Record<string, string> = {};

      const itineraryByPropertyId = new Map<string, ItineraryLike>();
      for (const it of itineraries) {
        const pid =
          typeof it?.propertyId === "object" && it?.propertyId
            ? String((it.propertyId as any)._id)
            : it?.propertyId
              ? String(it.propertyId)
              : "";
        if (pid && !itineraryByPropertyId.has(pid)) itineraryByPropertyId.set(pid, it);
      }

      await Promise.all(
        uniquePropertyIds.map(async (pid) => {
          const it = itineraryByPropertyId.get(pid);
          const fromDate = (it?.checkInDate || "").split("T")[0];
          const toDate = (it?.checkOutDate || "").split("T")[0];
          if (!fromDate || !toDate) {
            out[pid] = {};
            availOut[pid] = [];
            errs[pid] = "Check-in/Check-out dates missing on this lead — rates unavailable.";
            return;
          }
          const qs = new URLSearchParams({ hotelId: pid, fromDate, toDate });
          const [ratesSettled, availSettled] = await Promise.allSettled([
            (async () => {
              const res = await fetch(`${API_BASE_URL}/api/ezee/rates?${qs.toString()}`, {
                headers: withAuthHeaders(),
              });
              if (!res.ok) throw new Error("rates failed");
              return (await res.json()) as EzeeRatesLookupMap;
            })(),
            fetchAvailableRooms({ hotelId: pid, fromDate, toDate }),
          ]);

          if (ratesSettled.status === "fulfilled") {
            out[pid] = ratesSettled.value;
          } else {
            out[pid] = {};
            errs[pid] = "Could not fetch live rates from PMS — enter rates manually.";
          }

          if (availSettled.status === "fulfilled") {
            availOut[pid] = availSettled.value;
          } else {
            availOut[pid] = [];
          }
        })
      );
      if (cancelled) return;
      setEzeeRateMapByPropertyId((prev) => ({ ...prev, ...out }));
      setEzeeRateErrorByPropertyId((prev) => ({ ...prev, ...errs }));
      setAvailableRoomsByPropertyId((prev) => ({ ...prev, ...availOut }));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lead?.id, uniquePropertyIds.join("|")]);

  useEffect(() => {
    if (!open || uniquePropertyIds.length === 0) {
      if (!open) setHotelDetailsLoading(false);
      return;
    }
    let cancelled = false;
    setHotelDetailsLoading(true);
    (async () => {
      const detailsOut: Record<string, Record<string, unknown>> = {};
      const tierOut: Record<string, QuotationFormat> = {};
      const errOut: Record<string, string> = {};
      try {
        await Promise.all(
          uniquePropertyIds.map(async (pid) => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/ezee/hotel-details`, {
                method: "POST",
                headers: withAuthHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ hotelId: pid }),
              });
              if (!res.ok) throw new Error("hotel-details failed");
              const j = (await res.json()) as {
                tier?: string;
                details?: Record<string, unknown>;
                error?: string;
              };
              detailsOut[pid] = (j.details && typeof j.details === "object" ? j.details : {}) as Record<string, unknown>;
              const t = j.tier;
              if (t === "HOSTEL" || t === "SELECT" || t === "LUXURIA") tierOut[pid] = t;
              if (j.error) errOut[pid] = j.error;
            } catch {
              detailsOut[pid] = {};
              errOut[pid] = "Could not load hotel brochure details.";
            }
          })
        );
        if (!cancelled) {
          setHotelDetailsByPropertyId((prev) => ({ ...prev, ...detailsOut }));
          setHotelDetailsTierByPropertyId((prev) => ({ ...prev, ...tierOut }));
          setHotelDetailsErrorByPropertyId((prev) => ({ ...prev, ...errOut }));
        }
      } finally {
        if (!cancelled) setHotelDetailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, uniquePropertyIds.join("|")]);

  useEffect(() => {
    if (!open) return;
    rebuildSeparateDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itineraries.length, ezeeMappingReadyKey, ezeeRatesReadyKey]);

  const loadEmailAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const accounts = await listEmailAccounts();
      setEmailAccounts(accounts);
    } catch (err) {
      console.error("Failed to load email accounts:", err);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const hasEmailAccount = emailAccounts.length > 0;
  const primaryEmailAccount = emailAccounts.find(acc => acc.isPrimary) || emailAccounts[0];

  const loadQuotationHistory = async () => {
    if (!lead?.id) return;
    try {
      setIsLoadingHistory(true);
      const history = await listQuotations(lead.id);
      setQuotationHistory(history);
    } catch (err) {
      console.error("Failed to load quotation history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const activeDraft = drafts[activeDraftIdx];

  function calcHotelSummary(h: HotelQuoteDraft) {
    const nights = Math.max(1, Number(h.nights || 1));
    let discountedSubtotalAll = 0;
    let totalTax = 0;
    let grandTotal = 0;
    const pid = (h.propertyId || "").trim();
    const availList = pid ? availableRoomsByPropertyId[pid] : undefined;
    for (const row of h.rows) {
      const base = Math.max(0, Number(row.baseRate || 0));
      const disc = Math.min(discountCap, Math.max(0, Number(row.discountPercent || 0)));
      const pmsRow = availList?.length ? pickAvailableRowForQuotationRow(availList, row) : undefined;
      const pmsTotals =
        pmsRow && pmsRow.totalBeforeTax > 0
          ? { totalBeforeTax: pmsRow.totalBeforeTax, totalTax: pmsRow.totalTax }
          : null;
      const t = computeQuotationRowTotals(base, disc, nights, discountCap, pmsTotals);
      discountedSubtotalAll += t.discountedSubtotal;
      totalTax += t.taxTotal;
      grandTotal += t.roomTotal;
    }
    return { discountedSubtotalAll, totalTax, grandTotal };
  }

  function calcDraftSummary(d: QuotationDraft) {
    return d.hotelQuotes.reduce(
      (acc, h) => {
        const s = calcHotelSummary(h);
        acc.discountedSubtotalAll += s.discountedSubtotalAll;
        acc.totalTax += s.totalTax;
        acc.grandTotal += s.grandTotal;
        return acc;
      },
      { discountedSubtotalAll: 0, totalTax: 0, grandTotal: 0 }
    );
  }

  const gstSlabNote = useMemo(() => {
    const anyListing = uniquePropertyIds.some((pid) => (availableRoomsByPropertyId[pid]?.length ?? 0) > 0);
    if (anyListing) {
      return "Tax uses the same PMS breakdown as live booking: it scales with your pre-tax nightly rate after discount (ratio from the room listing for this stay). If no matching plan is found, GST slab 5%/18% by nightly rate applies.";
    }
    return "Tax uses GST @ 5% on rooms ≤ ₹7,499/night (after discount) and 18% above when live PMS room listing is unavailable.";
  }, [uniquePropertyIds, availableRoomsByPropertyId]);

  async function sendDraft(draftIdx: number) {
    if (!lead?.id) return;
    if (sendVia === "EMAIL" && !recipientEmail?.trim()) {
      toast({ title: "Email required", description: "Please enter an email address.", variant: "destructive" });
      return;
    }
    if (sendVia === "WHATSAPP" && !recipientPhone?.trim()) {
      toast({ title: "Phone required", description: "Please enter a phone number.", variant: "destructive" });
      return;
    }

    const d = drafts[draftIdx];
    if (!d) return;
    for (const h of d.hotelQuotes) {
      for (const row of h.rows) {
        if (!row.roomTypeId && !row.roomTypeName) {
          toast({ title: "Missing room type", description: "Please select a room type for all rows.", variant: "destructive" });
          return;
        }
        if (!row.mealPlanId && !row.mealPlanName) {
          toast({ title: "Missing meal plan", description: "Please select a meal plan for all rows.", variant: "destructive" });
          return;
        }
        if (row.discountPercent > discountCap) {
          toast({ title: "Discount too high", description: `Max discount is ${discountCap}%`, variant: "destructive" });
          return;
        }
      }
    }

    setIsSending(true);
    try {
      const payload = {
        sentVia: sendVia,
        sentTo: { name: recipientName, email: recipientEmail, phone: recipientPhone },
        hotelQuotes: d.hotelQuotes.map((h) => {
          const nights = Math.max(1, Number(h.nights || 1));
          const pid = (h.propertyId || "").trim();
          const availList = pid ? availableRoomsByPropertyId[pid] : undefined;
          const rows = h.rows.map((row) => {
            const baseRate = Math.max(0, Number(row.baseRate || 0));
            const discountPercent = Math.min(discountCap, Math.max(0, Number(row.discountPercent || 0)));
            const pmsRow = availList?.length ? pickAvailableRowForQuotationRow(availList, row) : undefined;
            const pmsTotals =
              pmsRow && pmsRow.totalBeforeTax > 0
                ? { totalBeforeTax: pmsRow.totalBeforeTax, totalTax: pmsRow.totalTax }
                : null;
            const t = computeQuotationRowTotals(baseRate, discountPercent, nights, discountCap, pmsTotals);
            return {
              roomTypeId: row.roomTypeId,
              roomTypeName: row.roomTypeName,
              mealPlanId: row.mealPlanId,
              mealPlanName: row.mealPlanName,
              ratePlanId: row.ratePlanId,
              ratePlanName: row.ratePlanName,
              adults: row.adults,
              children: row.children,
              baseRate,
              discountPercent,
              discountedRate: t.discountedNightlyRate,
              taxPercent: t.taxPercent,
              taxAmount: t.taxPerNight,
              total: t.roomTotal,
            };
          });
          const subtotal = rows.reduce((s, r) => s + r.discountedRate * nights, 0);
          const totalTax = rows.reduce((s, r) => s + r.taxAmount * nights, 0);
          const grandTotal = rows.reduce((s, r) => s + r.total, 0);
          return {
            propertyId: h.propertyId,
            hotelName: h.hotelName,
            hotelAddress: h.hotelAddress,
            checkInDate: h.checkInDate,
            checkOutDate: h.checkOutDate,
            nights,
            rows,
            subtotal,
            totalTax,
            grandTotal,
          };
        }),
      };

      await createQuotation(lead.id, payload as any);
      toast({ title: "Quotation sent", description: d.label });
      setDrafts((prev) => prev.map((x, i) => (i === draftIdx ? { ...x, sent: true } : x)));
      await loadQuotationHistory();
      onQuotationSent?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send quotation",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  async function sendAll() {
    const indices = drafts.map((d, i) => (d.sent ? -1 : i)).filter((i) => i >= 0);
    for (const i of indices) {
      // eslint-disable-next-line no-await-in-loop
      await sendDraft(i);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[min(100vw-2rem,72rem)] max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Send Quotation
              {lead && (
                <Badge variant="outline" className="ml-2">
                  Lead #{lead.leadNumber}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 min-h-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "history")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">
                <Send className="h-4 w-4 mr-2" />
                Create
              </TabsTrigger>
              <TabsTrigger value="history">
                <Clock className="h-4 w-4 mr-2" />
                History ({quotationHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              {sendVia === "EMAIL" && !hasEmailAccount && !isLoadingAccounts && (
                <Alert variant="destructive" className="border-amber-500 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Email Account Connected</AlertTitle>
                  <AlertDescription>
                    The quotation will be saved but not delivered via email until an email account is connected.
                  </AlertDescription>
                </Alert>
              )}

              {sendVia === "EMAIL" && hasEmailAccount && primaryEmailAccount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-800">
                    Email will be sent from: <strong>{primaryEmailAccount.email}</strong>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-3 lg:col-span-1">
                  <div className="space-y-2">
                    <Label>Send via</Label>
                    <RadioGroup value={sendVia} onValueChange={(v) => setSendVia(v as SendVia)} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="EMAIL" id="send-email" />
                        <Label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                          <Mail className="h-4 w-4 text-blue-600" />
                          Email
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="WHATSAPP" id="send-whatsapp" />
                        <Label htmlFor="send-whatsapp" className="flex items-center gap-2 cursor-pointer">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          WhatsApp
                          <span className="text-xs text-muted-foreground">(Coming soon)</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="q-to-name">Guest name</Label>
                    <Input id="q-to-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                  </div>
                  {sendVia === "EMAIL" ? (
                    <div className="space-y-2">
                      <Label htmlFor="q-to-email">Email *</Label>
                      <Input id="q-to-email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="q-to-phone">Phone *</Label>
                      <Input id="q-to-phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Max discount: <span className="font-medium">{discountCap}%</span>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  {activeDraft && (
                    <div className="space-y-4">
                      {drafts.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {drafts.map((tab, i) => (
                            <Button
                              key={tab.id}
                              type="button"
                              size="sm"
                              variant={i === activeDraftIdx ? "default" : "outline"}
                              className="gap-1.5 shrink-0"
                              onClick={() => {
                                setActiveDraftIdx(i);
                                setQuoteView("build");
                              }}
                            >
                              <span className="truncate">{tab.label}</span>
                              {tab.sent ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="Sent" /> : null}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 font-medium truncate">{activeDraft.label}</div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            variant={quoteView === "build" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setQuoteView("build")}
                          >
                            Build
                          </Button>
                          <Button
                            type="button"
                            variant={quoteView === "preview" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setQuoteView("preview")}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSending || !drafts.length}
                            onClick={() => void sendDraft(activeDraftIdx)}
                          >
                            {isSending ? "Sending…" : "Send"}
                          </Button>
                        </div>
                      </div>

                      {quoteView === "preview" && activeDraft.hotelQuotes[0] ? (
                        <QuotationPreview
                          format={hotelDetailsTierByPropertyId[activeDraft.hotelQuotes[0].propertyId || ""] || "HOSTEL"}
                          loading={hotelDetailsLoading}
                          loadError={hotelDetailsErrorByPropertyId[activeDraft.hotelQuotes[0].propertyId || ""]}
                          hotelName={activeDraft.hotelQuotes[0].hotelName || "Hotel"}
                          hotelAddress={activeDraft.hotelQuotes[0].hotelAddress}
                          checkInDate={
                            activeDraft.hotelQuotes[0].checkInDate
                              ? activeDraft.hotelQuotes[0].checkInDate.split("T")[0]
                              : undefined
                          }
                          checkOutDate={
                            activeDraft.hotelQuotes[0].checkOutDate
                              ? activeDraft.hotelQuotes[0].checkOutDate.split("T")[0]
                              : undefined
                          }
                          nights={Math.max(1, activeDraft.hotelQuotes[0].nights || 1)}
                          guestName={recipientName}
                          guestAdults={leadForDialog?.guests?.adults}
                          guestChildren={leadForDialog?.guests?.children}
                          details={hotelDetailsByPropertyId[activeDraft.hotelQuotes[0].propertyId || ""] || {}}
                          rows={activeDraft.hotelQuotes[0].rows.map((row) => {
                            const base = Math.max(0, Number(row.baseRate || 0));
                            const disc = Math.min(discountCap, Math.max(0, Number(row.discountPercent || 0)));
                            const n = Math.max(1, activeDraft.hotelQuotes[0].nights || 1);
                            const hq0 = activeDraft.hotelQuotes[0];
                            const pid0 = (hq0.propertyId || "").trim();
                            const avail0 = pid0 ? availableRoomsByPropertyId[pid0] : undefined;
                            const pmsRow0 = avail0?.length ? pickAvailableRowForQuotationRow(avail0, row) : undefined;
                            const pmsTotals0 =
                              pmsRow0 && pmsRow0.totalBeforeTax > 0
                                ? { totalBeforeTax: pmsRow0.totalBeforeTax, totalTax: pmsRow0.totalTax }
                                : null;
                            const t = computeQuotationRowTotals(base, disc, n, discountCap, pmsTotals0);
                            return {
                              roomTypeName: row.roomTypeName || "",
                              mealPlanName: row.mealPlanName || "",
                              adults: row.adults,
                              children: row.children,
                              baseRateNight: base,
                              discountAmountTotal: t.discountAmountTotal,
                              discountedSubtotal: t.discountedSubtotal,
                              taxPercent: t.taxPercent,
                              taxTotal: t.taxTotal,
                              roomTotal: t.roomTotal,
                              extraAdultRate: row.extraAdultRate,
                              extraChildRate: row.extraChildRate,
                            } satisfies QuotationPreviewRow;
                          })}
                          grandTotal={calcHotelSummary(activeDraft.hotelQuotes[0]).grandTotal}
                          totalTax={calcHotelSummary(activeDraft.hotelQuotes[0]).totalTax}
                          gstNote={gstSlabNote}
                          formatCurrency={formatCurrency}
                        />
                      ) : null}

                      {quoteView === "build"
                        ? activeDraft.hotelQuotes.map((hq, hIdx) => {
                        const summary = calcHotelSummary(hq);
                        const pid = (hq.propertyId || "").trim();
                        const pmsErr = pid ? ezeeErrorByPropertyId[pid] : undefined;
                        const pmsRatesErr = pid ? ezeeRateErrorByPropertyId[pid] : undefined;
                        const map = pid ? ezeeMappingByPropertyId[pid] : undefined;
                        const hasEzeeData =
                          !!map &&
                          ((map.roomTypes?.length ?? 0) > 0 ||
                            (map.rateTypes?.length ?? 0) > 0 ||
                            (map.ratePlans?.length ?? 0) > 0);
                        const noRatePlansConfigured = hasEzeeData && (map?.ratePlans?.length ?? 0) === 0;
                        return (
                          <div key={hIdx} className="rounded-lg border p-3 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{hq.hotelName || "Hotel"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {hq.checkInDate ? hq.checkInDate.split("T")[0] : "—"} → {hq.checkOutDate ? hq.checkOutDate.split("T")[0] : "—"} · {hq.nights} night{hq.nights === 1 ? "" : "s"}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Pre-tax: {formatCurrency(summary.discountedSubtotalAll)} · Tax: {formatCurrency(summary.totalTax)} · Total:{" "}
                                <span className="font-medium text-foreground">{formatCurrency(summary.grandTotal)}</span>
                              </div>
                            </div>

                            {pmsErr ? (
                              <Alert variant="destructive" className="py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle className="text-sm">PMS unavailable</AlertTitle>
                                <AlertDescription className="text-sm">
                                  {pmsErr}{" "}
                                  <span className="opacity-90">
                                    (You can still fill Room Type and Meal Plan manually.)
                                  </span>
                                </AlertDescription>
                              </Alert>
                            ) : noRatePlansConfigured ? (
                              <Alert className="py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle className="text-sm">No rate plans configured</AlertTitle>
                                <AlertDescription className="text-sm">
                                  No rate plans configured in PMS for this hotel. Please enter details manually.
                                </AlertDescription>
                              </Alert>
                            ) : pmsRatesErr ? (
                              <Alert className="py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle className="text-sm">Rates unavailable</AlertTitle>
                                <AlertDescription className="text-sm">
                                  {pmsRatesErr}
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            <div className="hidden lg:block overflow-x-auto rounded-md border">
                              <table className="min-w-[1150px] w-full text-sm">
                                <thead className="bg-muted/40">
                                  <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium">
                                    <th>Room Type</th>
                                    <th>Meal Plan</th>
                                    <th className="text-right">Adults</th>
                                    <th className="text-right">Children</th>
                                    <th className="text-right">Base / night</th>
                                    <th className="text-right">Disc %</th>
                                    <th className="text-right">Discount</th>
                                    <th className="text-right">Pre-tax</th>
                                    <th className="text-right">Tax %</th>
                                    <th className="text-right">Tax</th>
                                    <th className="text-right">Room total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hq.rows.map((row, rIdx) => {
                                    const disc = Math.min(discountCap, Math.max(0, Number(row.discountPercent || 0)));
                                    const base = Math.max(0, Number(row.baseRate || 0));
                                    const nightsRow = Math.max(1, Number(hq.nights || 1));
                                    const availH = pid ? availableRoomsByPropertyId[pid] : undefined;
                                    const pmsH = availH?.length ? pickAvailableRowForQuotationRow(availH, row) : undefined;
                                    const pmsTotalsH =
                                      pmsH && pmsH.totalBeforeTax > 0
                                        ? { totalBeforeTax: pmsH.totalBeforeTax, totalTax: pmsH.totalTax }
                                        : null;
                                    const t = computeQuotationRowTotals(base, disc, nightsRow, discountCap, pmsTotalsH);
                                    const ezeeMap = hq.propertyId ? ezeeMappingByPropertyId[hq.propertyId] : undefined;
                                    const roomOptions = roomTypeOptionsFromMapping(ezeeMap);
                                    const mealPlans = mealPlanOptionsForRoomType(ezeeMap, row.roomTypeId, row.roomTypeName);
                                    const hasPmsOptions = (roomOptions.length > 0 && (ezeeMap?.ratePlans?.length ?? 0) > 0 && (ezeeMap?.rateTypes?.length ?? 0) > 0);
                                    const noPlansForRoom = hasPmsOptions && row.roomTypeId && mealPlans.length === 0;
                                    const rateMap = hq.propertyId ? ezeeRateMapByPropertyId[hq.propertyId] : undefined;
                                    return (
                                      <tr key={row.rowId || rIdx} className="border-t">
                                        <td className="px-2 py-2">
                                          {hasPmsOptions ? (
                                            <select
                                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                              value={row.roomTypeId || ""}
                                              onChange={(e) => {
                                                const val = e.target.value || "";
                                                const picked = roomOptions.find((x) => x.id === val);
                                                const nextRoomTypeId = val || undefined;
                                                const nextRoomTypeName = picked?.name || undefined;
                                                const nextMealPlans = mealPlanOptionsForRoomType(ezeeMap, nextRoomTypeId, nextRoomTypeName);
                                                const nextMealPlanId = nextMealPlans[0]?.id;
                                                const nextMealPlanName = nextMealPlans[0]?.name;
                                                const plan = resolveRatePlanForSelection(ezeeMap, nextRoomTypeId, nextRoomTypeName, nextMealPlanId);
                                                const key = rateLookupKey(nextRoomTypeId, plan?.ratePlanId);
                                                const ratePatch = pmsRatePatchFromLookup(key, rateMap);

                                                setDrafts((prev) => {
                                                  const next = [...prev];
                                                  const d = next[activeDraftIdx];
                                                  const h = d.hotelQuotes[hIdx];
                                                  const rows = [...h.rows];
                                                  rows[rIdx] = {
                                                    ...rows[rIdx],
                                                    roomTypeId: nextRoomTypeId,
                                                    roomTypeName: nextRoomTypeName,
                                                    mealPlanId: nextMealPlanId,
                                                    mealPlanName: nextMealPlanName,
                                                    ratePlanId: plan?.ratePlanId,
                                                    ratePlanName: plan?.ratePlanName,
                                                    ...ratePatch,
                                                  };
                                                  d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                  next[activeDraftIdx] = { ...d };
                                                  return next;
                                                });
                                              }}
                                            >
                                              <option value="">Select…</option>
                                              {roomOptions.map((rt) => (
                                                <option key={rt.id} value={rt.id}>
                                                  {rt.name}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <Input
                                              value={row.roomTypeName || ""}
                                              placeholder="Enter room type"
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setDrafts((prev) => {
                                                  const next = [...prev];
                                                  const d = next[activeDraftIdx];
                                                  const h = d.hotelQuotes[hIdx];
                                                  const rows = [...h.rows];
                                                  rows[rIdx] = { ...rows[rIdx], roomTypeName: v, roomTypeId: rows[rIdx].roomTypeId };
                                                  d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                  next[activeDraftIdx] = { ...d };
                                                  return next;
                                                });
                                              }}
                                            />
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {hasPmsOptions ? (
                                            <>
                                              <select
                                                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                                value={row.mealPlanId || ""}
                                                disabled={!row.roomTypeId || mealPlans.length === 0}
                                                onChange={(e) => {
                                                  const val = e.target.value || "";
                                                  const picked = mealPlans.find((x) => x.id === val);
                                                  const plan = resolveRatePlanForSelection(ezeeMap, row.roomTypeId, row.roomTypeName, val);
                                                  const key = rateLookupKey(row.roomTypeId, plan?.ratePlanId);
                                                  const ratePatch = pmsRatePatchFromLookup(key, rateMap);
                                                  setDrafts((prev) => {
                                                    const next = [...prev];
                                                    const d = next[activeDraftIdx];
                                                    const h = d.hotelQuotes[hIdx];
                                                    const rows = [...h.rows];
                                                    rows[rIdx] = {
                                                      ...rows[rIdx],
                                                      mealPlanId: val,
                                                      mealPlanName: picked?.name || rows[rIdx].mealPlanName,
                                                      ratePlanId: plan?.ratePlanId,
                                                      ratePlanName: plan?.ratePlanName,
                                                      ...ratePatch,
                                                    };
                                                    d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                    next[activeDraftIdx] = { ...d };
                                                    return next;
                                                  });
                                                }}
                                              >
                                                <option value="">
                                                  {!row.roomTypeId ? "Select room type first…" : "Select…"}
                                                </option>
                                                {mealPlans.map((mp) => (
                                                  <option key={mp.id} value={mp.id}>
                                                    {mp.name}
                                                  </option>
                                                ))}
                                              </select>
                                              {noPlansForRoom ? (
                                                <div className="text-[11px] text-amber-700 dark:text-amber-500 mt-1 leading-snug">
                                                  No plans available for this room type.
                                                </div>
                                              ) : null}
                                            </>
                                          ) : (
                                            <Input
                                              value={row.mealPlanName || ""}
                                              placeholder="Enter meal plan"
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setDrafts((prev) => {
                                                  const next = [...prev];
                                                  const d = next[activeDraftIdx];
                                                  const h = d.hotelQuotes[hIdx];
                                                  const rows = [...h.rows];
                                                  rows[rIdx] = { ...rows[rIdx], mealPlanName: v };
                                                  d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                  next[activeDraftIdx] = { ...d };
                                                  return next;
                                                });
                                              }}
                                            />
                                          )}
                                        </td>
                                        {/* Room No removed (not part of quotation stage) */}
                                        <td className="px-2 py-2 text-right">
                                          <Input
                                            type="number"
                                            min={0}
                                            value={String(row.adults ?? 0)}
                                            onChange={(e) => {
                                              const v = Math.max(0, Number(e.target.value || 0));
                                              setDrafts((prev) => {
                                                const next = [...prev];
                                                const d = next[activeDraftIdx];
                                                const h = d.hotelQuotes[hIdx];
                                                const rows = [...h.rows];
                                                rows[rIdx] = { ...rows[rIdx], adults: v };
                                                d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                next[activeDraftIdx] = { ...d };
                                                return next;
                                              });
                                            }}
                                            className="text-right"
                                          />
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          <Input
                                            type="number"
                                            min={0}
                                            value={String(row.children ?? 0)}
                                            onChange={(e) => {
                                              const v = Math.max(0, Number(e.target.value || 0));
                                              setDrafts((prev) => {
                                                const next = [...prev];
                                                const d = next[activeDraftIdx];
                                                const h = d.hotelQuotes[hIdx];
                                                const rows = [...h.rows];
                                                rows[rIdx] = { ...rows[rIdx], children: v };
                                                d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                next[activeDraftIdx] = { ...d };
                                                return next;
                                              });
                                            }}
                                            className="text-right"
                                          />
                                        </td>
                                        <td className="px-2 py-2 text-right align-top">
                                          <div className="flex items-center justify-end gap-1 mb-1">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-xs"
                                              disabled={!row.mealPlanId || !row.roomTypeId}
                                              onClick={() => {
                                                const plan = resolveRatePlanForSelection(ezeeMap, row.roomTypeId, row.roomTypeName, row.mealPlanId);
                                                const key = rateLookupKey(row.roomTypeId, plan?.ratePlanId);
                                                const ratePatch = pmsRatePatchFromLookup(key, rateMap);
                                                setDrafts((prev) => {
                                                  const next = [...prev];
                                                  const d = next[activeDraftIdx];
                                                  const h = d.hotelQuotes[hIdx];
                                                  const rows = [...h.rows];
                                                  rows[rIdx] = { ...rows[rIdx], ...ratePatch };
                                                  d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                  next[activeDraftIdx] = { ...d };
                                                  return next;
                                                });
                                              }}
                                              title="Reset to PMS rate"
                                            >
                                              <RotateCcw className="h-3 w-3 mr-1" />
                                              PMS
                                            </Button>
                                          </div>
                                          <Input
                                            type="number"
                                            min={0}
                                            placeholder={
                                              row.rateUnavailable
                                                ? "Rate not available — enter manually"
                                                : "Enter base rate"
                                            }
                                            value={row.baseRate === "" ? "" : String(row.baseRate)}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              setDrafts((prev) => {
                                                const next = [...prev];
                                                const d = next[activeDraftIdx];
                                                const h = d.hotelQuotes[hIdx];
                                                const rows = [...h.rows];
                                                if (raw === "") {
                                                  rows[rIdx] = { ...rows[rIdx], baseRate: "" };
                                                } else {
                                                  const v = Math.max(0, Number(raw));
                                                  rows[rIdx] = {
                                                    ...rows[rIdx],
                                                    baseRate: Number.isFinite(v) ? v : 0,
                                                  };
                                                }
                                                d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                next[activeDraftIdx] = { ...d };
                                                return next;
                                              });
                                            }}
                                            className="text-right"
                                          />
                                          {row.extraAdultRate != null || row.extraChildRate != null ? (
                                            <div className="text-[11px] text-muted-foreground text-right mt-1 leading-snug">
                                              {row.extraAdultRate != null ? `Extra Adult: ₹${Math.round(row.extraAdultRate).toLocaleString("en-IN")}` : ""}
                                              {row.extraAdultRate != null && row.extraChildRate != null ? " | " : ""}
                                              {row.extraChildRate != null ? `Extra Child: ₹${Math.round(row.extraChildRate).toLocaleString("en-IN")}` : ""}
                                            </div>
                                          ) : null}
                                          {row.rateUnavailable ? (
                                            <div className="text-[11px] text-amber-700 dark:text-amber-500 text-right mt-1 leading-snug">
                                              No rate found for this combination in PMS — enter manually.
                                            </div>
                                          ) : null}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          <Input
                                            type="number"
                                            min={0}
                                            max={discountCap}
                                            value={String(row.discountPercent ?? 0)}
                                            onChange={(e) => {
                                              const v = Math.min(discountCap, Math.max(0, Number(e.target.value || 0)));
                                              setDrafts((prev) => {
                                                const next = [...prev];
                                                const d = next[activeDraftIdx];
                                                const h = d.hotelQuotes[hIdx];
                                                const rows = [...h.rows];
                                                rows[rIdx] = { ...rows[rIdx], discountPercent: v };
                                                d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                                next[activeDraftIdx] = { ...d };
                                                return next;
                                              });
                                            }}
                                            className="text-right"
                                          />
                                          <div className="text-[11px] text-muted-foreground text-right">max {discountCap}%</div>
                                        </td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(t.discountAmountTotal)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(t.discountedSubtotal)}</td>
                                        <td className="px-2 py-2 text-right">{formatTaxPercentLabel(t.taxPercent)}%</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(t.taxTotal)}</td>
                                        <td className="px-2 py-2 text-right font-medium">{formatCurrency(t.roomTotal)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div className="lg:hidden space-y-3">
                              {hq.rows.map((row, rIdx) => {
                                const disc = Math.min(discountCap, Math.max(0, Number(row.discountPercent || 0)));
                                const base = Math.max(0, Number(row.baseRate || 0));
                                const nightsRow = Math.max(1, Number(hq.nights || 1));
                                const availH = pid ? availableRoomsByPropertyId[pid] : undefined;
                                const pmsH = availH?.length ? pickAvailableRowForQuotationRow(availH, row) : undefined;
                                const pmsTotalsH =
                                  pmsH && pmsH.totalBeforeTax > 0
                                    ? { totalBeforeTax: pmsH.totalBeforeTax, totalTax: pmsH.totalTax }
                                    : null;
                                const t = computeQuotationRowTotals(base, disc, nightsRow, discountCap, pmsTotalsH);
                                const ezeeMap = hq.propertyId ? ezeeMappingByPropertyId[hq.propertyId] : undefined;
                                const rateMap = hq.propertyId ? ezeeRateMapByPropertyId[hq.propertyId] : undefined;
                                return (
                                  <div key={row.rowId || rIdx} className="rounded-md border p-3 space-y-2 text-sm">
                                    <div className="font-medium">{row.roomTypeName || row.roomTypeId || "Room"}</div>
                                    <div className="text-xs text-muted-foreground">{row.mealPlanName || "—"}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-xs">Adults</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={String(row.adults ?? 0)}
                                          onChange={(e) => {
                                            const v = Math.max(0, Number(e.target.value || 0));
                                            setDrafts((prev) => {
                                              const next = [...prev];
                                              const d = next[activeDraftIdx];
                                              const h = d.hotelQuotes[hIdx];
                                              const rows = [...h.rows];
                                              rows[rIdx] = { ...rows[rIdx], adults: v };
                                              d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                              next[activeDraftIdx] = { ...d };
                                              return next;
                                            });
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs">Children</Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={String(row.children ?? 0)}
                                          onChange={(e) => {
                                            const v = Math.max(0, Number(e.target.value || 0));
                                            setDrafts((prev) => {
                                              const next = [...prev];
                                              const d = next[activeDraftIdx];
                                              const h = d.hotelQuotes[hIdx];
                                              const rows = [...h.rows];
                                              rows[rIdx] = { ...rows[rIdx], children: v };
                                              d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                              next[activeDraftIdx] = { ...d };
                                              return next;
                                            });
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between gap-2">
                                        <Label className="text-xs">Base / night (₹)</Label>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-xs"
                                          disabled={!row.mealPlanId || !row.roomTypeId}
                                          onClick={() => {
                                            const plan = resolveRatePlanForSelection(ezeeMap, row.roomTypeId, row.roomTypeName, row.mealPlanId);
                                            const key = rateLookupKey(row.roomTypeId, plan?.ratePlanId);
                                            const ratePatch = pmsRatePatchFromLookup(key, rateMap);
                                            setDrafts((prev) => {
                                              const next = [...prev];
                                              const d = next[activeDraftIdx];
                                              const h = d.hotelQuotes[hIdx];
                                              const rows = [...h.rows];
                                              rows[rIdx] = { ...rows[rIdx], ...ratePatch };
                                              d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                              next[activeDraftIdx] = { ...d };
                                              return next;
                                            });
                                          }}
                                        >
                                          <RotateCcw className="h-3 w-3 mr-1" />
                                          Reset PMS
                                        </Button>
                                      </div>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={row.baseRate === "" ? "" : String(row.baseRate)}
                                        onChange={(e) => {
                                          const raw = e.target.value;
                                          setDrafts((prev) => {
                                            const next = [...prev];
                                            const d = next[activeDraftIdx];
                                            const h = d.hotelQuotes[hIdx];
                                            const rows = [...h.rows];
                                            if (raw === "") rows[rIdx] = { ...rows[rIdx], baseRate: "" };
                                            else {
                                              const v = Math.max(0, Number(raw));
                                              rows[rIdx] = { ...rows[rIdx], baseRate: Number.isFinite(v) ? v : 0 };
                                            }
                                            d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                            next[activeDraftIdx] = { ...d };
                                            return next;
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-xs pt-1 border-t">
                                      <span>Room total</span>
                                      <span className="font-medium">{formatCurrency(t.roomTotal)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex justify-between items-center">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setDrafts((prev) => {
                                    const next = [...prev];
                                    const d = next[activeDraftIdx];
                                    const h = d.hotelQuotes[hIdx];
                                    const pid = h.propertyId;
                                    const ezeeMap = pid ? ezeeMappingByPropertyId[pid] : undefined;
                                    const rateMapAdd = pid ? ezeeRateMapByPropertyId[pid] : undefined;
                                    const last = h.rows[h.rows.length - 1];
                                    const hasPmsOptions =
                                      (roomTypeOptionsFromMapping(ezeeMap).length > 0 &&
                                        (ezeeMap?.ratePlans?.length ?? 0) > 0 &&
                                        (ezeeMap?.rateTypes?.length ?? 0) > 0);
                                    const opts = hasPmsOptions
                                      ? mealPlanOptionsForRoomType(ezeeMap, last?.roomTypeId, last?.roomTypeName)
                                      : [];
                                    const initMealPlanId = opts[0]?.id;
                                    const initMealPlanName = opts[0]?.name;
                                    const plan = initMealPlanId
                                      ? resolveRatePlanForSelection(ezeeMap, last?.roomTypeId, last?.roomTypeName, initMealPlanId)
                                      : undefined;
                                    const addKey = rateLookupKey(last?.roomTypeId, plan?.ratePlanId);
                                    const ratePatchAdd = pmsRatePatchFromLookup(addKey, rateMapAdd);
                                    const rows = [
                                      ...h.rows,
                                      {
                                        rowId: crypto.randomUUID(),
                                        roomTypeId: last?.roomTypeId,
                                        roomTypeName: last?.roomTypeName,
                                        adults: last?.adults ?? 1,
                                        children: last?.children ?? 0,
                                        extraAdult: "" as const,
                                        extraChild: "" as const,
                                        discountPercent: 0,
                                        mealPlanId: initMealPlanId,
                                        mealPlanName: initMealPlanName,
                                        ratePlanId: plan?.ratePlanId,
                                        ratePlanName: plan?.ratePlanName,
                                        ...ratePatchAdd,
                                      },
                                    ];
                                    d.hotelQuotes = d.hotelQuotes.map((x, i) => (i === hIdx ? { ...h, rows } : x));
                                    next[activeDraftIdx] = { ...d };
                                    return next;
                                  });
                                }}
                              >
                                Add room
                              </Button>
                              <div className="text-xs text-muted-foreground text-right max-w-md space-y-1">
                                <div>
                                  Quotation total:{" "}
                                  <span className="font-medium text-foreground">{formatCurrency(summary.grandTotal)}</span>
                                </div>
                                <div className="text-[11px] leading-snug opacity-90">{gstSlabNote}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                        : null}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[400px]">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-sm text-muted-foreground">Loading quotation history...</span>
                  </div>
                ) : quotationHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No quotations sent yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quotationHistory.map((q) => (
                      <div key={q.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Version {q.versionNumber}</div>
                          <div className="text-xs text-muted-foreground">{q.sentAt ? new Date(q.sentAt).toLocaleString() : ""}</div>
                        </div>
                        {q.hotelQuotes?.length ? (
                          <div className="text-sm text-muted-foreground">
                            {q.hotelQuotes.length} hotel(s) · Total{" "}
                            {formatCurrency(q.hotelQuotes.reduce((s, h) => s + (h.grandTotal ?? 0), 0))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Legacy quotation</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          </div>

          {activeTab === "create" && (
            <DialogFooter className="flex items-center justify-between gap-2 px-6 py-4 shrink-0 border-t bg-background">
              <div className="text-xs text-muted-foreground">
                {drafts.length > 0 && activeDraft ? (
                  <>Grand total: <span className="font-medium text-foreground">{formatCurrency(calcDraftSummary(activeDraft).grandTotal)}</span></>
                ) : (
                  <span />
                )}
              </div>
              <div className="flex gap-2">
                {drafts.length > 1 && (
                  <Button type="button" variant="outline" onClick={sendAll} disabled={isSending}>
                    Send all
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button type="button" onClick={() => sendDraft(activeDraftIdx)} disabled={isSending || !drafts.length}>
                  {isSending ? "Sending…" : drafts.length > 1 ? "Send this hotel" : "Send quotation"}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

