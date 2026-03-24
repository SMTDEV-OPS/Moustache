import { Router } from "express";
import { z } from "zod";
import { DealModel } from "../models/deal";
import { AccountModel } from "../models/account";
import { ActivityLogModel } from "../models/activityLog";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, notFound, forbidden } from "../utils/httpError";

export const dealsRouter = Router();

dealsRouter.use(requireAuth);

const dealStageEnum = z.enum([
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "NA",
]);

const createSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  stage: dealStageEnum.optional(),
  value: z.number().min(0),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
  leadId: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  stage: dealStageEnum.optional(),
  value: z.number().min(0).optional(),
  currency: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.union([z.string(), z.null()]).optional(),
  ownerUserId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

// List deals by account
dealsRouter.get("/", async (req, res, next) => {
  try {
    const { accountId, includeNa } = req.query;
    if (!accountId || typeof accountId !== "string") {
      throw badRequest("accountId is required");
    }

    const account = await AccountModel.findById(accountId).lean();
    if (!account) throw notFound("Account not found");

    if (!hasPermission(req.user, "accounts.update")) {
      throw forbidden("Insufficient permissions to view deals");
    }

    const filter: Record<string, unknown> = { accountId };
    if (String(includeNa) !== "true") {
      filter.stage = { $ne: "NA" };
    }

    const deals = await DealModel.find(filter)
      .sort({ expectedCloseDate: -1, createdAt: -1 })
      .populate("ownerUserId", "name email")
      .lean();
    res.json(deals);
  } catch (err) {
    next(err);
  }
});

// Create deal
dealsRouter.post("/", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.update")) {
      throw forbidden("Insufficient permissions to create deals");
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid payload");
    }
    const data = parsed.data;

    const account = await AccountModel.findById(data.accountId).lean();
    if (!account) throw notFound("Account not found");

    const deal = await DealModel.create({
      ...data,
      expectedCloseDate:
        data.expectedCloseDate && typeof data.expectedCloseDate === "string"
          ? new Date(data.expectedCloseDate)
          : undefined,
      ownerUserId: req.user?.id,
    });
    const populated = await DealModel.findById(deal._id)
      .populate("ownerUserId", "name email")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// Get one
dealsRouter.get("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.update")) {
      throw forbidden("Insufficient permissions to view deals");
    }

    const deal = await DealModel.findById(req.params.id)
      .populate("ownerUserId", "name email")
      .populate("accountId", "name")
      .lean();
    if (!deal) throw notFound("Deal not found");

    res.json(deal);
  } catch (err) {
    next(err);
  }
});

// Update
dealsRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!hasPermission(req.user, "accounts.update")) {
      throw forbidden("Insufficient permissions to edit deals");
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload");
    }

    const deal = await DealModel.findById(req.params.id).lean();
    if (!deal) throw notFound("Deal not found");

    const updateData: Record<string, unknown> = { ...parsed.data };
    if (updateData.expectedCloseDate === null) {
      updateData.expectedCloseDate = undefined;
    } else if (typeof updateData.expectedCloseDate === "string") {
      updateData.expectedCloseDate = new Date(updateData.expectedCloseDate as string);
    }
    if (updateData.ownerUserId === null) updateData.ownerUserId = undefined;
    if (updateData.leadId === null) updateData.leadId = undefined;

    const updated = await DealModel.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    )
      .populate("ownerUserId", "name email")
      .lean();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE: only SYSTEM_ADMIN can hard delete; others must use Mark as NA
dealsRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!req.user?.isSystemAdmin) {
      return next(
        forbidden("Deletion not permitted. Use Mark as NA to deactivate this deal.")
      );
    }

    const deal = await DealModel.findById(req.params.id).lean();
    if (!deal) throw notFound("Deal not found");

    const dealName = (deal as any).name;
    await DealModel.findByIdAndDelete(req.params.id);

    await ActivityLogModel.create({
      type: "DEAL",
      entityId: req.params.id,
      userId: req.user.id,
      action: "DELETE",
      metadata: {
        dealName,
        deletedBy: req.user.id,
        deletedAt: new Date().toISOString(),
      },
    });

    res.json({ message: "Deal deleted successfully" });
  } catch (err) {
    next(err);
  }
});
