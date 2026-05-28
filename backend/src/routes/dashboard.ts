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
import { CommunicationModel } from "../models/communication";
import { CommunicationChannel, CommunicationDirection } from "../models/common";

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
        const stageIds = stages.map((s) => s._id);
        const counts = await LeadModel.aggregate([
          { $match: baseQuery },
          { $group: { _id: "$stageId", count: { $sum: 1 } } },
        ]);
        const countMap = Object.fromEntries(counts.map((c) => [c._id?.toString(), c.count]));
        data = stages.map((s) => ({
          stage_id: s._id.toString(),
          stage_name: s.name,
          count: countMap[s._id.toString()] ?? 0,
        }));
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

// GET /api/dashboard/tat-summary?scope=own|team|all
dashboardRouter.get("/tat-summary", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const scope = (req.query.scope as "own" | "team" | "all") || "own";
    const orgId =
      (req.query.orgId as string) ||
      process.env.DEFAULT_ORG_ID ||
      "69ae144fae23030b62f901f5";

    let effectiveScope: "own" | "team" | "all" = "own";
    if (scope === "team") {
      if (
        hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
        req.user.isAdmin
      ) {
        effectiveScope = "team";
      }
    } else if (scope === "all") {
      if (req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
        effectiveScope = "all";
      }
    }

    const baseQuery = await buildLeadQueryForUser(
      orgId,
      req.user.id,
      req.user,
      effectiveScope
    );

    const callTatAgg = await LeadModel.aggregate([
      {
        $match: {
          ...baseQuery,
          leadAssignedAt: { $ne: null },
          firstResponseAt: { $ne: null },
        },
      },
      {
        $project: {
          responseMinutes: {
            $divide: [
              { $subtract: ["$firstResponseAt", "$leadAssignedAt"] },
              1000 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgCallResponseMinutes: { $avg: "$responseMinutes" },
          sampleSize: { $sum: 1 },
        },
      },
    ]);

    const leadIds = await LeadModel.find(baseQuery).select("_id").lean();
    const ids = leadIds.map((l) => l._id);

    let avgEmailResponseMinutes: number | null = null;
    let emailSampleSize = 0;

    if (ids.length > 0) {
      const inboundEmails = await CommunicationModel.find({
        leadId: { $in: ids },
        channel: CommunicationChannel.EMAIL,
        direction: CommunicationDirection.INBOUND,
      })
        .sort({ leadId: 1, createdAt: 1 })
        .lean();

      const firstInboundByLead = new Map<string, Date>();
      for (const c of inboundEmails) {
        const lid = c.leadId?.toString();
        if (!lid || firstInboundByLead.has(lid)) continue;
        firstInboundByLead.set(lid, c.createdAt);
      }

      const deltas: number[] = [];
      for (const [leadId, inboundAt] of firstInboundByLead) {
        const outbound = await CommunicationModel.findOne({
          leadId: new Types.ObjectId(leadId),
          channel: CommunicationChannel.EMAIL,
          direction: CommunicationDirection.OUTBOUND,
          createdAt: { $gt: inboundAt },
        })
          .sort({ createdAt: 1 })
          .lean();

        if (outbound) {
          deltas.push(
            (outbound.createdAt.getTime() - inboundAt.getTime()) / (1000 * 60)
          );
        }
      }

      emailSampleSize = deltas.length;
      if (deltas.length > 0) {
        avgEmailResponseMinutes =
          deltas.reduce((a, b) => a + b, 0) / deltas.length;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diningToday = await LeadModel.countDocuments({
      ...baseQuery,
      createdAt: { $gte: today },
      leadType: "DINING",
    });

    res.json({
      avgCallResponseMinutes: callTatAgg[0]?.avgCallResponseMinutes ?? null,
      callSampleSize: callTatAgg[0]?.sampleSize ?? 0,
      avgEmailResponseMinutes,
      emailSampleSize,
      diningInquiriesToday: diningToday,
    });
  } catch (err) {
    next(err);
  }
});
