import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { WorkflowV2Model } from "../models/workflowV2";
import { WorkflowConditionModel } from "../models/workflowV2";
import { WorkflowActionModel } from "../models/workflowV2";
import { WorkflowExecutionLogModel } from "../models/workflowExecutionLog";
import { registerTrigger } from "../services/workflowEngine";
import { TRIGGER_EVENTS, ACTION_TYPES, CONDITION_OPERATORS } from "../models/workflowV2";
import { logAudit } from "../utils/auditLog";

export const adminWorkflowsRouter = Router();

adminWorkflowsRouter.use(requireAuth);
adminWorkflowsRouter.use(requirePermissions(["workflows.manage"]));

const conditionSchema = z.object({
  field_slug: z.string(),
  operator: z.enum(CONDITION_OPERATORS as unknown as [string, ...string[]]),
  value: z.string().default(""),
  logical_group: z.number().int().min(1).default(1),
});

const actionSchema = z.object({
  action_type: z.enum(ACTION_TYPES as unknown as [string, ...string[]]),
  params_json: z.record(z.any()).default({}),
  delay_minutes: z.number().int().min(0).default(0),
  order: z.number().int().min(0),
});

const createWorkflowSchema = z.object({
  orgId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_event: z.enum(TRIGGER_EVENTS as unknown as [string, ...string[]]),
  trigger_params_json: z.record(z.any()).optional(),
  is_active: z.boolean().default(true),
  run_once_per_lead: z.boolean().default(false),
  conditions: z.array(conditionSchema).default([]),
  actions: z.array(actionSchema).default([]),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

// GET /api/admin/workflows/logs/lead/:leadId (must be before /:id)
adminWorkflowsRouter.get("/logs/lead/:leadId", async (req, res, next) => {
  try {
    const leadId = req.params.leadId;
    if (!Types.ObjectId.isValid(leadId)) throw badRequest("Invalid leadId");
    const logs = await WorkflowExecutionLogModel.find({
      leadId: new Types.ObjectId(leadId),
    })
      .sort({ executed_at: -1 })
      .limit(100)
      .populate("workflowId", "name trigger_event")
      .lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/workflows — returns all workflows (no org filter)
adminWorkflowsRouter.get("/", async (req, res, next) => {
  try {
    const list = await WorkflowV2Model.find({ is_active: { $ne: false } })
      .sort({ createdAt: -1 })
      .lean();
    const workflows = await Promise.all(
      list.map(async (wf) => {
        const conditions = await WorkflowConditionModel.find({ workflowId: wf._id }).lean();
        const actions = await WorkflowActionModel.find({ workflowId: wf._id }).sort({ order: 1 }).lean();
        return { ...wf, conditions, actions };
      })
    );
    res.json(workflows);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/workflows
adminWorkflowsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid workflow payload");
    }
    const data = parsed.data;
    const orgObjectId = data.orgId
      ? (() => { try { return new Types.ObjectId(data.orgId); } catch { return new Types.ObjectId("69ae144fae23030b62f901f5"); } })()
      : new Types.ObjectId("69ae144fae23030b62f901f5");
    const wf = await WorkflowV2Model.create({
      orgId: orgObjectId,
      name: data.name,
      description: data.description,
      trigger_event: data.trigger_event,
      trigger_params_json: data.trigger_params_json,
      is_active: data.is_active,
      run_once_per_lead: data.run_once_per_lead,
    });
    for (const c of data.conditions) {
      await WorkflowConditionModel.create({
        workflowId: wf._id,
        orgId: wf.orgId,
        field_slug: c.field_slug,
        operator: c.operator,
        value: c.value,
        logical_group: c.logical_group,
      });
    }
    for (const a of data.actions) {
      await WorkflowActionModel.create({
        workflowId: wf._id,
        orgId: wf.orgId,
        action_type: a.action_type,
        params_json: a.params_json,
        delay_minutes: a.delay_minutes,
        order: a.order,
      });
    }
    const conditions = await WorkflowConditionModel.find({ workflowId: wf._id }).lean();
    const actions = await WorkflowActionModel.find({ workflowId: wf._id }).sort({ order: 1 }).lean();
    logAudit("created", "workflow", wf._id.toString(), null, { name: wf.name }, req, { orgId: data.orgId });
    res.status(201).json({ ...wf.toObject(), conditions, actions });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/workflows/:id
adminWorkflowsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid workflow update payload");
    }
    const wf = await WorkflowV2Model.findById(req.params.id);
    if (!wf) throw notFound("Workflow not found");

    const before = wf.toObject();
    const data = parsed.data;
    if (data.orgId) {
      try {
        wf.orgId = new Types.ObjectId(data.orgId);
      } catch {
        return res.status(400).json({ error: 'Invalid orgId format' });
      }
    }
    if (data.name !== undefined) wf.name = data.name;
    if (data.description !== undefined) wf.description = data.description;
    if (data.trigger_event !== undefined) wf.trigger_event = data.trigger_event as any;
    if (data.trigger_params_json !== undefined) wf.trigger_params_json = data.trigger_params_json;
    if (data.is_active !== undefined) wf.is_active = data.is_active;
    if (data.run_once_per_lead !== undefined) wf.run_once_per_lead = data.run_once_per_lead;
    await wf.save();

    if (data.conditions) {
      await WorkflowConditionModel.deleteMany({ workflowId: wf._id });
      for (const c of data.conditions) {
        await WorkflowConditionModel.create({
          workflowId: wf._id,
          orgId: wf.orgId,
          field_slug: c.field_slug,
          operator: c.operator,
          value: c.value,
          logical_group: c.logical_group,
        });
      }
    }
    if (data.actions) {
      await WorkflowActionModel.deleteMany({ workflowId: wf._id });
      for (const a of data.actions) {
        await WorkflowActionModel.create({
          workflowId: wf._id,
          orgId: wf.orgId,
          action_type: a.action_type,
          params_json: a.params_json,
          delay_minutes: a.delay_minutes,
          order: a.order,
        });
      }
    }

    const conditions = await WorkflowConditionModel.find({ workflowId: wf._id }).lean();
    const actions = await WorkflowActionModel.find({ workflowId: wf._id }).sort({ order: 1 }).lean();
    logAudit("updated", "workflow", wf._id.toString(), before, wf.toObject(), req, { orgId: wf.orgId?.toString() });
    res.json({ ...wf.toObject(), conditions, actions });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/workflows/:id (soft delete)
adminWorkflowsRouter.delete("/:id", async (req, res, next) => {
  try {
    const wf = await WorkflowV2Model.findByIdAndUpdate(
      req.params.id,
      { $set: { is_active: false } },
      { new: true }
    );
    if (!wf) throw notFound("Workflow not found");
    logAudit("deleted", "workflow", req.params.id, { is_active: true }, { is_active: false }, req, { orgId: wf.orgId?.toString() });
    res.json({ message: "Workflow deactivated", workflow: wf });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/workflows/:id/test
adminWorkflowsRouter.post("/:id/test", async (req, res, next) => {
  try {
    const { leadId } = req.body || {};
    if (!leadId) throw badRequest("leadId is required for test");
    const wf = await WorkflowV2Model.findById(req.params.id);
    if (!wf) throw notFound("Workflow not found");

    const triggerToEvent: Record<string, string> = {
      lead_created: "lead.created",
      lead_stage_moved: "lead.stage_moved",
      lead_rescored: "lead.rescored",
      lead_field_changed: "lead.field_changed",
      lead_unattended: "lead.unattended",
      followup_missed: "lead.followup_missed",
      followup_missed_count: "lead.followup_missed_count",
      agent_capacity_warning: "agent.capacity_warning",
      lead_overflow_queued: "lead.overflow_queued",
      lead_inactive_warning: "lead.inactive_warning",
      lead_inactive_critical: "lead.inactive_critical",
      scheduled: "scheduled",
    };
    const eventName = triggerToEvent[(wf as any).trigger_event] || (wf as any).trigger_event;

    await registerTrigger(eventName, {
      leadId,
      orgId: (wf as any).orgId?.toString(),
      workflowId: wf._id.toString(),
    }, { dryRun: true });

    const log = await WorkflowExecutionLogModel.findOne({
      workflowId: wf._id,
      leadId: new Types.ObjectId(leadId),
      dry_run: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ message: "Dry run completed", log });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/workflows/:id/logs
adminWorkflowsRouter.get("/:id/logs", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = parseInt(req.query.skip as string) || 0;
    const logs = await WorkflowExecutionLogModel.find({
      workflowId: req.params.id,
    })
      .sort({ executed_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});
