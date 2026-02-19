import { Schema, model, Document } from "mongoose";

export type WorkflowMedium = "CALL" | "EMAIL" | "WHATSAPP";
export type WorkflowExecutionMode = "AUTO" | "MANUAL" | "BOTH";

export interface IEmailTemplateConfig {
  templateId?: string; // Reference to Template model
  inlineSubject?: string; // Inline subject for email
  inlineBody?: string; // Inline body for email
}

export interface IWhatsAppTemplateConfig {
  templateId?: string; // Reference to Template model
  inlineMessage?: string; // Inline message for WhatsApp
}

export interface IStepTemplates {
  email?: IEmailTemplateConfig;
  whatsapp?: IWhatsAppTemplateConfig;
}

export interface IWorkflowStep {
  stepNumber: number;
  name: string;
  offsetDays: number; // Days from lead creation
  offsetHours?: number; // Additional hours offset

  // Mediums - can select multiple
  mediums: WorkflowMedium[];

  // Execution mode: AUTO, MANUAL, or BOTH
  executionMode: WorkflowExecutionMode;

  // Template configuration (for EMAIL/WHATSAPP when AUTO or BOTH)
  templates?: IStepTemplates;

  // Custom outcomes admin can define for this step
  possibleOutcomes: string[];

  isActive: boolean;
}

export interface IWorkflowCondition {
  leadType?: string;
  source?: string;
  propertyId?: string;
}

export interface IWorkflow extends Document {
  name: string;
  appliesTo?: IWorkflowCondition;
  steps: IWorkflowStep[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateConfigSchema = new Schema<IEmailTemplateConfig>(
  {
    templateId: { type: String },
    inlineSubject: { type: String },
    inlineBody: { type: String },
  },
  { _id: false }
);

const whatsappTemplateConfigSchema = new Schema<IWhatsAppTemplateConfig>(
  {
    templateId: { type: String },
    inlineMessage: { type: String },
  },
  { _id: false }
);

const stepTemplatesSchema = new Schema<IStepTemplates>(
  {
    email: { type: emailTemplateConfigSchema },
    whatsapp: { type: whatsappTemplateConfigSchema },
  },
  { _id: false }
);

const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    stepNumber: { type: Number, required: true },
    name: { type: String, required: true },
    offsetDays: { type: Number, required: true, default: 0 },
    offsetHours: { type: Number, default: 0 },
    mediums: {
      type: [{ type: String, enum: ["CALL", "EMAIL", "WHATSAPP"] }],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one medium must be selected",
      },
    },
    executionMode: {
      type: String,
      enum: ["AUTO", "MANUAL", "BOTH"],
      required: true,
      default: "MANUAL",
    },
    templates: { type: stepTemplatesSchema },
    possibleOutcomes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: { type: String, required: true, unique: true },
    appliesTo: {
      leadType: String,
      source: String,
      propertyId: String,
    },
    steps: { type: [workflowStepSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WorkflowModel = model<IWorkflow>("Workflow", workflowSchema);
