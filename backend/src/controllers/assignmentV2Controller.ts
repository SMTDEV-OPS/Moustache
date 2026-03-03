import { Request, Response } from "express";
import { AssignmentRuleModel } from "../models/assignmentRule";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { UserModel } from "../models/user";

export const getRules = async (req: Request, res: Response) => {
    try {
        const module = req.params.module;
        const rules = await AssignmentRuleModel.find({ module })
            .sort({ priority: 1, createdAt: 1 })
            .populate("employeeGroupId", "groupName")
            .populate("specificUserId", "name email");

        res.json(rules);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getRuleById = async (req: Request, res: Response) => {
    try {
        const rule = await AssignmentRuleModel.findById(req.params.id)
            .populate("employeeGroupId", "groupName")
            .populate("specificUserId", "name email");
        if (!rule) return res.status(404).json({ error: "Rule not found" });
        res.json(rule);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const createRule = async (req: Request, res: Response) => {
    try {
        const payload = req.body;

        // Validate target
        if (payload.assignTo === "group" && !payload.employeeGroupId) {
            return res.status(400).json({ error: "Group is required" });
        }
        if (payload.assignTo === "user" && !payload.specificUserId) {
            return res.status(400).json({ error: "User is required" });
        }

        const rule = new AssignmentRuleModel(payload);
        await rule.save();

        res.status(201).json(rule);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const updateRule = async (req: Request, res: Response) => {
    try {
        const rule = await AssignmentRuleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rule) return res.status(404).json({ error: "Rule not found" });
        res.json(rule);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const deleteRule = async (req: Request, res: Response) => {
    try {
        await AssignmentRuleModel.findByIdAndDelete(req.params.id);
        res.json({ message: "Rule deleted" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
