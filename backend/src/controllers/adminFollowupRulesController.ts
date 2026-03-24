import { Request, Response } from "express";
import { FollowupRuleModel } from "../models/followupRule";
import { z } from "zod";
import { logger } from "../config/logger";
import mongoose from "mongoose";

const baseRuleSchema = z.object({
    org_id: z.string().optional(),
    bucket: z.enum(["Hot", "Warm", "Cold", "Inactive"]),
    followup_number: z.number().int().positive(),
    offset_hours: z.number().optional().nullable(),
    offset_days: z.number().optional().nullable(),
    description: z.string().optional(),
    template_id: z.string().optional(),
    is_active: z.boolean().default(true),
    display_order: z.number().int(),
});

const ruleSchema = baseRuleSchema.refine(data => {
    const hasHours = data.offset_hours !== undefined && data.offset_hours !== null;
    const hasDays = data.offset_days !== undefined && data.offset_days !== null;
    return (hasHours && !hasDays) || (!hasHours && hasDays);
}, {
    message: "Must provide either offset_hours or offset_days, but not both"
});

export const AdminFollowupRulesController = {
    // GET /api/admin/followup-rules
    async listRules(req: Request, res: Response) {
        try {
            const rules = await FollowupRuleModel.find({ is_active: { $ne: false } }).sort({ bucket: 1, display_order: 1 });

            // Group by bucket
            const grouped = rules.reduce((acc, rule) => {
                if (!acc[rule.bucket]) acc[rule.bucket] = [];
                acc[rule.bucket].push(rule);
                return acc;
            }, {} as Record<string, any[]>);

            res.status(200).json(grouped);
        } catch (err: any) {
            logger.error("Error listing followup rules", {}, err instanceof Error ? err : new Error(String(err)));
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // POST /api/admin/followup-rules
    async createRule(req: Request, res: Response) {
        try {
            const validated = ruleSchema.parse(req.body);
            const rule = await FollowupRuleModel.create(validated);
            res.status(201).json(rule);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ errors: err.errors });
            }
            logger.error("Error creating followup rule", {}, err instanceof Error ? err : new Error(String(err)));
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // PUT /api/admin/followup-rules/:id
    async updateRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const validated = baseRuleSchema.partial().parse(req.body);
            const rule = await FollowupRuleModel.findByIdAndUpdate(id, validated, { new: true });
            if (!rule) return res.status(404).json({ message: "Rule not found" });
            res.status(200).json(rule);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ errors: err.errors });
            }
            logger.error("Error updating followup rule", {}, err instanceof Error ? err : new Error(String(err)));
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // DELETE /api/admin/followup-rules/:id
    async deleteRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            // Soft delete
            const rule = await FollowupRuleModel.findByIdAndUpdate(id, { is_active: false }, { new: true });
            if (!rule) return res.status(404).json({ message: "Rule not found" });
            res.status(200).json({ message: "Rule deleted (soft)" });
        } catch (err: any) {
            logger.error("Error deleting followup rule", {}, err instanceof Error ? err : new Error(String(err)));
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // PUT /api/admin/followup-rules/reorder
    async reorderRules(req: Request, res: Response) {
        try {
            const updates = z.array(z.object({
                id: z.string(),
                display_order: z.number()
            })).parse(req.body);

            // Bulk update
            const bulkOps: any[] = updates.map(u => ({
                updateOne: {
                    filter: { _id: u.id },
                    update: { $set: { display_order: u.display_order } }
                }
            }));

            await FollowupRuleModel.bulkWrite(bulkOps);
            res.status(200).json({ message: "Rules reordered successfully" });
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return res.status(400).json({ errors: err.errors });
            }
            logger.error("Error reordering followup rules", {}, err instanceof Error ? err : new Error(String(err)));
            res.status(500).json({ message: "Internal server error" });
        }
    }
};
