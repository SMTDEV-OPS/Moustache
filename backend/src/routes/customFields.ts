import { Router, Request, Response } from "express";
import { CustomFieldModel } from "../models/customField";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

// All custom field operations require authentication
router.use(requireAuth);

// GET all active custom fields for a module (used by normal forms)
router.get("/module/:moduleName", async (req: Request, res: Response) => {
    try {
        const { moduleName } = req.params;
        const fields = await CustomFieldModel.find({
            module: moduleName,
            isActive: { $ne: false },
            is_active: { $ne: false },
        }).sort({ order: 1 });

        res.json(fields);
    } catch (error: any) {
        console.error("Error fetching custom fields:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// GET all custom fields (including inactive) for Admin UI
router.get(
    "/admin/module/:moduleName",
    requirePermissions([PERMISSIONS.SETTINGS.MANAGE]),
    async (req: Request, res: Response) => {
        try {
            const { moduleName } = req.params;
            const fields = await CustomFieldModel.find({ module: moduleName }).sort({ order: 1 });
            res.json(fields);
        } catch (error: any) {
            console.error("Error fetching custom fields for admin:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// CREATE a new custom field (Admin only)
router.post(
    "/",
    requirePermissions([PERMISSIONS.SETTINGS.MANAGE]),
    async (req: Request, res: Response) => {
        try {
        const newField = new CustomFieldModel(req.body);
        await newField.save();

        res.status(201).json(newField);
        } catch (error: any) {
            console.error("Error creating custom field:", error);
            if (error.code === 11000) {
                return res.status(400).json({ message: "A field with this name already exists for this module." });
            }
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// UPDATE a custom field (Admin only)
router.put(
    "/:id",
    requirePermissions([PERMISSIONS.SETTINGS.MANAGE]),
    async (req: Request, res: Response) => {
        try {
        // Keep legacy and new active flags in sync.
        // Some UI uses `isActive` while other consumers check `is_active`.
        if (typeof req.body.isActive === "boolean" && typeof req.body.is_active !== "boolean") {
            req.body.is_active = req.body.isActive;
        }
        if (typeof req.body.is_active === "boolean" && typeof req.body.isActive !== "boolean") {
            req.body.isActive = req.body.is_active;
        }

        const { id } = req.params;
        const updatedField = await CustomFieldModel.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedField) {
            return res.status(404).json({ message: "Custom field not found" });
        }

        res.json(updatedField);
        } catch (error: any) {
            console.error("Error updating custom field:", error);
            if (error.code === 11000) {
                return res.status(400).json({ message: "A field with this name already exists for this module." });
            }
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// DELETE a custom field (Soft Delete / Deactivate)
router.delete(
    "/:id",
    requirePermissions([PERMISSIONS.SETTINGS.MANAGE]),
    async (req: Request, res: Response) => {
        try {
        const { id } = req.params;
        // Soft delete is preferred over actual deletion to maintain data integrity
        const updatedField = await CustomFieldModel.findByIdAndUpdate(
            id,
            { isActive: false, is_active: false },
            { new: true }
        );

        if (!updatedField) {
            return res.status(404).json({ message: "Custom field not found" });
        }

        res.json({ message: "Custom field deactivated", field: updatedField });
        } catch (error: any) {
            console.error("Error deactivating custom field:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

// REORDER custom fields
router.post(
    "/reorder",
    requirePermissions([PERMISSIONS.SETTINGS.MANAGE]),
    async (req: Request, res: Response) => {
        try {
        const { orderedIds } = req.body; // Array of IDs in the new order

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ message: "orderedIds must be an array" });
        }

        const bulkOps = orderedIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { order: index },
            },
        }));

        if (bulkOps.length > 0) {
            await CustomFieldModel.bulkWrite(bulkOps);
        }

        res.json({ message: "Reordered successfully" });
        } catch (error: any) {
            console.error("Error reordering custom fields:", error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
);

export default router;
