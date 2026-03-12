import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { TaskModel } from "../models/task";
import { LeadModel } from "../models/lead";
import { assertLeadAccess } from "../utils/leadAccess";
import { badRequest, forbidden, notFound } from "../utils/httpError";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string(),
  leadId: z.string().optional(),
  dueAt: z.string().datetime(),
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid task payload");
    }

    const task = await TaskModel.create({
      title: parsed.data.title,
      description: parsed.data.description,
      ownerUserId: parsed.data.ownerUserId,
      createdByUserId: req.user?.id,
      leadId: parsed.data.leadId,
      dueAt: new Date(parsed.data.dueAt),
    });

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

    const { ownerUserId, status, fromDue, toDue, leadId } = req.query;
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

    if (fromDue || toDue) {
      filter.dueAt = {};
      if (fromDue)
        (filter.dueAt as any).$gte = new Date(String(fromDue));
      if (toDue)
        (filter.dueAt as any).$lte = new Date(String(toDue));
    }

    const tasks = await TaskModel.find(filter)
      .populate("leadId", "leadNumber status")
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

    if (String(task.ownerUserId) !== req.user?.id) {
      throw forbidden("Only owner can update this task");
    }

    if (parsed.data.title !== undefined) task.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      task.description = parsed.data.description;
    if (parsed.data.status !== undefined)
      task.status = parsed.data.status;

    await task.save();
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

    await TaskModel.findByIdAndDelete(req.params.id);

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

    task.popupState = {
      ...task.popupState,
      dismissedAt: new Date(),
      lastShownAt: new Date(),
    };

    await task.save();
    await task.populate("leadId", "leadNumber status");

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Get tasks that need popup reminders (due and not dismissed recently)
tasksRouter.get("/pending-reminders", async (req, res, next) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const tasks = await TaskModel.find({
      ownerUserId: req.user?.id,
      status: "OPEN",
      dueAt: { $lte: now },
      $or: [
        { "popupState.dismissedAt": { $exists: false } },
        { "popupState.dismissedAt": { $lt: fiveMinutesAgo } },
      ],
    })
      .populate("leadId", "leadNumber status")
      .sort({ dueAt: 1 })
      .limit(10)
      .lean();

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});


