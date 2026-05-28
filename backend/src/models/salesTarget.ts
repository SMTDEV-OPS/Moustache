import { Schema, model, Document, Types } from "mongoose";

export interface ISalesTarget extends Document {
  orgId: Types.ObjectId;
  year: number;
  month: number;
  userId?: Types.ObjectId;
  targetAmount?: number;
  targetCount?: number;
}

const salesTargetSchema = new Schema<ISalesTarget>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    targetAmount: Number,
    targetCount: Number,
  },
  { timestamps: true }
);

salesTargetSchema.index({ orgId: 1, year: 1, month: 1, userId: 1 }, { unique: true });

export const SalesTargetModel = model<ISalesTarget>("SalesTarget", salesTargetSchema);
