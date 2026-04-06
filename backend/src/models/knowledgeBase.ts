import { Schema, model, Document, Types } from "mongoose";
import { PropertyRef, UserRef } from "./common";

export enum KnowledgeBaseType {
  PROPERTY = "PROPERTY",
  FACTSHEET = "FACTSHEET",
  TEMPLATE = "TEMPLATE",
  RESOURCE = "RESOURCE",
  /** Structured hotel directory card: contact, rooms, amenities, city guide (see `IPropertyDirectoryContent`). */
  PROPERTY_DIRECTORY = "PROPERTY_DIRECTORY",
}

export type DirectoryTierLabel = "Hostel" | "Select" | "Luxuria" | "Cowork";

/** City / area guide row (v2 directory). */
export interface ICityInfoItem {
  name: string;
  distanceOrNotes?: string;
}

/** @deprecated legacy alias */
export type IPropertyDirectoryCityEntry = ICityInfoItem;

export interface IRoomCategory {
  category: string;
  count: number;
  isAC: boolean;
  isEnsuite: boolean;
  notes?: string;
}

export interface IPropertyContact {
  frontDesk?: string;
  managerName?: string;
  managerPhone?: string;
  ownerName?: string;
  ownerPhone?: string;
  email?: string;
  mapLink?: string;
}

/**
 * PROPERTY_DIRECTORY body (v2). Stored in `content` Mixed — fields optional in DB until filled.
 * Legacy rows may still use old `cityGuide`, `rooms[].name`, `contact.frontDeskPhone`, etc.
 */
export interface IPropertyDirectoryContent {
  tier?: DirectoryTierLabel;
  region?: string;
  city?: string;
  address?: string;
  landmark?: string;
  contact?: IPropertyContact;
  buildingHighlights?: string[];
  rooms?: IRoomCategory[];
  amenities?: {
    room?: string[];
    hotel?: string[];
    safety?: string[];
    frontOffice?: string[];
  };
  cityInfo?: {
    restaurants?: ICityInfoItem[];
    shopping?: ICityInfoItem[];
    nightlife?: ICityInfoItem[];
    attractions?: ICityInfoItem[];
    importantPlaces?: ICityInfoItem[];
    streetFood?: ICityInfoItem[];
  };
  checkInTime?: string;
  checkOutTime?: string;
  lastImportedAt?: string;
  importSource?: "excel_import" | "manual";
}

/** Typed content for FACTSHEET KB items (stored in `content` mixed field). */
export interface IFactSheetContent {
  propertyAddress?: string;
  mapLocation?: string;
  checkInTime?: string;
  checkOutTime?: string;
  roomCategories?: Array<{
    name: string;
    capacity?: number;
    sizesqft?: number;
    isAC?: boolean;
    isDorm?: boolean;
  }>;
  inHouseRules?: string[];
  additionalCharges?: Array<{
    item: string;
    amount?: string;
  }>;
  propertyPolicy?: string[];
  nearbyAttractions?: string[];
  nearbyRestaurants?: string[];
  pocDetails?: {
    frontDeskPhone?: string;
    frontDeskEmail?: string;
    gmName?: string;
    gmPhone?: string;
  };
  generalInfo?: string[];
  roomAmenities?: string[];
  hotelAmenities?: string[];
  promotionsAndOffers?: string[];
  specialRemarks?: string;
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
    isActive: { type: Boolean, default: true },
    createdBy: { ...UserRef, required: true },
    updatedBy: { ...UserRef, required: true },
  },
  { timestamps: true }
);

// Indexes for efficient querying
knowledgeBaseSchema.index({ propertyId: 1, type: 1 });
knowledgeBaseSchema.index({ propertyId: 1, type: 1, isActive: 1 });
knowledgeBaseSchema.index({ type: 1, "content.city": 1 });
knowledgeBaseSchema.index({ type: 1, "content.region": 1 });
knowledgeBaseSchema.index({ type: 1, "content.tier": 1 });
knowledgeBaseSchema.index({
  title: "text",
  description: "text",
  "content.city": "text",
  "content.region": "text",
});

export const KnowledgeBaseModel = model<IKnowledgeBase>(
  "KnowledgeBase",
  knowledgeBaseSchema
);

