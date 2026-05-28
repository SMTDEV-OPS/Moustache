import { Schema, model, Document, Types } from "mongoose";

export type AchievementMetric = "revenue" | "booked_leads";

export interface IOrgSalesSettings extends Document {
  orgId: Types.ObjectId;
  financialYearStartMonth: number;
  financialYearStartDay: number;
  achievementMetric: AchievementMetric;
}

const orgSalesSettingsSchema = new Schema<IOrgSalesSettings>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    financialYearStartDay: { type: Number, default: 1, min: 1, max: 31 },
    achievementMetric: {
      type: String,
      enum: ["revenue", "booked_leads"],
      default: "booked_leads",
    },
  },
  { timestamps: true }
);

export const OrgSalesSettingsModel = model<IOrgSalesSettings>(
  "OrgSalesSettings",
  orgSalesSettingsSchema
);
