import { Schema, model, Document, Types } from "mongoose";

export interface IUserDashboardConfig extends Document {
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  layout_json: any[];
  updatedAt: Date;
}

const userDashboardConfigSchema = new Schema<IUserDashboardConfig>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    layout_json: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userDashboardConfigSchema.index({ orgId: 1, userId: 1 }, { unique: true });

export const UserDashboardConfigModel = model<IUserDashboardConfig>(
  "UserDashboardConfig",
  userDashboardConfigSchema
);
