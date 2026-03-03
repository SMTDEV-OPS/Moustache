import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserModel } from "../models/user";
import { UserRoleModel } from "../models/userRole";
import { RoleModel } from "../models/role";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/httpError";
import { AccessControlService } from "../services/auth/AccessControlService";
import { PERMISSIONS } from "../constants/permissions";

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullish(),
  password: z.string().min(6),
  regions: z.array(z.string()).nullish(),
  roleId: z.string().nullish(),
  reportsTo: z.string().nullish(), // ID of the manager
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  regions: z.array(z.string()).optional(),
  roleId: z.string().optional(),
  password: z.string().min(6).optional(),
  reportsTo: z.string().optional().nullable(),
});

usersRouter.use(requireAuth);


// Get entire user hierarchy
usersRouter.get("/hierarchy", async (req, res, next) => {
  try {
    // Fetch all active users
    const users = await UserModel.find({ status: "ACTIVE" })
      .lean();

    // Construct tree in memory? Or just return flat list with reportsTo?
    // Returning flat list is easier for frontend to build tree.
    res.json(users);
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/", async (req, res, next) => {
  try {
    const { status, regionId } = req.query;
    const filter: Record<string, unknown> = {};
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
    const hasManageUsers = req.user.permissions?.includes(PERMISSIONS.USERS.MANAGE);

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
  requirePermissions([PERMISSIONS.USERS.MANAGE]),
  async (req, res, next) => {
    try {
      console.log("Users Create Route Hit - Body:", JSON.stringify(req.body));
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        console.error("User Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
        throw badRequest(`VALIDATION FAILED: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ")}`);
      }
      const { name, email, phone, regions, roleId, password, reportsTo } =
        parsed.data;

      const existing = await UserModel.findOne({ email });
      if (existing) {
        throw badRequest("User with this email already exists");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Create user first
      const user = await UserModel.create({
        name,
        email,
        phone,
        regions,
        roleId,
        passwordHash,
        reportsTo,
      });

      // If reportsTo is set, build hierarchy
      if (reportsTo) {
        await AccessControlService.rebuildHierarchy(user.id);
        // re-fetch to get updated path
        const updated = await UserModel.findById(user.id);
        if (updated) Object.assign(user, updated);
      }

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        reportsTo: user.reportsTo,
        hierarchyPath: user.hierarchyPath,
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
        console.error("User Update Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
        throw badRequest(`Invalid update payload: ${parsed.error.issues.map(i => i.message).join(", ")}`);
      }
      const update: Record<string, unknown> = { ...parsed.data };

      if (parsed.data.password) {
        update.passwordHash = await bcrypt.hash(parsed.data.password, 10);
        delete update.password;
      }

      // Handle reportsTo change specifically
      const oldUser = await UserModel.findById(req.params.id);

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true }
      ).lean();

      if (!user) {
        throw notFound("User not found");
      }

      // If reportsTo changed, rebuild hierarchy
      if (
        oldUser &&
        parsed.data.reportsTo !== undefined &&
        String(oldUser.reportsTo) !== String(parsed.data.reportsTo)
      ) {
        await AccessControlService.rebuildHierarchy(user._id.toString());
      }

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);



