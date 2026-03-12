import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  getAllocationConfig,
  updateAllocationConfig,
  getWorkloadsForDate,
  toggleAgentAvailability,
  getTodayDateString,
} from "../services/allocationService";
import { badRequest } from "../utils/httpError";
import { PropertyModel } from "../models/property";
import { AccountModel } from "../models/account";

/** Resolve orgId: "default_org" -> first property or account id; otherwise return if valid ObjectId */
async function resolveOrgId(orgId: string): Promise<string> {
  const trimmed = String(orgId).trim();
  if (trimmed !== "default_org") {
    if (!Types.ObjectId.isValid(trimmed)) throw badRequest("Invalid orgId");
    return trimmed;
  }
  const fromEnv = process.env.DEFAULT_ORG_ID;
  if (fromEnv && Types.ObjectId.isValid(fromEnv)) return fromEnv;
  const property = await PropertyModel.findOne().select("_id").lean();
  if (property) return property._id.toString();
  const account = await AccountModel.findOne().select("_id").lean();
  if (account) return account._id.toString();
  throw badRequest("No default org found. Add a property/account or set DEFAULT_ORG_ID.");
}

/** GET config - query: orgId */
export async function getConfig(req: Request, res: Response) {
  const { orgId } = req.query;
  if (!orgId || typeof orgId !== "string") {
    throw badRequest("orgId query parameter is required");
  }
  const resolved = await resolveOrgId(orgId);
  const config = await getAllocationConfig(resolved);
  res.json(config);
}

/** PUT config - body: { orgId, keys: Record<string, string> } */
export async function updateConfig(req: Request, res: Response) {
  const { orgId, keys } = req.body;
  if (!orgId || typeof orgId !== "string") {
    throw badRequest("orgId is required");
  }
  if (!keys || typeof keys !== "object") {
    throw badRequest("keys must be an object of key-value pairs");
  }
  const resolved = await resolveOrgId(orgId);
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(keys)) {
    if (typeof value !== "string") {
      throw badRequest(`Config value for "${key}" must be a string`);
    }
    updates[key] = value;
  }
  await updateAllocationConfig(resolved, updates);
  res.json({ success: true });
}

/** GET workloads - query: orgId, date? (YYYY-MM-DD, defaults to today) */
export async function getWorkloads(req: Request, res: Response) {
  const { orgId, date } = req.query;
  if (!orgId || typeof orgId !== "string") {
    throw badRequest("orgId query parameter is required");
  }
  const resolved = await resolveOrgId(orgId);
  const workloads = await getWorkloadsForDate(resolved, typeof date === "string" ? date : undefined);
  res.json({ date: date ?? getTodayDateString(), workloads });
}

/** PUT workload availability - params: agentId, body: { is_available: boolean }, query: orgId, date? */
export async function putWorkloadAvailability(req: Request, res: Response) {
  const { agentId } = req.params;
  const { orgId, date } = req.query;
  const { is_available } = req.body;

  if (!orgId || typeof orgId !== "string") {
    throw badRequest("orgId query parameter is required");
  }
  if (!Types.ObjectId.isValid(agentId)) {
    throw badRequest("Invalid agentId");
  }
  if (typeof is_available !== "boolean") {
    throw badRequest("is_available must be a boolean");
  }

  const resolved = await resolveOrgId(orgId);
  await toggleAgentAvailability(
    resolved,
    agentId,
    is_available,
    typeof date === "string" ? date : undefined
  );
  res.json({ success: true, agentId, is_available });
}
