import { Router } from "express";
import { z } from "zod";
import { ContactModel } from "../models/contact";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";

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
    isLoyaltyMember: z.boolean().default(false),
    loyaltyProgramName: z.string().optional(),
    loyaltyNumber: z.string().optional(),
    boardNumber: z.string().optional(),
    officeNumber: z.string().optional(),
    mobileNumber1: z.string().optional(),
    mobileNumber2: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    clientStatus: z.enum(["PROMOTER", "NEUTRAL", "DETRACTOR"]).default("NEUTRAL"),
});

// Get all contacts for an account
contactsRouter.get("/account/:accountId", async (req, res, next) => {
    try {
        const contacts = await ContactModel.find({ accountId: req.params.accountId })
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
        res.json(contact);
    } catch (err) {
        next(err);
    }
});

// Create contact for an account
contactsRouter.post("/account/:accountId", async (req, res, next) => {
    try {
        const parsed = contactSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid contact payload");
        }

        const contact = await ContactModel.create({
            ...parsed.data,
            accountId: req.params.accountId,
        });
        res.status(201).json(contact);
    } catch (err) {
        next(err);
    }
});

// Update contact
contactsRouter.patch("/:id", async (req, res, next) => {
    try {
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

// Delete contact
contactsRouter.delete("/:id", async (req, res, next) => {
    try {
        const contact = await ContactModel.findByIdAndDelete(req.params.id).lean();
        if (!contact) {
            throw notFound("Contact not found");
        }
        res.json({ message: "Contact deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// Get upcoming events
contactsRouter.get("/events/upcoming", async (req, res, next) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const now = new Date();
        const future = new Date();
        future.setDate(now.getDate() + days);

        // This is a simplified query; proper birthday query usually involves checking month/day ignore year
        const contacts = await ContactModel.find({
            $or: [
                { dateOfBirth: { $exists: true } },
                { weddingAnniversary: { $exists: true } }
            ]
        }).lean();

        // Filter in JS for simplicity, or use $expr and $month/$dayOfMonth for MongoDB
        const events = contacts.filter(c => {
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
