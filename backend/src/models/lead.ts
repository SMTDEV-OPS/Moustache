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
  source: LeadSource;
  leadType: LeadType;

  // Status & Pipeline
  status: LeadStatus; // Legacy/Backward compat
  stage: LeadStage;   // New SOP pipeline stage

  // Scoring & Qualification
  heatLevel: HeatLevel;
  score: number;      // 0-10 SOP score
  budget?: number;    // Numeric budget for scoring
  bookingWindow?: string; // "Within 5 hrs", "Within 24 hrs", "Yet to decide"
  customerType?: string; // B2C, B2B, Corporate, Influencer, NRI, HNI, Reference

  checkInDate?: Date;
  checkOutDate?: Date;
  roomsRequested?: number;
  guests?: ILeadGuestDetails;
  occasion?: string;
  isFirstTimeGuest: boolean;
  assignedToUserId?: Types.ObjectId;
  assignedTeamType?: string;
  assignedRegionId?: Types.ObjectId;
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
  roomCategory?: string;
  roomPreference?: string;
  // Call status and payment tracking
  callStatus?: CallStatus;
  pendingAmount?: number;
  lastSMSFollowUpAt?: Date;
  followUpCount: number; // Track number of follow-ups
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
    source: { type: String, enum: Object.values(LeadSource), required: true },
    leadType: { type: String, enum: Object.values(LeadType), required: true },

    // Status & Progression
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
      index: true,
    },
    stage: {
      type: String,
      enum: Object.values(LeadStage),
      default: LeadStage.NEW_LEAD, // Default to first SOP stage
      index: true,
    },

    // Scoring & Heat
    heatLevel: {
      type: String,
      enum: Object.values(HeatLevel),
      default: HeatLevel.WARM,
    },
    score: { type: Number, default: 0 }, // 0-10 score
    budget: Number,
    bookingWindow: String,
    customerType: String,

    checkInDate: Date,
    checkOutDate: Date,
    roomsRequested: Number,
    guests: {
      adults: Number,
      children: Number,
    },
    occasion: String,
    isFirstTimeGuest: { type: Boolean, default: false },
    assignedToUserId: UserRef,
    assignedTeamType: { type: String },
    assignedRegionId: RegionRef,
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
    roomCategory: String,
    roomPreference: String,
    // Call status and payment tracking
    callStatus: {
      type: String,
      enum: Object.values(CallStatus),
    },
    pendingAmount: Number,
    lastSMSFollowUpAt: Date,
    followUpCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

leadSchema.index({ assignedToUserId: 1, status: 1, checkInDate: 1 });
leadSchema.index({ createdAt: -1 });

export const LeadModel = model<ILead>("Lead", leadSchema);

// Example helper enums reused from communications module for clarity
export { CommunicationChannel, CommunicationDirection, LeadRef };


