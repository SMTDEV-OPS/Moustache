import { Types } from "mongoose";
import { AllocationConfigModel } from "../models/allocationConfig";
import { AgentDailyWorkloadModel } from "../models/agentDailyWorkload";
import { UserModel } from "../models/user";
import { EmployeeGroupModel } from "../models/employeeGroup";
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

export async function getConfigValue(orgId: string, key: string, defaultValue: string): Promise<string> {
    const config = await AllocationConfigModel.findOne({ orgId: new Types.ObjectId(orgId), key }).lean();
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

    const eligibleUsers = await UserModel.find({
        _id: { $in: agentIds },
        status: "ACTIVE",
        lastLoginAt: { $gte: loginCutoff }
    }).select('_id').lean();

    const eligibleUserIds = eligibleUsers.map(u => u._id);
    if (eligibleUserIds.length === 0) return [];

    const workloads = await AgentDailyWorkloadModel.find({
        orgId: new Types.ObjectId(orgId),
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
        orgId: new Types.ObjectId(orgId),
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
