import { Schema, model, Document, Types } from "mongoose";
import {
  AccountRef,
  CallStatus,
  ClosedReason,
  CommunicationChannel,
  CommunicationDirection,
  GuestRef,
  HeatLevel,
  LeadRef,
  LeadSource,
  LeadStatus,
  LeadStage, // New SOP stage enum
  LeadType,
  PropertyRef,
  RegionRef,
  UserRef,
} from "./common";

export interface ILeadGuestDetails {
  adults?: number;
  children?: number;
}

/** Snapshot of contact info used for this lead inquiry (preserved history) */
export interface ILeadContactDetails {
  name: string;
  phone?: string;
  email?: string;
}

export interface ILead extends Document {
  leadNumber: string;
  guestId?: Types.ObjectId;
  /** Contact details used for THIS lead (inquiry snapshot; preferred for display) */
  contactDetails?: ILeadContactDetails;
  accountId?: Types.ObjectId;
  propertyId?: Types.ObjectId;
  orgId?: Types.ObjectId;
  source: LeadSource;
  leadType: LeadType;

  // Status & Pipeline
  status: LeadStatus; // Legacy/Backward compat
  stageId?: Types.ObjectId;   // Reference to PipelineStage

  // Scoring & Qualification
  heatLevel: HeatLevel;
  score: number;      // 0-10 SOP score
  color?: string;     // Added for dynamic scoring thresholds
  thresholdId?: Types.ObjectId;
  budget?: number;    // Numeric budget for scoring
  bookingWindow?: string; // "Within 5 hrs", "Within 24 hrs", "Yet to decide"
  customerType?: string; // B2C, B2B, Corporate, Influencer, NRI, HNI, Reference

  occasion?: string;
  roomsRequested?: number;
  isFirstTimeGuest: boolean;
  assignedToUserId?: Types.ObjectId;
  assignedRegionId?: Types.ObjectId;
  /** How the lead was assigned: v2_rule, legacy_rule, round_robin_fallback, manual, overflow, none */
  assignmentSource?: "v2_rule" | "legacy_rule" | "round_robin_fallback" | "manual" | "overflow" | "none";
  /** Name of the V2 assignment rule that matched (when assignmentSource is v2_rule) */
  assignmentRuleName?: string;
  createdAt: Date;
  leadAssignedAt?: Date;
  firstResponseAt?: Date;
  closedAt?: Date;
  closedReason?: ClosedReason;
  closedReasonNote?: string;
  pmsReservationId?: string;
  // Additional form fields
  alternateContact?: string;
  occupation?: string;
  bookingSource?: string;
  specialRequests?: string;
  isCorporateBooking?: boolean;
  companyName?: string;
  gstin?: string;
  estimatedValue?: string;
  notes?: string;
  // Call status and payment tracking
  callStatus?: CallStatus;
  pendingAmount?: number;
  lastSMSFollowUpAt?: Date;
  followUpCount: number; // Track number of follow-ups
  missed_followup_count?: number; // Count of missed follow-up tasks (for workflow triggers)
  tags?: string[];

  // Dynamic Custom Fields
  customData?: Map<string, any>;
}

const leadSchema = new Schema<ILead>(
  {
    leadNumber: { type: String, required: true, unique: true },
    guestId: GuestRef,
    contactDetails: {
      name: String,
      phone: String,
      email: String,
    },
    accountId: AccountRef,
    propertyId: PropertyRef,
    orgId: { type: Schema.Types.ObjectId },
    source: { type: String, enum: Object.values(LeadSource), required: true },
    leadType: { type: String, enum: Object.values(LeadType), required: true },

    // Status & Progression
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
      index: true,
    },
    stageId: {
      type: Schema.Types.ObjectId,
      ref: "PipelineStage",
      index: true,
    },

    // Scoring & Heat
    heatLevel: {
      type: String,
      default: HeatLevel.WARM,
    },
    score: { type: Number, default: 0 }, // 0-10 score
    color: String,
    thresholdId: Schema.Types.ObjectId,
    assignedToUserId: UserRef,
    assignedRegionId: RegionRef,
    assignmentSource: { type: String, enum: ["v2_rule", "legacy_rule", "round_robin_fallback", "manual", "overflow", "none"], index: true },
    assignmentRuleName: String,
    leadAssignedAt: { type: Date },
    firstResponseAt: { type: Date },
    closedAt: { type: Date },
    closedReason: {
      type: String,
      enum: Object.values(ClosedReason),
    },
    closedReasonNote: String,
    pmsReservationId: String,
    // Additional form fields
    alternateContact: String,
    occupation: String,
    bookingSource: String,
    specialRequests: String,
    isCorporateBooking: { type: Boolean, default: false },
    companyName: String,
    gstin: String,
    estimatedValue: String,
    notes: String,
    budget: Number,
    bookingWindow: String,
    customerType: String,
    occasion: String,
    roomsRequested: Number,
    callStatus: {
      type: String,
      enum: Object.values(CallStatus),
    },
    pendingAmount: Number,
    lastSMSFollowUpAt: Date,
    followUpCount: { type: Number, default: 0 },
    missed_followup_count: { type: Number, default: 0 },
    tags: [{ type: String, index: true }],

    // Dynamic Custom Fields
    customData: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Set up virtual population for Itineraries (Line Items)
leadSchema.virtual("itineraries", {
  ref: "LeadItinerary",
  localField: "_id",
  foreignField: "leadId",
});

// Ensure virtuals are included when converting documents to JSON
leadSchema.set("toJSON", { virtuals: true });
leadSchema.set("toObject", { virtuals: true });

leadSchema.index({ assignedToUserId: 1, status: 1 });
leadSchema.index({ createdAt: -1 });

export const LeadModel = model<ILead>("Lead", leadSchema);

// Example helper enums reused from communications module for clarity
export { CommunicationChannel, CommunicationDirection, LeadRef };


