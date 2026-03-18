/**
 * Seed dashboard widget library (global, no org).
 * Idempotent: uses widget_type uniqueness.
 *
 * Usage: npx ts-node scripts/seedDashboardWidgets.ts
 */
import "dotenv/config";
declare var process: any;
declare var require: any;
declare var module: any;
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { DashboardWidgetModel } from "../src/models/dashboardWidget";

const WIDGETS = [
  {
    widget_type: "lead_count",
    title: "Lead Count",
    description: "Count of leads by status/stage",
    required_permission: "leads.read",
  },
  {
    widget_type: "conversion_funnel",
    title: "Conversion Funnel",
    description: "Leads at each pipeline stage",
    required_permission: "leads.read",
  },
  {
    widget_type: "revenue_total",
    title: "Revenue Total",
    description: "Sum of budget for won leads",
    required_permission: "leads.read",
  },
  {
    widget_type: "agent_leaderboard",
    title: "Agent Leaderboard",
    description: "Top agents by performance",
    required_permission: "leads.read",
  },
  {
    widget_type: "pending_followups",
    title: "Pending Follow-ups",
    description: "Overdue follow-up tasks",
    required_permission: "leads.read",
  },
  {
    widget_type: "hot_leads_list",
    title: "Hot Leads List",
    description: "List of hot leads",
    required_permission: "leads.read",
  },
  {
    widget_type: "source_breakdown",
    title: "Source Breakdown",
    description: "Leads by source",
    required_permission: "leads.read",
  },
  {
    widget_type: "stage_distribution",
    title: "Stage Distribution",
    description: "Leads by stage",
    required_permission: "leads.read",
  },
  {
    widget_type: "call_quality_avg",
    title: "Call Quality Avg",
    description: "Average call quality score",
    required_permission: "leads.read",
  },
  {
    widget_type: "response_time_avg",
    title: "Response Time Avg",
    description: "Average response time",
    required_permission: "leads.read",
  },
];

export async function seedDashboardWidgets() {
  for (const w of WIDGETS) {
    const existing = await DashboardWidgetModel.findOne({
      widget_type: w.widget_type,
    });

    if (existing) {
      logger.info(`Dashboard widget "${w.widget_type}" already exists, skipping`);
      continue;
    }

    await DashboardWidgetModel.create({
      ...w,
      is_active: true,
    });

    logger.info(`Created dashboard widget "${w.widget_type}"`);
  }
}

async function main() {
  await mongoose.connect(config.mongoUri);
  await seedDashboardWidgets();
  await mongoose.disconnect();
  logger.info("Seed complete");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
