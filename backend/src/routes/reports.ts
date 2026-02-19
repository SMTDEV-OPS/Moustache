import { Router } from "express";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { LeadModel } from "../models/lead";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { CommunicationModel } from "../models/communication";
import { TaskModel } from "../models/task";
import { ReservationModel } from "../models/reservation";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requirePermissions(["reports.view"]));

// GET /reports/daily-activity?date=YYYY-MM-DD
reportsRouter.get("/daily-activity", async (req, res, next) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dayEnd = new Date(dateStr + "T23:59:59.999Z");

    const [newLeads, activities, comms, reservations, tasks] = await Promise.all([
      LeadModel.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$assignedToUserId", count: { $sum: 1 } } },
      ]),
      LeadActivityModel.aggregate([
        { $match: { performedAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$performedByUserId", count: { $sum: 1 } } },
      ]),
      CommunicationModel.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$performedByUserId", count: { $sum: 1 } } },
      ]),
      ReservationModel.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: "$propertyId", count: { $sum: 1 } } },
      ]),
      TaskModel.aggregate([
        { $match: { updatedAt: { $gte: dayStart, $lte: dayEnd }, status: "COMPLETED" } },
        { $group: { _id: "$ownerUserId", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({ date: dateStr, newLeads, activities, communications: comms, reservations, completedTasks: tasks });
  } catch (err) {
    next(err);
  }
});

// GET /reports/response-time
reportsRouter.get("/response-time", async (_req, res, next) => {
  try {
    const pipeline = [
      {
        $project: {
          assignedToUserId: 1,
          leadAssignedAt: 1,
          firstResponseAt: 1,
          closedAt: 1,
        },
      },
      {
        $match: {
          leadAssignedAt: { $ne: null },
          firstResponseAt: { $ne: null },
        },
      },
      {
        $project: {
          assignedToUserId: 1,
          firstResponseMinutes: {
            $divide: [
              { $subtract: ["$firstResponseAt", "$leadAssignedAt"] },
              1000 * 60,
            ],
          },
          timeToCloseHours: {
            $cond: [
              { $and: [{ $ne: ["$closedAt", null] }] },
              {
                $divide: [
                  { $subtract: ["$closedAt", "$leadAssignedAt"] },
                  1000 * 60 * 60,
                ],
              },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$assignedToUserId",
          avgFirstResponseMinutes: { $avg: "$firstResponseMinutes" },
          avgTimeToCloseHours: { $avg: "$timeToCloseHours" },
          leadsHandled: { $sum: 1 },
        },
      },
    ];

    const stats = await LeadModel.aggregate(pipeline);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /reports/conversions
reportsRouter.get("/conversions", async (_req, res, next) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: { source: "$source", propertyId: "$propertyId" },
          totalLeads: { $sum: 1 },
          confirmedLeads: {
            $sum: {
              $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0],
            },
          },
        },
      },
    ];

    const conversions = await LeadModel.aggregate(pipeline);
    res.json(conversions);
  } catch (err) {
    next(err);
  }
});

// GET /reports/lost-reasons
reportsRouter.get("/lost-reasons", async (_req, res, next) => {
  try {
    const pipeline = [
      {
        $match: {
          status: { $in: ["LOST", "CLOSED_AUTO"] },
        },
      },
      {
        $group: {
          _id: { reason: "$closedReason", propertyId: "$propertyId" },
          count: { $sum: 1 },
        },
      },
    ];
    const data = await LeadModel.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /reports/lead-aging
reportsRouter.get("/lead-aging", async (_req, res, next) => {
  try {
    const now = new Date();
    const pipeline = [
      {
        $project: {
          assignedToUserId: 1,
          status: 1,
          createdAt: 1,
          closedAt: 1,
          ageDays: {
            $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $bucket: {
          groupBy: "$ageDays",
          boundaries: [0, 1, 3, 7, 14, 9999],
          default: "14+",
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ];

    const buckets = await LeadModel.aggregate(pipeline);
    res.json(buckets);
  } catch (err) {
    next(err);
  }
});

// GET /reports/buddy
reportsRouter.get("/buddy", async (_req, res, next) => {
  try {
    // Simplified: count leads per assignedToUserId
    const pipeline = [
      {
        $group: {
          _id: "$assignedToUserId",
          leads: { $sum: 1 },
        },
      },
    ];
    const data = await LeadModel.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    next(err);
  }
});



