import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { WorkflowModel } from "../models/workflow";
import { badRequest, notFound } from "../utils/httpError";

export const workflowsRouter = Router();

workflowsRouter.use(requireAuth);

const emailTemplateConfigSchema = z.object({
  templateId: z.string().optional(),
  inlineSubject: z.string().optional(),
  inlineBody: z.string().optional(),
});

const whatsappTemplateConfigSchema = z.object({
  templateId: z.string().optional(),
  inlineMessage: z.string().optional(),
});

const stepTemplatesSchema = z.object({
  email: emailTemplateConfigSchema.optional(),
  whatsapp: whatsappTemplateConfigSchema.optional(),
});

const stepSchema = z.object({
  stepNumber: z.number().int().positive(),
  name: z.string().min(1, "Step name is required"),
  offsetDays: z.number().int().min(0).default(0),
  offsetHours: z.number().int().min(0).optional(),
  mediums: z
    .array(z.enum(["CALL", "EMAIL", "WHATSAPP"]))
    .min(1, "At least one medium must be selected"),
  executionMode: z.enum(["AUTO", "MANUAL", "BOTH"]).default("MANUAL"),
  templates: stepTemplatesSchema.optional(),
  possibleOutcomes: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const workflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  appliesTo: z
    .object({
      leadType: z.string().optional(),
      source: z.string().optional(),
      propertyId: z.string().optional(),
    })
    .optional(),
  steps: z.array(stepSchema).default([]),
  isActive: z.boolean().optional(),
});

// GET /workflows - List all workflows
workflowsRouter.get("/", async (_req, res, next) => {
  try {
    const list = await WorkflowModel.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /workflows/:id - Get single workflow
workflowsRouter.get("/:id", async (req, res, next) => {
  try {
    const workflow = await WorkflowModel.findById(req.params.id).lean();
    if (!workflow) {
      throw notFound("Workflow not found");
    }
    res.json(workflow);
  } catch (err) {
    next(err);
  }
});

// POST /workflows - Create workflow
workflowsRouter.post(
  "/",
  requirePermissions(["workflows.manage"]),
  async (req, res, next) => {
    try {
      const parsed = workflowSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.errors[0]?.message || "Invalid workflow payload");
      }
      const wf = await WorkflowModel.create(parsed.data);
      res.status(201).json(wf);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /workflows/:id - Update workflow
workflowsRouter.patch(
  "/:id",
  requirePermissions(["workflows.manage"]),
  async (req, res, next) => {
    try {
      const parsed = workflowSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.errors[0]?.message || "Invalid workflow update payload");
      }
      const wf = await WorkflowModel.findByIdAndUpdate(
        req.params.id,
        { $set: parsed.data },
        { new: true }
      ).lean();
      if (!wf) {
        throw notFound("Workflow not found");
      }
      res.json(wf);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /workflows/:id - Delete workflow
workflowsRouter.delete(
  "/:id",
  requirePermissions(["workflows.manage"]),
  async (req, res, next) => {
    try {
      const wf = await WorkflowModel.findByIdAndDelete(req.params.id).lean();
      if (!wf) {
        throw notFound("Workflow not found");
      }
      res.json({ message: "Workflow deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);
