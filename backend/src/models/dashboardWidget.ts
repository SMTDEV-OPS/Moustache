import { Schema, model, Document } from "mongoose";

export interface IDashboardWidget extends Document {
  widget_type: string;
  title: string;
  description?: string;
  config_schema_json?: Record<string, any>;
  required_permission: string;
  is_active: boolean;
}

const dashboardWidgetSchema = new Schema<IDashboardWidget>(
  {
    widget_type: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    config_schema_json: { type: Schema.Types.Mixed },
    required_permission: { type: String, default: "leads.read" },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const DashboardWidgetModel = model<IDashboardWidget>(
  "DashboardWidget",
  dashboardWidgetSchema
);
