import { Types } from "mongoose";
import { logger } from "../config/logger";
import { LeadModel, ILead } from "../models/lead";
import { WorkflowModel, IWorkflowStep } from "../models/workflow";
import {
  LeadWorkflowStateModel,
  IStepExecution,
  IStepExecutionDetail,
} from "../models/leadWorkflowState";
import { TemplateModel } from "../models/template";
import { TaskModel } from "../models/task";
import { CommunicationModel } from "../models/communication";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import {
  NotificationModel,
  NotificationType,
} from "../models/notification";
import { GuestModel } from "../models/guest";
import { PropertyModel } from "../models/property";
import { getPrimaryEmailAccount, sendEmail } from "./emailService";
import { IEmailAddress } from "../models/emailMessage";

// Lean workflow type for queries
interface LeanWorkflow {
  _id: Types.ObjectId;
  name: string;
  appliesTo?: {
    leadType?: string;
    source?: string;
    propertyId?: string;
  };
  steps: IWorkflowStep[];
  isActive: boolean;
}

/**
 * Find a matching workflow for a lead based on appliesTo conditions
 */
export async function findMatchingWorkflow(lead: ILead): Promise<LeanWorkflow | null> {
  // Find all active workflows
  const workflows = await WorkflowModel.find({ isActive: true }).lean() as LeanWorkflow[];

  for (const workflow of workflows) {
    const conditions = workflow.appliesTo;

    // If no conditions, workflow applies to all leads
    if (!conditions || Object.keys(conditions).length === 0) {
      return workflow;
    }

    let matches = true;

    // Check leadType condition
    if (conditions.leadType && conditions.leadType !== lead.leadType) {
      matches = false;
    }

    // Check source condition
    if (conditions.source && conditions.source !== lead.source) {
      matches = false;
    }

    // Check propertyId condition
    if (
      conditions.propertyId &&
      lead.propertyId?.toString() !== conditions.propertyId
    ) {
      matches = false;
    }

    if (matches) {
      return workflow;
    }
  }

  return null;
}

/**
 * Calculate scheduled time for a workflow step
 */
function calculateScheduledTime(
  baseDate: Date,
  offsetDays: number,
  offsetHours: number = 0
): Date {
  const scheduledAt = new Date(baseDate);
  scheduledAt.setDate(scheduledAt.getDate() + offsetDays);
  scheduledAt.setHours(scheduledAt.getHours() + offsetHours);
  return scheduledAt;
}

/**
 * Initialize workflow for a lead after assignment
 */
export async function initializeWorkflowForLead(
  leadId: Types.ObjectId | string
): Promise<boolean> {
  try {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      logger.warn(`Cannot initialize workflow: Lead ${leadId} not found`);
      return false;
    }

    // Check if workflow already exists for this lead
    const existingState = await LeadWorkflowStateModel.findOne({ leadId });
    if (existingState) {
      logger.info(`Workflow already exists for lead ${leadId}`);
      return false;
    }

    // Find matching workflow
    const workflow = await findMatchingWorkflow(lead);
    if (!workflow) {
      logger.info(`No matching workflow found for lead ${leadId}`);
      return false;
    }

    // Get active steps sorted by step number
    const activeSteps = workflow.steps
      .filter((step) => step.isActive)
      .sort((a, b) => a.stepNumber - b.stepNumber);

    if (activeSteps.length === 0) {
      logger.info(`Workflow ${workflow.name} has no active steps`);
      return false;
    }

    // Create step executions for each active step
    const baseDate = lead.createdAt || new Date();
    const stepExecutions: IStepExecution[] = activeSteps.map((step) => ({
      stepNumber: step.stepNumber,
      scheduledAt: calculateScheduledTime(
        baseDate,
        step.offsetDays,
        step.offsetHours
      ),
      status: "PENDING" as const,
      executionDetails: [],
    }));

    // Create workflow state
    await LeadWorkflowStateModel.create({
      leadId: lead._id,
      workflowId: workflow._id,
      currentStepNumber: activeSteps[0].stepNumber,
      stepExecutions,
      isCompleted: false,
      isPaused: false,
    });

    logger.info(
      `Initialized workflow "${workflow.name}" for lead ${leadId} with ${activeSteps.length} steps`
    );
    return true;
  } catch (error) {
    logger.error("Error initializing workflow for lead", {
      leadId: leadId.toString(),
    }, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Replace template placeholders with actual values
 */
async function renderTemplate(
  template: string,
  lead: ILead
): Promise<string> {
  let rendered = template;

  // Get guest details if available
  let guestName = "Guest";
  if (lead.guestId) {
    const guest = await GuestModel.findById(lead.guestId).lean();
    if (guest) {
      guestName = guest.name || "Guest";
    }
  }

  // Get property details if available
  let propertyName = "Property";
  if (lead.propertyId) {
    const property = await PropertyModel.findById(lead.propertyId).lean();
    if (property) {
      propertyName = property.name || "Property";
    }
  }

  // Replace placeholders
  rendered = rendered.replace(/\{\{guestName\}\}/g, guestName);
  rendered = rendered.replace(/\{\{propertyName\}\}/g, propertyName);
  // Get primary itinerary if it exists
  const { LeadItineraryModel } = await import("../models/leadItinerary");
  const itineraries = await LeadItineraryModel.find({ leadId: lead._id }).sort({ checkInDate: 1 }).lean();
  const primaryItin = itineraries[0];

  rendered = rendered.replace(
    /\{\{checkInDate\}\}/g,
    primaryItin?.checkInDate ? new Date(primaryItin.checkInDate).toLocaleDateString() : "TBD"
  );
  rendered = rendered.replace(
    /\{\{checkOutDate\}\}/g,
    primaryItin?.checkOutDate ? new Date(primaryItin.checkOutDate).toLocaleDateString() : "TBD"
  );
  rendered = rendered.replace(/\{\{leadNumber\}\}/g, lead.leadNumber);

  return rendered;
}

/**
 * Create a reminder task for the assigned user
 */
async function createReminderTask(
  lead: ILead,
  step: IWorkflowStep,
  medium: string
): Promise<Types.ObjectId | null> {
  if (!lead.assignedToUserId) {
    logger.warn(`Cannot create task: Lead ${lead._id} has no assigned user`);
    return null;
  }

  const task = await TaskModel.create({
    title: `Follow-up: ${step.name} - ${medium}`,
    description: `Workflow step ${step.stepNumber}: ${step.name}. Medium: ${medium}. Please contact the guest.`,
    ownerUserId: lead.assignedToUserId,
    leadId: lead._id,
    dueAt: new Date(),
    status: "OPEN",
  });

  // Send notification to the assigned user
  await NotificationModel.create({
    userId: lead.assignedToUserId,
    type: NotificationType.WORKFLOW_REMINDER,
    title: `Follow-up Reminder: ${step.name}`,
    message: `You have a scheduled ${medium} follow-up for lead ${lead.leadNumber}.`,
    metadata: {
      leadId: lead._id,
      leadNumber: lead.leadNumber,
      stepNumber: step.stepNumber,
      medium,
    },
  });

  return task._id as Types.ObjectId;
}

/**
 * Send automated message (EMAIL/WHATSAPP)
 */
async function sendAutomatedMessage(
  lead: ILead,
  step: IWorkflowStep,
  medium: "EMAIL" | "WHATSAPP"
): Promise<Types.ObjectId | null> {
  try {
    let subject: string | undefined;
    let body: string;

    const templateConfig = step.templates?.[medium.toLowerCase() as "email" | "whatsapp"];

    if (!templateConfig) {
      logger.warn(`No template configured for ${medium} in step ${step.stepNumber}`);
      return null;
    }

    // Get template content
    if (templateConfig.templateId) {
      const template = await TemplateModel.findById(templateConfig.templateId).lean();
      if (!template) {
        logger.warn(`Template ${templateConfig.templateId} not found`);
        return null;
      }
      subject = template.subject;
      body = template.body;
    } else if (medium === "EMAIL" && "inlineBody" in templateConfig) {
      subject = templateConfig.inlineSubject;
      body = templateConfig.inlineBody || "";
    } else if (medium === "WHATSAPP" && "inlineMessage" in templateConfig) {
      body = templateConfig.inlineMessage || "";
    } else {
      logger.warn(`No template content found for ${medium} in step ${step.stepNumber}`);
      return null;
    }

    // Render template with lead data
    body = await renderTemplate(body, lead);
    if (subject) {
      subject = await renderTemplate(subject, lead);
    }

    let communicationId: Types.ObjectId | null = null;

    // For EMAIL, try to send through user's connected email account
    if (medium === "EMAIL" && lead.assignedToUserId) {
      try {
        const emailAccount = await getPrimaryEmailAccount(lead.assignedToUserId.toString());
        if (emailAccount) {
          // Get guest email
          const guest = lead.guestId ? await GuestModel.findById(lead.guestId).lean() : null;
          const guestEmail = guest?.email;

          if (guestEmail) {
            const toAddresses: IEmailAddress[] = [{ email: guestEmail, name: guest?.name }];

            const emailMessage = await sendEmail(emailAccount._id.toString(), {
              to: toAddresses,
              subject: subject || "Follow-up",
              bodyText: body.replace(/<[^>]*>/g, ""), // Strip HTML for text version
              bodyHtml: body,
            });

            communicationId = emailMessage._id as Types.ObjectId;

            logger.info(
              `Sent automated EMAIL via user account for lead ${lead._id}, step ${step.stepNumber}`
            );
          }
        }
      } catch (error) {
        logger.warn(`Failed to send email via user account, falling back to log only:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If email wasn't sent via user account, or for WhatsApp, log as communication
    if (!communicationId) {
      const communication = await CommunicationModel.create({
        leadId: lead._id,
        guestId: lead.guestId,
        channel: medium === "EMAIL" ? CommunicationChannel.EMAIL : CommunicationChannel.WHATSAPP,
        direction: CommunicationDirection.OUTBOUND,
        summary: subject ? `${subject}: ${body.substring(0, 100)}...` : body.substring(0, 150),
        rawPayload: { subject, body, autoSent: true, stepNumber: step.stepNumber },
        performedByUserId: null, // System automated
      });
      communicationId = communication._id as Types.ObjectId;
    }

    // Notify assigned user that auto message was sent
    if (lead.assignedToUserId) {
      await NotificationModel.create({
        userId: lead.assignedToUserId,
        type: NotificationType.WORKFLOW_AUTO_SENT,
        title: `Auto ${medium} Sent`,
        message: `An automated ${medium} was sent for lead ${lead.leadNumber} (Step: ${step.name}).`,
        metadata: {
          leadId: lead._id,
          leadNumber: lead.leadNumber,
          stepNumber: step.stepNumber,
          medium,
        },
      });
    }

    logger.info(
      `Sent automated ${medium} for lead ${lead._id}, step ${step.stepNumber}`
    );

    return communicationId;
  } catch (error) {
    logger.error("Error sending automated communication", {
      leadId: lead._id.toString(),
      stepNumber: step.stepNumber,
      medium,
    }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Execute a workflow step for a lead
 */
export async function executeWorkflowStep(
  leadId: Types.ObjectId | string,
  stepNumber: number
): Promise<boolean> {
  try {
    const workflowState = await LeadWorkflowStateModel.findOne({ leadId });
    if (!workflowState) {
      logger.warn(`No workflow state found for lead ${leadId}`);
      return false;
    }

    const workflow = await WorkflowModel.findById(workflowState.workflowId).lean() as LeanWorkflow | null;
    if (!workflow) {
      logger.warn(`Workflow ${workflowState.workflowId} not found`);
      return false;
    }

    const step = workflow.steps.find((s) => s.stepNumber === stepNumber);
    if (!step || !step.isActive) {
      logger.warn(`Step ${stepNumber} not found or inactive in workflow`);
      return false;
    }

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      logger.warn(`Lead ${leadId} not found`);
      return false;
    }

    const stepExecution = workflowState.stepExecutions.find(
      (se) => se.stepNumber === stepNumber
    );
    if (!stepExecution) {
      logger.warn(`Step execution ${stepNumber} not found`);
      return false;
    }

    if (stepExecution.status !== "PENDING") {
      logger.info(`Step ${stepNumber} already processed`);
      return false;
    }

    const executionDetails: IStepExecutionDetail[] = [];

    // Process each medium in the step
    for (const medium of step.mediums) {
      if (medium === "CALL") {
        // CALL is always manual - create reminder task
        const taskId = await createReminderTask(lead, step, "CALL");
        executionDetails.push({
          medium: "CALL",
          mode: "MANUAL",
          taskId: taskId || undefined,
        });
      } else if (medium === "EMAIL" || medium === "WHATSAPP") {
        if (step.executionMode === "AUTO") {
          // Send automated message
          const commId = await sendAutomatedMessage(lead, step, medium);
          executionDetails.push({
            medium,
            mode: "AUTO",
            communicationId: commId || undefined,
          });
        } else if (step.executionMode === "MANUAL") {
          // Create reminder task for manual follow-up
          const taskId = await createReminderTask(lead, step, medium);
          executionDetails.push({
            medium,
            mode: "MANUAL",
            taskId: taskId || undefined,
          });
        } else if (step.executionMode === "BOTH") {
          // Send automated message AND create reminder
          const commId = await sendAutomatedMessage(lead, step, medium);
          const taskId = await createReminderTask(lead, step, medium);
          executionDetails.push({
            medium,
            mode: "AUTO",
            communicationId: commId || undefined,
            taskId: taskId || undefined,
          });
        }
      }
    }

    // Update step execution
    stepExecution.status = "EXECUTED";
    stepExecution.executedAt = new Date();
    stepExecution.executionDetails = executionDetails;

    await workflowState.save();

    logger.info("Executed workflow step", {
      leadId: leadId.toString(),
      stepNumber,
    });
    return true;
  } catch (error) {
    logger.error("Error executing workflow step", {
      leadId: leadId.toString(),
      stepNumber,
    }, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Process all pending workflow steps that are due
 */
export async function processPendingWorkflowSteps(): Promise<number> {
  const now = new Date();
  let processedCount = 0;

  try {
    // Find all workflow states with pending steps that are due
    const pendingStates = await LeadWorkflowStateModel.find({
      isCompleted: false,
      isPaused: false,
      stepExecutions: {
        $elemMatch: {
          status: "PENDING",
          scheduledAt: { $lte: now },
        },
      },
    });

    for (const state of pendingStates) {
      // Find the first pending step that is due
      const pendingStep = state.stepExecutions
        .filter((se) => se.status === "PENDING" && se.scheduledAt <= now)
        .sort((a, b) => a.stepNumber - b.stepNumber)[0];

      if (pendingStep) {
        const success = await executeWorkflowStep(
          state.leadId,
          pendingStep.stepNumber
        );
        if (success) {
          processedCount++;
        }
      }
    }

    if (processedCount > 0) {
      logger.info(`Processed ${processedCount} workflow steps`);
    }

    return processedCount;
  } catch (error) {
    logger.error("Error processing pending workflow steps", {
      processedCount,
    }, error instanceof Error ? error : new Error(String(error)));
    return processedCount;
  }
}

