import { Types } from "mongoose";
import { logger } from "../config/logger";
import { LeadModel, ILead } from "../models/lead";
import { GuestModel } from "../models/guest";
import { UserModel } from "../models/user";
import { TaskModel } from "../models/task";
import { TemplateModel } from "../models/template";
import { CommunicationModel } from "../models/communication";
import { NotificationModel, NotificationType } from "../models/notification";
import { CommunicationChannel, CommunicationDirection, LeadStatus } from "../models/common";
import { WorkflowV2Model, IWorkflowV2 } from "../models/workflowV2";
import { WorkflowConditionModel, IWorkflowCondition, ConditionOperator } from "../models/workflowV2";
import { WorkflowActionModel, IWorkflowAction, ActionType } from "../models/workflowV2";
import { WorkflowExecutionLogModel } from "../models/workflowExecutionLog";
import { PendingWorkflowActionModel } from "../models/pendingWorkflowAction";
import { sendWhatsApp } from "./communicationService";
import { getPrimaryEmailAccount, sendEmail } from "./emailService";
import { validateStageMove, reassignLead, leadEventBus } from "./leadService";
import { getAvailableAgents } from "./allocationService";
import { IEmailAddress } from "../models/emailMessage";

// Event name mapping: internal -> trigger_event
const EVENT_MAP: Record<string, string> = {
  "lead.created": "lead_created",
  "lead.stage_moved": "lead_stage_moved",
  "lead.rescored": "lead_rescored",
  "lead.field_changed": "lead_field_changed",
  "lead.unattended": "lead_unattended",
  "lead.followup_missed": "followup_missed",
  "lead.followup_missed_count": "followup_missed_count",
  "agent.capacity_warning": "agent_capacity_warning",
  "lead.overflow_queued": "lead_overflow_queued",
  "lead.inactive_warning": "lead_inactive_warning",
  "lead.inactive_critical": "lead_inactive_critical",
  scheduled: "scheduled",
};

export type LeadContext = Record<string, any>;

/**
 * Build lead context from lead + related data for condition evaluation and template resolution
 */
export async function buildLeadContext(
  leadId: string,
  orgId: string | undefined,
  extraPayload?: Record<string, any>
): Promise<LeadContext> {
  const lead = await LeadModel.findById(leadId)
    .populate("propertyId", "name")
    .populate("assignedToUserId", "name email phone")
    .lean();

  if (!lead) {
    return { lead_id: leadId, ...extraPayload };
  }

  const leadAny = lead as any;
  const ctx: LeadContext = {
    lead_id: lead._id.toString(),
    lead_number: lead.leadNumber,
    score: lead.score,
    bucket: lead.heatLevel,
    stage_id: lead.stageId?.toString(),
    assigned_agent_id: lead.assignedToUserId?._id?.toString(),
    created_at: lead.createdAt,
    last_activity_at: (lead as any).updatedAt ?? lead.createdAt,
    updated_at: (lead as any).updatedAt ?? lead.createdAt,
    source: lead.source,
    first_contact_done: !!lead.firstResponseAt,
    missed_followup_count: (lead as any).missed_followup_count ?? 0,
    lead_name: lead.contactDetails?.name,
    property_name: (lead as any).propertyId?.name,
    agent_name: (lead as any).assignedToUserId?.name,
    booking_window: lead.bookingWindow,
    time_of_day: new Date().getHours(),
  };

  if (lead.guestId) {
    const guest = await GuestModel.findById(lead.guestId).lean();
    if (guest) {
      ctx.lead_name = ctx.lead_name || guest.name;
      ctx.lead_mobile = guest.phone;
      ctx.lead_email = guest.email;
    }
  }

  if (lead.assignedToUserId) {
    const user = await UserModel.findById(lead.assignedToUserId).lean();
    if (user) {
      ctx.agent_name = (user as any).name;
      ctx.agent_email = (user as any).email;
      ctx.agent_mobile = (user as any).phone;
    }
  }

  const nextTask = await TaskModel.findOne({
    leadId: lead._id,
    type: "followup",
    status: "OPEN",
    dueAt: { $gte: new Date() },
  })
    .sort({ dueAt: 1 })
    .lean();

  if (nextTask) {
    ctx.followup_date = nextTask.dueAt
      ? new Date(nextTask.dueAt).toLocaleDateString()
      : "";
  }

  if (lead.customData && typeof lead.customData === "object") {
    const customData = lead.customData as Map<string, any> | Record<string, any>;
    if (customData instanceof Map) {
      customData.forEach((v, k) => {
        ctx[k] = v;
      });
    } else {
      Object.assign(ctx, customData);
    }
  }

  for (const [k, v] of Object.entries(leadAny)) {
    if (v !== undefined && v !== null && !ctx[k] && typeof v !== "object") {
      ctx[k] = v;
    }
  }

  if (extraPayload) {
    Object.assign(ctx, extraPayload);
  }

  return ctx;
}

/**
 * Resolve {{field_slug}} placeholders in template body
 */
export function resolveTemplateVariables(
  templateBody: string,
  leadContext: LeadContext
): string {
  let result = templateBody;
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(templateBody)) !== null) {
    const slug = m[1];
    const value = leadContext[slug];
    result = result.replace(
      new RegExp(`\\{\\{${slug}\\}\\}`, "g"),
      value != null ? String(value) : ""
    );
  }
  return result;
}

/**
 * Evaluate a single condition against lead context
 */
function evaluateSingleCondition(
  cond: IWorkflowCondition | { field_slug: string; operator: ConditionOperator; value: string; logical_group?: number },
  ctx: LeadContext
): boolean {
  const actual = ctx[cond.field_slug];
  const expected = cond.value;

  const isEmpty = (v: any) =>
    v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

  switch (cond.operator) {
    case "eq":
      return String(actual) === String(expected);
    case "neq":
      return String(actual) !== String(expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "in":
      const inList = expected.split(",").map((s) => s.trim());
      return inList.includes(String(actual));
    case "not_in":
      const ninList = expected.split(",").map((s) => s.trim());
      return !ninList.includes(String(actual));
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    case "contains":
      return String(actual || "").toLowerCase().includes(String(expected).toLowerCase());
    default:
      return false;
  }
}

/**
 * Evaluate all conditions. Groups are OR'd, within group AND'd.
 */
export function evaluateConditions(
  conditions: Array<{ field_slug: string; operator: ConditionOperator; value: string; logical_group?: number }>,
  leadContext: LeadContext
): boolean {
  if (conditions.length === 0) return true;

  const byGroup = new Map<number, typeof conditions>();
  for (const c of conditions) {
    const g = c.logical_group ?? 1;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(c);
  }

  const groups = Array.from(byGroup.entries()).sort((a, b) => a[0] - b[0]);

  for (const [, conds] of groups) {
    const allPass = conds.every((c) => evaluateSingleCondition(c, leadContext));
    if (allPass) return true;
  }
  return false;
}

/**
 * Apply trigger params filter (e.g. minutes, count, to_stage_id)
 */
function passesTriggerParams(
  params: Record<string, any> | undefined,
  payload: Record<string, any>,
  triggerEvent: string
): boolean {
  if (!params || Object.keys(params).length === 0) return true;

  if (params.minutes !== undefined && payload.minutes_idle !== undefined) {
    if (params.minutes !== payload.minutes_idle) return false;
  }
  if (params.count !== undefined && payload.missed_count !== undefined) {
    if (params.count !== payload.missed_count) return false;
  }
  if (params.to_stage_id && payload.toStageId) {
    if (params.to_stage_id !== payload.toStageId) return false;
  }
  return true;
}

/**
 * Execute a single workflow action
 */
async function executeAction(
  action: IWorkflowAction,
  leadContext: LeadContext,
  orgId: string,
  leadId: string
): Promise<{ status: string; error?: string }> {
  const lead = await LeadModel.findById(leadId);
  if (!lead) return { status: "failed", error: "Lead not found" };

  const params = action.params_json || {};
  const actionId = action._id.toString();

  try {
    switch (action.action_type as ActionType) {
      case "send_whatsapp": {
        const templateId = params.template_id || params.templateId;
        const recipientField = params.recipient_field || "lead_mobile";
        let phone = leadContext[recipientField];
        if (!phone && lead.guestId) {
          const guest = await GuestModel.findById(lead.guestId).lean();
          phone = guest?.phone;
        }
        if (!phone) {
          return { status: "failed", error: "No phone number for WhatsApp" };
        }
        let body = "";
        if (templateId) {
          const t = await TemplateModel.findById(templateId).lean();
          if (t) body = resolveTemplateVariables(t.body, leadContext);
        }
        if (!body) return { status: "failed", error: "Template not found or empty" };
        await sendWhatsApp(leadId, { phone: String(phone), message: body });
        return { status: "completed" };
      }

      case "send_email": {
        const templateId = params.template_id || params.templateId;
        const recipientField = params.recipient_field || "lead_email";
        let email = leadContext[recipientField];
        if (!email && lead.guestId) {
          const guest = await GuestModel.findById(lead.guestId).lean();
          email = guest?.email;
        }
        if (!email) {
          return { status: "failed", error: "No email for send_email" };
        }
        let body = "";
        let subject = "";
        if (templateId) {
          const t = await TemplateModel.findById(templateId).lean();
          if (t) {
            body = resolveTemplateVariables(t.body, leadContext);
            subject = t.subject ? resolveTemplateVariables(t.subject, leadContext) : "";
          }
        }
        if (!body) return { status: "failed", error: "Template not found or empty" };
        const accountId =
          recipientField === "agent_email" && lead.assignedToUserId
            ? (await getPrimaryEmailAccount(lead.assignedToUserId.toString()))?._id
            : null;
        if (!accountId) {
          await CommunicationModel.create({
            leadId: lead._id,
            guestId: lead.guestId,
            channel: CommunicationChannel.EMAIL,
            direction: CommunicationDirection.OUTBOUND,
            summary: subject || "Workflow email",
            messageContent: body,
            rawPayload: { subject, body, autoSent: true },
          });
        } else {
          const toAddresses: IEmailAddress[] = [{ email: String(email), name: leadContext.lead_name }];
          await sendEmail(accountId.toString(), {
            to: toAddresses,
            subject: subject || "Follow-up",
            bodyText: body.replace(/<[^>]*>/g, ""),
            bodyHtml: body,
          });
        }
        return { status: "completed" };
      }

      case "create_task": {
        const title = params.title || "Workflow Task";
        const assignTo = params.assign_to || "agent";
        let ownerId = lead.assignedToUserId;
        if (assignTo === "tl" || assignTo === "manager") {
          if (lead.assignedToUserId) {
            const u = await UserModel.findById(lead.assignedToUserId).select("reportsTo").lean();
            ownerId = (u as any)?.reportsTo;
          }
        }
        if (!ownerId) return { status: "failed", error: "No assignee for task" };
        const dueOffset = params.due_offset_hours || 0;
        const dueAt = new Date();
        dueAt.setHours(dueAt.getHours() + dueOffset);
        await TaskModel.create({
          title: resolveTemplateVariables(title, leadContext),
          description: params.description ? resolveTemplateVariables(params.description, leadContext) : undefined,
          ownerUserId: ownerId,
          createdByUserId: null,
          leadId: lead._id,
          dueAt,
          status: "OPEN",
          type: "general",
        });
        return { status: "completed" };
      }

      case "move_stage": {
        const targetStageId = params.target_stage_id;
        if (!targetStageId) return { status: "failed", error: "Missing target_stage_id" };
        const validation = await validateStageMove(leadId, targetStageId, orgId);
        if (!validation.allowed) {
          logger.warn("Workflow move_stage blocked", {
            leadId,
            targetStageId,
            reason: validation.reason,
          });
          return { status: "skipped", error: validation.reason };
        }
        lead.stageId = new Types.ObjectId(targetStageId);
        await lead.save();
        return { status: "completed" };
      }

      case "assign_lead": {
        const strategy = params.strategy || "min_open_leads";
        const specificUserId = params.user_id;
        if (specificUserId) {
          const sysUser = await UserModel.findOne({ status: "ACTIVE" }).select("_id").lean();
          const performedBy = sysUser?._id?.toString() || specificUserId;
          await reassignLead(leadId, specificUserId, performedBy);
          return { status: "completed" };
        }
        const agents = await getAvailableAgents(orgId);
        if (agents.length === 0) return { status: "failed", error: "No available agents" };
        const userIds = await LeadModel.aggregate([
          { $match: { assignedToUserId: { $in: agents }, status: { $in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTATION_SHARED, LeadStatus.PAYMENT_PENDING, LeadStatus.ON_HOLD] } } },
          { $group: { _id: "$assignedToUserId", count: { $sum: 1 } } },
        ]);
        const countMap = new Map<string, number>();
        for (const item of userIds) {
          countMap.set(item._id.toString(), item.count);
        }
        let minUser = agents[0];
        let minCount = countMap.get(agents[0].toString()) ?? 0;
        for (const id of agents) {
          const c = countMap.get(id.toString()) ?? 0;
          if (c < minCount) {
            minCount = c;
            minUser = id;
          }
        }
        const sysUser = await UserModel.findOne({ status: "ACTIVE" }).select("_id").lean();
        const performedBy = sysUser?._id?.toString() || minUser.toString();
        await reassignLead(leadId, minUser.toString(), performedBy);
        return { status: "completed" };
      }

      case "notify_user": {
        const recipient = params.recipient || "assigned_agent";
        const message = params.message ? resolveTemplateVariables(params.message, leadContext) : "Workflow notification";
        let userId: Types.ObjectId | undefined;
        if (recipient === "assigned_agent" && lead.assignedToUserId) {
          userId = lead.assignedToUserId;
        } else if (recipient === "specific_user" && params.user_id) {
          userId = new Types.ObjectId(params.user_id);
        } else if ((recipient === "tl" || recipient === "manager") && lead.assignedToUserId) {
          const u = await UserModel.findById(lead.assignedToUserId).select("reportsTo").lean();
          userId = (u as any)?.reportsTo;
        }
        if (!userId) return { status: "failed", error: "No recipient for notify_user" };
        await NotificationModel.create({
          userId,
          type: NotificationType.GENERAL,
          title: "Workflow",
          message,
          metadata: { leadId: lead._id, leadNumber: lead.leadNumber },
        });
        return { status: "completed" };
      }

      case "update_field": {
        const slug = params.field_slug;
        const value = params.value;
        if (!slug) return { status: "failed", error: "Missing field_slug" };
        const leadDoc = await LeadModel.findById(leadId);
        if (!leadDoc) return { status: "failed", error: "Lead not found" };
        if (leadDoc.schema.paths[slug]) {
          (leadDoc as any).set(slug, value);
        } else if (leadDoc.customData) {
          leadDoc.customData.set(slug, value);
          leadDoc.markModified("customData");
        } else {
          leadDoc.customData = new Map([[slug, value]]);
          leadDoc.markModified("customData");
        }
        await leadDoc.save();
        return { status: "completed" };
      }

      case "escalate": {
        const toRole = params.to_role || "tl";
        const message = params.message ? resolveTemplateVariables(params.message, leadContext) : "Lead escalated";
        let userId: Types.ObjectId | undefined;
        if (lead.assignedToUserId) {
          const u = await UserModel.findById(lead.assignedToUserId).select("reportsTo").lean();
          userId = (u as any)?.reportsTo;
        }
        if (!userId) return { status: "failed", error: "No escalation target" };
        await NotificationModel.create({
          userId,
          type: NotificationType.GENERAL,
          title: "Escalation",
          message,
          metadata: { leadId: lead._id, leadNumber: lead.leadNumber },
        });
        return { status: "completed" };
      }

      case "generate_report": {
        logger.info("Workflow generate_report not fully implemented", { actionId, leadId });
        return { status: "skipped", error: "generate_report not implemented" };
      }

      case "cancel_pending_tasks": {
        const taskType = params.task_type || "all";
        const q: any = { leadId: lead._id, status: "OPEN" };
        if (taskType === "followup") q.type = "followup";
        await TaskModel.updateMany(q, { status: "CANCELLED" });
        return { status: "completed" };
      }

      default:
        return { status: "failed", error: `Unknown action_type: ${action.action_type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Workflow action failed", { actionId, leadId, action_type: action.action_type }, err instanceof Error ? err : new Error(String(err)));
    return { status: "failed", error: msg };
  }
}

/**
 * Register a trigger - called when an event fires. Fetches workflows, evaluates conditions, enqueues actions.
 */
export async function registerTrigger(
  eventName: string,
  payload: Record<string, any>,
  options?: { dryRun?: boolean }
): Promise<void> {
  const triggerEvent = EVENT_MAP[eventName] || eventName;
  const orgId = payload.orgId || payload.org_id;
  const leadId = payload.leadId || payload.lead_id;

  if (!leadId && triggerEvent !== "agent_capacity_warning" && triggerEvent !== "scheduled") {
    logger.debug("WorkflowEngine: no leadId in payload", { eventName, triggerId: payload.leadId });
    return;
  }

  const dryRun = options?.dryRun ?? false;

  const workflowQuery: any = {
    trigger_event: triggerEvent,
    is_active: true,
  };
  if (payload.workflowId) workflowQuery._id = new Types.ObjectId(payload.workflowId);

  const workflows = await WorkflowV2Model.find(workflowQuery).lean();

  for (const wf of workflows) {
    const params = (wf as any).trigger_params_json || {};
    if (!passesTriggerParams(params, payload, triggerEvent)) continue;

    if (wf.run_once_per_lead && leadId) {
      const existing = await WorkflowExecutionLogModel.findOne({
        workflowId: wf._id,
        leadId: new Types.ObjectId(leadId),
        status: "completed",
      });
      if (existing) continue;
    }

    let leadContext: LeadContext = {};
    if (leadId) {
      leadContext = await buildLeadContext(leadId, orgId, payload);
    } else if (triggerEvent === "scheduled") {
      leadContext = { ...payload };
    } else if (triggerEvent === "agent_capacity_warning") {
      continue;
    }

    const conditions = await WorkflowConditionModel.find({
      workflowId: wf._id,
    }).lean();

    const condsList = conditions.map((c) => ({
      field_slug: c.field_slug,
      operator: c.operator,
      value: c.value,
      logical_group: c.logical_group,
    }));

    const conditionsPass = evaluateConditions(condsList, leadContext);
    if (!conditionsPass) {
      const wfOrgId = (wf as any).orgId;
      await WorkflowExecutionLogModel.create({
        workflowId: wf._id,
        leadId: leadId ? new Types.ObjectId(leadId) : wfOrgId,
        orgId: wfOrgId,
        trigger_event: triggerEvent,
        status: "skipped",
        conditions_result: false,
        actions_summary_json: [],
        dry_run: dryRun,
      });
      continue;
    }

    const actions = await WorkflowActionModel.find({ workflowId: wf._id })
      .sort({ order: 1 })
      .lean();

    if (actions.length === 0) {
      const wfOrgId = (wf as any).orgId;
      await WorkflowExecutionLogModel.create({
        workflowId: wf._id,
        leadId: leadId ? new Types.ObjectId(leadId) : wfOrgId,
        orgId: wfOrgId,
        trigger_event: triggerEvent,
        status: "completed",
        conditions_result: true,
        actions_summary_json: [],
        dry_run: dryRun,
      });
      continue;
    }

    const wfOrgId = (wf as any).orgId;
    const execLog = await WorkflowExecutionLogModel.create({
      workflowId: wf._id,
      leadId: leadId ? new Types.ObjectId(leadId) : wfOrgId,
      orgId: wfOrgId,
      trigger_event: triggerEvent,
      status: "started",
      conditions_result: true,
      actions_summary_json: [],
      dry_run: dryRun,
    });

    if (dryRun) {
      execLog.actions_summary_json = actions.map((a) => ({
        action_id: a._id.toString(),
        status: "would_execute",
      }));
      execLog.status = "completed";
      await execLog.save();
      continue;
    }

    const now = new Date();
    const summary: Array<{ action_id: string; status: string; error?: string }> = [];

    for (const action of actions) {
      if (action.delay_minutes > 0) {
        const executeAt = new Date(now.getTime() + action.delay_minutes * 60 * 1000);
        await PendingWorkflowActionModel.create({
          workflowId: wf._id,
          leadId: new Types.ObjectId(leadId),
          orgId: wfOrgId,
          workflowActionId: action._id,
          lead_context_snapshot: { ...leadContext },
          execute_at: executeAt,
          status: "pending",
        });
        summary.push({ action_id: action._id.toString(), status: "scheduled" });
      } else {
        const result = await executeAction(
          action as unknown as IWorkflowAction,
          leadContext,
          (wf as any).orgId?.toString() || orgId || "",
          leadId
        );
        summary.push({
          action_id: action._id.toString(),
          status: result.status,
          error: result.error,
        });
      }
    }

    execLog.actions_summary_json = summary;
    const hasFailed = summary.some((s) => s.status === "failed");
    execLog.status = hasFailed ? "failed" : "completed";
    await execLog.save();
  }
}

/**
 * Process pending workflow actions that are due
 */
export async function processPendingWorkflowActions(): Promise<number> {
  const now = new Date();
  const pending = await PendingWorkflowActionModel.find({
    status: "pending",
    execute_at: { $lte: now },
  })
    .populate("workflowActionId")
    .limit(50)
    .lean();

  let processed = 0;
  for (const p of pending) {
    const action = (p as any).workflowActionId;
    if (!action) continue;

    await PendingWorkflowActionModel.updateOne(
      { _id: p._id },
      { $set: { status: "executing" } }
    );

    const result = await executeAction(
      action as unknown as IWorkflowAction,
      (p as any).lead_context_snapshot || {},
      (p as any).orgId?.toString() || "",
      (p as any).leadId?.toString() || ""
    );

    await PendingWorkflowActionModel.updateOne(
      { _id: p._id },
      {
        $set: {
          status: result.status === "completed" || result.status === "skipped" ? "completed" : "failed",
          error: result.error,
        },
      }
    );
    processed++;
  }
  return processed;
}

/**
 * Subscribe leadEventBus to WorkflowEngine - call on app startup
 */
export function initializeWorkflowEngine(): void {
  const events = [
    "lead.created",
    "lead.stage_moved",
    "lead.rescored",
    "lead.field_changed",
    "lead.unattended",
    "lead.followup_missed",
    "lead.followup_missed_count",
    "agent.capacity_warning",
    "lead.overflow_queued",
    "lead.inactive_warning",
    "lead.inactive_critical",
    "scheduled",
  ];
  for (const eventName of events) {
    leadEventBus.on(eventName, (payload: Record<string, any>) => {
      registerTrigger(eventName, payload || {}).catch((err) => {
        logger.error("WorkflowEngine registerTrigger error", { eventName }, err instanceof Error ? err : new Error(String(err)));
      });
    });
  }
  logger.info("WorkflowEngine event listeners initialized");
}
