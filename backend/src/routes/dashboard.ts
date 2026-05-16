import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, hasPermission } from "../middleware/auth";
import { DashboardWidgetModel } from "../models/dashboardWidget";
import { UserDashboardConfigModel } from "../models/userDashboardConfig";
import { LeadModel } from "../models/lead";
import { TaskModel } from "../models/task";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { badRequest } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";
import { buildLeadQueryForUser } from "../services/dashboardDataScope";
import {
  buildLeadsPipelineStageDistribution,
  LeanPipelineStage,
} from "../utils/pipelineStageDistribution";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET /api/dashboard/widgets/library
dashboardRouter.get("/widgets/library", async (req, res, next) => {
  try {
    const widgets = await DashboardWidgetModel.find({ is_active: true })
      .select("-__v")
      .lean();
    res.json(widgets);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/config?orgId=
dashboardRouter.get("/config", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const { orgId } = req.query;
    if (!orgId || typeof orgId !== "string") {
      throw badRequest("orgId required");
    }

    const config = await UserDashboardConfigModel.findOne({
      orgId: new Types.ObjectId(orgId),
      userId: req.user.id,
    }).lean();

    res.json(config || { layout_json: [] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/dashboard/config
dashboardRouter.put("/config", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const { orgId, layout_json } = req.body;
    if (!orgId) throw badRequest("orgId required");
    if (!Array.isArray(layout_json)) throw badRequest("layout_json must be array");

    const config = await UserDashboardConfigModel.findOneAndUpdate(
      {
        orgId: new Types.ObjectId(orgId),
        userId: req.user.id,
      },
      { layout_json },
      { new: true, upsert: true }
    );

    res.json(config);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/widgets/:widget_type/data?config=&orgId=&scope=
dashboardRouter.get("/widgets/:widget_type/data", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const { widget_type } = req.params;
    const { config: configStr, orgId, scope = "own" } = req.query;

    if (!orgId || typeof orgId !== "string") {
      throw badRequest("orgId required");
    }

    const widgetConfig = configStr
      ? (typeof configStr === "string"
          ? (() => {
              try {
                return JSON.parse(configStr);
              } catch {
                return {};
              }
            })()
          : configStr)
      : {};

    const baseQuery = await buildLeadQueryForUser(
      orgId,
      req.user.id,
      req.user,
      scope as "own" | "team" | "all"
    );

    let data: any = {};

    switch (widget_type) {
      case "lead_count": {
        const statusCounts = await LeadModel.aggregate([
          { $match: baseQuery },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        data = statusCounts.reduce(
          (acc: Record<string, number>, cur) => {
            acc[cur._id] = cur.count;
            return acc;
          },
          {}
        );
        break;
      }

      case "conversion_funnel": {
        const pipeline = await PipelineModel.findOne({
          module: "leads",
          isDefault: true,
        }).lean();
        if (!pipeline) {
          data = [];
          break;
        }
        const stages = await PipelineStageModel.find({
          pipelineId: pipeline._id,
        })
          .sort({ order: 1 })
          .lean();
        data = await buildLeadsPipelineStageDistribution(
          baseQuery,
          stages as LeanPipelineStage[]
        );
        break;
      }

      case "revenue_total": {
        const pipeline = await PipelineModel.findOne({
          module: "leads",
          isDefault: true,
        }).lean();
        if (!pipeline) {
          data = { total: 0 };
          break;
        }
        const wonStage = await PipelineStageModel.findOne({
          pipelineId: pipeline._id,
          isTerminal: true,
          terminalType: "WON",
        }).lean();
        if (!wonStage) {
          data = { total: 0 };
          break;
        }
        const from = widgetConfig.timeline?.from
          ? new Date(widgetConfig.timeline.from)
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const to = widgetConfig.timeline?.to
          ? new Date(widgetConfig.timeline.to)
          : new Date();

        const result = await LeadModel.aggregate([
          {
            $match: {
              ...baseQuery,
              stageId: wonStage._id,
              closedAt: { $gte: from, $lte: to },
            },
          },
          { $group: { _id: null, total: { $sum: "$budget" } } },
        ]);
        data = { total: result[0]?.total ?? 0 };
        break;
      }

      case "pending_followups": {
        const leadIds = await LeadModel.find(baseQuery).select("_id").lean();
        const ids = leadIds.map((l) => l._id);
        const count = await TaskModel.countDocuments({
          leadId: { $in: ids },
          status: "OPEN",
          type: "followup",
          dueAt: { $lt: new Date() },
        });
        data = { count };
        break;
      }

      case "agent_leaderboard":
      case "hot_leads_list":
      case "source_breakdown":
      case "stage_distribution":
      case "call_quality_avg":
      case "response_time_avg":
      default:
        data = { data: [], message: "TODO" };
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});
