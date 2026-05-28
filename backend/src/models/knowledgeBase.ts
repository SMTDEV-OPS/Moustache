import { Schema, model, Document, Types } from "mongoose";
import { PropertyRef, UserRef } from "./common";

export enum KnowledgeBaseType {
  PROPERTY = "PROPERTY",
  FACTSHEET = "FACTSHEET",
  TEMPLATE = "TEMPLATE",
  RESOURCE = "RESOURCE",
  PROPERTY_GUIDE = "PROPERTY_GUIDE",
}

export interface IKnowledgeBaseFile {
  _id?: Types.ObjectId;
  filename: string;
  originalName: string;
  fileId?: Types.ObjectId;
  path?: string;
  gcsFileName?: string;
  s3Key?: string;
  storageType: "LOCAL" | "GRIDFS" | "GCS" | "S3";
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface IKnowledgeBase extends Document {
  type: KnowledgeBaseType;
  propertyId: Types.ObjectId;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  files: IKnowledgeBaseFile[];
  shareToken?: string;
  shareEnabled?: boolean;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseFileSchema = new Schema<IKnowledgeBaseFile>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileId: { type: Schema.Types.ObjectId },
    path: { type: String },
    gcsFileName: { type: String },
    s3Key: { type: String },
    storageType: { type: String, enum: ["LOCAL", "GRIDFS", "GCS", "S3"], default: "GRIDFS" },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    type: {
      type: String,
      enum: Object.values(KnowledgeBaseType),
      required: true,
      index: true,
    },
    propertyId: { ...PropertyRef, required: true },
    title: { type: String, required: true },
    description: String,
    content: { type: Schema.Types.Mixed },
    files: [knowledgeBaseFileSchema],
    shareToken: { type: String, index: true, sparse: true },
    shareEnabled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { ...UserRef, required: true },
    updatedBy: { ...UserRef, required: true },
  },
  { timestamps: true }
);

// Indexes for efficient querying
knowledgeBaseSchema.index({ propertyId: 1, type: 1 });
knowledgeBaseSchema.index({ propertyId: 1, type: 1, isActive: 1 });
knowledgeBaseSchema.index({ title: "text", description: "text" });

export const KnowledgeBaseModel = model<IKnowledgeBase>(
  "KnowledgeBase",
  knowledgeBaseSchema
);

