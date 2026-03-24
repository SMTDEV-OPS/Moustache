import { Schema, model, Document, Types } from "mongoose";
import { PropertyRef } from "./common";

export interface IAccount extends Document {
  // Basic Information
  name: string; // Company Name

  // Organization Classification (NEW)
  organizationType: "CORPORATE" | "TRAVEL_AGENT" | "EVENT_PLANNER" | "WEDDING_PLANNER" | "PCO" | "AIRLINE" | "GOVERNMENT" | "EMBASSY_CONSULATE" | "PSU" | "CUSTOM" | "EVENT_ORGANISER" | "PROFESSIONAL_CONFERENCE_ORGANISER" | "GOVERNMENT_BODIES" | "EMBASSIES_AND_CONSULATES" | "PUBLIC_SECTOR_UNIT";
  customOrganizationType?: string; // When organizationType = "CUSTOM"
  customOrganizationTypes?: string[];

  // Conglomerate (NEW)
  conglomerateId?: Types.ObjectId; // Reference to Conglomerate model
  conglomerateName?: string; // Denormalized for display

  // Account Hierarchy (NEW)
  accountLevel: "MASTER" | "PARENT" | "BRANCH" | "SUBSIDIARY";
  /** Legacy HQ flag (kept for existing data). */
  isHeadquarter: boolean;
  /** Profile status for no-hard-delete workflows. */
  profileStatus?: "ACTIVE" | "NA";
  canChangeHeadquarter: boolean; // Admin-only flag (NEW)
  headquarterName?: string; // Headquarter Name
  hqAccountId?: Types.ObjectId;

  // Legacy type field (keeping for backward compatibility)
  type: "TRAVEL_AGENT" | "CORPORATE" | "EVENT_PLANNER" | "AIRLINES" | "GOVERNMENT" | "OTHER"; // Account Type
  parentAccountId?: Types.ObjectId;

  // Address Information
  addressLine1?: string; // Add Line 1
  addressLine2?: string; // Add Line 2
  zip?: string; // ZIP
  city?: string; // City
  subCity?: string; // Sub-City
  state?: string; // State
  country?: string; // Country
  zone?: string; // Zone
  locality?: string; // Locality/Area by city (NEW)
  pmsProfileId?: string; // Two-way PMS integration ID (NEW)

  // Contact Information
  email?: string; // Email (Primary)
  secondaryEmail?: string; // Secondary Email
  boardLine?: string; // Board Line (Phone)
  fax?: string; // FAX
  website?: string; // Website

  // Business Information
  marketSegment?: string; // Market Segment
  gstin?: string; // GSTIN
  panNumber?: string; // PAN Number
  accountClassification?: string; // Account Classification

  // Industry Classification (NEW - Hierarchical)
  /** Industry label + PostcardCRM API field (mirrors industryCategory when synced). */
  industry?: string;
  industryCategory?: string; // e.g., "Consumer & Retail"
  industrySubCategory?: string; // e.g., "FMCG"
  industrySize?: "SMALL" | "MEDIUM" | "LARGE";
  /** PostcardCRM enum name for size band. */
  industryStatus?: "SMALL" | "MEDIUM" | "LARGE";
  officeStatus?: string; // Office Status
  travelAgentImplant?: string; // Travel Agent (Implant)
  salesTeam?: string; // Sales Team
  contractingType?: string; // Contracting Type (legacy)
  pmsSource?: string; // PMS Source

  // Contracting (NEW - Multiple types with timelines)
  contractingTypes?: Array<{
    type: "LOCAL_CONTRACTING" | "LOCAL_RFP" | "GLOBAL_RFP" | "ANNUAL_CONTRACT";
    year?: number;
    fromYear?: number;
    toYear?: number;
    fromMonth: number;
    toMonth: number;
  }>;

  // Account Type Classification (NEW)
  accountType?: "ACQUISITION" | "DEVELOPMENT" | "RETENTION";
  accountTypeOverride?: boolean; // Manual override toggle

  // Sales & Credit Information
  businessPotentialCity?: string; // Business Potential City (legacy)
  primarySalesPerson?: string; // Primary Sales Person (legacy)
  secondarySalesPerson?: string; // Secondary Sales Person (legacy)

  // Sales Team Assignment (NEW)
  primaryAccountManager?: {
    userId: Types.ObjectId;
    name: string;
    city: string;
  };
  secondaryAccountManagers?: Array<{
    userId: Types.ObjectId;
    name: string;
    city: string;
  }>;

  customerBlacklist?: boolean; // Customer Blacklist
  creditAllowed?: boolean; // Credit Allowed
  creditLimits?: number; // Credit Limits
  creditDays?: number; // Credit Days
  billingInstruction?: string; // Billing Instruction

  // Loyalty Information
  loyaltyProgram?: string; // Loyalty Program
  loyaltyNumber?: string; // Loyalty Number
  loyaltyCreditPoint?: number; // Loyalty Credit Point

  // Hotel/Property Related (for travel agents)
  hotel?: string; // Hotel
  hotelCity?: string; // City (for hotel)
  starCategory?: string; // Star Category
  office?: string; // Office
  travelAgencyType?: string; // Travel Agency Type
  distance?: number; // Distance
  roomNight?: number; // Room Night
  rate?: number; // Rate
  adr?: number; // Average Daily Rate (ADR)
  remarks?: string; // Remarks

  propertyIds?: Types.ObjectId[];

  // Additional fields
  marketArea?: string; // Market/Area
  competitor?: string; // Competitor

  // Legacy fields (keeping for backward compatibility)
  primaryContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;

  tags?: string[];
  status?: "LEAD" | "PROSPECT" | "ACTIVE" | "INACTIVE" | "BLACKLISTED" | "NA";
  systemSyncedFields?: string[];
  followUpDate?: Date | null;
  followUpNote?: string;
}

const accountSchema = new Schema<IAccount>(
  {
    // Basic Information
    name: { type: String, required: true },

    // Organization Classification (NEW)
    organizationType: {
      type: String,
      enum: [
        "CORPORATE",
        "TRAVEL_AGENT",
        "EVENT_PLANNER",
        "WEDDING_PLANNER",
        "PCO",
        "AIRLINE",
        "GOVERNMENT",
        "EMBASSY_CONSULATE",
        "PSU",
        "CUSTOM",
        "EVENT_ORGANISER",
        "PROFESSIONAL_CONFERENCE_ORGANISER",
        "GOVERNMENT_BODIES",
        "EMBASSIES_AND_CONSULATES",
        "PUBLIC_SECTOR_UNIT",
      ],
      required: true,
    },
    customOrganizationType: String,
    customOrganizationTypes: [{ type: String }],

    // Conglomerate (NEW)
    conglomerateId: {
      type: Schema.Types.ObjectId,
      ref: "Conglomerate",
      default: null,
    },
    conglomerateName: String,

    // Account Hierarchy (NEW)
    accountLevel: {
      type: String,
      enum: ["MASTER", "PARENT", "BRANCH", "SUBSIDIARY"],
      required: true,
      default: "MASTER",
    },
    isHeadquarter: { type: Boolean, required: true, default: false },
    profileStatus: { type: String, enum: ["ACTIVE", "NA"], default: "ACTIVE" },
    canChangeHeadquarter: { type: Boolean, default: true },
    headquarterName: String,
    hqAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // Legacy type field (keeping for backward compatibility)
    type: {
      type: String,
      enum: ["TRAVEL_AGENT", "CORPORATE", "EVENT_PLANNER", "AIRLINES", "GOVERNMENT", "OTHER"],
      required: true,
    },
    parentAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // Address Information
    addressLine1: String,
    addressLine2: String,
    zip: String,
    city: String,
    subCity: String,
    state: String,
    country: String,
    zone: String,
    locality: String, // NEW
    pmsProfileId: String, // NEW

    // Contact Information
    email: String,
    secondaryEmail: String,
    boardLine: String,
    fax: String,
    website: String,

    // Business Information
    industry: String,
    marketSegment: String,
    gstin: String,
    panNumber: String,
    accountClassification: String,

    industryCategory: String,
    industrySubCategory: String,
    industrySize: {
      type: String,
      enum: ["SMALL", "MEDIUM", "LARGE"],
    },
    industryStatus: {
      type: String,
      enum: ["SMALL", "MEDIUM", "LARGE"],
    },
    officeStatus: String,
    travelAgentImplant: String,
    salesTeam: String,
    contractingType: String, // Legacy
    pmsSource: String,

    contractingTypes: [
      {
        type: {
          type: String,
          enum: ["LOCAL_CONTRACTING", "LOCAL_RFP", "GLOBAL_RFP", "ANNUAL_CONTRACT"],
        },
        year: { type: Number },
        fromYear: { type: Number },
        toYear: { type: Number },
        fromMonth: {
          type: Number,
          min: 1,
          max: 12,
        },
        toMonth: {
          type: Number,
          min: 1,
          max: 12,
        },
      },
    ],

    // Account Type Classification (NEW)
    accountType: {
      type: String,
      enum: ["ACQUISITION", "DEVELOPMENT", "RETENTION"],
    },
    accountTypeOverride: { type: Boolean, default: false },

    // Sales & Credit Information
    businessPotentialCity: String, // Legacy
    primarySalesPerson: String, // Legacy
    secondarySalesPerson: String, // Legacy

    // Sales Team Assignment (NEW)
    primaryAccountManager: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      name: String,
      city: String,
    },
    secondaryAccountManagers: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        name: String,
        city: String,
      },
    ],

    customerBlacklist: { type: Boolean, default: false },
    creditAllowed: { type: Boolean, default: false },
    creditLimits: Number,
    creditDays: Number,
    billingInstruction: String,

    // Loyalty Information
    loyaltyProgram: String,
    loyaltyNumber: String,
    loyaltyCreditPoint: Number,

    // Hotel/Property Related
    hotel: String,
    hotelCity: String,
    starCategory: String,
    office: String,
    travelAgencyType: String,
    distance: Number,
    roomNight: Number,
    rate: Number,
    adr: { type: Number, default: null },
    remarks: String,

    propertyIds: { type: [PropertyRef], default: [] },

    marketArea: String,
    competitor: String,

    primaryContact: {
      name: String,
      phone: String,
      email: String,
    },
    notes: String,

    tags: [String],
    status: {
      type: String,
      enum: ["LEAD", "PROSPECT", "ACTIVE", "INACTIVE", "BLACKLISTED", "NA"],
      default: "ACTIVE",
    },
    systemSyncedFields: [String],
    followUpDate: { type: Date, default: null },
    followUpNote: { type: String, default: "" },
  },
  { timestamps: true }
);

accountSchema.index({ name: 1, type: 1 });
accountSchema.index({ parentAccountId: 1 });
accountSchema.index({ organizationType: 1 }); // NEW
accountSchema.index({ conglomerateId: 1 }); // NEW
accountSchema.index({ accountLevel: 1 }); // NEW
accountSchema.index({ industry: 1, industrySubCategory: 1 });
accountSchema.index({ industryCategory: 1, industrySubCategory: 1 });
accountSchema.index({ status: 1 });
accountSchema.index({ tags: 1 });
accountSchema.index({ accountType: 1 }); // NEW
accountSchema.index({ 'primaryAccountManager.userId': 1 }); // NEW
accountSchema.index({ city: 1, organizationType: 1 }); // Compound index for filtering
accountSchema.index({ name: 'text' }); // Text search index

// Keep profileStatus soft-delete flag aligned with status when explicitly NA.
accountSchema.pre("save", function (next) {
  const doc = this as IAccount;
  if (doc.profileStatus === "NA") {
    doc.status = "NA";
  }
  next();
});

// Prevent circular references
accountSchema.pre("save", async function (next) {
  if (this.parentAccountId && this._id) {
    // Prevent self-reference
    if (this.parentAccountId.equals(this._id)) {
      return next(new Error("Account cannot be its own parent"));
    }

    // Check if parent exists
    const parent = await AccountModel.findById(this.parentAccountId);
    if (!parent) {
      return next(new Error("Parent account does not exist"));
    }

    // Prevent circular reference: check if parent is a descendant of this account
    const checkCircularReference = async (accountId: Types.ObjectId, targetParentId: Types.ObjectId): Promise<boolean> => {
      const account = await AccountModel.findById(accountId);
      if (!account || !account.parentAccountId) {
        return false;
      }
      if (account.parentAccountId.equals(targetParentId)) {
        return true;
      }
      return checkCircularReference(account.parentAccountId, targetParentId);
    };

    const isCircular = await checkCircularReference(this.parentAccountId, this._id);
    if (isCircular) {
      return next(new Error("Circular reference detected: cannot set parent that would create a cycle"));
    }
  }
  next();
});

export const AccountModel = model<IAccount>("Account", accountSchema);



