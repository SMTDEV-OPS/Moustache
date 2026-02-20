import { Router } from "express";
import { z } from "zod";
import { RoleModel } from "../models/role";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";

export const rolesRouter = Router();

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()), // Resource:Action:Scope
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

rolesRouter.use(requireAuth);
rolesRouter.use(requirePermissions([PERMISSIONS.ROLES.MANAGE]));

// List all roles
rolesRouter.get("/", async (req, res, next) => {
  try {
    const roles = await RoleModel.find().lean();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// Get single role
rolesRouter.get("/:id", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id).lean();
    if (!role) {
      throw notFound("Role not found");
    }
    res.json(role);
  } catch (err) {
    next(err);
  }
});

// Create role
rolesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("Role Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      throw badRequest(`Invalid role payload: ${parsed.error.issues.map(i => i.message).join(", ")}`);
    }

    const { name, description, permissions } = parsed.data;

    const existing = await RoleModel.findOne({ name });
    if (existing) {
      throw badRequest("Role with this name already exists");
    }

    const role = await RoleModel.create({
      name,
      description,
      permissions,
      // Default legacy fields to empty/compatible
      memberPermissions: [],
      ownerPermissions: [],
    });

    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
});

// Update role
rolesRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("Role Update Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      throw badRequest(`Invalid update payload: ${parsed.error.issues.map(i => i.message).join(", ")}`);
    }

    const role = await RoleModel.findByIdAndUpdate(
      req.params.id,
      { $set: parsed.data },
      { new: true }
    ).lean();

    if (!role) {
      throw notFound("Role not found");
    }

    res.json(role);
  } catch (err) {
    next(err);
  }
});

// Delete role
rolesRouter.delete("/:id", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    if (role.isSystemRole) {
      throw badRequest("Cannot delete system role");
    }

    await RoleModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
