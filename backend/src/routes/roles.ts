import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { RoleModel } from "../models/role";
import { UserModel } from "../models/user";
import { UserRoleModel } from "../models/userRole";
import { badRequest, notFound } from "../utils/httpError";
import { logger } from "../config/logger";

export const rolesRouter = Router();

rolesRouter.use(requireAuth, requirePermissions(["users.manage"]));

const baseRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  memberPermissions: z.array(z.string()).min(1), // Permissions for group members (required)
  ownerPermissions: z.array(z.string()).min(1), // Permissions for role owners (required)
  ownerUserId: z.string().optional(), // Legacy - kept for backward compatibility
  ownerUserIds: z.array(z.string()).optional(), // Multiple owners (SPOCs)
  permissions: z.array(z.string()).optional(), // Legacy field - kept for backward compatibility
  isSystemRole: z.boolean().optional(),
});

const createRoleSchema = baseRoleSchema;

const updateRoleSchema = baseRoleSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

const assignUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

rolesRouter.get("/", async (req, res, next) => {
  try {
    const roles = await RoleModel.find().lean();
    // Serialize ObjectIds to strings for proper JSON response
    // Ensure ownerPermissions is always included (even if empty array)
    const serializedRoles = roles.map((role) => ({
      ...role,
      _id: role._id.toString(),
      ownerUserId: role.ownerUserId?.toString(),
      ownerUserIds: role.ownerUserIds?.map((id) => id.toString()),
      ownerPermissions: role.ownerPermissions || [],
      memberPermissions: role.memberPermissions || [],
    }));
    
    logger.debug("Returning roles list", {
      requestId: req.requestId,
      roleCount: serializedRoles.length,
    });
    
    res.json(serializedRoles);
  } catch (err) {
    next(err);
  }
});

rolesRouter.get("/:id", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id).lean();
    if (!role) {
      throw notFound("Role not found");
    }
    // Serialize ObjectIds to strings for proper JSON response
    // Ensure ownerPermissions is always included (even if empty array)
    const serializedRole = {
      ...role,
      _id: role._id.toString(),
      ownerUserId: role.ownerUserId?.toString(),
      ownerUserIds: role.ownerUserIds?.map((id) => id.toString()),
      ownerPermissions: role.ownerPermissions || [],
      memberPermissions: role.memberPermissions || [],
    };
    
    logger.debug("Returning role", {
      requestId: req.requestId,
      roleId: serializedRole._id,
      roleName: serializedRole.name,
      ownerPermissionsCount: serializedRole.ownerPermissions.length,
      memberPermissionsCount: serializedRole.memberPermissions.length,
    });
    
    res.json(serializedRole);
  } catch (err) {
    next(err);
  }
});

rolesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid role payload");
    }

    const { name, description, memberPermissions, ownerPermissions, ownerUserId, ownerUserIds, permissions, isSystemRole } =
      parsed.data;

    // Validate owner user IDs if provided
    if (ownerUserId) {
      const owner = await UserModel.findById(ownerUserId);
      if (!owner) {
        throw badRequest("Invalid ownerUserId");
      }
    }

    if (ownerUserIds && ownerUserIds.length > 0) {
      const owners = await UserModel.find({ _id: { $in: ownerUserIds } });
      if (owners.length !== ownerUserIds.length) {
        throw badRequest("One or more ownerUserIds are invalid");
      }
    }

    const existing = await RoleModel.findOne({ name });
    if (existing) {
      throw badRequest("Role with this name already exists");
    }

    // Convert string IDs to ObjectIds for ownerUserIds
    const ownerUserIdsArray = ownerUserIds && ownerUserIds.length > 0
      ? ownerUserIds.map((id) => new Types.ObjectId(id))
      : undefined;

    const role = await RoleModel.create({
      name,
      description,
      memberPermissions: memberPermissions ?? [],
      ownerPermissions: ownerPermissions ?? [],
      ownerUserId: ownerUserId ? new Types.ObjectId(ownerUserId) : undefined,
      ownerUserIds: ownerUserIdsArray,
      permissions: permissions, // Legacy field - kept for backward compatibility
      isSystemRole: isSystemRole ?? false,
    });

    // Serialize ObjectIds to strings for proper JSON response
    // Ensure memberPermissions and ownerPermissions are always included (even if empty array)
    const roleObj = role.toObject();
    const serializedRole = {
      ...roleObj,
      _id: roleObj._id.toString(),
      ownerUserId: roleObj.ownerUserId?.toString(),
      ownerUserIds: roleObj.ownerUserIds?.map((id: Types.ObjectId) => id.toString()),
      memberPermissions: roleObj.memberPermissions || [],
      ownerPermissions: roleObj.ownerPermissions || [],
    };
    res.status(201).json(serializedRole);
  } catch (err) {
    next(err);
  }
});

rolesRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid role update payload");
    }

    const update = parsed.data;

    // Validate owner user IDs if provided
    if (update.ownerUserId) {
      const owner = await UserModel.findById(update.ownerUserId);
      if (!owner) {
        throw badRequest("Invalid ownerUserId");
      }
    }

    if (update.ownerUserIds && update.ownerUserIds.length > 0) {
      const owners = await UserModel.find({ _id: { $in: update.ownerUserIds } });
      if (owners.length !== update.ownerUserIds.length) {
        throw badRequest("One or more ownerUserIds are invalid");
      }
    }

    // Prepare update object with converted ObjectIds
    const updatePayload: any = { ...update };
    if (update.ownerUserIds !== undefined) {
      updatePayload.ownerUserIds = update.ownerUserIds.length > 0
        ? update.ownerUserIds.map((id: string) => new Types.ObjectId(id))
        : [];
    }
    if (update.ownerUserId !== undefined) {
      updatePayload.ownerUserId = update.ownerUserId
        ? new Types.ObjectId(update.ownerUserId)
        : undefined;
    }
    if (update.memberPermissions !== undefined) {
      updatePayload.memberPermissions = update.memberPermissions.length > 0
        ? update.memberPermissions
        : [];
    }
    if (update.ownerPermissions !== undefined) {
      updatePayload.ownerPermissions = update.ownerPermissions.length > 0
        ? update.ownerPermissions
        : [];
    }

    const role = await RoleModel.findByIdAndUpdate(
      req.params.id,
      { $set: updatePayload },
      { new: true }
    ).lean();

    if (!role) {
      throw notFound("Role not found");
    }

    // Serialize ObjectIds to strings for proper JSON response
    // Ensure memberPermissions and ownerPermissions are always included (even if empty array)
    const serializedRole = {
      ...role,
      _id: role._id.toString(),
      ownerUserId: role.ownerUserId?.toString(),
      ownerUserIds: role.ownerUserIds?.map((id) => id.toString()),
      memberPermissions: role.memberPermissions || [],
      ownerPermissions: role.ownerPermissions || [],
    };
    res.json(serializedRole);
  } catch (err) {
    next(err);
  }
});

rolesRouter.delete("/:id", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    if (role.isSystemRole) {
      throw badRequest("Cannot delete system role");
    }

    const assignmentsCount = await UserRoleModel.countDocuments({
      roleId: role._id,
    });
    const usersWithPrimaryRole = await UserModel.countDocuments({
      roleId: role._id,
    });

    if (assignmentsCount > 0 || usersWithPrimaryRole > 0) {
      throw badRequest("Cannot delete role that is assigned to users");
    }

    await role.deleteOne();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

rolesRouter.post("/:id/users", async (req, res, next) => {
  try {
    const parsed = assignUsersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid assign users payload");
    }

    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    const { userIds } = parsed.data;

    const users = await UserModel.find({ _id: { $in: userIds } }, { _id: 1 });
    const validUserIds = users.map((u) => u._id);

    if (validUserIds.length === 0) {
      throw badRequest("No valid users to assign");
    }

    const assignedById = req.user ? new Types.ObjectId(req.user.id) : undefined;

    const docs = validUserIds.map((userId) => ({
      userId,
      roleId: role._id,
      assignedBy: assignedById,
      assignedAt: new Date(),
    }));

    await UserRoleModel.bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { userId: doc.userId, roleId: doc.roleId },
          update: { $setOnInsert: doc } as any,
          upsert: true,
        },
      })) as any
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

rolesRouter.delete("/:id/users/:userId", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    await UserRoleModel.findOneAndDelete({
      roleId: role._id,
      userId: req.params.userId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

rolesRouter.get("/:id/users", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    const assignments = await UserRoleModel.find({ roleId: role._id }).lean();
    const userIds = assignments.map((a) => a.userId);

    if (userIds.length === 0) {
      return res.json([]);
    }

    const users = await UserModel.find({ _id: { $in: userIds } }).lean();

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get role owners (SPOCs)
rolesRouter.get("/:id/owners", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    const ownerIds: Types.ObjectId[] = [];
    
    // Collect from both legacy ownerUserId and new ownerUserIds array
    if (role.ownerUserId) {
      ownerIds.push(role.ownerUserId);
    }
    if (role.ownerUserIds && role.ownerUserIds.length > 0) {
      for (const id of role.ownerUserIds) {
        if (id && !ownerIds.some(existing => existing.toString() === id.toString())) {
          ownerIds.push(id);
        }
      }
    }

    if (ownerIds.length === 0) {
      return res.json([]);
    }

    const owners = await UserModel.find({ _id: { $in: ownerIds } }).lean();
    res.json(owners);
  } catch (err) {
    next(err);
  }
});

// Add role owners (SPOCs)
const addOwnersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

rolesRouter.post("/:id/owners", async (req, res, next) => {
  try {
    const parsed = addOwnersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid add owners payload");
    }

    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    const { userIds } = parsed.data;
    const users = await UserModel.find({ _id: { $in: userIds } }, { _id: 1 });
    const validUserIds = users.map((u) => u._id);

    if (validUserIds.length === 0) {
      throw badRequest("No valid users to add as owners");
    }

    // Initialize ownerUserIds if it doesn't exist
    if (!role.ownerUserIds) {
      role.ownerUserIds = [];
    }

    // Add new owner IDs that aren't already present
    const existingIds = new Set(
      role.ownerUserIds.map((id) => id.toString())
    );
    
    for (const userId of validUserIds) {
      const userIdStr = userId.toString();
      if (!existingIds.has(userIdStr)) {
        role.ownerUserIds.push(userId);
      }
    }

    await role.save();

    // Fetch and return updated owners
    const owners = await UserModel.find({ _id: { $in: role.ownerUserIds } }).lean();
    res.json(owners);
  } catch (err) {
    next(err);
  }
});

// Remove role owner (SPOC)
rolesRouter.delete("/:id/owners/:userId", async (req, res, next) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw notFound("Role not found");
    }

    const userIdToRemove = req.params.userId;

    // Remove from ownerUserIds array
    if (role.ownerUserIds && role.ownerUserIds.length > 0) {
      role.ownerUserIds = role.ownerUserIds.filter(
        (id) => id.toString() !== userIdToRemove
      );
    }

    // Also clear legacy ownerUserId if it matches
    if (role.ownerUserId && role.ownerUserId.toString() === userIdToRemove) {
      role.ownerUserId = undefined;
    }

    await role.save();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


