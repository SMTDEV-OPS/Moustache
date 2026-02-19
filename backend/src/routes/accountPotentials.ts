import { Router } from "express";
import { z } from "zod";
import { AccountPotentialModel } from "../models/accountPotential";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";

export const accountPotentialsRouter = Router();

accountPotentialsRouter.use(requireAuth);

const potentialDataSchema = z.object({
    roomNights: z.number().default(0),
    roomRevenue: z.number().default(0),
    actualRoomNights: z.number().optional(),
    actualRoomRevenue: z.number().optional(),
});

const accountPotentialSchema = z.object({
    city: z.string().min(1),
    location: z.enum(["CBD", "MICRO_MARKET", "INDUSTRIAL_BELT", "NORTH_GEO", "SOUTH_GEO", "CUSTOM"]),
    customLocation: z.string().optional(),
    segment: z.enum(["LUXURY", "UPPER_UPSCALE", "UPSCALE", "MID_SEGMENT", "BUDGET", "GUEST_HOUSE"]),
    fitPotential: potentialDataSchema.optional(),
    groupPotential: potentialDataSchema.optional(),
    longStayPotential: potentialDataSchema.optional(),
    banquetPotential: z.object({
        events: z.number().default(0),
        revenue: z.number().default(0),
        actualEvents: z.number().optional(),
        actualRevenue: z.number().optional(),
    }).optional(),
    competitors: z.array(z.object({
        brandId: z.string().optional(),
        brandName: z.string().min(1),
        rates: z.string().optional(),
        marketShare: z.number().optional(),
    })).optional(),
    remarks: z.string().optional(),
    year: z.number().default(() => new Date().getFullYear()),
});

// Get all potentials for an account
accountPotentialsRouter.get("/account/:accountId", async (req, res, next) => {
    try {
        const potentials = await AccountPotentialModel.find({ accountId: req.params.accountId })
            .sort({ year: -1, city: 1 })
            .lean();
        res.json(potentials);
    } catch (err) {
        next(err);
    }
});

// Create or update potential entry
accountPotentialsRouter.post("/account/:accountId", async (req, res, next) => {
    try {
        const parsed = accountPotentialSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid potential payload");
        }

        const { city, year } = parsed.data;

        // Upsert behavior: update if city/year/accountId exists, else create
        const potential = await AccountPotentialModel.findOneAndUpdate(
            { accountId: req.params.accountId, city, year },
            { $set: parsed.data },
            { new: true, upsert: true }
        ).lean();

        res.status(potential ? 200 : 201).json(potential);
    } catch (err) {
        next(err);
    }
});

// Get aggregated potential summary for account
accountPotentialsRouter.get("/account/:accountId/summary", async (req, res, next) => {
    try {
        const potentials = await AccountPotentialModel.find({
            accountId: req.params.accountId,
            year: parseInt(req.query.year as string) || new Date().getFullYear()
        }).lean();

        const summary = potentials.reduce((acc, p) => {
            acc.totalFitPotential += p.fitPotential.roomRevenue;
            acc.totalFitActual += p.fitPotential.actualRoomRevenue || 0;
            acc.totalGroupPotential += p.groupPotential.roomRevenue;
            acc.totalGroupActual += p.groupPotential.actualRoomRevenue || 0;
            acc.totalLongStayPotential += p.longStayPotential.roomRevenue;
            acc.totalLongStayActual += p.longStayPotential.actualRoomRevenue || 0;
            acc.totalBanquetPotential += p.banquetPotential.revenue;
            acc.totalBanquetActual += p.banquetPotential.actualRevenue || 0;
            return acc;
        }, {
            totalFitPotential: 0, totalFitActual: 0,
            totalGroupPotential: 0, totalGroupActual: 0,
            totalLongStayPotential: 0, totalLongStayActual: 0,
            totalBanquetPotential: 0, totalBanquetActual: 0,
        });

        const totalPotential = summary.totalFitPotential + summary.totalGroupPotential + summary.totalLongStayPotential + summary.totalBanquetPotential;
        const totalActual = summary.totalFitActual + summary.totalGroupActual + summary.totalLongStayActual + summary.totalBanquetActual;
        const achievementPercentage = totalPotential > 0 ? (totalActual / totalPotential) * 100 : 0;

        res.json({
            ...summary,
            totalPotential,
            totalActual,
            achievementPercentage
        });
    } catch (err) {
        next(err);
    }
});

// Delete potential
accountPotentialsRouter.delete("/:id", async (req, res, next) => {
    try {
        const potential = await AccountPotentialModel.findByIdAndDelete(req.params.id).lean();
        if (!potential) {
            throw notFound("Potential entry not found");
        }
        res.json({ message: "Potential entry deleted successfully" });
    } catch (err) {
        next(err);
    }
});
