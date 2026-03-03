import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { UserModel } from "../models/user";
import { RoleModel } from "../models/role";
import { badRequest, notFound } from "../utils/httpError";

export const groupsRouter = Router();

groupsRouter.use(requireAuth, requirePermissions(["users.manage"]));

const baseGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  memberUserIds: z.array(z.string()).optional(),
  memberRoleIds: z.array(z.string()).optional(),
  includeSubordinates: z.boolean().optional(),
  subGroupIds: z.array(z.string()).optional(),
});

const createGroupSchema = baseGroupSchema;

const updateGroupSchema = baseGroupSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

const memberIdsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

const roleIdsSchema = z.object({
  roleIds: z.array(z.string().min(1)).min(1),
});

groupsRouter.get("/", async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const filter: Record<string, unknown> = {};
    if (typeof isActive === "string") {
      filter.isActive = isActive === "true";
    }
    const groups = await EmployeeGroupModel.find(filter).lean();
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

groupsRouter.get("/:id", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id).lean();
    if (!group) {
      throw notFound("Group not found");
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
});

groupsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid group payload");
    }

    const { name, description, isActive } = parsed.data;

    const existing = await EmployeeGroupModel.findOne({ name });
    if (existing) {
      throw badRequest("Group with this name already exists");
    }

    const group = await EmployeeGroupModel.create({
      name,
      description,
      memberUserIds: parsed.data.memberUserIds || [],
      memberRoleIds: parsed.data.memberRoleIds || [],
      includeSubordinates: parsed.data.includeSubordinates || false,
      subGroupIds: parsed.data.subGroupIds || [],
      isActive: isActive ?? true,
    });

    res.status(201).json(group.toObject());
  } catch (err) {
    next(err);
  }
});

groupsRouter.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid group update payload");
    }

    const update = parsed.data;

    const group = await EmployeeGroupModel.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();

    if (!group) {
      throw notFound("Group not found");
    }

    res.json(group);
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete("/:id", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    if ((group.memberUserIds?.length ?? 0) > 0) {
      throw badRequest("Cannot delete a group that still has members");
    }
    if ((group.roleIds?.length ?? 0) > 0) {
      throw badRequest("Cannot delete a group that is mapped to roles");
    }

    await group.deleteOne();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Group membership
groupsRouter.get("/:id/users", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    const userIds = group.memberUserIds ?? [];
    if (userIds.length === 0) {
      return res.json([]);
    }

    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

groupsRouter.post("/:id/users", async (req, res, next) => {
  try {
    const parsed = memberIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid add users payload");
    }

    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    const { userIds } = parsed.data;
    const users = await UserModel.find({ _id: { $in: userIds } }, { _id: 1 });
    const validIds = users.map((u) => u._id);
    if (validIds.length === 0) {
      throw badRequest("No valid users to add");
    }

    const current = new Set((group.memberUserIds ?? []).map((id) => id.toString()));
    for (const id of validIds) {
      current.add(id.toString());
    }
    group.memberUserIds = Array.from(current).map((id) => id) as any;
    await group.save();

    // Optionally update users.groupIds for quick lookup
    await UserModel.updateMany(
      { _id: { $in: validIds } },
      { $addToSet: { groupIds: group._id } }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete("/:id/users/:userId", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    group.memberUserIds = (group.memberUserIds ?? []).filter(
      (id) => id.toString() !== req.params.userId
    );
    await group.save();

    await UserModel.updateOne(
      { _id: req.params.userId },
      { $pull: { groupIds: group._id } }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Group–role mappings
groupsRouter.get("/:id/roles", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    const roleIds = group.roleIds ?? [];
    if (roleIds.length === 0) {
      return res.json([]);
    }

    const roles = await RoleModel.find({ _id: { $in: roleIds } }).lean();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

groupsRouter.post("/:id/roles", async (req, res, next) => {
  try {
    const parsed = roleIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid add roles payload");
    }

    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    const { roleIds } = parsed.data;
    const roles = await RoleModel.find({ _id: { $in: roleIds } }, { _id: 1 });
    const validIds = roles.map((r) => r._id);
    if (validIds.length === 0) {
      throw badRequest("No valid roles to add");
    }

    const current = new Set((group.roleIds ?? []).map((id) => id.toString()));
    for (const id of validIds) {
      current.add(id.toString());
    }
    group.roleIds = Array.from(current).map((id) => id) as any;
    await group.save();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete("/:id/roles/:roleId", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id);
    if (!group) {
      throw notFound("Group not found");
    }

    group.roleIds = (group.roleIds ?? []).filter(
      (id) => id.toString() !== req.params.roleId
    );
    await group.save();

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Calculate and preview all resolved members (users) for a group
groupsRouter.get("/:id/members/preview", async (req, res, next) => {
  try {
    const group = await EmployeeGroupModel.findById(req.params.id)
      .populate('memberUserIds', 'name email status')
      .populate('memberRoleIds', 'name')
      .populate('subGroupIds', 'name')
      .lean();

    if (!group) {
      throw notFound("Group not found");
    }

    // This is a naive preview implementation. In a real scenario, you would recursively 
    // resolve subGroupIds, memberRoleIds, and includeSubordinates to get the full list
    // of unique user IDs, and then fetch those users.

    // For now, returning the populated group data which the UI can render as "Direct Members"
    // and we will build the full resolver in the DataSharingService later.

    res.json(group);
  } catch (err) {
    next(err);
  }
});


