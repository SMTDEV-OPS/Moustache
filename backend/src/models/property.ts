import { Schema, model, Document } from "mongoose";

export type PropertyTier = "HOSTEL" | "SELECT" | "LUXURIA";

export interface IPropertyBranding {
  primaryFont?: string;
  secondaryFont?: string;
  colorScheme?: {
    primary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
}

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
  tier?: PropertyTier;
  branding?: IPropertyBranding;
  contactEmail?: string;
  contactPhone?: string;
  mapLocation?: string;
  pmsProvider?: "NONE" | "EZEE";
  pmsConfig?: {
    hotelCode?: string;
    authCode?: string;
    username?: string;
    /** Used when InsertBooking `Source_Id` is omitted (eZee often requires a channel/source unk id). */
    defaultInsertBookingSourceId?: string;
  };
  roomCategories?: string[];
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
    tier: { type: String, enum: ["HOSTEL", "SELECT", "LUXURIA"] },
    branding: {
      primaryFont: String,
      secondaryFont: String,
      colorScheme: {
        primary: String,
        accent: String,
        background: String,
        text: String,
      },
    },
    contactEmail: String,
    contactPhone: String,
    mapLocation: String,
    pmsProvider: {
      type: String,
      enum: ["NONE", "EZEE"],
      default: "NONE",
    },
    pmsConfig: {
      hotelCode: String,
      authCode: String,
      username: String,
      defaultInsertBookingSourceId: String,
    },
    roomCategories: [{ type: String }],
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

export const PropertyModel = model<IProperty>("Property", propertySchema);



