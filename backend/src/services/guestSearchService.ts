import { GuestModel, IGuest } from "../models/guest";
import { LeadModel } from "../models/lead";
import { ReservationModel } from "../models/reservation";
import { CommunicationModel } from "../models/communication";
import { logger } from "../config/logger";
import { Types } from "mongoose";

// Plain object type for guest (without Mongoose Document methods)
// This matches the structure returned by .lean()
export interface GuestPlain {
  _id: Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  isSunshineMember: boolean;
  sunshineTier?: string | null;
  tags: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  totalLeadsCount: number;
  totalReservationsCount: number;
  externalGuestId?: string;
  externalSource?: string;
  lastSyncedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExternalGuestData {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  // Add other fields as needed when external DB structure is known
  [key: string]: any;
}

export interface GuestSearchResult {
  guest?: GuestPlain | null;
  source: "local" | "external" | "both";
  externalData?: ExternalGuestData;
  previousLeads?: any[];
  previousReservations?: any[];
  communicationHistory?: any[];
}

/**
 * Placeholder function for searching guest in external database
 * This will be replaced with actual API integration later
 */
export async function searchGuestInExternalDB(
  phone: string
): Promise<ExternalGuestData | null> {
  // TODO: Implement actual external database API call
  // This is a placeholder that returns null
  // When implementing, replace with actual API call to client's guest database

  logger.info("External guest search called (placeholder)", { phone });

  // Example structure for future implementation:
  // const response = await fetch(`${EXTERNAL_API_URL}/guests/search`, {
  //   method: "POST",
  //   headers: { "Authorization": `Bearer ${EXTERNAL_API_KEY}` },
  //   body: JSON.stringify({ phone })
  // });
  // return response.json();

  return null;
}

/**
 * Search guest by phone number in local database first, then external database
 */
export async function searchGuestByPhone(
  phone: string
): Promise<GuestSearchResult> {
  // Import phone utilities
  const { normalizePhone } = await import("../utils/phoneUtils");

  // Normalize the search phone
  const normalizedPhone = normalizePhone(phone);

  // Search in local database (primary and secondary phones)
  const localGuest = await GuestModel.findOne({
    $or: [
      { phone: phone },
      { phone: normalizedPhone },
      { secondaryPhones: phone },
      { secondaryPhones: normalizedPhone },
    ],
  }).lean();

  // Search in external database (placeholder)
  const externalGuest = await searchGuestInExternalDB(phone);

  let guest: GuestPlain | null = null;
  let source: "local" | "external" | "both" = "local";

  if (localGuest && externalGuest) {
    source = "both";
    guest = localGuest as GuestPlain;
    // Optionally sync external data to local guest
    // This can be implemented later when sync strategy is defined
  } else if (localGuest) {
    source = "local";
    guest = localGuest as GuestPlain;
  } else if (externalGuest) {
    source = "external";
    // Create a temporary guest object from external data
    // In production, you might want to create a local guest record
    guest = {
      _id: new Types.ObjectId(),
      name: externalGuest.name,
      phone: externalGuest.phone,
      email: externalGuest.email,
      isSunshineMember: false,
      tags: [],
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      totalLeadsCount: 0,
      totalReservationsCount: 0,
      externalGuestId: externalGuest.id,
      externalSource: "external",
      lastSyncedAt: new Date(),
    } as GuestPlain;
  }

  // Fetch guest history if guest found
  let previousLeads: any[] = [];
  let previousReservations: any[] = [];
  let communicationHistory: any[] = [];

  if (guest && guest._id) {
    // Get previous leads
    previousLeads = await LeadModel.find({ guestId: guest._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get previous reservations
    previousReservations = await ReservationModel.find({ guestId: guest._id })
      .sort({ checkInDate: -1 })
      .limit(10)
      .lean();

    // Get communication history
    communicationHistory = await CommunicationModel.find({
      $or: [{ guestId: guest._id }, { leadId: { $in: previousLeads.map((l) => l._id) } }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }

  return {
    guest,
    source,
    externalData: externalGuest || undefined,
    previousLeads,
    previousReservations,
    communicationHistory,
  };
}

/**
 * Search guest by email
 */
export async function searchGuestByEmail(
  email: string
): Promise<GuestSearchResult> {
  // Import email utilities
  const { normalizeEmail } = await import("../utils/phoneUtils");

  // Normalize the search email
  const normalizedEmail = normalizeEmail(email);

  const localGuest = await GuestModel.findOne({
    $or: [
      { email: normalizedEmail },
      { secondaryEmails: normalizedEmail },
    ],
  }).lean();

  let previousLeads: any[] = [];
  let previousReservations: any[] = [];
  let communicationHistory: any[] = [];

  if (localGuest) {
    previousLeads = await LeadModel.find({ guestId: localGuest._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    previousReservations = await ReservationModel.find({ guestId: localGuest._id })
      .sort({ checkInDate: -1 })
      .limit(10)
      .lean();

    communicationHistory = await CommunicationModel.find({
      $or: [{ guestId: localGuest._id }, { leadId: { $in: previousLeads.map((l) => l._id) } }],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
  }

  return {
    guest: localGuest as GuestPlain | null,
    source: localGuest ? "local" : "external",
    previousLeads,
    previousReservations,
    communicationHistory,
  };
}

