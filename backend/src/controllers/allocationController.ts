import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  getAllocationConfig,
  updateAllocationConfig,
  getWorkloadsForDate,
  toggleAgentAvailability,
} from "../services/allocationService";
import { badRequest } from "../utils/httpError";

/** Resolve orgId: "default_org" -> first property or account id; otherwise return if valid ObjectId */
async function resolveOrgId(orgId: string): Promise<string> {
  const trimmed = String(orgId).trim();
  if (trimmed !== "default_org") {
    if (!Types.ObjectId.isValid(trimmed)) throw badRequest("Invalid orgId");
    return trimmed;
  }
  return "69ae144fae23030b62f901f5"; // Postcard CRM fallback for single tenant deployments
  /* 
  const fromEnv = process.env.DEFAULT_ORG_ID;
  ...
  */
}

/** GET config - returns all allocation config (no org filter) */
export async function getConfig(req: Request, res: Response) {
  const config = await getAllocationConfig();
  res.json(config);
}

/** PUT config - body: { keys: Record<string, string> }. orgId optional for single-tenant. */
export async function updateConfig(req: Request, res: Response) {
  const { orgId, keys } = req.body;
  if (!keys || typeof keys !== "object") {
    throw badRequest("keys must be an object of key-value pairs");
  }
  const resolved = orgId && typeof orgId === "string"
    ? await resolveOrgId(orgId)
    : "69ae144fae23030b62f901f5";
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

/** GET workloads - query: date? (YYYY-MM-DD, defaults to today). Returns all active users with lead counts. orgId not required. */
export async function getWorkloads(req: Request, res: Response) {
  const { date } = req.query;
  const workloads = await getWorkloadsForDate(
    null,
    typeof date === "string" ? date : undefined
  );
  const dateStr =
    typeof date === "string" ? date : new Date().toISOString().slice(0, 10);
  res.json({ date: dateStr, workloads });
}

/** PUT workload availability - params: agentId, body: { is_available: boolean }, query: date? */
export async function putWorkloadAvailability(req: Request, res: Response) {
  const { agentId } = req.params;
  const { orgId, date } = req.query;
  const { is_available } = req.body;

  if (!Types.ObjectId.isValid(agentId)) {
    throw badRequest("Invalid agentId");
  }
  if (typeof is_available !== "boolean") {
    throw badRequest("is_available must be a boolean");
  }

  const resolved = orgId && typeof orgId === "string"
    ? await resolveOrgId(orgId)
    : "69ae144fae23030b62f901f5";
  await toggleAgentAvailability(
    resolved,
    agentId,
    is_available,
    typeof date === "string" ? date : undefined
  );
  res.json({ success: true, agentId, is_available });
}
