import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { TemplateModel } from "../models/template";
import { badRequest, notFound } from "../utils/httpError";

export const templatesRouter = Router();

templatesRouter.use(requireAuth);

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  medium: z.enum(["EMAIL", "WHATSAPP"]),
  subject: z.string().optional(), // Only for EMAIL
  body: z.string().min(1, "Template body is required"),
  isActive: z.boolean().optional(),
});

// GET /templates - List all templates
templatesRouter.get("/", async (req, res, next) => {
  try {
    const { medium, isActive } = req.query;
    const filter: Record<string, unknown> = {};

    if (medium) {
      filter.medium = medium;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const templates = await TemplateModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// GET /templates/:id - Get single template
templatesRouter.get("/:id", async (req, res, next) => {
  try {
    const template = await TemplateModel.findById(req.params.id).lean();
    if (!template) {
      throw notFound("Template not found");
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
});

// POST /templates - Create template
templatesRouter.post(
  "/",
  requirePermissions(["templates.manage"]),
  async (req, res, next) => {
    try {
      const parsed = templateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.errors[0]?.message || "Invalid template payload");
      }

      const template = await TemplateModel.create(parsed.data);
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /templates/:id - Update template
templatesRouter.patch(
  "/:id",
  requirePermissions(["templates.manage"]),
  async (req, res, next) => {
    try {
      const parsed = templateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest(parsed.error.errors[0]?.message || "Invalid template update payload");
      }

      const template = await TemplateModel.findByIdAndUpdate(
        req.params.id,
        { $set: parsed.data },
        { new: true }
      ).lean();

      if (!template) {
        throw notFound("Template not found");
      }
      res.json(template);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /templates/:id - Delete template
templatesRouter.delete(
  "/:id",
  requirePermissions(["templates.manage"]),
  async (req, res, next) => {
    try {
      const template = await TemplateModel.findByIdAndDelete(req.params.id).lean();
      if (!template) {
        throw notFound("Template not found");
      }
      res.json({ message: "Template deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

