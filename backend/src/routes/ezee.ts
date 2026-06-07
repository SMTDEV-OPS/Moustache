import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import axios from "axios";
import { requireAuth } from "../middleware/auth";
import { PropertyModel } from "../models/property";
import { LeadModel } from "../models/lead";
import { LeadBookingModel } from "../models/leadBooking";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { LeadStatus } from "../models/common";
import { EzeePMSService } from "../services/pms/adapters/EzeePMSService";
import { badRequest, notFound } from "../utils/httpError";
import { logger } from "../config/logger";
import { fetchCleanEzeeHotelDetails } from "../utils/ezeeHotelDetails";

export const ezeeRouter = Router();

ezeeRouter.use(requireAuth);

function daysBetweenYmd(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  const d = Math.round((b - a) / 86400000);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function extractEzeeErrorMessage(data: any): string | null {
  const errBag = data?.Errors ?? data?.RES_Response?.Errors;
  const code = String(errBag?.ErrorCode ?? errBag?.errorcode ?? "").trim();
  const msg = String(errBag?.ErrorMessage ?? errBag?.errormessage ?? data?.ErrorMessage ?? data?.Error ?? "").trim();
  if (code && code !== "0") return msg || `eZee error ${code}`;
  if (msg && !/^success$/i.test(msg)) return msg;
  return null;
}

function unwrapEzeeErrorDetailsNode(details: any): any {
  if (details == null) return null;
  if (Array.isArray(details) && details.length > 0) return details[0];
  return details;
}

/** InsertBooking sometimes returns `[{ "Error Details": { ... } }]` instead of top-level `Errors`. */
function extractEzeeErrorDetailsBlock(data: any): any | null {
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first && typeof first === "object") {
      const raw = first["Error Details"] ?? first["ErrorDetails"] ?? first.errorDetails;
      const details = unwrapEzeeErrorDetailsNode(raw);
      if (details != null) return details;
      return first;
    }
    return null;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const raw = data["Error Details"] ?? data["ErrorDetails"] ?? data.errorDetails;
    const details = unwrapEzeeErrorDetailsNode(raw);
    if (details != null) return details;
  }
  return null;
}

function messageFromEzeeErrorBlock(ezeeError: any): string {
  if (ezeeError == null) return "";
  if (typeof ezeeError === "string") return ezeeError.trim();
  const m =
    String(ezeeError["Error Description"] ?? "").trim() ||
    String(ezeeError["Error_Description"] ?? "").trim() ||
    String(ezeeError.ErrorDescription ?? "").trim() ||
    String(ezeeError.ErrorMessage ?? "").trim() ||
    String(ezeeError.errormessage ?? "").trim() ||
    String(ezeeError.message ?? "").trim() ||
    String(ezeeError.error ?? "").trim() ||
    String(ezeeError.Message ?? "").trim();
  if (m) return m;
  try {
    return JSON.stringify(ezeeError);
  } catch {
    return String(ezeeError);
  }
}

/** RoomList / InsertBooking: classic Errors bag, or array + Error Details object. */
function extractEzeeBookingApiFailureMessage(data: any): string | null {
  const fromBag = extractEzeeErrorMessage(data);
  if (fromBag) return fromBag;
  const block = extractEzeeErrorDetailsBlock(data);
  if (block) {
    const msg = messageFromEzeeErrorBlock(block);
    if (msg) return msg;
  }
  return null;
}

/**
 * eZee `InsertBooking` → `BookingData` JSON: property names MUST match Postman “Create a Booking” / eZee Connectivity API.
 * `POST /api/ezee/create-booking` maps CRM fields to this JSON; we send it to eZee as a **multipart form field** `BookingData`
 * (not in the URL query string).
 *
 * CRM → eZee (subset): checkIn→check_in_date, checkOut→check_out_date, guestEmail→Email_Address,
 * guestPhone→MobileNo, guestAddress→Address, guestState→State, guestCountry→Country, guestCity→City,
 * guestZipcode→Zipcode, rooms[].roomRateId→Rateplan_Id, rooms[].rateTypeId→Ratetype_Id,
 * rooms[].roomTypeId→Roomtype_Id, rooms[].baseRate→baserate, guestFirstName→First_Name, …
 */
type EzeeInsertBookingRoomN = {
  Rateplan_Id: string;
  Ratetype_Id: string;
  Roomtype_Id: string;
  baserate: string;
  extradultrate: string;
  extrachildrate: string;
  number_adults: string;
  number_children: string;
  ExtraChild_Age: string;
  Title: string;
  First_Name: string;
  Last_Name: string;
  Gender: string;
  SpecialRequest: string;
  RoomID?: string;
};

type EzeeInsertBookingData = {
  Room_Details: Record<string, EzeeInsertBookingRoomN>;
  check_in_date: string;
  check_out_date: string;
  Booking_Payment_Mode: string;
  Email_Address: string;
  Source_Id: string;
  MobileNo: string;
  Address: string;
  State: string;
  Country: string;
  City: string;
  Zipcode: string;
  Fax: string;
  Device: string;
  Languagekey: string;
  paymenttypeunkid: string;
};

function buildEzeeInsertBookingRoomRows(
  rooms: {
    roomRateId: string;
    rateTypeId: string;
    roomTypeId: string;
    baseRate: number;
    extraAdultRate: number;
    extraChildRate: number;
    nightlyRates?: {
      date: string;
      rate: number;
      extraAdult?: number;
      extraChild?: number;
    }[];
    adults: number;
    children: number;
    physicalRoomId?: string;
  }[],
  guest: {
    guestTitle: string;
    guestFirstName: string;
    guestLastName: string;
    guestGender: string;
    specialRequest: string;
  }
): Record<string, EzeeInsertBookingRoomN> {
  const out: Record<string, EzeeInsertBookingRoomN> = {};
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    const pr = String(r.physicalRoomId ?? "").trim();
    const rt = String(r.roomTypeId).trim();

    // eZee expects comma-separated values per night for these rate fields.
    // Example (2 nights): "449,449" not "449".
    const baserate = Array.isArray(r.nightlyRates) && r.nightlyRates.length > 0
      ? r.nightlyRates.map((n) => String(Math.round(toNum(n.rate)))).join(",")
      : String(Math.round(toNum(r.baseRate)));
    const extradultrate = Array.isArray(r.nightlyRates) && r.nightlyRates.length > 0
      ? r.nightlyRates.map((n) => String(Math.round(toNum(n.extraAdult ?? 0)))).join(",")
      : String(Math.round(toNum(r.extraAdultRate ?? 0)));
    const extrachildrate = Array.isArray(r.nightlyRates) && r.nightlyRates.length > 0
      ? r.nightlyRates.map((n) => String(Math.round(toNum(n.extraChild ?? 0)))).join(",")
      : String(Math.round(toNum(r.extraChildRate ?? 0)));

    const row: EzeeInsertBookingRoomN = {
      Rateplan_Id: String(r.roomRateId),
      Ratetype_Id: String(r.rateTypeId),
      Roomtype_Id: String(r.roomTypeId),
      baserate,
      extradultrate,
      extrachildrate,
      number_adults: String(r.adults),
      number_children: String(r.children),
      ExtraChild_Age: r.children > 0 ? "0" : "",
      Title: String(guest.guestTitle),
      First_Name: String(guest.guestFirstName),
      Last_Name: String(guest.guestLastName),
      Gender: String(guest.guestGender),
      SpecialRequest: String(guest.specialRequest ?? ""),
    };
    if (pr && pr !== rt) {
      row.RoomID = pr;
    }
    out[`Room_${i + 1}`] = row;
  }
  return out;
}

function buildEzeeInsertBookingData(params: {
  roomRows: Record<string, EzeeInsertBookingRoomN>;
  checkIn: string;
  checkOut: string;
  paymentMode: string;
  email: string;
  sourceId: string;
  mobileNo: string;
  address: string;
  state: string;
  country: string;
  city: string;
  zipcode: string;
}): EzeeInsertBookingData {
  return {
    Room_Details: params.roomRows,
    check_in_date: params.checkIn,
    check_out_date: params.checkOut,
    Booking_Payment_Mode: String(params.paymentMode || "0"),
    Email_Address: params.email,
    Source_Id: params.sourceId,
    MobileNo: params.mobileNo,
    Address: params.address,
    State: params.state,
    Country: params.country,
    City: params.city,
    Zipcode: params.zipcode,
    Fax: "",
    Device: "",
    Languagekey: "",
    paymenttypeunkid: "",
  };
}

async function moveLeadToBooked(leadId: string, performedByUserId?: unknown) {
  const lead = await LeadModel.findById(leadId);
  if (!lead) throw notFound("Lead not found");

  const prevStatus = lead.status;
  const prevStageId = lead.stageId?.toString();

  // Mark confirmed + closed (matches current BookingService behavior).
  lead.status = LeadStatus.CONFIRMED;
  lead.closedAt = new Date();

  // Move to WON/terminal stage in default pipeline if available.
  let wonStage: { _id: unknown; name?: string } | null = null;
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
  if (pipeline) {
    wonStage = await PipelineStageModel.findOne({
      pipelineId: pipeline._id,
      isTerminal: true,
      terminalType: "WON",
    }).exec();
    if (wonStage) {
      lead.stageId = wonStage._id as any;
    }
  }

  await lead.save();

  const { LeadActivityModel, LeadActivityType } = await import("../models/leadActivity");

  if (prevStatus !== LeadStatus.CONFIRMED) {
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.STATUS_CHANGE,
      fromStatus: prevStatus,
      toStatus: LeadStatus.CONFIRMED,
      note: "Lead marked confirmed after PMS booking",
      performedByUserId,
      performedAt: new Date(),
    });
  }

  if (wonStage && prevStageId !== String(wonStage._id)) {
    const prevStage = prevStageId ? await PipelineStageModel.findById(prevStageId).lean() : null;
    const fromName = prevStage?.name || "Previous stage";
    const toName = wonStage.name || "Won";
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.NOTE,
      note: `Stage moved from ${fromName} to ${toName}`,
      performedByUserId,
      performedAt: new Date(),
    });
  }
}

async function moveLeadToCancelled(leadId: string, performedByUserId?: unknown) {
  const lead = await LeadModel.findById(leadId);
  if (!lead) throw notFound("Lead not found");

  const prevStatus = lead.status;
  const prevStageId = lead.stageId?.toString();

  lead.status = LeadStatus.CANCELLED;
  lead.closedAt = new Date();

  let cancelledStage: { _id: unknown; name?: string } | null = null;
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
  if (pipeline) {
    cancelledStage = await PipelineStageModel.findOne({
      pipelineId: pipeline._id,
      name: /^cancelled$/i,
    }).exec();
    if (cancelledStage) {
      lead.stageId = cancelledStage._id as any;
    }
  }

  await lead.save();

  const { LeadActivityModel, LeadActivityType } = await import("../models/leadActivity");

  if (prevStatus !== LeadStatus.CANCELLED) {
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.STATUS_CHANGE,
      fromStatus: prevStatus,
      toStatus: LeadStatus.CANCELLED,
      note: "Lead marked cancelled after PMS booking cancellation",
      performedByUserId,
      performedAt: new Date(),
    });
  }

  if (cancelledStage && prevStageId !== String(cancelledStage._id)) {
    const prevStage = prevStageId ? await PipelineStageModel.findById(prevStageId).lean() : null;
    const fromName = prevStage?.name || "Previous stage";
    const toName = cancelledStage.name || "Cancelled";
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.NOTE,
      note: `Stage moved from ${fromName} to ${toName}`,
      performedByUserId,
      performedAt: new Date(),
    });
  }
}

function normName(s: unknown): string {
  return String(s || "").trim().toLowerCase();
}

/** Drop PMS placeholder rows only — never use RatePlanID / ID suffix (legitimate plans can end in ...0000001). */
function isDefaultUnmappedLabel(name: unknown): boolean {
  return normName(name).includes("default unmapped");
}

function rateTypeNameForPlan(
  mapping: { rateTypes?: { id: string; name: string }[] },
  rateTypeId: string | undefined
): string | undefined {
  const id = String(rateTypeId || "").trim();
  if (!id) return undefined;
  const rt = (mapping.rateTypes ?? []).find((x) => String(x.id || "").trim() === id);
  return rt?.name ? String(rt.name).trim() : undefined;
}

// GET /api/ezee/room-info?hotelId={propertyId}
ezeeRouter.get("/room-info", async (req, res, next) => {
  try {
    const query = z.object({ hotelId: z.string().min(1) }).safeParse(req.query);
    if (!query.success) throw badRequest("hotelId is required");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");

    if (property.pmsProvider !== "EZEE") {
      return res.json({ roomTypes: [], rateTypes: [], ratePlans: [], channelSources: [] });
    }
    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) {
      return res.json({ roomTypes: [], rateTypes: [], ratePlans: [], channelSources: [] });
    }

    const ezee = new EzeePMSService({ hotelCode, authCode });
    const mapping = await ezee.getSeparateSourceMapping();

    const roomTypes = (mapping.roomTypes ?? [])
      .filter((x) => x?.id)
      .filter((x) => !isDefaultUnmappedLabel(x.name))
      .map((x) => ({ id: String(x.id).trim(), name: String(x.name || "").trim() }))
      .filter((x) => x.id);

    const rateTypes = (mapping.rateTypes ?? [])
      .filter((x) => x?.id)
      .filter((x) => !isDefaultUnmappedLabel(x.name))
      .map((x) => ({ id: String(x.id).trim(), name: String(x.name || "").trim() }))
      .filter((x) => x.id);

    const ratePlans = (mapping.ratePlans ?? [])
      .filter((p) => p?.id)
      .filter(
        (p) =>
          !isDefaultUnmappedLabel(p.name) && !isDefaultUnmappedLabel(rateTypeNameForPlan(mapping, p.rateTypeId))
      )
      .map((p) => ({
        id: String(p.id).trim(),
        roomTypeId: p.roomTypeId ? String(p.roomTypeId).trim() : undefined,
        rateTypeId: p.rateTypeId ? String(p.rateTypeId).trim() : undefined,
        name: p.name ? String(p.name).trim() : undefined,
      }))
      .filter((p) => p.id);

    const channelSources = Array.isArray(mapping.channelSources) ? mapping.channelSources : [];

    res.json({ roomTypes, rateTypes, ratePlans, channelSources });
  } catch (err) {
    next(err);
  }
});

function parseHotelIdParam(req: Request): string {
  const q = req.query?.hotelId;
  if (typeof q === "string" && q.trim()) return q.trim();
  const b = (req.body as { hotelId?: unknown } | undefined)?.hotelId;
  if (typeof b === "string" && b.trim()) return b.trim();
  return "";
}

/** Proxy MetaSearch HotelList — Postman uses POST to listing.php with query string only. */
async function handleHotelDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const hotelId = parseHotelIdParam(req);
    const query = z.object({ hotelId: z.string().min(1) }).safeParse({ hotelId });
    if (!query.success) throw badRequest("hotelId is required (query or JSON body)");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");

    const tier = property.tier ?? undefined;

    if (property.pmsProvider !== "EZEE") {
      return res.json({ tier, details: {} });
    }
    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const apiKey = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !apiKey) {
      return res.json({ tier, details: {} });
    }

    const details = (await fetchCleanEzeeHotelDetails(property)) ?? {};
    return res.json({ tier, details });
  } catch (err) {
    next(err);
  }
}

// GET ?hotelId=… or POST { "hotelId": "…" } — both supported
ezeeRouter.get("/hotel-details", handleHotelDetails);
ezeeRouter.post("/hotel-details", handleHotelDetails);

// GET /api/ezee/physical-rooms?hotelId=&roomTypeId=&fromDate=&toDate=
// Dates are accepted for API parity; RoomInfo (used inside getRoomMasterCatalog) does not filter by stay dates.
ezeeRouter.get("/physical-rooms", async (req, res, next) => {
  try {
    const query = z
      .object({
        hotelId: z.string().min(1),
        roomTypeId: z.string().min(1),
        fromDate: z.string().min(1),
        toDate: z.string().min(1),
      })
      .safeParse(req.query);

    if (!query.success) {
      throw badRequest("hotelId, roomTypeId, fromDate, toDate are all required");
    }

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Property not found");
    if (property.pmsProvider !== "EZEE") throw badRequest("Not an Ezee property");

    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) throw badRequest("Ezee credentials missing");

    const ezee = new EzeePMSService({ hotelCode, authCode });
    const catalog = await ezee.getRoomMasterCatalog();
    if (!catalog) {
      return res.json({ physicalRooms: [] });
    }

    const matched = catalog.roomTypes.find((rt) => String(rt.roomTypeId) === String(query.data.roomTypeId));
    const raw = matched?.physicalRooms ?? [];
    const physicalRooms = raw.filter((r) => r.roomId && r.roomName);

    res.json({ physicalRooms });
  } catch (err) {
    next(err);
  }
});

// GET /api/ezee/rates?hotelId={propertyId}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
ezeeRouter.get("/rates", async (req, res, next) => {
  try {
    const query = z
      .object({
        hotelId: z.string().min(1),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(req.query);
    if (!query.success) throw badRequest("hotelId, fromDate, toDate are required (YYYY-MM-DD)");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");

    if (property.pmsProvider !== "EZEE") {
      return res.json({});
    }
    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) {
      return res.json({});
    }

    const ezee = new EzeePMSService({ hotelCode, authCode });
    try {
      const map = await ezee.getRatesLookup(query.data.fromDate, query.data.toDate);
      res.json(map);
    } catch (e) {
      logger.warn("eZee rate fetch failed", {
        propertyId: property._id,
        err: e instanceof Error ? e.message : String(e),
      });
      throw badRequest("PMS rate fetch failed — enter rates manually");
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/ezee/available-rooms?hotelId={propertyId}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
ezeeRouter.get("/available-rooms", async (req, res, next) => {
  try {
    const query = z
      .object({
        hotelId: z.string().min(1),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        promotionCode: z.string().optional(),
      })
      .safeParse(req.query);
    if (!query.success) throw badRequest("hotelId, fromDate, toDate are required (YYYY-MM-DD)");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");
    if (property.pmsProvider !== "EZEE") return res.json([]);

    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) return res.json([]);

    const promo = String(query.data.promotionCode ?? "").trim();
    let url =
      `https://live.ipms247.com/booking/reservation_api/listing.php` +
      `?request_type=RoomList` +
      `&HotelCode=${encodeURIComponent(hotelCode)}` +
      `&APIKey=${encodeURIComponent(authCode)}` +
      `&check_in_date=${encodeURIComponent(query.data.fromDate)}` +
      `&check_out_date=${encodeURIComponent(query.data.toDate)}`;
    if (promo) {
      url += `&promotion_code=${encodeURIComponent(promo)}`;
    }

    const resp = await axios.get(url, { timeout: 15000 });
    const data: any = resp.data;
    const err = extractEzeeErrorMessage(data);
    if (err) throw badRequest(err);

    const rows: any[] = Array.isArray(data) ? data : [];

    const out = rows
      .map((r) => {
        const roomTypeId = String(r?.roomtypeunkid ?? "").trim();
        const rateTypeId = String(r?.ratetypeunkid ?? "").trim();
        const roomRateId = String(r?.roomrateunkid ?? "").trim();
        const roomTypeName = String(r?.Roomtype_Name ?? "").trim();
        const planName = String(r?.Room_Name ?? "").trim();
        const availableRooms = toNum(r?.min_ava_rooms);
        const availableByDate = (r?.available_rooms ?? r?.availableRooms ?? {}) as Record<string, unknown>;
        const baseAdultOccupancy = toNum(r?.base_adult_occupancy);
        const maxAdultOccupancy = toNum(r?.max_adult_occupancy);
        const maxChildOccupancy = toNum(r?.max_child_occupancy);

        const ex = r?.room_rates_info?.exclusive_tax ?? {};
        const tx = r?.room_rates_info?.tax ?? {};
        const nightlyRates = Object.keys(ex || {})
          .map((date) => {
            const rate = toNum(ex?.[date]);
            const tax = toNum(tx?.[date]);
            return { date, rate, tax, total: rate + tax, extraAdult: 0, extraChild: 0 };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        const totalBeforeTax = nightlyRates.reduce((s, n) => s + toNum(n.rate), 0);
        const totalTax = nightlyRates.reduce((s, n) => s + toNum(n.tax), 0);
        const grandTotal = totalBeforeTax + totalTax;

        const discountRaw = r?.room_discount ?? r?.roomDiscount ?? null;
        const discount =
          discountRaw && typeof discountRaw === "object"
            ? {
                couponCode: String((discountRaw as any).coupon_code ?? (discountRaw as any).couponCode ?? "").trim(),
                discountPercentage: toNum((discountRaw as any).discount_percentage ?? (discountRaw as any).discountPercentage),
                discountAmount: toNum((discountRaw as any).discount_amount ?? (discountRaw as any).discountAmount),
                promotionName: String((discountRaw as any).promotion_name ?? (discountRaw as any).promotionName ?? "").trim(),
                promotionDescription: String(
                  (discountRaw as any).promotion_description ?? (discountRaw as any).promotionDescription ?? ""
                ).trim(),
              }
            : null;
        const isDiscounted = !!discount && (discount.discountAmount > 0 || discount.discountPercentage > 0);

        return {
          roomTypeId,
          rateTypeId,
          roomRateId,
          roomTypeName,
          planName,
          availableRooms,
          availableByDate,
          baseAdultOccupancy,
          maxAdultOccupancy,
          maxChildOccupancy,
          nightlyRates,
          totalBeforeTax,
          totalTax,
          grandTotal,
          discount,
          isDiscounted,
        };
      })
      .filter((x) => x.roomTypeId && x.rateTypeId && x.roomRateId)
      // Do not hide unavailable options; frontend can warn per-date unavailability.
      ;

    res.json(out);
  } catch (err) {
    next(err);
  }
});

// POST /api/ezee/create-booking
ezeeRouter.post("/create-booking", async (req, res, next) => {
  try {
    const body = z
      .object({
        hotelId: z.string().min(1),
        leadId: z.string().min(1),
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentMode: z.enum(["0", "1", "2"]).optional().default("0"),
        guestTitle: z.string().min(1),
        guestFirstName: z.string().min(1),
        guestLastName: z.string().min(1),
        guestEmail: z.string().trim().min(1).email(),
        guestPhone: z.string().trim().min(7).max(40),
        guestGender: z.enum(["Male", "Female"]),
        guestDateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
        guestNationality: z.string().trim().min(1).max(120),
        guestCity: z.string().trim().min(1).max(120),
        guestCountry: z.string().trim().min(1).max(120),
        guestAddress: z.string().trim().max(500).optional().or(z.literal("")),
        guestState: z.string().trim().max(120).optional().or(z.literal("")),
        guestZipcode: z.string().trim().max(32).optional().or(z.literal("")),
        specialRequest: z.string().optional().or(z.literal("")),
        sourceId: z.string().optional(),
        /** Allowlisted CRM-only key; merged into InsertBooking `Source_Id` before channel / defaults. */
        businessSourceId: z.string().optional().or(z.literal("")),
        promotionCode: z.string().optional().or(z.literal("")),
        rooms: z
          .array(
            z.object({
              roomTypeId: z.string().min(1),
              rateTypeId: z.string().min(1),
              roomRateId: z.string().min(1),
              roomTypeName: z.string().min(1),
              planName: z.string().min(1),
              adults: z.number().int().min(1),
              children: z.number().int().min(0),
              baseRate: z.number().min(0),
              extraAdultRate: z.number().min(0).optional().default(0),
              extraChildRate: z.number().min(0).optional().default(0),
              nightlyRates: z
                .array(
                  z.object({
                    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                    rate: z.number().min(0),
                    extraAdult: z.number().min(0).optional(),
                    extraChild: z.number().min(0).optional(),
                  })
                )
                .optional(),
              physicalRoomId: z.string().min(1).optional(),
              physicalRoomName: z.string().optional(),
            })
          )
          .min(1),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest("Invalid booking payload");

    const allowlistedBusinessSourceIds = new Set(["29680000000000001858"]);
    const businessSourceId = String(body.data.businessSourceId ?? "").trim();
    if (businessSourceId && !allowlistedBusinessSourceIds.has(businessSourceId)) {
      throw badRequest("Invalid business source");
    }

    const property = await PropertyModel.findById(body.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");
    if (property.pmsProvider !== "EZEE") throw badRequest("Selected hotel is not an eZee PMS property");

    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) throw badRequest("Hotel PMS credentials are missing");

    /** InsertBooking `Source_Id` is often mandatory per property; never leave empty when we can resolve one. */
    let sourceIdForEzee =
      businessSourceId ||
      String(body.data.sourceId ?? "").trim() ||
      String(property.pmsConfig?.defaultInsertBookingSourceId ?? "").trim();
    if (!sourceIdForEzee) {
      try {
        const ezee = new EzeePMSService({ hotelCode, authCode });
        const { channelSources } = await ezee.getSeparateSourceMapping();
        sourceIdForEzee = String(channelSources[0]?.channelId ?? "").trim();
      } catch {
        // non-fatal
      }
    }
    if (!sourceIdForEzee) {
      throw badRequest(
        "eZee requires Source_Id. Choose a booking source in the form, pass businessSourceId, or set property PMS default insert booking source id / channel sources in eZee."
      );
    }

    const nights = daysBetweenYmd(body.data.checkIn, body.data.checkOut);
    if (nights <= 0) throw badRequest("Invalid date range");

    // Fetch RoomList once to compute tax ratios for storing totals (rate remains editable).
    const roomListUrl =
      `https://live.ipms247.com/booking/reservation_api/listing.php` +
      `?request_type=RoomList` +
      `&HotelCode=${encodeURIComponent(hotelCode)}` +
      `&APIKey=${encodeURIComponent(authCode)}` +
      `&check_in_date=${encodeURIComponent(body.data.checkIn)}` +
      `&check_out_date=${encodeURIComponent(body.data.checkOut)}`;

    let roomRateTotals = new Map<string, { beforeTax: number; tax: number }>();
    let roomTypeRateTotals = new Map<string, { beforeTax: number; tax: number }>();
    try {
      const roomListResp = await axios.get(roomListUrl, { timeout: 15000 });
      const roomListData: any = roomListResp.data;
      const roomListErr = extractEzeeErrorMessage(roomListData);
      if (!roomListErr) {
        const roomListRows: any[] = Array.isArray(roomListData) ? roomListData : [];
        for (const row of roomListRows) {
          const roomRateId = String(row?.roomrateunkid ?? "").trim();
          const roomTypeId = String(row?.roomtypeunkid ?? "").trim();
          const rateTypeId = String(row?.ratetypeunkid ?? "").trim();
          if (!roomRateId) continue;
          const ex = row?.room_rates_info?.exclusive_tax ?? {};
          const tx = row?.room_rates_info?.tax ?? {};
          const beforeTax = Object.keys(ex || {}).reduce((s, k) => s + toNum(ex?.[k]), 0);
          const tax = Object.keys(tx || {}).reduce((s, k) => s + toNum(tx?.[k]), 0);
          if (beforeTax > 0 || tax > 0) {
            roomRateTotals.set(roomRateId, { beforeTax, tax });
            if (roomTypeId && rateTypeId) {
              roomTypeRateTotals.set(`${roomTypeId}_${rateTypeId}`, { beforeTax, tax });
            }
          }
        }
      }
    } catch {
      // Non-fatal: totals can still be stored as base-only fallback.
    }

    const roomRows = buildEzeeInsertBookingRoomRows(
      body.data.rooms.map((r) => ({
        roomRateId: r.roomRateId,
        rateTypeId: r.rateTypeId,
        roomTypeId: r.roomTypeId,
        baseRate: r.baseRate,
        extraAdultRate: r.extraAdultRate ?? 0,
        extraChildRate: r.extraChildRate ?? 0,
        nightlyRates: r.nightlyRates,
        adults: r.adults,
        children: r.children,
        physicalRoomId: r.physicalRoomId,
      })),
      {
        guestTitle: body.data.guestTitle,
        guestFirstName: body.data.guestFirstName,
        guestLastName: body.data.guestLastName,
        guestGender: body.data.guestGender,
        specialRequest: body.data.specialRequest ?? "",
      }
    );

    const bookingData: EzeeInsertBookingData = buildEzeeInsertBookingData({
      roomRows,
      checkIn: body.data.checkIn,
      checkOut: body.data.checkOut,
      paymentMode: body.data.paymentMode ?? "0",
      email: String(body.data.guestEmail).trim(),
      sourceId: sourceIdForEzee,
      mobileNo: String(body.data.guestPhone).trim(),
      address: String(body.data.guestAddress ?? "").trim(),
      state: String(body.data.guestState ?? "").trim(),
      country: String(body.data.guestCountry).trim(),
      city: String(body.data.guestCity).trim(),
      zipcode: String(body.data.guestZipcode ?? "").trim(),
    });

    const bookingDataJson = JSON.stringify(bookingData);
    const bookingDataJsonPretty = JSON.stringify(bookingData, null, 2);
    const logInsertBookingPayloadAtInfo =
      process.env.NODE_ENV !== "production" ||
      process.env.LOG_EZEE_INSERT_BOOKING_PAYLOAD === "1" ||
      process.env.LOG_EZEE_INSERT_BOOKING_PAYLOAD === "true";
    if (logInsertBookingPayloadAtInfo) {
      logger.info("eZee InsertBooking BookingData (multipart form field BookingData)", {
        bookingDataJson: bookingDataJsonPretty,
      });
    } else {
      logger.debug("eZee InsertBooking BookingData", { bookingDataJson: bookingDataJsonPretty });
    }

    /** InsertBooking: hotel/auth on URL; `BookingData` JSON only in POST body as multipart/form-data. */
    const insertUrl =
      `https://live.ipms247.com/booking/reservation_api/listing.php` +
      `?request_type=InsertBooking` +
      `&HotelCode=${encodeURIComponent(hotelCode)}` +
      `&APIKey=${encodeURIComponent(authCode)}` +
      `&LANGUAGE=${encodeURIComponent("en")}`;

    const insertForm = new FormData();
    insertForm.append("BookingData", bookingDataJson);

    const urlForLog = insertUrl.split(encodeURIComponent(authCode)).join("***");
    logger.debug("eZee InsertBooking URL", { url: urlForLog });

    const resp = await axios.post(insertUrl, insertForm, {
      timeout: 20000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    let data: any = resp.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        /* keep raw string */
      }
    }

    const errMsg = extractEzeeBookingApiFailureMessage(data);
    if (errMsg) throw badRequest(errMsg);

    const bookingRef =
      String(
        data?.ReservationNo ??
          data?.Reservation_No ??
          data?.ResNo ??
          data?.resno ??
          data?.BookingRef ??
          data?.bookingRef ??
          ""
      ).trim() ||
      String(data?.ReservationNumber ?? data?.reservationNumber ?? "").trim();

    if (!bookingRef) {
      const ezeeError = Array.isArray(data)
        ? unwrapEzeeErrorDetailsNode(data[0]?.["Error Details"] ?? data[0]?.["ErrorDetails"]) ?? data[0]
        : unwrapEzeeErrorDetailsNode(data?.["Error Details"] ?? data?.["ErrorDetails"]) ?? data;
      const ezeeMessage =
        messageFromEzeeErrorBlock(ezeeError) ||
        (() => {
          try {
            return JSON.stringify(data, null, 2);
          } catch {
            return String(data);
          }
        })();
      logger.warn("eZee InsertBooking failed (no reservation ref)", {
        ezeeError,
        ezeeMessage,
        dataJson: (() => {
          try {
            return JSON.stringify(data, null, 2);
          } catch {
            return String(data);
          }
        })(),
      });
      throw badRequest(`Booking failed: ${ezeeMessage}`);
    }

    logger.debug("eZee InsertBooking raw response", {
      body: (() => {
        try {
          return JSON.stringify(data);
        } catch {
          return String(data);
        }
      })(),
    });

    let processedInPms = false;
    try {
      const ezeePms = new EzeePMSService({ hotelCode, authCode });
      await ezeePms.processBooking(bookingRef, "3");
      processedInPms = true;
      logger.info("eZee ProcessBooking success", { reservationNo: bookingRef });
    } catch (processErr) {
      logger.warn("eZee ProcessBooking failed — reservation exists in eZee but may need manual confirmation in PMS", {
        reservationNo: bookingRef,
        error: processErr instanceof Error ? processErr.message : String(processErr),
      });
    }

    const roomsForDb = body.data.rooms.map((r) => {
      const baseTotal = (Number(r.baseRate) || 0) * nights;
      let totals = roomRateTotals.get(String(r.roomRateId).trim());
      if (!totals && r.roomTypeId && r.rateTypeId) {
        totals = roomTypeRateTotals.get(`${String(r.roomTypeId).trim()}_${String(r.rateTypeId).trim()}`);
      }
      const ratio = totals && totals.beforeTax > 0 ? totals.tax / totals.beforeTax : 0;
      const nightlyTax =
        Array.isArray(r.nightlyRates) && r.nightlyRates.length > 0
          ? r.nightlyRates.reduce((s, n) => s + toNum((n as { tax?: number }).tax), 0)
          : 0;
      const taxTotal = ratio > 0 ? baseTotal * ratio : nightlyTax > 0 ? nightlyTax : 0;
      const totalAmount = baseTotal > 0 ? baseTotal + taxTotal : 0;
      return {
      roomTypeId: r.roomTypeId,
      roomTypeName: r.roomTypeName,
      rateTypeId: r.rateTypeId,
      planName: r.planName,
      adults: r.adults,
      children: r.children,
      baseRate: r.baseRate,
      totalAmount,
      };
    });

    const grandTotal = roomsForDb.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

    await LeadBookingModel.create({
      leadId: body.data.leadId,
      propertyId: body.data.hotelId,
      ezeeBookingRef: bookingRef,
      checkIn: new Date(`${body.data.checkIn}T00:00:00.000Z`),
      checkOut: new Date(`${body.data.checkOut}T00:00:00.000Z`),
      nights,
      guestName: `${body.data.guestFirstName} ${body.data.guestLastName}`.trim(),
      guestEmail: body.data.guestEmail || undefined,
      guestPhone: body.data.guestPhone || undefined,
      rooms: roomsForDb,
      grandTotal,
      status: "confirmed",
      bookedBy: (req as any).user?.id,
      bookedAt: new Date(),
      specialRequest: body.data.specialRequest || undefined,
      promotionCode: String(body.data.promotionCode ?? "").trim() || undefined,
      processedInPms,
    });

    const { logPmsBookingCreated } = await import("../utils/pmsActivityLog");
    await logPmsBookingCreated(body.data.leadId, {
      bookingRef,
      propertyId: body.data.hotelId,
      roomCount: roomsForDb.length,
      grandTotal,
      performedByUserId: (req as any).user?.id,
    });

    const { LeadItineraryModel } = await import("../models/leadItinerary");
    await LeadItineraryModel.deleteMany({
      leadId: body.data.leadId,
      propertyId: body.data.hotelId,
    });

    await moveLeadToBooked(body.data.leadId, (req as any).user?.id);

    res.json({ bookingRef, raw: data, processedInPms });
  } catch (err) {
    next(err);
  }
});

// GET /api/ezee/booking/:bookingRef?hotelId={propertyId}
ezeeRouter.get("/booking/:bookingRef", async (req, res, next) => {
  try {
    const params = z.object({ bookingRef: z.string().min(1) }).safeParse(req.params);
    const query = z.object({ hotelId: z.string().min(1) }).safeParse(req.query);
    if (!params.success) throw badRequest("bookingRef is required");
    if (!query.success) throw badRequest("hotelId is required");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");
    if (property.pmsProvider !== "EZEE") return res.json({});

    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) return res.json({});

    const url =
      `https://live.ipms247.com/booking/reservation_api/listing.php` +
      `?request_type=ReadBooking` +
      `&HotelCode=${encodeURIComponent(hotelCode)}` +
      `&APIKey=${encodeURIComponent(authCode)}` +
      `&ResNo=${encodeURIComponent(params.data.bookingRef)}`;

    const resp = await axios.post(url, null, { timeout: 15000 });
    const data: any = resp.data;
    const err = extractEzeeErrorMessage(data);
    if (err) throw badRequest(err);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/ezee/cancel-booking
ezeeRouter.post("/cancel-booking", async (req, res, next) => {
  try {
    const body = z
      .object({
        hotelId: z.string().min(1),
        bookingRef: z.string().min(1),
        leadId: z.string().min(1),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest("hotelId, bookingRef, leadId are required");

    const property = await PropertyModel.findById(body.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");
    if (property.pmsProvider !== "EZEE") throw badRequest("Selected hotel is not an eZee PMS property");

    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) throw badRequest("Hotel PMS credentials are missing");

    const url =
      `https://live.ipms247.com/booking/reservation_api/listing.php` +
      `?request_type=CancelBooking` +
      `&HotelCode=${encodeURIComponent(hotelCode)}` +
      `&APIKey=${encodeURIComponent(authCode)}` +
      `&language=en` +
      `&ResNo=${encodeURIComponent(body.data.bookingRef)}`;

    const resp = await axios.post(url, null, { timeout: 15000 });
    const data: any = resp.data;
    const err = extractEzeeErrorMessage(data);
    if (err) throw badRequest(err);

    await LeadBookingModel.updateOne(
      { leadId: body.data.leadId, propertyId: body.data.hotelId, ezeeBookingRef: body.data.bookingRef },
      { $set: { status: "cancelled" } }
    );

    const { logPmsBookingCancelled } = await import("../utils/pmsActivityLog");
    await logPmsBookingCancelled(body.data.leadId, {
      bookingRef: body.data.bookingRef,
      propertyId: body.data.hotelId,
      performedByUserId: (req as any).user?.id,
    });

    const { LeadItineraryModel } = await import("../models/leadItinerary");
    await LeadItineraryModel.deleteMany({
      leadId: body.data.leadId,
      propertyId: body.data.hotelId,
    });

    const remainingConfirmed = await LeadBookingModel.countDocuments({
      leadId: body.data.leadId,
      status: "confirmed",
    });
    if (remainingConfirmed === 0) {
      await moveLeadToCancelled(body.data.leadId, (req as any).user?.id);
    }

    res.json({ ok: true, raw: data });
  } catch (err) {
    next(err);
  }
});

