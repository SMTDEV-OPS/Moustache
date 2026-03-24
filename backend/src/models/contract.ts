import { Schema, model, Document, Types } from "mongoose";
import { AccountRef, PropertyRef, UserRef } from "./common";

export type ContractStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type ContractChannel = "B2B" | "B2C";

export interface IContractPricingRow {
  roomCategory: string;
  rate: number;
  inclusions?: string;
  /** Room nights (auto-calc or manual override) */
  rn?: number;
  remarks?: string;
}

/** Rate grid row with occupancy columns */
export interface IRateGridRow {
  id: string;
  roomType: string;
  rateSlab: string;
  single: number;
  double: number;
  triple: number;
  rn: number;
  inclusions: string[];
  remarks: string;
}

export interface IInclusionNomenclature {
  code: string;
  fullName: string;
}

export interface IRateGridData {
  rows: IRateGridRow[];
  inclusionNomenclature: IInclusionNomenclature[];
  additionalRemarks: string;
}

export interface IRateGridValue {
  b2b: IRateGridData;
  b2c: IRateGridData;
  inclusionNomenclature: IInclusionNomenclature[];
  additionalRemarks: string;
}

export interface IContractApproval {
  step: number;
  approverUserId: Types.ObjectId;
  approverName?: string;
  label?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  actedAt?: Date;
  note?: string;
}

export interface IContract extends Document {
  accountId: Types.ObjectId;
  propertyIds: Types.ObjectId[];
  companyName: string;
  contactId?: Types.ObjectId;
  contactEmail?: string;
  channel: ContractChannel;
  status: ContractStatus;
  pricingGrid: IContractPricingRow[];
  /** New rate grid: B2B + B2C with inclusion nomenclature */
  rateGrid?: IRateGridValue;
  approvals: IContractApproval[];
  submittedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pricingRowSchema = new Schema<IContractPricingRow>(
  {
    roomCategory: { type: String, required: true },
    rate: { type: Number, required: true },
    inclusions: String,
    rn: Number,
    remarks: String,
  },
  { _id: false }
);

const approvalSchema = new Schema<IContractApproval>(
  {
    step: { type: Number, required: true },
    approverUserId: { ...UserRef, required: true },
    approverName: String,
    label: String,
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    actedAt: Date,
    note: String,
  },
  { _id: false }
);

const contractSchema = new Schema<IContract>(
  {
    accountId: { ...AccountRef, required: true, index: true },
    propertyIds: { type: [PropertyRef], default: [] },
    companyName: { type: String, required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", index: true },
    contactEmail: String,
    channel: { type: String, enum: ["B2B", "B2C"], required: true, index: true },
    status: { type: String, enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"], default: "DRAFT", index: true },
    pricingGrid: { type: [pricingRowSchema], default: [] },
    rateGrid: { type: Schema.Types.Mixed },
    approvals: { type: [approvalSchema], default: [] },
    submittedByUserId: UserRef,
  },
  { timestamps: true }
);

contractSchema.index({ accountId: 1, status: 1, channel: 1 });

export const ContractModel = model<IContract>("Contract", contractSchema);
