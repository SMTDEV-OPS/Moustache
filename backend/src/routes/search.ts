import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";
import { LeadModel } from "../models/lead";
import { LeadItineraryModel } from "../models/leadItinerary";
import { AccountModel } from "../models/account";
import { GuestModel } from "../models/guest";
import { PropertyModel } from "../models/property";

export const searchRouter = Router();

searchRouter.use(requireAuth);

type LeadScope = "own" | "team" | "all";

async function getTeamMemberIdsForRoleOwner(userId: string): Promise<string[]> {
  try {
    const { AccessControlService } = await import("../services/auth/AccessControlService");
    return await AccessControlService.getDescendants(userId);
  } catch {
    return [];
  }
}

async function buildLeadScopeFilter(
  user: { id: string; isAdmin?: boolean },
  scope: LeadScope
): Promise<Record<string, unknown>> {
  if (!user) return { assignedToUserId: new Types.ObjectId("000000000000000000000000") };

  if (scope === "all") {
    return {};
  }
  if (scope === "team") {
    const teamMemberIds = await getTeamMemberIdsForRoleOwner(user.id);
    if (teamMemberIds.length === 0) {
      return { assignedToUserId: new Types.ObjectId("000000000000000000000000") };
    }
    return { assignedToUserId: { $in: teamMemberIds.map((id) => new Types.ObjectId(id)) } };
  }
  return { assignedToUserId: new Types.ObjectId(user.id) };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

searchRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "8"), 10) || 8, 1), 20);

    if (q.length < 2) {
      return res.json({ leads: [], accounts: [], guests: [] });
    }

    const regex = new RegExp(escapeRegex(q), "i");
    const scope = (req.query.scope as LeadScope) || "own";

    let effectiveScope: LeadScope = "own";
    if (scope === "team") {
      if (
        hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
        req.user.isAdmin
      ) {
        effectiveScope = "team";
      }
    } else if (scope === "all") {
      if (req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
        effectiveScope = "all";
      }
    }

    const scopeFilter = await buildLeadScopeFilter(req.user, effectiveScope);

    const propertyMatches = await PropertyModel.find({ name: regex })
      .select("_id")
      .limit(20)
      .lean();
    const propertyIds = propertyMatches.map((p) => p._id);

    const itineraryMatches = await LeadItineraryModel.find({ hotelName: regex })
      .select("leadId hotelName")
      .limit(50)
      .lean();
    const itineraryLeadIds = [...new Set(itineraryMatches.map((i) => i.leadId.toString()))];

    const textOr: Record<string, unknown>[] = [
      { leadNumber: regex },
      { "contactDetails.name": regex },
      { "contactDetails.phone": regex },
      { "contactDetails.email": regex },
      { bookingSource: regex },
      { pmsReservationId: regex },
      { companyName: regex },
      { notes: regex },
    ];
    if (propertyIds.length > 0) {
      textOr.push({ propertyId: { $in: propertyIds } });
    }
    if (itineraryLeadIds.length > 0) {
      textOr.push({ _id: { $in: itineraryLeadIds.map((id) => new Types.ObjectId(id)) } });
    }

    const canSearchLeads =
      req.user.isAdmin ||
      hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
      hasPermission(req.user, PERMISSIONS.LEADS.MANAGE);

    let leadsOut: Array<{
      id: string;
      leadNumber: string;
      guestName: string;
      phone?: string;
      hotelNames: string[];
      bookingSource?: string;
      pmsReservationId?: string;
      accountName?: string;
    }> = [];

    if (canSearchLeads) {
      const leads = await LeadModel.find({
        ...scopeFilter,
        $or: textOr,
      })
        .populate("guestId", "name phone email")
        .populate("propertyId", "name")
        .populate("accountId", "name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const leadIds = leads.map((l) => l._id);
      const allItineraries = await LeadItineraryModel.find({ leadId: { $in: leadIds } })
        .select("leadId hotelName")
        .lean();
      const hotelsByLead = new Map<string, string[]>();
      for (const it of allItineraries) {
        const lid = it.leadId.toString();
        const list = hotelsByLead.get(lid) || [];
        if (it.hotelName && !list.includes(it.hotelName)) list.push(it.hotelName);
        hotelsByLead.set(lid, list);
      }

      leadsOut = leads.map((l) => {
        const guest = l.guestId as { name?: string; phone?: string; email?: string } | null;
        const contact = l.contactDetails as { name?: string; phone?: string; email?: string } | undefined;
        const property = l.propertyId as { name?: string } | null;
        const account = l.accountId as { name?: string } | null;
        const lid = l._id.toString();
        return {
          id: lid,
          leadNumber: l.leadNumber || lid,
          guestName: contact?.name || guest?.name || "",
          phone: contact?.phone || guest?.phone,
          hotelNames: hotelsByLead.get(lid) || (property?.name ? [property.name] : []),
          bookingSource: l.bookingSource,
          pmsReservationId: l.pmsReservationId,
          accountName: account?.name,
        };
      });
    }

    let accountsOut: Array<{
      id: string;
      name: string;
      city?: string;
      type?: string;
      isChild?: boolean;
      parentName?: string;
    }> = [];

    const canSearchAccounts =
      req.user.isAdmin ||
      hasPermission(req.user, "accounts.read") ||
      hasPermission(req.user, "accounts.access");

    if (canSearchAccounts) {
      const accounts = await AccountModel.find({
        $or: [
          { name: regex },
          { gstin: regex },
          { panNumber: regex },
          { email: regex },
          { city: regex },
          { pmsProfileId: regex },
        ],
      })
        .select("name city type organizationType parentAccountId")
        .limit(limit)
        .lean();

      const parentIds = accounts
        .filter((a) => a.parentAccountId)
        .map((a) => a.parentAccountId as Types.ObjectId);
      const parents =
        parentIds.length > 0
          ? await AccountModel.find({ _id: { $in: parentIds } })
              .select("name")
              .lean()
          : [];
      const parentMap = new Map(parents.map((p) => [p._id.toString(), p.name]));

      accountsOut = accounts.map((a) => ({
        id: a._id.toString(),
        name: a.name,
        city: a.city,
        type: a.organizationType || a.type,
        isChild: !!a.parentAccountId,
        parentName: a.parentAccountId
          ? parentMap.get(a.parentAccountId.toString())
          : undefined,
      }));
    }

    let guestsOut: Array<{ id: string; name: string; phone?: string; email?: string }> = [];

    const guests = await GuestModel.find({
      $or: [{ name: regex }, { phone: regex }, { email: regex }],
    })
      .select("name phone email")
      .limit(limit)
      .lean();

    guestsOut = guests.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      phone: g.phone,
      email: g.email,
    }));

    res.json({ leads: leadsOut, accounts: accountsOut, guests: guestsOut });
  } catch (err) {
    next(err);
  }
});
