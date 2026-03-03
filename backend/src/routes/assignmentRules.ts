import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { LeadAssignmentRuleModel } from "../models/leadAssignmentRule";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { LeadType } from "../models/common";
import { badRequest, notFound } from "../utils/httpError";

export const assignmentRulesRouter = Router();

// All assignment rule operations require authentication and admin/manage permissions
assignmentRulesRouter.use(requireAuth, requirePermissions(["leads.manage"]));

const createRuleSchema = z.object({
  leadType: z.nativeEnum(LeadType),
  employeeGroupId: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const updateRuleSchema = z.object({
  employeeGroupId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

// List all assignment rules
assignmentRulesRouter.get("/", async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter: Record<string, unknown> = {};

    if (typeof isActive === "string") {
      filter.isActive = isActive === "true";
    }

    const rules = await LeadAssignmentRuleModel.find(filter)
      .sort({ priority: -1, leadType: 1 })
      .lean();

    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// Get a single assignment rule
assignmentRulesRouter.get("/:id", async (req, res, next) => {
  try {
    const rule = await LeadAssignmentRuleModel.findById(req.params.id)
      .lean();

    if (!rule) {
      throw notFound("Assignment rule not found");
    }

    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// Get rule by lead type
assignmentRulesRouter.get("/by-lead-type/:leadType", async (req, res, next) => {
  try {
    const { leadType } = req.params;

    if (!Object.values(LeadType).includes(leadType as LeadType)) {
      throw badRequest("Invalid lead type");
    }

    const rule = await LeadAssignmentRuleModel.findOne({
      leadType: leadType as LeadType,
    })
      .lean();

    if (!rule) {
      return res.json(null);
    }

    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// Create a new assignment rule
assignmentRulesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid assignment rule payload");
    }

    const { leadType, employeeGroupId, isActive, priority } = parsed.data;

    // Check if rule already exists for this lead type
    const existing = await LeadAssignmentRuleModel.findOne({ leadType });
    if (existing) {
      throw badRequest(
        `Assignment rule already exists for lead type: ${leadType}`
      );
    }

    // Verify employee group exists
    const group = await EmployeeGroupModel.findById(employeeGroupId);
    if (!group) {
      throw badRequest("Employee group not found");
    }

    const rule = await LeadAssignmentRuleModel.create({
      leadType,
      employeeGroupId,
      isActive: isActive ?? true,
      priority: priority ?? 0,
    });

    const populatedRule = await LeadAssignmentRuleModel.findById(rule._id)
      .lean();

    res.status(201).json(populatedRule);
  } catch (err) {
    next(err);
  }
});

// Update an assignment rule
assignmentRulesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid assignment rule update payload");
    }

    const updates = parsed.data;

    // If employeeGroupId is being updated, verify it exists
    if (updates.employeeGroupId) {
      const group = await EmployeeGroupModel.findById(updates.employeeGroupId);
      if (!group) {
        throw badRequest("Employee group not found");
      }
    }

    const rule = await LeadAssignmentRuleModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    )
      .lean();

    if (!rule) {
      throw notFound("Assignment rule not found");
    }

    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// Delete an assignment rule
assignmentRulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const rule = await LeadAssignmentRuleModel.findByIdAndDelete(req.params.id);

    if (!rule) {
      throw notFound("Assignment rule not found");
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

