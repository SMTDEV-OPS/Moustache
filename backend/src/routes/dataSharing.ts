import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { DataSharingRuleModel } from "../models/dataSharingRule";
import { ModuleDefaultAccessModel, DataSharingDefaultAccess } from "../models/moduleDefaultAccess";
import { badRequest, notFound } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";

export const dataSharingRouter = Router();

// Only settings managers can configure data sharing
dataSharingRouter.use(requireAuth, requirePermissions([PERMISSIONS.SETTINGS.MANAGE]));

// ==========================================
// Module Default Access Settings
// ==========================================

const updateDefaultAccessSchema = z.object({
    defaultAccess: z.enum(['private', 'public_read', 'public_read_write', 'public_full'])
});

dataSharingRouter.get("/defaults", async (req, res, next) => {
    try {
        const defaults = await ModuleDefaultAccessModel.find().lean();
        res.json(defaults);
    } catch (err) {
        next(err);
    }
});

dataSharingRouter.get("/defaults/:module", async (req, res, next) => {
    try {
        const defaultAccess = await ModuleDefaultAccessModel.findOne({ module: req.params.module }).lean();
        res.json(defaultAccess || { module: req.params.module, defaultAccess: 'private' });
    } catch (err) {
        next(err);
    }
});

dataSharingRouter.put("/defaults/:module", async (req, res, next) => {
    try {
        const parsed = updateDefaultAccessSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid default access level");
        }

        const defaultAccess = await ModuleDefaultAccessModel.findOneAndUpdate(
            { module: req.params.module },
            {
                module: req.params.module,
                defaultAccess: parsed.data.defaultAccess
            },
            { new: true, upsert: true }
        ).lean();

        res.json(defaultAccess);
    } catch (err) {
        next(err);
    }
});

// ==========================================
// Data Sharing Rules
// ==========================================

const createRuleSchema = z.object({
    module: z.string().min(1),
    fromType: z.enum(['role', 'group']),
    fromId: z.string().min(1),
    toType: z.enum(['role', 'group']),
    toId: z.string().min(1),
    accessLevel: z.enum(['read', 'read_write', 'full']),
    isActive: z.boolean().optional()
});

dataSharingRouter.get("/rules", async (req, res, next) => {
    try {
        const { module } = req.query;
        const filter = module ? { module } : {};

        const rules = await DataSharingRuleModel.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        res.json(rules);
    } catch (err) {
        next(err);
    }
});

dataSharingRouter.post("/rules", async (req, res, next) => {
    try {
        const parsed = createRuleSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest(`Invalid rule payload: ${parsed.error.issues.map(i => i.message).join(', ')}`);
        }

        const existing = await DataSharingRuleModel.findOne({
            module: parsed.data.module,
            fromType: parsed.data.fromType,
            fromId: parsed.data.fromId,
            toType: parsed.data.toType,
            toId: parsed.data.toId
        });

        if (existing) {
            throw badRequest("A rule with this identical mapping already exists.");
        }

        const rule = await DataSharingRuleModel.create(parsed.data);
        res.status(201).json(rule);
    } catch (err) {
        next(err);
    }
});

dataSharingRouter.put("/rules/:id", async (req, res, next) => {
    try {
        // Can only update access level and active status
        const updateSchema = z.object({
            accessLevel: z.enum(['read', 'read_write', 'full']).optional(),
            isActive: z.boolean().optional()
        });

        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid rule update payload");
        }

        const rule = await DataSharingRuleModel.findByIdAndUpdate(
            req.params.id,
            { $set: parsed.data },
            { new: true }
        ).lean();

        if (!rule) throw notFound("Rule not found");
        res.json(rule);
    } catch (err) {
        next(err);
    }
});

dataSharingRouter.delete("/rules/:id", async (req, res, next) => {
    try {
        const rule = await DataSharingRuleModel.findByIdAndDelete(req.params.id);
        if (!rule) throw notFound("Rule not found");
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});
