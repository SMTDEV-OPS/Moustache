import { FilterQuery, Types } from "mongoose";
import { LeadStatus } from "../models/common";
import { ILead } from "../models/lead";
import { LeadModel } from "../models/lead";

export type LeanPipelineStage = {
  _id: Types.ObjectId;
  name: string;
  order: number;
  isTerminal?: boolean;
  terminalType?: "WON" | "LOST";
  color?: string;
};

export type StageDistributionRow = {
  stage_id: string;
  stage_name: string;
  count: number;
  color?: string;
};

/**
 * Count leads per pipeline stage. Uses stageId when it belongs to this pipeline;
 * otherwise maps LeadStatus to stages by name so legacy/IVR leads still count.
 */
export async function buildLeadsPipelineStageDistribution(
  filter: FilterQuery<ILead>,
  stages: LeanPipelineStage[]
): Promise<StageDistributionRow[]> {
  if (stages.length === 0) return [];

  const validIds = new Set(stages.map((s) => s._id.toString()));

  const byNameMatch = (...substrings: string[]) => {
    const needles = substrings.map((s) => s.toLowerCase());
    const hit = stages.find((x) => {
      const n = String(x.name || "").toLowerCase();
      return needles.some((frag) => n === frag || n.includes(frag));
    });
    return hit?._id.toString();
  };

  const won = stages.find((s) => s.terminalType === "WON");
  const lost = stages.find((s) => s.terminalType === "LOST");
  const orderedNonTerminal = [...stages]
    .filter((s) => !s.isTerminal)
    .sort((a, b) => a.order - b.order);
  const firstStageId =
    orderedNonTerminal[0]?._id.toString() ?? stages[0]._id.toString();

  const statusToStage: Record<string, string> = {
    [LeadStatus.NEW]: byNameMatch("new lead") ?? firstStageId,
    [LeadStatus.UNASSIGNED_OVERFLOW]: byNameMatch("new lead") ?? firstStageId,
    [LeadStatus.CONTACTED]: byNameMatch("1st connect", "first connect") ?? firstStageId,
    [LeadStatus.QUOTATION_SHARED]: byNameMatch("discussion") ?? firstStageId,
    [LeadStatus.PAYMENT_PENDING]:
      byNameMatch("payment request", "payment") ?? byNameMatch("discussion") ?? firstStageId,
    [LeadStatus.ON_HOLD]: byNameMatch("discussion") ?? firstStageId,
    [LeadStatus.CONFIRMED]: won?._id.toString() ?? firstStageId,
    [LeadStatus.LOST]: lost?._id.toString() ?? firstStageId,
    [LeadStatus.CLOSED_AUTO]: lost?._id.toString() ?? firstStageId,
  };

  const mini = await LeadModel.find(filter).select("stageId status").lean();

  const countMap: Record<string, number> = {};
  for (const s of stages) {
    countMap[s._id.toString()] = 0;
  }

  for (const lead of mini) {
    const rawId = lead.stageId ? String(lead.stageId) : "";
    const sid = rawId && validIds.has(rawId) ? rawId : statusToStage[lead.status] ?? firstStageId;
    if (countMap[sid] !== undefined) {
      countMap[sid] += 1;
    }
  }

  return stages.map((s) => ({
    stage_id: s._id.toString(),
    stage_name: s.name,
    count: countMap[s._id.toString()] ?? 0,
    ...(s.color ? { color: s.color } : {}),
  }));
}
