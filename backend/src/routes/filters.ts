import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, hasPermission } from "../middleware/auth";
import { SavedFilterModel } from "../models/savedFilter";
import { LeadModel } from "../models/lead";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";
import { applyFilter } from "../services/filterService";
import { AccessControlService } from "../services/auth/AccessControlService";

export const filtersRouter = Router();

filtersRouter.use(requireAuth);

async function getTeamMemberIds(userId: string): Promise<string[]> {
  try {
    return await AccessControlService.getDescendants(userId);
  } catch {
    return [];
  }
}

function buildScopeFilter(
  scope: "own" | "team" | "all",
  userId: string,
  teamMemberIds: string[]
): Record<string, any> {
  if (scope === "own") {
    return { assignedToUserId: new Types.ObjectId(userId) };
  }
  if (scope === "team") {
    if (teamMemberIds.length === 0) return { assignedToUserId: new Types.ObjectId("000000000000000000000000") }; // no match
    return { assignedToUserId: { $in: teamMemberIds.map((id) => new Types.ObjectId(id)) } };
  }
  return {};
}

const createFilterSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  entity_type: z.enum(["lead", "contact", "deal"]),
  filter_json: z.object({
    conditions: z.array(
      z.object({
        field: z.string(),
        operator: z.string(),
        value: z.any().optional(),
      })
    ),
    logic: z.enum(["AND", "OR"]).optional(),
  }),
  is_shared: z.boolean().optional(),
});

const updateFilterSchema = createFilterSchema.partial();

// GET /api/filters?entity=lead&orgId=
filtersRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const { entity, orgId } = req.query;
    if (!orgId || typeof orgId !== "string") {
      throw badRequest("orgId is required");
    }

    const oid = new Types.ObjectId(orgId);
    const query: Record<string, any> = { orgId: oid };

    if (entity && typeof entity === "string") {
      query.entity_type = entity;
    }

    const filters = await SavedFilterModel.find({
      ...query,
      $or: [
        { created_by: req.user.id },
        { is_shared: true },
        { is_system: true },
      ],
    })
      .sort({ is_system: -1, name: 1 })
      .lean();

    res.json(filters);
  } catch (err) {
    next(err);
  }
});

// POST /api/filters
filtersRouter.post("/", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");
    if (!hasPermission(req.user, PERMISSIONS.LEADS.READ)) {
      throw forbidden("Insufficient permissions");
    }

    const parsed = createFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const data = parsed.data;
    const filter = await SavedFilterModel.create({
      orgId: new Types.ObjectId(data.orgId),
      name: data.name,
      entity_type: data.entity_type,
      filter_json: data.filter_json,
      is_system: false,
      created_by: req.user.id,
      is_shared: data.is_shared ?? false,
    });

    res.status(201).json(filter);
  } catch (err) {
    next(err);
  }
});

// PUT /api/filters/:id
filtersRouter.put("/:id", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const existing = await SavedFilterModel.findById(req.params.id);
    if (!existing) throw notFound("Filter not found");

    const isOwner = existing.created_by?.toString() === req.user.id;
    const isAdmin =
      req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE);

    if (!isOwner && !isAdmin) {
      throw forbidden("You can only update your own filters");
    }

    const parsed = updateFilterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const data = parsed.data;
    if (data.orgId) existing.orgId = new Types.ObjectId(data.orgId);
    if (data.name) existing.name = data.name;
    if (data.entity_type) existing.entity_type = data.entity_type;
    if (data.filter_json) existing.filter_json = data.filter_json;
    if (data.is_shared !== undefined) existing.is_shared = data.is_shared;

    await existing.save();
    res.json(existing);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/filters/:id
filtersRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const existing = await SavedFilterModel.findById(req.params.id);
    if (!existing) throw notFound("Filter not found");

    if (existing.is_system) {
      const isAdmin =
        req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE);
      if (!isAdmin) {
        throw forbidden("System filters can only be deleted by admins");
      }
    } else {
      const isOwner = existing.created_by?.toString() === req.user.id;
      const isAdmin =
        req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE);
      if (!isOwner && !isAdmin) {
        throw forbidden("You can only delete your own filters");
      }
    }

    await SavedFilterModel.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/filters/:id/apply?page=&limit=&scope=&orgId=
filtersRouter.post("/:id/apply", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const { page = "1", limit = "20", scope = "own", orgId } = req.query;
    if (!orgId || typeof orgId !== "string") {
      throw badRequest("orgId is required");
    }

    const result = await applyFilter(
      req.params.id,
      orgId,
      req.user.id,
      req.user
    );

    const teamMemberIds =
      scope === "team" ? await getTeamMemberIds(req.user.id) : [];
    const scopeFilter = buildScopeFilter(
      scope as "own" | "team" | "all",
      req.user.id,
      teamMemberIds
    );

    const hasAll =
      req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE);
    if (scope === "all" && !hasAll) {
      throw forbidden("Insufficient permissions for all leads");
    }

    const skip = (parseInt(String(page), 10) - 1) * parseInt(String(limit), 10);
    const limitNum = Math.min(parseInt(String(limit), 10), 100);

    let leads: any[];
    let total: number;

    if ((result as any).useAggregation && (result as any).aggregationPipeline) {
      const pipeline = (result as any).aggregationPipeline as any[];
      const scopeMatch =
        Object.keys(scopeFilter).length > 0 ? [{ $match: scopeFilter }] : [];
      const fullPipeline = [
        ...pipeline,
        ...scopeMatch,
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limitNum },
              {
                $lookup: {
                  from: "guests",
                  localField: "guestId",
                  foreignField: "_id",
                  as: "guestId",
                },
              },
              { $unwind: { path: "$guestId", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  "guestId.name": 1,
                  "guestId.phone": 1,
                  "guestId.email": 1,
                  guestId: 1,
                  leadNumber: 1,
                  status: 1,
                  heatLevel: 1,
                  stageId: 1,
                  source: 1,
                  createdAt: 1,
                  contactDetails: 1,
                },
              },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];
      const aggResult = await LeadModel.aggregate(fullPipeline);
      leads = aggResult[0]?.data || [];
      total = aggResult[0]?.total?.[0]?.count ?? 0;
    } else {
      const baseQuery =
        Object.keys(scopeFilter).length > 0
          ? { $and: [result.query, scopeFilter] }
          : result.query;

      [leads, total] = await Promise.all([
        LeadModel.find(baseQuery)
          .populate("guestId", "name phone email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        LeadModel.countDocuments(baseQuery),
      ]);
    }

    res.json({
      data: leads,
      total,
      page: parseInt(String(page), 10),
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
});
