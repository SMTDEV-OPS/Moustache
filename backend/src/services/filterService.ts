import { Types } from "mongoose";
import { Query } from "mongoose";
import { SavedFilterModel, ISavedFilter, IFilterCondition, IFilterJson } from "../models/savedFilter";
import { LeadModel } from "../models/lead";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { CustomFieldModel } from "../models/customField";
import { hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { notFound, forbidden } from "../utils/httpError";

type AccessUser = {
  id: string;
  permissions?: string[];
  isAdmin?: boolean;
};

// Standard lead field mapping (filter field -> DB path)
const LEAD_FIELD_MAP: Record<string, string> = {
  bucket: "heatLevel",
  stage_id: "stageId",
  first_contact_done: "__firstResponseAt", // virtual, handled specially
  status: "status",
  source: "source",
  budget: "budget",
  closed_at: "closedAt",
  terminal_type: "__terminalType", // virtual, needs stage join
};

/**
 * Resolve a condition to MongoDB query expression for leads
 */
async function resolveLeadCondition(
  cond: IFilterCondition,
  orgId: Types.ObjectId
): Promise<Record<string, any> | null> {
  const { field, operator, value } = cond;
  const logic = operator.toLowerCase();

  // Resolve field path
  let path: string;
  if (LEAD_FIELD_MAP[field]) {
    path = LEAD_FIELD_MAP[field];
  } else {
    // Custom field - check CustomField for slug
    const customField = await CustomFieldModel.findOne({
      entity_type: "lead",
      slug: field,
      is_active: true,
    }).lean();
    path = customField ? `customData.${field}` : `customData.${field}`;
  }

  // Handle virtual field: first_contact_done (true = has firstResponseAt, false = doesn't)
  if (path === "__firstResponseAt") {
    const boolVal = value === true || value === "true" || value === 1;
    if (logic === "eq") {
      if (boolVal) {
        return { firstResponseAt: { $exists: true, $ne: null } };
      } else {
        return {
          $or: [
            { firstResponseAt: { $exists: false } },
            { firstResponseAt: null },
          ],
        };
      }
    }
    return null;
  }

  // Handle virtual field: terminal_type (won/lost - filter by stage's terminalType)
  if (path === "__terminalType") {
    const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).lean();
    if (!pipeline) return null;
    const stageVal = (value || "").toString().toUpperCase();
    const stages = await PipelineStageModel.find({
      pipelineId: pipeline._id,
      isTerminal: true,
      terminalType: stageVal === "WON" ? "WON" : stageVal === "LOST" ? "LOST" : undefined,
    })
      .select("_id")
      .lean();
    const stageIds = stages.map((s) => s._id);
    if (stageIds.length === 0) return null;
    if (logic === "eq") return { stageId: { $in: stageIds } };
    if (logic === "neq") return { $or: [{ stageId: { $nin: stageIds } }, { stageId: null }] };
    return null;
  }

  // Resolve special date values at query time
  let resolvedVal = value;
  if (value === "__start_of_month") {
    const now = new Date();
    resolvedVal = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Standard operators
  const buildOp = (op: string, val: any): Record<string, any> => {
    switch (op) {
      case "eq":
        return { [path]: val };
      case "neq":
        return { [path]: { $ne: val } };
      case "gt":
        return { [path]: { $gt: val } };
      case "gte":
        return { [path]: { $gte: val } };
      case "lt":
        return { [path]: { $lt: val } };
      case "lte":
        return { [path]: { $lte: val } };
      case "in":
        return { [path]: { $in: Array.isArray(val) ? val : [val] } };
      case "not_in":
        return { [path]: { $nin: Array.isArray(val) ? val : [val] } };
      case "is_empty":
        return {
          $or: [
            { [path]: { $exists: false } },
            { [path]: null },
            { [path]: "" },
          ],
        };
      case "is_not_empty":
        return {
          $and: [
            { [path]: { $exists: true } },
            { [path]: { $ne: null } },
            { [path]: { $ne: "" } },
          ],
        };
      case "contains":
        return { [path]: { $regex: String(val), $options: "i" } };
      default:
        return { [path]: val };
    }
  };

  return buildOp(logic, resolvedVal);
}

/**
 * Build Mongoose query from filter_json for leads
 */
export async function buildLeadQueryFromFilter(
  filterJson: IFilterJson,
  orgId: Types.ObjectId,
  baseFilter: Record<string, any> = {}
): Promise<Record<string, any>> {
  const conditions = filterJson.conditions || [];
  const logic = (filterJson.logic || "AND").toUpperCase() === "OR" ? "$or" : "$and";

  const resolved: Record<string, any>[] = [];
  for (const cond of conditions) {
    const expr = await resolveLeadCondition(cond, orgId);
    if (expr) resolved.push(expr);
  }

  const combined: Record<string, any> = { ...baseFilter };
  if (resolved.length > 0) {
    combined[logic] = resolved;
  }
  return combined;
}

/** Check if filter has conditions requiring aggregation (e.g. has_overdue_followup) */
function requiresAggregation(filterJson: IFilterJson): boolean {
  return (filterJson.conditions || []).some(
    (c) => c.field === "has_overdue_followup"
  );
}

/**
 * Build aggregation pipeline for filters with has_overdue_followup
 */
async function buildLeadAggregationPipeline(
  filterJson: IFilterJson,
  orgId: Types.ObjectId,
  baseFilter: Record<string, any>
): Promise<any[]> {
  const TaskModel = (await import("../models/task")).TaskModel;
  const pipeline: any[] = [
    { $match: { orgId, ...baseFilter } },
    {
      $lookup: {
        from: TaskModel.collection.name,
        let: { leadId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$leadId", "$$leadId"] },
              status: "OPEN",
              type: "followup",
              dueAt: { $lt: new Date() },
            },
          },
        ],
        as: "overdueFollowups",
      },
    },
    { $match: { overdueFollowups: { $ne: [] } } },
  ];

  const otherConditions = (filterJson.conditions || []).filter(
    (c) => c.field !== "has_overdue_followup"
  );
  if (otherConditions.length > 0) {
    const subFilter = { conditions: otherConditions, logic: filterJson.logic };
    const extraQuery = await buildLeadQueryFromFilter(subFilter, orgId, {});
    if (Object.keys(extraQuery).length > 0) {
      pipeline.push({ $match: extraQuery });
    }
  }

  return pipeline;
}

/**
 * Apply saved filter: fetch, validate access, build query.
 * Returns query or aggregation pipeline (caller adds pagination).
 */
export async function applyFilter(
  filterId: string,
  orgId: string | Types.ObjectId,
  userId: string,
  user: AccessUser
): Promise<{
  filter: ISavedFilter;
  query: Record<string, any>;
  useAggregation?: boolean;
  aggregationPipeline?: any[];
}> {
  const oid = typeof orgId === "string" ? new Types.ObjectId(orgId) : orgId;

  const filter = await SavedFilterModel.findOne({
    _id: filterId,
    orgId: oid,
  }).lean();

  if (!filter) {
    throw notFound("Filter not found");
  }

  const filterDoc = filter as unknown as ISavedFilter;

  // Access: own, shared, or admin
  const isOwner = filter.created_by && filter.created_by.toString() === userId;
  const isShared = filter.is_shared;
  const hasAll =
    user.isAdmin || hasPermission(user as any, PERMISSIONS.LEADS.MANAGE);
  if (!isOwner && !isShared && !hasAll) {
    throw forbidden("You do not have access to this filter");
  }

  if (filter.entity_type !== "lead") {
    throw notFound("Only lead entity filters are supported for apply");
  }

  const filterJson = filter.filter_json as IFilterJson;

  if (requiresAggregation(filterJson)) {
    const aggregationPipeline = await buildLeadAggregationPipeline(
      filterJson,
      oid,
      { orgId: oid }
    );
    return {
      filter: filterDoc,
      query: {},
      useAggregation: true,
      aggregationPipeline,
    };
  }

  const query = await buildLeadQueryFromFilter(
    filterJson,
    oid,
    { orgId: oid }
  );

  return { filter: filterDoc, query };
}
