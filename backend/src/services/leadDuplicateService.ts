import { Types } from "mongoose";
import { LeadModel } from "../models/lead";
import { LeadItineraryModel } from "../models/leadItinerary";

function normalizePhone(phone?: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10);
}

export interface DuplicateCheckInput {
  phone?: string;
  email?: string;
  accountId?: string;
  checkIn?: string;
  checkOut?: string;
  excludeLeadId?: string;
}

export interface DuplicateMatch {
  leadId: string;
  leadNumber: string;
  reason: string;
  contactName?: string;
}

export async function findDuplicateLeads(input: DuplicateCheckInput): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();
  const phoneNorm = normalizePhone(input.phone);
  const emailNorm = input.email?.trim().toLowerCase();

  const orConditions: Record<string, unknown>[] = [];
  if (phoneNorm.length >= 10) {
    orConditions.push({ "contactDetails.phone": { $regex: phoneNorm.slice(-10) + "$" } });
  }
  if (emailNorm) {
    orConditions.push({ "contactDetails.email": { $regex: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
  }

  if (orConditions.length === 0) return [];

  const query: Record<string, unknown> = { $or: orConditions };
  if (input.excludeLeadId && Types.ObjectId.isValid(input.excludeLeadId)) {
    query._id = { $ne: new Types.ObjectId(input.excludeLeadId) };
  }

  const leads = await LeadModel.find(query)
    .select("leadNumber contactDetails accountId createdAt")
    .limit(20)
    .lean();

  for (const lead of leads) {
    const id = String(lead._id);
    if (seen.has(id)) continue;
    seen.add(id);

    const reasons: string[] = [];
    const leadPhone = normalizePhone((lead as any).contactDetails?.phone);
    if (phoneNorm && leadPhone && leadPhone === phoneNorm) reasons.push("Same phone number");
    const leadEmail = (lead as any).contactDetails?.email?.toLowerCase();
    if (emailNorm && leadEmail === emailNorm) reasons.push("Same email");

    if (input.accountId && lead.accountId?.toString() === input.accountId) {
      reasons.push("Same account");
    }

    if (input.checkIn && input.checkOut) {
      const checkIn = new Date(input.checkIn);
      const checkOut = new Date(input.checkOut);
      const itineraries = await LeadItineraryModel.find({ leadId: lead._id })
        .select("checkInDate checkOutDate")
        .lean();
      for (const it of itineraries) {
        if (!it.checkInDate || !it.checkOutDate) continue;
        const aStart = new Date(it.checkInDate).getTime();
        const aEnd = new Date(it.checkOutDate).getTime();
        const bStart = checkIn.getTime();
        const bEnd = checkOut.getTime();
        if (aStart <= bEnd && bStart <= aEnd) {
          reasons.push("Overlapping stay dates");
          break;
        }
      }
    }

    if (reasons.length === 0 && phoneNorm) reasons.push("Possible duplicate contact");

    matches.push({
      leadId: id,
      leadNumber: (lead as any).leadNumber || id,
      reason: reasons.join("; "),
      contactName: (lead as any).contactDetails?.name,
    });
  }

  return matches;
}
