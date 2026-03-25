import mongoose, { Schema, Document } from "mongoose";

export interface IRoomType {
  roomTypeId: string;      // PMS room type ID
  roomTypeCode: string;    // Short code e.g. "DLX"
  roomTypeName: string;    // Display name e.g. "Deluxe Room"
  maxOccupancy?: number;
  description?: string;
}

export interface IRatePlan {
  ratePlanId: string;      // PMS rate plan ID
  ratePlanCode: string;    // Short code e.g. "CP"
  ratePlanName: string;    // Display name e.g. "Continental Plan"
  inclusions?: string;     // e.g. "Breakfast included"
}

export interface IPMSRoomCatalogue extends Document {
  propertyId: mongoose.Types.ObjectId;
  roomTypes: IRoomType[];
  ratePlans: IRatePlan[];
  lastSyncedAt: Date;
}

const roomTypeSchema = new Schema<IRoomType>({
  roomTypeId: { type: String, required: true },
  roomTypeCode: { type: String },
  roomTypeName: { type: String, required: true },
  maxOccupancy: { type: Number },
  description: { type: String },
}, { _id: false });

const ratePlanSchema = new Schema<IRatePlan>({
  ratePlanId: { type: String, required: true },
  ratePlanCode: { type: String },
  ratePlanName: { type: String, required: true },
  inclusions: { type: String },
}, { _id: false });

const pmsCatalogueSchema = new Schema<IPMSRoomCatalogue>({
  propertyId: { 
    type: Schema.Types.ObjectId, 
    ref: "Property", 
    required: true, 
    unique: true 
  },
  roomTypes: { type: [roomTypeSchema], default: [] },
  ratePlans: { type: [ratePlanSchema], default: [] },
  lastSyncedAt: { type: Date },
}, { timestamps: true });

export const PMSRoomCatalogueModel = mongoose.model<IPMSRoomCatalogue>(
  "PMSRoomCatalogue",
  pmsCatalogueSchema
);
