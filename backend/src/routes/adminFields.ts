import { Router, Request, Response, NextFunction } from "express";
import { CustomFieldModel, EntityType, CustomFieldType } from "../models/customField";
import { PipelineStageModel } from "../models/pipelineStage";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import mongoose from "mongoose";
import { logAudit } from "../utils/auditLog";

const router = Router();

// All admin field operations require authentication and admin/settings manage permission
router.use(requireAuth);
router.use(requirePermissions([PERMISSIONS.SETTINGS.MANAGE]));

/**
 * Utility: Generate slug from name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Validation Middleware for Custom Fields
 */
const validateFieldPayload = async (req: Request, res: Response, next: NextFunction) => {
    const { name, dataType, options, mandatory_at_stage_id, entity_type, slug } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Field 'name' is required." });
    }

    const typeArg = dataType || req.body.type; // support both
    if (!typeArg) {
        return res.status(400).json({ message: "Field 'dataType' is required." });
    }

    const validTypes: CustomFieldType[] = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN", "TEXTAREA", "MULTI_SELECT", "PHONE", "URL"];
    if (!validTypes.includes(typeArg)) {
        return res.status(400).json({ message: `Invalid 'dataType'. Must be one of: ${validTypes.join(", ")}` });
    }

    if ((typeArg === "DROPDOWN" || typeArg === "MULTI_SELECT") && (!options || !Array.isArray(options) || options.length === 0)) {
        return res.status(400).json({ message: `Field 'options' is required and must be a non-empty array for type ${typeArg}.` });
    }

    if (mandatory_at_stage_id) {
        if (!mongoose.isValidObjectId(mandatory_at_stage_id)) {
            return res.status(400).json({ message: "Invalid 'mandatory_at_stage_id' format." });
        }
        const stageExists = await PipelineStageModel.exists({ _id: mandatory_at_stage_id });
        if (!stageExists) {
            return res.status(404).json({ message: "Referenced PipelineStage not found." });
        }
    }

    // Slug generation or validation
    if (!slug) {
        req.body.slug = generateSlug(name);
    }

    // Set entity_type default
    if (!entity_type) {
        req.body.entity_type = "lead";
    }

    // Set standard properties
    req.body.dataType = typeArg;
    req.body.label = name; // UI uses label
    req.body.module = req.body.entity_type === 'lead' ? 'leads' : req.body.entity_type === 'contact' ? 'contacts' : 'accounts'; // legacy compat

    next();
};

/**
 * GET /api/admin/fields
 * List all fields for a given entity type, sorted by display_order
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const entity_type = (req.query.entity as string) || "lead";
        const includeInactive = req.query.include_inactive === "true";

        const fields = await CustomFieldModel.find({ entity_type })
            .sort({ display_order: 1, order: 1 });

        if (includeInactive) {
            res.json(fields);
            return;
        }

        // Some records may use legacy `isActive` while others use the newer `is_active`.
        // Treat a field as active only when BOTH flags are not explicitly false.
        const activeFields = fields.filter((f: any) => f.is_active !== false && f.isActive !== false);
        res.json(activeFields);
    } catch (error: any) {
        console.error("Error listing custom fields:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /api/admin/fields
 * Create a new custom field
 */
router.post("/", validateFieldPayload, async (req: Request, res: Response) => {
    try {
        // Enforce uniqueness for slug/name by entity_type before saving
        const existingField = await CustomFieldModel.findOne({
            entity_type: req.body.entity_type,
            $or: [{ name: req.body.name }, { slug: req.body.slug }]
        });

        if (existingField) {
            return res.status(400).json({ message: `A field with this name (${req.body.name}) or slug (${req.body.slug}) already exists for entity ${req.body.entity_type}.` });
        }

        // Determine max display order
        const maxOrderField = await CustomFieldModel.findOne({ entity_type: req.body.entity_type })
            .sort({ display_order: -1 })
            .select("display_order text");

        req.body.display_order = maxOrderField && maxOrderField.display_order !== undefined ? maxOrderField.display_order + 1 : 0;
        req.body.order = req.body.display_order; // keep legacy in sync

        const newField = new CustomFieldModel(req.body);
        await newField.save();

        logAudit("created", "field_definition", newField._id.toString(), null, { name: newField.name, slug: newField.slug }, req);
        res.status(201).json(newField);
    } catch (error: any) {
        console.error("Error creating custom field:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * PUT /api/admin/fields/reorder
 * Bulk update display orders
 * Body: { orderedIds: [{ id: "...", display_order: 1 }, ...] }
 */
router.put("/reorder", async (req: Request, res: Response) => {
    try {
        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ message: "orderedIds must be an array of objects containing id and display_order." });
        }

        const bulkOps = orderedIds.map((item: any) => ({
            updateOne: {
                filter: { _id: item.id },
                update: {
                    $set: {
                        display_order: item.display_order,
                        order: item.display_order // sync legacy
                    }
                },
            },
        }));

        if (bulkOps.length > 0) {
            await CustomFieldModel.bulkWrite(bulkOps);
        }

        res.json({ message: "Fields reordered successfully" });
    } catch (error: any) {
        console.error("Error reordering custom fields:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * PUT /api/admin/fields/:id
 * Update a field
 */
router.put("/:id", validateFieldPayload, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent changing slug during update to avoid data loss on Leads
        delete req.body.slug;
        delete req.body.entity_type; // Prevent moving entities

        // Keep legacy and new active flags in sync.
        if (typeof req.body.isActive === "boolean" && typeof req.body.is_active !== "boolean") {
            req.body.is_active = req.body.isActive;
        }
        if (typeof req.body.is_active === "boolean" && typeof req.body.isActive !== "boolean") {
            req.body.isActive = req.body.is_active;
        }

        const existingField = await CustomFieldModel.findById(id).lean();
        const updatedField = await CustomFieldModel.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedField) {
            return res.status(404).json({ message: "Field not found" });
        }

        logAudit("updated", "field_definition", id, existingField || {}, updatedField.toObject(), req);
        res.json(updatedField);
    } catch (error: any) {
        console.error("Error updating custom field:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * DELETE /api/admin/fields/:id
 * Soft delete field
 */
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const beforeDelete = await CustomFieldModel.findById(id).lean();
        // Perform soft delete
        const deletedField = await CustomFieldModel.findByIdAndUpdate(
            id,
            { is_active: false, isActive: false },
            { new: true }
        );

        if (!deletedField) {
            return res.status(404).json({ message: "Field not found" });
        }

        logAudit("deleted", "field_definition", id, beforeDelete || {}, { is_active: false }, req);
        res.json({ message: "Field deleted successfully", field: deletedField });
    } catch (error: any) {
        console.error("Error soft deleting custom field:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

export default router;
