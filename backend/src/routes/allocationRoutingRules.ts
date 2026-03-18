import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireAnyPermission } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { AllocationRoutingRuleModel } from "../models/allocationRoutingRule";
import { EmployeeGroupModel } from "../models/employeeGroup";

const router = Router();

// Match allocation router auth posture (settings/manage OR leads/manage)
router.use(requireAuth);
router.use(requireAnyPermission(["settings.manage", "leads.manage"]));

function getOrgId(req: any): string {
  const orgId = (req.query?.orgId ?? req.body?.orgId) as string | undefined;
  if (!orgId || typeof orgId !== "string") throw badRequest("orgId is required");
  return orgId;
}

const operatorSchema = z.enum(["eq", "neq", "in", "not_in"]);

const createSchema = z.object({
  orgId: z.string().min(1),
  condition_field: z.string().min(1),
  condition_operator: operatorSchema,
  condition_value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  assign_to_group_id: z.string().min(1),
  assign_to_group_name: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const updateSchema = z
  .object({
    condition_field: z.string().min(1).optional(),
    condition_operator: operatorSchema.optional(),
    condition_value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    assign_to_group_id: z.string().min(1).optional(),
    assign_to_group_name: z.string().min(1).optional(),
    priority: z.number().int().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided" });

router.get("/", async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const rules = await AllocationRoutingRuleModel.find({ orgId }).sort({ priority: 1 }).lean();
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse({ ...req.body, orgId: req.body?.orgId ?? req.query?.orgId });
    if (!parsed.success) throw badRequest("Invalid routing rule payload");

    const { orgId, assign_to_group_id } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(assign_to_group_id)) {
      throw badRequest("assign_to_group_id must be a valid ObjectId");
    }

    const group = await EmployeeGroupModel.findById(assign_to_group_id).select("name").lean();
    if (!group) throw notFound("Group not found");

    const existingMax = await AllocationRoutingRuleModel.findOne({ orgId })
      .sort({ priority: -1 })
      .select("priority")
      .lean();
    const nextPriority =
      parsed.data.priority !== undefined
        ? parsed.data.priority
        : (existingMax?.priority ?? 0) + 1;

    const rule = await AllocationRoutingRuleModel.create({
      orgId,
      priority: nextPriority,
      condition_field: parsed.data.condition_field,
      condition_operator: parsed.data.condition_operator,
      condition_value: parsed.data.condition_value,
      assign_to_group_id: new mongoose.Types.ObjectId(assign_to_group_id),
      assign_to_group_name: parsed.data.assign_to_group_name ?? group.name,
      is_active: parsed.data.is_active ?? true,
    });

    res.status(201).json(rule.toObject());
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid routing rule update payload");

    const update: any = { ...parsed.data };

    if (update.assign_to_group_id) {
      if (!mongoose.Types.ObjectId.isValid(update.assign_to_group_id)) {
        throw badRequest("assign_to_group_id must be a valid ObjectId");
      }
      const group = await EmployeeGroupModel.findById(update.assign_to_group_id).select("name").lean();
      if (!group) throw notFound("Group not found");
      update.assign_to_group_name = group.name;
      update.assign_to_group_id = new mongoose.Types.ObjectId(update.assign_to_group_id);
    }

    const rule = await AllocationRoutingRuleModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), orgId },
      { $set: update },
      { new: true }
    ).lean();

    if (!rule) throw notFound("Routing rule not found");
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");

    const deleted = await AllocationRoutingRuleModel.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      orgId,
    }).lean();
    if (!deleted) throw notFound("Routing rule not found");

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put("/reorder", async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
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
        return AllocationRoutingRuleModel.updateOne(
          { _id: new mongoose.Types.ObjectId(item.id), orgId },
          { $set: { priority: item.priority } }
        );
      })
    );

    const rules = await AllocationRoutingRuleModel.find({ orgId }).sort({ priority: 1 }).lean();
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

export default router;

