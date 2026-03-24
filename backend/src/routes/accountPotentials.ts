import { Router } from "express";
import { z } from "zod";
import { AccountModel } from "../models/account";
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

const eventPotentialSchema = z.object({
    events: z.number().default(0),
    revenue: z.number().default(0),
    actualEvents: z.number().optional(),
    actualRevenue: z.number().optional(),
});

const accountPotentialSchema = z.object({
    city: z.string().min(1),
    location: z.enum(["CBD", "MICRO_MARKET", "INDUSTRIAL_BELT", "NORTH_GEO", "SOUTH_GEO", "COMMERCIAL_BUSINESS_DISTRICT", "CUSTOM"]),
    customLocation: z.string().optional(),
    segment: z.enum(["LUXURY", "UPPER_UPSCALE", "UPSCALE", "MID_SEGMENT", "BUDGET", "GUEST_HOUSE"]),
    fitPotential: potentialDataSchema.optional(),
    groupPotential: potentialDataSchema.optional(),
    longStayPotential: potentialDataSchema.optional(),
    banquetPotential: eventPotentialSchema.optional(),
    fbPotential: eventPotentialSchema.optional(),
    spaPotential: eventPotentialSchema.optional(),
    competitors: z.array(z.object({
        brandId: z.string().optional(),
        brandName: z.string().optional(),
        rate: z.number().optional(),
        inclusion: z.string().optional(),
        roomNightSharePercent: z.number().optional(),
        remarks: z.string().optional(),
    })).optional(),
    remarks: z.string().optional(),
    autoCalculatedRN: z.number().nullable().optional(),
    year: z.number().default(() => new Date().getFullYear()),
});

// TODO: make configurable — load from a SystemConfig document or admin settings
function getAccountTypeThresholds() {
    return {
        baseRoomNights: 1000,
        acquisitionBelow: 20,
        retentionAbove: 60,
    };
}

// Market search: list accounts (hotels) that have potential for given location + segment + optional city
accountPotentialsRouter.get("/market-search", async (req, res, next) => {
    try {
        const { location, segment, city } = req.query;
        if (!location || !segment || typeof location !== "string" || typeof segment !== "string") {
            throw badRequest("location and segment are required");
        }
        const filter: Record<string, unknown> = { location, segment };
        if (city && typeof city === "string") filter.city = city;
        const year = new Date().getFullYear();
        filter.year = year;

        const potentials = await AccountPotentialModel.find(filter)
            .populate("accountId", "name city")
            .lean();
        const byAccount = new Map<string, { accountId: string; accountName: string; city?: string }>();
        for (const p of potentials) {
            const acc = p.accountId as any;
            const id = acc?._id?.toString() || acc?.id || (p as any).accountId?.toString();
            if (id && !byAccount.has(id)) {
                byAccount.set(id, {
                    accountId: id,
                    accountName: acc?.name || "Unknown",
                    city: acc?.city || (p as any).city,
                });
            }
        }
        res.json(Array.from(byAccount.values()));
    } catch (err) {
        next(err);
    }
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

        const { city, year, location, segment } = parsed.data;

        // Upsert behavior: update if (accountId, city, year, location, segment) exists, else create
        const potential = await AccountPotentialModel.findOneAndUpdate(
            { accountId: req.params.accountId, city, year, location, segment },
            { $set: parsed.data },
            { new: true, upsert: true }
        ).lean();

        // Account Type calculation using configurable thresholds
        try {
            const thresholds = getAccountTypeThresholds();
            const baseRN = thresholds.baseRoomNights || 1000;
            const acqBelow = thresholds.acquisitionBelow || 20;
            const retAbove = thresholds.retentionAbove || 60;

            const allPotentials = await AccountPotentialModel.find({ accountId: req.params.accountId }).lean();
            let totalActualRN = 0;

            for (const p of allPotentials) {
                totalActualRN +=
                    (p.fitPotential?.actualRoomNights || 0) +
                    (p.groupPotential?.actualRoomNights || 0) +
                    (p.longStayPotential?.actualRoomNights || 0);
            }

            const account = await AccountModel.findById(req.params.accountId);
            if (account && !account.accountTypeOverride) {
                let calculatedType: "ACQUISITION" | "DEVELOPMENT" | "RETENTION" = "ACQUISITION";

                const percentage = (totalActualRN / baseRN) * 100;
                if (percentage > retAbove) {
                    calculatedType = "RETENTION";
                } else if (percentage >= acqBelow) {
                    calculatedType = "DEVELOPMENT";
                }

                if (account.accountType !== calculatedType) {
                    await AccountModel.findByIdAndUpdate(req.params.accountId, {
                        $set: { accountType: calculatedType },
                    });
                }
            }
        } catch (calcErr) {
            console.error("Failed to calculate account type", calcErr);
        }

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
            year: parseInt(req.query.year as string) || new Date().getFullYear(),
        }).lean();

        const summary = potentials.reduce(
            (acc, p) => {
                acc.totalFitPotential += p.fitPotential?.roomRevenue ?? 0;
                acc.totalFitActual += p.fitPotential?.actualRoomRevenue ?? 0;
                acc.totalGroupPotential += p.groupPotential?.roomRevenue ?? 0;
                acc.totalGroupActual += p.groupPotential?.actualRoomRevenue ?? 0;
                acc.totalLongStayPotential += p.longStayPotential?.roomRevenue ?? 0;
                acc.totalLongStayActual += p.longStayPotential?.actualRoomRevenue ?? 0;
                acc.totalBanquetPotential += p.banquetPotential?.revenue ?? 0;
                acc.totalBanquetActual += p.banquetPotential?.actualRevenue ?? 0;
                return acc;
            },
            {
                totalFitPotential: 0,
                totalFitActual: 0,
                totalGroupPotential: 0,
                totalGroupActual: 0,
                totalLongStayPotential: 0,
                totalLongStayActual: 0,
                totalBanquetPotential: 0,
                totalBanquetActual: 0,
            }
        );

        const totalPotential =
            summary.totalFitPotential +
            summary.totalGroupPotential +
            summary.totalLongStayPotential +
            summary.totalBanquetPotential;
        const totalActual =
            summary.totalFitActual +
            summary.totalGroupActual +
            summary.totalLongStayActual +
            summary.totalBanquetActual;
        const achievementPercentage =
            totalPotential > 0 ? (totalActual / totalPotential) * 100 : 0;

        res.json({
            ...summary,
            totalPotential,
            totalActual,
            achievementPercentage,
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
