import { Schema, model, Document } from "mongoose";
import { PropertyRef, UserRef } from "./common";

export interface IAvailabilityReport extends Document {
  propertyId: any;
  date: Date;
  uploadedByUserId: any;
  reportDateRange?: {
    start?: Date;
    end?: Date;
  };
  data: any;
}

const availabilityReportSchema = new Schema<IAvailabilityReport>(
  {
    propertyId: { ...PropertyRef, required: true },
    date: { type: Date, required: true },
    uploadedByUserId: UserRef,
    reportDateRange: {
      start: Date,
      end: Date,
    },
    data: Schema.Types.Mixed,
  },
  { timestamps: true }
);

availabilityReportSchema.index({ propertyId: 1, date: -1 });

export const AvailabilityReportModel = model<IAvailabilityReport>(
  "AvailabilityReport",
  availabilityReportSchema
);



