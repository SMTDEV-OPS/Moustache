import { Schema, model, Document, Types } from "mongoose";

export type AccountDocumentType = "CONTRACT" | "CERTIFICATE" | "AGREEMENT" | "OTHER";

export interface IAccountDocument extends Document {
  accountId: Types.ObjectId;
  name: string;
  fileUrl: string;
  storageType?: "LOCAL" | "S3";
  mimeType?: string;
  size?: number;
  type?: AccountDocumentType;
  uploadedByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const accountDocumentSchema = new Schema<IAccountDocument>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    storageType: {
      type: String,
      enum: ["LOCAL", "S3"],
      default: "S3",
    },
    mimeType: { type: String },
    size: { type: Number },
    type: {
      type: String,
      enum: ["CONTRACT", "CERTIFICATE", "AGREEMENT", "OTHER"],
      default: "OTHER",
    },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

accountDocumentSchema.index({ accountId: 1, createdAt: -1 });

export const AccountDocumentModel = model<IAccountDocument>("AccountDocument", accountDocumentSchema);
