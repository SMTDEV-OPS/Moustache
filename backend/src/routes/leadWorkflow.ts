import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { LeadWorkflowStateModel } from "../models/leadWorkflowState";
import { WorkflowModel } from "../models/workflow";
import { LeadModel } from "../models/lead";
import { badRequest, notFound } from "../utils/httpError";

export const leadWorkflowRouter = Router();

leadWorkflowRouter.use(requireAuth);

// GET /leads/:leadId/workflow - Get lead's workflow state
leadWorkflowRouter.get("/:leadId/workflow", async (req, res, next) => {
  try {
    const { leadId } = req.params;

    if (!Types.ObjectId.isValid(leadId)) {
      throw badRequest("Invalid lead ID");
    }

    const lead = await LeadModel.findById(leadId).lean();
    if (!lead) {
      throw notFound("Lead not found");
    }

    const workflowState = await LeadWorkflowStateModel.findOne({ leadId })
      .populate("workflowId")
      .lean();

    if (!workflowState) {
      res.json({ message: "No workflow assigned to this lead", workflowState: null });
      return;
    }

    res.json(workflowState);
  } catch (err) {
    next(err);
  }
});

// POST /leads/:leadId/workflow/record-outcome - Record outcome for a step
const recordOutcomeSchema = z.object({
  stepNumber: z.number().int().positive(),
  outcome: z.string().min(1, "Outcome is required"),
  outcomeNote: z.string().optional(),
});

leadWorkflowRouter.post("/:leadId/workflow/record-outcome", async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const userId = (req as any).user?.id;

    if (!Types.ObjectId.isValid(leadId)) {
      throw badRequest("Invalid lead ID");
    }

    const parsed = recordOutcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const { stepNumber, outcome, outcomeNote } = parsed.data;

    const workflowState = await LeadWorkflowStateModel.findOne({ leadId });
    if (!workflowState) {
      throw notFound("No workflow assigned to this lead");
    }

    // Find the step execution
    const stepExecution = workflowState.stepExecutions.find(
      (se) => se.stepNumber === stepNumber
    );
    if (!stepExecution) {
      throw notFound(`Step ${stepNumber} not found in workflow`);
    }

    // Validate outcome against workflow's possible outcomes
    const workflow = await WorkflowModel.findById(workflowState.workflowId).lean();
    if (workflow) {
      const step = workflow.steps.find((s) => s.stepNumber === stepNumber);
      if (step && step.possibleOutcomes.length > 0) {
        if (!step.possibleOutcomes.includes(outcome)) {
          throw badRequest(
            `Invalid outcome. Allowed outcomes: ${step.possibleOutcomes.join(", ")}`
          );
        }
      }
    }

    // Update the step execution
    stepExecution.outcome = outcome;
    stepExecution.outcomeNote = outcomeNote;
    stepExecution.outcomeRecordedAt = new Date();
    stepExecution.outcomeRecordedByUserId = userId
      ? new Types.ObjectId(userId)
      : undefined;

    // Move to next step if current step is completed
    if (stepExecution.status === "EXECUTED") {
      const nextStepNumber = stepNumber + 1;
      const hasNextStep = workflowState.stepExecutions.some(
        (se) => se.stepNumber === nextStepNumber
      );
      if (hasNextStep) {
        workflowState.currentStepNumber = nextStepNumber;
      } else {
        workflowState.isCompleted = true;
      }
    }

    await workflowState.save();

    res.json(workflowState);
  } catch (err) {
    next(err);
  }
});

// POST /leads/:leadId/workflow/skip-step - Skip current step
const skipStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  reason: z.string().optional(),
});

leadWorkflowRouter.post("/:leadId/workflow/skip-step", async (req, res, next) => {
  try {
    const { leadId } = req.params;

    if (!Types.ObjectId.isValid(leadId)) {
      throw badRequest("Invalid lead ID");
    }

    const parsed = skipStepSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const { stepNumber, reason } = parsed.data;

    const workflowState = await LeadWorkflowStateModel.findOne({ leadId });
    if (!workflowState) {
      throw notFound("No workflow assigned to this lead");
    }

    // Find the step execution
    const stepExecution = workflowState.stepExecutions.find(
      (se) => se.stepNumber === stepNumber
    );
    if (!stepExecution) {
      throw notFound(`Step ${stepNumber} not found in workflow`);
    }

    if (stepExecution.status !== "PENDING") {
      throw badRequest("Can only skip pending steps");
    }

    // Mark as skipped
    stepExecution.status = "SKIPPED";
    stepExecution.outcomeNote = reason || "Skipped by user";

    // Move to next step
    const nextStepNumber = stepNumber + 1;
    const hasNextStep = workflowState.stepExecutions.some(
      (se) => se.stepNumber === nextStepNumber
    );
    if (hasNextStep) {
      workflowState.currentStepNumber = nextStepNumber;
    } else {
      workflowState.isCompleted = true;
    }

    await workflowState.save();

    res.json(workflowState);
  } catch (err) {
    next(err);
  }
});

// POST /leads/:leadId/workflow/pause - Pause workflow
leadWorkflowRouter.post("/:leadId/workflow/pause", async (req, res, next) => {
  try {
    const { leadId } = req.params;

    if (!Types.ObjectId.isValid(leadId)) {
      throw badRequest("Invalid lead ID");
    }

    const workflowState = await LeadWorkflowStateModel.findOne({ leadId });
    if (!workflowState) {
      throw notFound("No workflow assigned to this lead");
    }

    if (workflowState.isPaused) {
      throw badRequest("Workflow is already paused");
    }

    if (workflowState.isCompleted) {
      throw badRequest("Cannot pause a completed workflow");
    }

    workflowState.isPaused = true;
    await workflowState.save();

    res.json(workflowState);
  } catch (err) {
    next(err);
  }
});

// POST /leads/:leadId/workflow/resume - Resume workflow
leadWorkflowRouter.post("/:leadId/workflow/resume", async (req, res, next) => {
  try {
    const { leadId } = req.params;

    if (!Types.ObjectId.isValid(leadId)) {
      throw badRequest("Invalid lead ID");
    }

    const workflowState = await LeadWorkflowStateModel.findOne({ leadId });
    if (!workflowState) {
      throw notFound("No workflow assigned to this lead");
    }

    if (!workflowState.isPaused) {
      throw badRequest("Workflow is not paused");
    }

    if (workflowState.isCompleted) {
      throw badRequest("Cannot resume a completed workflow");
    }

    workflowState.isPaused = false;
    await workflowState.save();

    res.json(workflowState);
  } catch (err) {
    next(err);
  }
});

