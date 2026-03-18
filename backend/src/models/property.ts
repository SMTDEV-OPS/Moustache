import { Schema, model, Document } from "mongoose";

export interface IProperty extends Document {
  name: string;
  code: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  timeZone?: string;
  status: "ACTIVE" | "INACTIVE";
  pmsProvider?: "NONE" | "EZEE";
  pmsConfig?: {
    hotelCode?: string;
    authCode?: string;
    username?: string;
  };
  lastSyncedAt?: Date;
}

const propertySchema = new Schema<IProperty>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    location: {
      city: String,
      state: String,
      country: String,
    },
    timeZone: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    pmsProvider: {
      type: String,
      enum: ["NONE", "EZEE"],
      default: "NONE",
    },
    pmsConfig: {
      hotelCode: String,
      authCode: String,
      username: String,
    },
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

export const PropertyModel = model<IProperty>("Property", propertySchema);



