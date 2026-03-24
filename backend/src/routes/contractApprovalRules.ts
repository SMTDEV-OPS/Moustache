import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireAnyPermission } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { ContractApprovalRuleModel } from "../models/contractApprovalRule";

export const contractApprovalRulesRouter = Router();

contractApprovalRulesRouter.use(requireAuth);
contractApprovalRulesRouter.use(requireAnyPermission(["settings.manage", "accounts.manage"]));

const stepSchema = z.object({
  step: z.number().int().min(1),
  approverType: z.enum(["specific_user", "role", "reports_to_submitter"]),
  approverUserId: z.string().optional(),
  approverRoleId: z.string().optional(),
  label: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  condition_field: z.enum(["propertyId", "channel", "contractValue", "accountType", "organisationType"]),
  condition_operator: z.enum(["eq", "neq", "in", "not_in"]),
  condition_value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  applyToAll: z.boolean().optional(),
  approvalSteps: z.array(stepSchema).min(1),
  is_active: z.boolean().optional(),
});

const updateSchema = createSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided" });

contractApprovalRulesRouter.get("/", async (_req, res, next) => {
  try {
    const rules = await ContractApprovalRuleModel.find({}).sort({ priority: 1 }).lean();
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

contractApprovalRulesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid contract approval rule payload");

    const existingMax = await ContractApprovalRuleModel.findOne({})
      .sort({ priority: -1 })
      .select("priority")
      .lean();
    const nextPriority =
      parsed.data.priority !== undefined ? parsed.data.priority : (existingMax?.priority ?? 0) + 1;

    const approvalSteps = parsed.data.approvalSteps.map((step) => ({
      ...step,
      approverUserId: step.approverUserId ? new mongoose.Types.ObjectId(step.approverUserId) : undefined,
      approverRoleId: step.approverRoleId ? new mongoose.Types.ObjectId(step.approverRoleId) : undefined,
    }));

    const rule = await ContractApprovalRuleModel.create({
      ...parsed.data,
      priority: nextPriority,
      approvalSteps,
      applyToAll: parsed.data.applyToAll ?? false,
      is_active: parsed.data.is_active ?? true,
    });

    res.status(201).json(rule.toObject());
  } catch (err) {
    next(err);
  }
});

contractApprovalRulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid contract approval rule update payload");

    const update: any = { ...parsed.data };
    if (update.approvalSteps) {
      update.approvalSteps = update.approvalSteps.map((step: any) => ({
        ...step,
        approverUserId: step.approverUserId ? new mongoose.Types.ObjectId(step.approverUserId) : undefined,
        approverRoleId: step.approverRoleId ? new mongoose.Types.ObjectId(step.approverRoleId) : undefined,
      }));
    }

    const rule = await ContractApprovalRuleModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update },
      { new: true }
    ).lean();

    if (!rule) throw notFound("Contract approval rule not found");
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

contractApprovalRulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");

    const deleted = await ContractApprovalRuleModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
    }).lean();
    if (!deleted) throw notFound("Contract approval rule not found");

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

contractApprovalRulesRouter.put("/reorder", async (req, res, next) => {
  try {
    const schema = z.array(
      z.object({
        id: z.string().min(1),
        priority: z.number().int(),
      })
    );
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid reorder payload");

    await Promise.all(
      parsed.data.map((item) => {
        if (!mongoose.Types.ObjectId.isValid(item.id)) {
          throw badRequest("Invalid id in reorder payload");
        }
        return ContractApprovalRuleModel.updateOne(
          { _id: new mongoose.Types.ObjectId(item.id) },
          { $set: { priority: item.priority } }
        );
      })
    );

    const rules = await ContractApprovalRuleModel.find({}).sort({ priority: 1 }).lean();
    res.json(rules);
  } catch (err) {
    next(err);
  }
});
