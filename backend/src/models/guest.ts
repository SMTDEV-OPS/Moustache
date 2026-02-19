import { Schema, model, Document } from "mongoose";
import { SunshineTier } from "./common";

export interface IGuest extends Document {
  name: string;
  phone?: string;
  email?: string;
  // Secondary contact information (alternative phones/emails discovered from leads)
  secondaryPhones?: string[];
  secondaryEmails?: string[];
  isSunshineMember: boolean;
  sunshineTier?: SunshineTier | null;
  tags: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  totalLeadsCount: number;
  totalReservationsCount: number;
  // External database sync fields
  externalGuestId?: string;
  externalSource?: string;
  lastSyncedAt?: Date;
}

const guestSchema = new Schema<IGuest>(
  {
    name: { type: String, required: true },
    phone: { type: String, index: true },
    email: { type: String, index: true },
    // Secondary contact information
    secondaryPhones: [{ type: String }],
    secondaryEmails: [{ type: String }],
    isSunshineMember: { type: Boolean, default: false },
    sunshineTier: {
      type: String,
      enum: Object.values(SunshineTier),
      default: null,
    },
    tags: [{ type: String }],
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    totalLeadsCount: { type: Number, default: 0 },
    totalReservationsCount: { type: Number, default: 0 },
    // External database sync fields
    externalGuestId: String,
    externalSource: String,
    lastSyncedAt: Date,
  },
  { timestamps: true }
);

guestSchema.index({ phone: 1, email: 1 });

export const GuestModel = model<IGuest>("Guest", guestSchema);



