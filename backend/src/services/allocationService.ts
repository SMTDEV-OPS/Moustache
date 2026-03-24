import { Types } from "mongoose";
import { AllocationConfigModel } from "../models/allocationConfig";
import { AgentDailyWorkloadModel } from "../models/agentDailyWorkload";
import { UserModel } from "../models/user";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { AllocationRoutingRuleModel } from "../models/allocationRoutingRule";
import { LeadModel } from "../models/lead";
import { LeadStatus } from "../models/common";
import { leadEventBus } from "./leadService";

export function getTodayDateString(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function seedAllocationConfig(orgId: string): Promise<void> {
    const defaults = [
        { key: "daily_lead_cap", value: "30", description: "Daily maximum leads per agent" },
        { key: "allocation_window_hours", value: "8", description: "Lead assignment window from last login (hours)" },
        { key: "overflow_mode", value: "queue", description: "Mode when all agents are at capacity: 'queue' or 'smart_queue'" },
        { key: "alert_threshold_percent", value: "90", description: "Percentage of daily cap to alert TL" },
        { key: "tl_notification_user_ids", value: "[]", description: "JSON array of TL User IDs to notify" }
    ];

    for (const item of defaults) {
        await AllocationConfigModel.updateOne(
            { orgId: new Types.ObjectId(orgId), key: item.key },
            { $setOnInsert: { value: item.value, description: item.description } },
            { upsert: true }
        );
    }
}

export async function getConfigValue(_orgId: string | null, key: string, defaultValue: string): Promise<string> {
    const config = await AllocationConfigModel.findOne({ key }).lean();
    return config ? config.value : defaultValue;
}

export async function getAvailableAgents(
    orgId: string,
    teamId?: string | Types.ObjectId
): Promise<Types.ObjectId[]> {
    const today = getTodayDateString();
    const capStr = await getConfigValue(orgId, "daily_lead_cap", "30");
    const windowStr = await getConfigValue(orgId, "allocation_window_hours", "8");

    const dailyLeadCap = parseInt(capStr, 10);
    const windowHours = parseInt(windowStr, 10);

    const loginCutoff = new Date();
    loginCutoff.setHours(loginCutoff.getHours() - windowHours);

    let agentIds: Types.ObjectId[] = [];
    if (teamId) {
        const group = await EmployeeGroupModel.findById(teamId).lean();
        if (group && group.memberUserIds) {
            agentIds = group.memberUserIds as Types.ObjectId[];
        }
    } else {
        const users = await UserModel.find({ status: "ACTIVE" }).select('_id').lean();
        agentIds = users.map(u => u._id as Types.ObjectId);
    }

    if (agentIds.length === 0) return [];

    // Include users who logged in recently OR have no lastLoginAt (e.g. new users, never logged in)
    const eligibleUsers = await UserModel.find({
        _id: { $in: agentIds },
        status: "ACTIVE",
        $or: [
            { lastLoginAt: { $gte: loginCutoff } },
            { lastLoginAt: null },
            { lastLoginAt: { $exists: false } },
        ],
    }).select('_id').lean();

    const eligibleUserIds = eligibleUsers.map(u => u._id);
    if (eligibleUserIds.length === 0) return [];

    const workloads = await AgentDailyWorkloadModel.find({
        date: today,
        agentId: { $in: eligibleUserIds }
    }).lean();

    const workloadMap = new Map<string, any>();
    for (const w of workloads) {
        workloadMap.set(w.agentId.toString(), w);
    }

    const availableAgents: { agentId: Types.ObjectId, count: number }[] = [];

    for (const id of eligibleUserIds) {
        const w = workloadMap.get(id.toString());
        const count = w ? w.lead_count : 0;
        const isAvail = w ? w.is_available : true;

        if (isAvail && count < dailyLeadCap) {
            availableAgents.push({ agentId: id, count });
        }
    }

    // Sort ascending by lead count (fewest leads today gets priority in overflow smart assignments)
    availableAgents.sort((a, b) => a.count - b.count);
    return availableAgents.map(a => a.agentId);
}

async function getRoutingGroup(
    lead: any,
    _orgId: string
): Promise<Types.ObjectId | null> {
    const rules = await AllocationRoutingRuleModel
        .find({ is_active: true })
        .sort({ priority: 1 })
        .lean();

    for (const rule of rules) {
        const leadValue =
            (lead?.customData && typeof lead.customData.get === "function"
                ? lead.customData.get(rule.condition_field)
                : lead?.customData?.[rule.condition_field]) ??
            (lead as any)?.[rule.condition_field];

        if (leadValue === undefined || leadValue === null) continue;

        let matches = false;
        switch (rule.condition_operator) {
            case "eq":
                matches = String(leadValue) === String(rule.condition_value);
                break;
            case "neq":
                matches = String(leadValue) !== String(rule.condition_value);
                break;
            case "in": {
                const inValues = Array.isArray(rule.condition_value)
                    ? rule.condition_value
                    : [rule.condition_value as any];
                matches = inValues.map(String).includes(String(leadValue));
                break;
            }
            case "not_in": {
                const notInValues = Array.isArray(rule.condition_value)
                    ? rule.condition_value
                    : [rule.condition_value as any];
                matches = !notInValues.map(String).includes(String(leadValue));
                break;
            }
        }

        if (matches) return rule.assign_to_group_id as unknown as Types.ObjectId;
    }
    return null;
}

export async function getAvailableAgentsForLead(
    orgId: string,
    lead: any,
    teamId?: string | Types.ObjectId
): Promise<Types.ObjectId[]> {
    const base = await getAvailableAgents(orgId, teamId);
    if (base.length === 0) return [];

    const groupId = await getRoutingGroup(lead, orgId);
    if (!groupId) return base;

    const group = await EmployeeGroupModel.findById(groupId).lean();
    const members = (group?.memberUserIds ?? []) as Types.ObjectId[];
    if (members.length === 0) return base;

    const memberSet = new Set(members.map((m) => m.toString()));
    const filtered = base.filter((id) => memberSet.has(id.toString()));
    return filtered.length > 0 ? filtered : base;
}

export async function incrementAgentWorkload(orgId: string, agentId: string): Promise<void> {
    const today = getTodayDateString();
    await AgentDailyWorkloadModel.findOneAndUpdate(
        { orgId: new Types.ObjectId(orgId), agentId: new Types.ObjectId(agentId), date: today },
        { $inc: { lead_count: 1 }, $setOnInsert: { is_available: true, alert_sent: false } },
        { upsert: true, new: true }
    );
}

export async function checkCapacityAlerts(orgId: string): Promise<void> {
    const today = getTodayDateString();
    const capStr = await getConfigValue(orgId, "daily_lead_cap", "30");
    const pctStr = await getConfigValue(orgId, "alert_threshold_percent", "90");

    const cap = parseInt(capStr, 10);
    const pct = parseInt(pctStr, 10);
    const threshold = Math.floor(cap * pct / 100);

    const alerts = await AgentDailyWorkloadModel.find({
        date: today,
        lead_count: { $gte: threshold },
        alert_sent: false
    });

    for (const workload of alerts) {
        workload.alert_sent = true;
        await workload.save();

        leadEventBus.emit("agent.capacity_warning", {
            agentId: workload.agentId.toString(),
            leadCount: workload.lead_count,
            cap,
            orgId
        });
    }
}

/** Return all allocation config entries (no org filter) */
export async function getAllocationConfig(_orgId?: string | null): Promise<Record<string, { value: string; description?: string }>> {
    const configs = await AllocationConfigModel.find({}).lean();
    const result: Record<string, { value: string; description?: string }> = {};
    for (const c of configs) {
        result[c.key] = { value: c.value, description: c.description };
    }
    return result;
}

/** Update multiple allocation config keys for an org */
export async function updateAllocationConfig(orgId: string, updates: Record<string, string>): Promise<void> {
    const orgObjId = new Types.ObjectId(orgId);
    for (const [key, value] of Object.entries(updates)) {
        await AllocationConfigModel.updateOne(
            { orgId: orgObjId, key },
            { $set: { value } },
            { upsert: true }
        );
    }
}

/** Return workload for all active users with today's lead counts and open lead counts */
export async function getWorkloadsForDate(orgId: string | null, date?: string): Promise<Array<{
    agentId: string;
    name: string;
    email: string;
    isOnline: boolean;
    lastLoginAt?: Date;
    leadsToday: number;
    openLeads: number;
    isAvailable: boolean;
    alertSent: boolean;
}>> {
    const d = date ?? getTodayDateString();

    const users = await UserModel.find({ status: "ACTIVE" })
        .select("_id name email isOnline lastLoginAt roleId")
        .lean();

    const workloadQuery: Record<string, any> = { date: d };
    if (orgId) workloadQuery.orgId = new Types.ObjectId(orgId);

    const workloads = await AgentDailyWorkloadModel.find(workloadQuery).lean();

    const userIds = users.map((u) => u._id);
    const openLeadCounts = await LeadModel.aggregate([
        {
            $match: {
                assignedToUserId: { $in: userIds },
                status: { $nin: [LeadStatus.LOST, LeadStatus.CLOSED_AUTO, LeadStatus.CONFIRMED] },
            },
        },
        { $group: { _id: "$assignedToUserId", count: { $sum: 1 } } },
    ]);

    const openLeadMap = new Map(
        openLeadCounts.map((r) => [r._id.toString(), r.count])
    );

    const workloadMap = new Map(
        workloads.map((w) => [w.agentId.toString(), w])
    );

    return users.map((user) => {
        const workload = workloadMap.get(user._id.toString());
        const openLeads = openLeadMap.get(user._id.toString()) ?? 0;

        return {
            agentId: user._id.toString(),
            name: user.name ?? "Unknown",
            email: user.email ?? "",
            isOnline: user.isOnline ?? false,
            lastLoginAt: user.lastLoginAt,
            leadsToday: workload?.lead_count ?? 0,
            openLeads,
            isAvailable: workload?.is_available !== false,
            alertSent: workload?.alert_sent ?? false,
        };
    });
}

/** Toggle is_available for an agent for a given date (defaults to today) */
export async function toggleAgentAvailability(orgId: string, agentId: string, isAvailable: boolean, date?: string): Promise<void> {
    const d = date ?? getTodayDateString();
    await AgentDailyWorkloadModel.findOneAndUpdate(
        { orgId: new Types.ObjectId(orgId), agentId: new Types.ObjectId(agentId), date: d },
        { $set: { is_available: isAvailable }, $setOnInsert: { lead_count: 0, alert_sent: false } },
        { upsert: true }
    );
}
