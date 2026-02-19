import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserModel } from "../models/user";
import { UserRoleModel } from "../models/userRole";
import { RoleModel } from "../models/role";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/httpError";

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  teamType: z.string(),
  regions: z.array(z.string()).optional(),
  roleId: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  teamType: z.string().optional(),
  regions: z.array(z.string()).optional(),
  roleId: z.string().optional(),
  password: z.string().min(6).optional(),
});

usersRouter.use(requireAuth);
usersRouter.use(requirePermissions(["users.manage"]));

usersRouter.get("/", async (req, res, next) => {
  try {
    const { teamType, regionId, status } = req.query;
    const filter: Record<string, unknown> = {};
    if (teamType) filter.teamType = teamType;
    if (status) filter.status = status;
    if (regionId) filter.regions = regionId;

    const users = await UserModel.find(filter).lean();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.params.id).lean();
    if (!user) {
      throw notFound("User not found");
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id/roles", async (req, res, next) => {
  try {
    if (!req.user) {
      throw unauthorized();
    }

    const isSelf = req.user.id === req.params.id;
    const hasManageUsers = req.user.permissions?.includes("users.manage");

    if (!isSelf && !hasManageUsers) {
      throw forbidden("Not allowed to view roles for this user");
    }

    const assignments = await UserRoleModel.find({
      userId: req.params.id,
    }).lean();
    const roleIds = assignments.map((a) => a.roleId);

    if (roleIds.length === 0) {
      return res.json([]);
    }

    const roles = await RoleModel.find({ _id: { $in: roleIds } }).lean();

    res.json(roles);
  } catch (err) {
    next(err);
  }
});

usersRouter.post(
  "/",
  requirePermissions(["users.manage"]),
  async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid user payload");
      }
      const { name, email, phone, password, teamType, regions, roleId } =
        parsed.data;

      const existing = await UserModel.findOne({ email });
      if (existing) {
        throw badRequest("User with this email already exists");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await UserModel.create({
        name,
        email,
        phone,
        teamType,
        regions,
        roleId,
        passwordHash,
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        teamType: user.teamType,
        roleId: user.roleId,
      });
    } catch (err) {
      next(err);
    }
  }
);

usersRouter.patch(
  "/:id",
  requirePermissions(["users.manage"]),
  async (req, res, next) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid update payload");
      }
      const update: Record<string, unknown> = { ...parsed.data };

      if (parsed.data.password) {
        update.passwordHash = await bcrypt.hash(parsed.data.password, 10);
        delete update.password;
      }

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      ).lean();

      if (!user) {
        throw notFound("User not found");
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);



