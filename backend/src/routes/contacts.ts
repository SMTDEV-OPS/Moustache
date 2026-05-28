import { Router } from "express";
import { z } from "zod";
import { ContactModel } from "../models/contact";
import { AccountModel } from "../models/account";
import { ActivityLogModel } from "../models/activityLog";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, notFound, forbidden } from "../utils/httpError";

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

const contactSchema = z.object({
    title: z.string().optional(),
    name: z.string().min(1),
    designation: z.string().optional(),
    isKeyPersonnel: z.boolean().default(false),
    keyPersonnelRole: z.enum(["ADMIN_HEAD", "FINANCE_HEAD", "SALES_HEAD", "MARKETING_HEAD", "COUNTRY_CITY_HEAD", "ASSISTANT", "HR_HEAD", "TRAINING_HEAD"]).optional(),
    officeAddress: z.object({
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
    }).optional(),
    personalAddress: z.object({
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
    }).optional(),
    dateOfBirth: z.string().pipe(z.coerce.date()).optional(),
    weddingAnniversary: z.string().pipe(z.coerce.date()).optional(),
    personnelDetails: z.string().optional(),
    isLoyaltyMember: z.boolean().default(false),
    loyaltyProgramName: z.string().optional(),
    loyaltyNumber: z.string().optional(),
    preferenceOfCommunication: z.string().optional(),
    boardNumber: z.string().optional(),
    officeNumber: z.string().optional(),
    mobileNumber1: z.string().optional(),
    mobileNumber2: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    clientStatus: z.enum(["PROMOTER", "NEUTRAL", "DETRACTOR"]).default("NEUTRAL"),
    tags: z.array(z.string()).optional(),
    status: z.enum(["ACTIVE", "NA"]).optional(),
    followUpDate: z.coerce.date().optional().nullable(),
    followUpNote: z.string().optional(),
});

// Get all contacts for an account (visibility enforced via contacts.* permissions)
contactsRouter.get("/account/:accountId", async (req, res, next) => {
    try {
        const accountId = req.params.accountId;
        const { includeNa } = req.query;
        const canReadAll = hasPermission(req.user, "contacts.read_all");
        const canReadOwn = hasPermission(req.user, "contacts.read_own");
        if (!canReadAll && !canReadOwn) {
            throw forbidden("Insufficient permissions to view contacts");
        }

        const filter: Record<string, unknown> = { accountId };
        if (!canReadAll) {
            if (!req.user?.id) throw forbidden("Authentication required");
            filter.createdByUserId = req.user.id;
        }
        if (String(includeNa) !== "true") {
            filter.status = { $ne: "NA" };
        }

        const contacts = await ContactModel.find(filter)
            .sort({ isKeyPersonnel: -1, name: 1 })
            .lean();
        res.json(contacts);
    } catch (err) {
        next(err);
    }
});

// Get single contact
contactsRouter.get("/:id", async (req, res, next) => {
    try {
        const contact = await ContactModel.findById(req.params.id).lean();
        if (!contact) {
            throw notFound("Contact not found");
        }
        const canReadAll = hasPermission(req.user, "contacts.read_all");
        const canReadOwn = hasPermission(req.user, "contacts.read_own");
        if (!canReadAll && !canReadOwn) {
            throw forbidden("Insufficient permissions to view contacts");
        }
        if (!canReadAll) {
            const creatorId = (contact as any).createdByUserId?.toString?.() ?? (contact as any).createdByUserId;
            if (!req.user?.id || creatorId !== req.user.id) {
                throw forbidden("You do not have access to this contact");
            }
        }
        res.json(contact);
    } catch (err) {
        next(err);
    }
});

// Create contact for an account
contactsRouter.post("/account/:accountId", async (req, res, next) => {
    try {
        if (!req.user?.id) {
            throw forbidden("Authentication required");
        }
        if (!hasPermission(req.user, "contacts.create")) {
            throw forbidden("Insufficient permissions to create contacts");
        }

        const parsed = contactSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid contact payload");
        }

        const accountId = req.params.accountId;
        const account = await AccountModel.findById(accountId).lean();
        if (!account) {
            throw notFound("Account not found");
        }

        const contact = await ContactModel.create({
            ...parsed.data,
            accountId,
            createdByUserId: req.user.id,
        });
        res.status(201).json(contact);
    } catch (err) {
        next(err);
    }
});

// Update contact
contactsRouter.patch("/:id", async (req, res, next) => {
    try {
        const existing = await ContactModel.findById(req.params.id).lean();
        if (!existing) {
            throw notFound("Contact not found");
        }
        const canUpdateAll = hasPermission(req.user, "contacts.update_all");
        const canUpdateOwn = hasPermission(req.user, "contacts.update_own");
        if (!canUpdateAll && !canUpdateOwn) {
            throw forbidden("Insufficient permissions to update contacts");
        }
        if (!canUpdateAll) {
            const creatorId = (existing as any).createdByUserId?.toString?.() ?? (existing as any).createdByUserId;
            if (!req.user?.id || creatorId !== req.user.id) {
                throw forbidden("You do not have access to update this contact");
            }
        }

        const parsed = contactSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid update payload");
        }

        const contact = await ContactModel.findByIdAndUpdate(
            req.params.id,
            { $set: parsed.data },
            { new: true }
        ).lean();

        if (!contact) {
            throw notFound("Contact not found");
        }
        res.json(contact);
    } catch (err) {
        next(err);
    }
});

// Delete contact (SYSTEM_ADMIN only for hard delete; others must use Mark as NA)
contactsRouter.delete("/:id", async (req, res, next) => {
    try {
        const existing = await ContactModel.findById(req.params.id).lean();
        if (!existing) {
            throw notFound("Contact not found");
        }
        const canDeleteAll = hasPermission(req.user, "contacts.delete_all");
        const canDeleteOwn = hasPermission(req.user, "contacts.delete_own");
        if (!canDeleteAll && !canDeleteOwn) {
            throw forbidden("Insufficient permissions to delete contacts");
        }
        if (!req.user?.isSystemAdmin) {
            return next(
                forbidden("Deletion not permitted. Use Mark as NA to deactivate this contact.")
            );
        }
        if (!canDeleteAll) {
            const creatorId = (existing as any).createdByUserId?.toString?.() ?? (existing as any).createdByUserId;
            if (!req.user?.id || creatorId !== req.user.id) {
                throw forbidden("You do not have access to delete this contact");
            }
        }

        const contactName = (existing as any).name;
        await ContactModel.findByIdAndDelete(req.params.id);

        await ActivityLogModel.create({
            type: "CONTACT",
            entityId: req.params.id,
            userId: req.user.id,
            action: "DELETE",
            metadata: {
                contactName,
                deletedBy: req.user.id,
                deletedAt: new Date().toISOString(),
            },
        });

        res.json({ message: "Contact deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// Get upcoming events (birthdays / anniversaries)
contactsRouter.get("/events/upcoming", async (req, res, next) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const now = new Date();
        const future = new Date();
        future.setDate(now.getDate() + days);

        const canReadAll = hasPermission(req.user, "contacts.read_all");
        const canReadOwn = hasPermission(req.user, "contacts.read_own");
        if (!canReadAll && !canReadOwn) {
            throw forbidden("Insufficient permissions to view contacts");
        }

        const baseFilter: Record<string, unknown> = {
            $or: [
                { dateOfBirth: { $exists: true } },
                { weddingAnniversary: { $exists: true } },
            ],
        };
        if (!canReadAll) {
            if (!req.user?.id) throw forbidden("Authentication required");
            baseFilter.createdByUserId = req.user.id;
        }
        const contacts = await ContactModel.find(baseFilter).lean();

        const events = contacts.filter((c) => {
            if (c.dateOfBirth) {
                const d = new Date(c.dateOfBirth);
                d.setFullYear(now.getFullYear());
                if (d >= now && d <= future) return true;
            }
            if (c.weddingAnniversary) {
                const d = new Date(c.weddingAnniversary);
                d.setFullYear(now.getFullYear());
                if (d >= now && d <= future) return true;
            }
            return false;
        });

        res.json(events);
    } catch (err) {
        next(err);
    }
});
