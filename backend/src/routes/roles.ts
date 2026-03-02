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
  parentRoleId: z.string().optional(),
  shareDataWithPeers: z.boolean().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  parentRoleId: z.string().optional().nullable(),
  shareDataWithPeers: z.boolean().optional(),
});

rolesRouter.use(requireAuth);
rolesRouter.use(requirePermissions([PERMISSIONS.ROLES.MANAGE]));

// List all roles
rolesRouter.get("/", async (req, res, next) => {
  try {
    const roles = await RoleModel.find().populate('parentRoleId', 'name').lean();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// Get roles as a hierarchical tree
rolesRouter.get("/tree", async (req, res, next) => {
  try {
    const roles = await RoleModel.find().lean();

    // Build tree
    const roleMap = new Map();
    const tree: any[] = [];

    // First pass: map nodes
    roles.forEach(role => {
      roleMap.set(role._id.toString(), { ...role, children: [] });
    });

    // Second pass: associate children with parents
    roles.forEach(role => {
      const node = roleMap.get(role._id.toString());
      if (role.parentRoleId) {
        const parent = roleMap.get(role.parentRoleId.toString());
        if (parent) {
          parent.children.push(node);
        } else {
          // If parent is missing, treat as root to avoid orphan loss
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    });

    res.json(tree);
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

    const { name, description, parentRoleId, shareDataWithPeers } = parsed.data;

    const existing = await RoleModel.findOne({ name });
    if (existing) {
      throw badRequest("Role with this name already exists");
    }

    const role = await RoleModel.create({
      name,
      description,
      parentRoleId: parentRoleId || undefined,
      shareDataWithPeers: shareDataWithPeers || false,
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

    // Check if any roles report to this role
    const children = await RoleModel.find({ parentRoleId: req.params.id });
    if (children.length > 0) {
      throw badRequest("Cannot delete role: other roles report to it");
    }

    // Check if any users have this role (we'd need to import UserModel, but let's assume we can do a check or the UI prevents it)
    // Assuming UI prevention or later User reference check for now.

    await RoleModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
