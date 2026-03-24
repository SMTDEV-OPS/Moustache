import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { TaskModel } from "../models/task";
import { LeadModel } from "../models/lead";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { assertLeadAccess } from "../utils/leadAccess";
import { badRequest, forbidden, notFound } from "../utils/httpError";
import { leadEventBus } from "../services/leadService";
import { logAudit } from "../utils/auditLog";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string(),
  leadId: z.string().optional(),
  accountId: z.string().optional(),
  dueAt: z.string().datetime(),
  type: z
    .enum(["general", "followup", "call", "email", "whatsapp", "meeting"])
    .optional(),
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid task payload");
    }

    let orgId: string | undefined;
    if (parsed.data.leadId) {
      const lead = await LeadModel.findById(parsed.data.leadId)
        .select("orgId")
        .lean();
      orgId = (lead as { orgId?: { toString(): string } })?.orgId?.toString();
    }

    const task = await TaskModel.create({
      title: parsed.data.title,
      description: parsed.data.description,
      ownerUserId: parsed.data.ownerUserId === "me" ? req.user?.id : parsed.data.ownerUserId,
      createdByUserId: req.user?.id,
      leadId: parsed.data.leadId,
      accountId: parsed.data.accountId,
      orgId,
      dueAt: new Date(parsed.data.dueAt),
      type: parsed.data.type ?? "general",
    });

    if (task.leadId) {
      await LeadActivityModel.create({
        leadId: task.leadId,
        type: LeadActivityType.FOLLOW_UP,
        note: `Follow-up task created: ${task.title}`,
        dueAt: task.dueAt,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
        metadata: { taskId: task._id, taskType: task.type },
      });
    }

    logAudit(
      "created",
      "task",
      task._id.toString(),
      null,
      {
        title: task.title,
        type: task.type,
        leadId: task.leadId ? String(task.leadId) : undefined,
        dueAt: task.dueAt,
      },
      req,
      { orgId }
    );

    await task.populate("leadId", "leadNumber status");
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

tasksRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const { ownerUserId, status, fromDue, toDue, from, to, leadId, accountId } = req.query;
    const filter: Record<string, unknown> = {};

    const currentUserId = req.user.id;

    // When leadId is provided, fetch tasks for that lead (user must have lead access)
    if (leadId && typeof leadId === "string") {
      const lead = await LeadModel.findById(leadId).lean();
      if (!lead) {
        throw notFound("Lead not found");
      }
      await assertLeadAccess(req.user as any, lead);
      filter.leadId = leadId;
      // When filtering by lead, do not restrict by ownerUserId so all tasks for the lead are visible
    } else {
      // Enforce user privacy: users can only query their own tasks
      if (ownerUserId) {
        if (String(ownerUserId) !== String(currentUserId)) {
          throw forbidden("You can only access your own tasks");
        }
        filter.ownerUserId = ownerUserId;
      } else {
        filter.ownerUserId = currentUserId;
      }
    }

    if (status) filter.status = status;
    if (accountId && typeof accountId === "string") filter.accountId = accountId;

    if (fromDue || toDue || from || to) {
      filter.dueAt = {};
      const fromValue = from ?? fromDue;
      const toValue = to ?? toDue;
      if (fromValue) (filter.dueAt as any).$gte = new Date(String(fromValue));
      if (toValue) (filter.dueAt as any).$lte = new Date(String(toValue));
    }

    const tasks = await TaskModel.find(filter)
      .populate("leadId", "leadNumber status")
      .populate("accountId", "name")
      .sort({ dueAt: 1 })
      .lean();
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

const updateTaskSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
  outcome: z.string().optional(),
});

tasksRouter.get("/summary", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const ownerUserId = req.user.id;
    const [overdue, dueToday, upcoming, completedToday] = await Promise.all([
      TaskModel.countDocuments({
        ownerUserId,
        status: "OPEN",
        dueAt: { $lt: startOfDay },
      }),
      TaskModel.countDocuments({
        ownerUserId,
        status: "OPEN",
        dueAt: { $gte: startOfDay, $lte: endOfDay },
      }),
      TaskModel.countDocuments({
        ownerUserId,
        status: "OPEN",
        dueAt: { $gt: endOfDay, $lte: in7Days },
      }),
      TaskModel.countDocuments({
        ownerUserId,
        status: "COMPLETED",
        completedAt: { $gte: startOfDay },
      }),
    ]);

    res.json({ overdue, dueToday, upcoming, completedToday });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid task update payload");
    }

    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      throw notFound("Task not found");
    }

    const isOwner = String(task.ownerUserId) === req.user?.id;
    const isCreator = task.createdByUserId
      ? String(task.createdByUserId) === req.user?.id
      : false;
    const isAdmin = !!req.user?.isAdmin;

    if (
      parsed.data.status === "CANCELLED" &&
      !(isOwner || isCreator || isAdmin)
    ) {
      throw forbidden("Only owner, creator, or admin can cancel this task");
    }

    if (parsed.data.status !== "CANCELLED" && !isOwner) {
      throw forbidden("Only owner can update this task");
    }

    const before = task.toObject() as unknown as Record<string, unknown>;

    if (parsed.data.title !== undefined) task.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      task.description = parsed.data.description;
    if (parsed.data.status !== undefined)
      task.status = parsed.data.status;
    if (parsed.data.outcome !== undefined) {
      task.outcome = parsed.data.outcome;
    }

    if (parsed.data.status === "COMPLETED") {
      if (task.type === "followup" && !parsed.data.outcome?.trim()) {
        return res.status(400).json({
          error: "Outcome is required when completing a follow-up task",
        });
      }
      task.completedAt = new Date();
      task.completedByUserId = req.user?.id || null;

      if (task.leadId) {
        await LeadActivityModel.create({
          leadId: task.leadId,
          type: LeadActivityType.NOTE,
          performedByUserId: req.user?.id,
          note: `Follow-up completed: ${task.title}${parsed.data.outcome ? ` | Outcome: ${parsed.data.outcome}` : ""}`,
          metadata: {
            taskId: task._id,
            taskType: task.type,
            outcome: parsed.data.outcome ?? null,
          },
        });

        leadEventBus.emit("task.completed", {
          leadId: String(task.leadId),
          taskId: String(task._id),
          orgId: task.orgId ? String(task.orgId) : undefined,
        });
      }
    }

    if (parsed.data.status === "OPEN") {
      task.completedAt = null;
      task.completedByUserId = null;
    }

    await task.save();
    logAudit(
      "updated",
      "task",
      task._id.toString(),
      before,
      task.toObject() as unknown as Record<string, unknown>,
      req,
      { orgId: task.orgId ? String(task.orgId) : undefined }
    );

    if (parsed.data.status === "CANCELLED" && task.leadId) {
      await LeadActivityModel.create({
        leadId: task.leadId,
        type: LeadActivityType.NOTE,
        note: `Follow-up cancelled: ${task.title}`,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
        metadata: { taskId: task._id, taskType: task.type },
      });
    }

    await task.populate("leadId", "leadNumber status");

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Delete a task - only owner can delete
tasksRouter.delete("/:id", async (req, res, next) => {
  try {
    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      throw notFound("Task not found");
    }

    // Only owner can delete their tasks
    if (String(task.ownerUserId) !== req.user?.id) {
      throw forbidden("Only the owner can delete this task");
    }

    const before = task.toObject() as unknown as Record<string, unknown>;
    await TaskModel.findByIdAndDelete(req.params.id);

    if (task.leadId) {
      await LeadActivityModel.create({
        leadId: task.leadId,
        type: LeadActivityType.NOTE,
        note: `Follow-up deleted: ${task.title}`,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
        metadata: { taskId: task._id, taskType: task.type },
      });
    }

    logAudit(
      "deleted",
      "task",
      task._id.toString(),
      before,
      null,
      req,
      { orgId: task.orgId ? String(task.orgId) : undefined }
    );

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Dismiss task popup (snooze)
tasksRouter.post("/:id/dismiss", async (req, res, next) => {
  try {
    const task = await TaskModel.findById(req.params.id);
    if (!task) {
      throw notFound("Task not found");
    }

    // Only owner can dismiss their tasks
    if (String(task.ownerUserId) !== req.user?.id) {
      throw forbidden("Only the owner can dismiss this task");
    }

    const before = task.toObject() as unknown as Record<string, unknown>;
    task.popupState = {
      ...task.popupState,
      dismissedAt: new Date(),
      lastShownAt: new Date(),
    };

    await task.save();
    if (task.leadId) {
      await LeadActivityModel.create({
        leadId: task.leadId,
        type: LeadActivityType.NOTE,
        note: `Follow-up reminder snoozed: ${task.title}`,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
        metadata: { taskId: task._id, taskType: task.type },
      });
    }
    logAudit(
      "updated",
      "task",
      task._id.toString(),
      before,
      task.toObject() as unknown as Record<string, unknown>,
      req,
      { orgId: task.orgId ? String(task.orgId) : undefined }
    );
    await task.populate("leadId", "leadNumber status");

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Get tasks that need popup reminders (due in next 30 minutes, not dismissed in last 24 hours)
tasksRouter.get("/pending-reminders", async (req, res, next) => {
  try {
    const now = new Date();
    const inThirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tasks = await TaskModel.find({
      ownerUserId: req.user?.id,
      status: "OPEN",
      dueAt: { $gte: now, $lte: inThirtyMinutes },
      $or: [
        { "popupState.dismissedAt": { $exists: false } },
        { "popupState.dismissedAt": null },
        { "popupState.dismissedAt": { $lt: twentyFourHoursAgo } },
      ],
    })
      .populate("leadId", "leadNumber status")
      .populate("accountId", "name")
      .sort({ dueAt: 1 })
      .limit(10)
      .lean();

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});


