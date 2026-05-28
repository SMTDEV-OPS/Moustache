import { Schema, model, Document, Types } from "mongoose";

export type HolidayCalendarType = "public_holiday" | "season";

export interface IHolidayCalendar extends Document {
  orgId: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  type: HolidayCalendarType;
  region?: string;
}

const holidayCalendarSchema = new Schema<IHolidayCalendar>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    type: { type: String, enum: ["public_holiday", "season"], required: true },
    region: String,
  },
  { timestamps: true }
);

export const HolidayCalendarModel = model<IHolidayCalendar>(
  "HolidayCalendar",
  holidayCalendarSchema
);
