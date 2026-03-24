import { Router } from "express";
import { z } from "zod";
import { ContactActivityModel } from "../models/contactActivity";
import { ContactModel } from "../models/contact";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, notFound, forbidden } from "../utils/httpError";

export const contactActivitiesRouter = Router();

contactActivitiesRouter.use(requireAuth);

const activityTypeEnum = z.enum(["SALES_CALL", "TELECALL", "EMAIL", "CLIENT_SITE_INSPECTION"]);
const activityStatusEnum = z.enum(["ACTIVE", "CANCELLED"]);
const responseStatusEnum = z.enum(["NEEDS_ACTION", "ACCEPTED", "DECLINED", "TENTATIVE"]);
const attendeeKindEnum = z.enum(["INTERNAL", "EXTERNAL"]);

const attendeeSchema = z.object({
  kind: attendeeKindEnum,
  userId: z.string().optional(),
  contactId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
});

const createSchema = z.object({
  accountId: z.string().min(1),
  contactId: z.string().min(1),
  activityType: activityTypeEnum,
  status: activityStatusEnum.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  category: z.string().optional(),
  reminderMinutesBefore: z.number().min(0).max(60 * 24 * 7).optional(),
  attendees: z.array(attendeeSchema).optional(),
  purpose: z.string().optional(),
  discussion: z.string().optional(),
  output: z.string().optional(),
  followUp: z.string().optional(),
  leadId: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const updateSchema = createSchema.partial().omit({ accountId: true, contactId: true });

// List by account (optional contactId filter)
contactActivitiesRouter.get("/", async (req, res, next) => {
  try {
    const { accountId, contactId, from, to, status } = req.query;
    if (!accountId || typeof accountId !== "string") {
      throw badRequest("accountId is required");
    }

    const canManageActivities = hasPermission(req.user, "accounts.manage_activities");
    const canReadAllContacts = hasPermission(req.user, "contacts.read_all");
    const canReadOwnContacts = hasPermission(req.user, "contacts.read_own");
    if (!canManageActivities && !canReadAllContacts && !canReadOwnContacts) {
      throw forbidden("Insufficient permissions to view activities");
    }

    const filter: Record<string, unknown> = { accountId };
    if (contactId && typeof contactId === "string") filter.contactId = contactId;
    if (status && typeof status === "string") filter.status = status;

    if (from || to) {
      const startsAt: Record<string, Date> = {};
      if (from && typeof from === "string") startsAt.$gte = new Date(from);
      if (to && typeof to === "string") startsAt.$lte = new Date(to);
      filter.startsAt = startsAt;
    }

    // Own-scope: only activities for contacts created by current user.
    if (!canManageActivities && !canReadAllContacts) {
      if (!req.user?.id) throw forbidden("Authentication required");
      const ownContacts = await ContactModel.find({ accountId, createdByUserId: req.user.id }, { _id: 1 }).lean();
      const ownIds = ownContacts.map((c: any) => c._id);
      filter.contactId = contactId ? contactId : { $in: ownIds };
    }

    const activities = await ContactActivityModel.find(filter)
      .sort({ startsAt: 1 })
      .populate("performedByUserId", "name email")
      .populate("contactId", "name")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

// Create
contactActivitiesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid payload");
    }
    const {
      accountId,
      contactId,
      activityType,
      status,
      startsAt,
      endsAt,
      category,
      reminderMinutesBefore,
      attendees,
      purpose,
      discussion,
      output,
      followUp,
      leadId,
      latitude,
      longitude,
    } = parsed.data;

    const fromMobile = req.get("X-Source") === "mobile";
    if (fromMobile && (latitude == null || longitude == null)) {
      throw badRequest("Location (latitude, longitude) is required when submitting from mobile");
    }

    if ((startsAt && !endsAt) || (!startsAt && endsAt)) {
      throw badRequest("startsAt and endsAt must both be provided");
    }
    if (startsAt && endsAt) {
      const s = new Date(startsAt);
      const e = new Date(endsAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) throw badRequest("Invalid startsAt/endsAt");
      if (e.getTime() <= s.getTime()) throw badRequest("endsAt must be after startsAt");
    }

    const contact = await ContactModel.findById(contactId).lean();
    if (!contact) throw notFound("Contact not found");
    if ((contact as any).accountId?.toString() !== accountId) {
      throw badRequest("Contact does not belong to this account");
    }

    const canManageActivities = hasPermission(req.user, "accounts.manage_activities");
    const canUpdateAll = hasPermission(req.user, "contacts.update_all");
    const canUpdateOwn = hasPermission(req.user, "contacts.update_own");
    if (!canManageActivities && !canUpdateAll && !canUpdateOwn) {
      throw forbidden("Insufficient permissions to create activities");
    }
    if (!canManageActivities && !canUpdateAll) {
      const creatorId = (contact as any).createdByUserId?.toString?.() ?? (contact as any).createdByUserId;
      if (!req.user?.id || creatorId !== req.user.id) {
        throw forbidden("You can only add activities to contacts you own");
      }
    }

    const activity = await ContactActivityModel.create({
      accountId,
      contactId,
      activityType,
      status: status || "ACTIVE",
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      category,
      reminderMinutesBefore,
      attendees: attendees || [],
      purpose,
      discussion,
      output,
      followUp,
      leadId: leadId || undefined,
      performedByUserId: req.user?.id,
      latitude,
      longitude,
    });
    const populated = await ContactActivityModel.findById(activity._id)
      .populate("performedByUserId", "name email")
      .populate("contactId", "name")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// Get one
contactActivitiesRouter.get("/:id", async (req, res, next) => {
  try {
    const activity = await ContactActivityModel.findById(req.params.id)
      .populate("performedByUserId", "name email")
      .populate("contactId", "name")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();
    if (!activity) throw notFound("Activity not found");
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

// Update
contactActivitiesRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_activities")) {
      throw forbidden("Insufficient permissions to update activities");
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload");
    }
    if ((parsed.data.startsAt && !parsed.data.endsAt) || (!parsed.data.startsAt && parsed.data.endsAt)) {
      throw badRequest("startsAt and endsAt must both be provided");
    }
    if (parsed.data.startsAt && parsed.data.endsAt) {
      const s = new Date(parsed.data.startsAt);
      const e = new Date(parsed.data.endsAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) throw badRequest("Invalid startsAt/endsAt");
      if (e.getTime() <= s.getTime()) throw badRequest("endsAt must be after startsAt");
    }

    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startsAt) update.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt) update.endsAt = new Date(parsed.data.endsAt);

    const activity = await ContactActivityModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    )
      .populate("performedByUserId", "name email")
      .populate("contactId", "name")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();
    if (!activity) throw notFound("Activity not found");

    res.json(activity);
  } catch (err) {
    next(err);
  }
});

// Cancel (activity records are not hard-deletable)
contactActivitiesRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.manage_activities")) {
      throw forbidden("Insufficient permissions to cancel activities");
    }

    const activity = await ContactActivityModel.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "CANCELLED" } },
      { new: true }
    )
      .populate("performedByUserId", "name email")
      .populate("contactId", "name")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();
    if (!activity) throw notFound("Activity not found");

    res.json(activity);
  } catch (err) {
    next(err);
  }
});

// No DELETE: activity records are not deletable
contactActivitiesRouter.delete("/:id", (_req, res) => {
  res.status(403).json({ message: "Activity deletion is not allowed." });
});

// RSVP (authenticated)
contactActivitiesRouter.post("/:id/rsvp", async (req, res, next) => {
  try {
    const schema = z.object({
      responseStatus: responseStatusEnum,
      attendeeEmail: z.string().email().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid RSVP payload");

    const activity = await ContactActivityModel.findById(req.params.id);
    if (!activity) throw notFound("Activity not found");

    const targetEmail = parsed.data.attendeeEmail || (req.user as any)?.email;
    if (!targetEmail) throw badRequest("attendeeEmail is required");

    const attendees: any[] = Array.isArray((activity as any).attendees) ? (activity as any).attendees : [];
    const match = attendees.find((a) => String(a.email).toLowerCase() === String(targetEmail).toLowerCase());
    if (!match) throw forbidden("You are not an attendee of this activity");

    match.responseStatus = parsed.data.responseStatus;
    match.respondedAt = new Date();
    await activity.save();

    const populated = await ContactActivityModel.findById(activity._id)
      .populate("performedByUserId", "name email")
      .populate("contactId", "name email")
      .populate("attendees.userId", "name email")
      .populate("attendees.contactId", "name email")
      .lean();
    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// In-app reminders: due reminders for current user
contactActivitiesRouter.get("/pending-reminders/me", async (req, res, next) => {
  try {
    if (!req.user?.id) throw badRequest("Missing authenticated user");
    const now = new Date();
    const userId = req.user.id;

    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const candidates = await ContactActivityModel.find({
      status: "ACTIVE",
      startsAt: { $lte: horizon },
      "attendees.userId": userId,
    })
      .sort({ startsAt: 1 })
      .limit(50)
      .populate("contactId", "name")
      .lean();

    const due = (candidates as any[]).filter((a) => {
      const mins = a.reminderMinutesBefore;
      if (mins == null) return false;
      const startsAt = new Date(a.startsAt);
      const reminderAt = new Date(startsAt.getTime() - mins * 60 * 1000);
      return reminderAt.getTime() <= now.getTime();
    });

    res.json(due.slice(0, 10));
  } catch (err) {
    next(err);
  }
});
