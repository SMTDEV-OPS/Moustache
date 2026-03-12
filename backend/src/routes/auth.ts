import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserModel } from "../models/user";
import { badRequest, unauthorized } from "../utils/httpError";
import { signJwt, requireAuth } from "../middleware/auth";
import { logger } from "../config/logger";
import { AccessControlService } from "../services/auth/AccessControlService";
import { logAudit } from "../utils/auditLog";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("Login attempt with invalid payload", {
        requestId: req.requestId,
        errors: parsed.error.errors,
      });
      throw badRequest("Invalid login payload");
    }
    const { email, password } = parsed.data;

    const user = await UserModel.findOne({ email });
    if (!user) {
      logger.warn("Login attempt with non-existent email", {
        requestId: req.requestId,
        email,
      });
      throw unauthorized("Invalid credentials");
    }

    if (user.status !== "ACTIVE") {
      logger.warn("Login attempt for inactive user", {
        requestId: req.requestId,
        email,
        status: user.status,
      });
      throw unauthorized("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logger.warn("Login attempt with incorrect password", {
        requestId: req.requestId,
        email,
      });
      throw unauthorized("Invalid credentials");
    }

    user.lastLoginAt = new Date();
    user.isOnline = true;
    user.lastHeartbeatAt = new Date();
    await user.save();

    const token = signJwt({
      id: user.id,
      email: user.email,
      roleId: user.roleId?.toString(),
    });

    logger.info("User logged in successfully", {
      requestId: req.requestId,
      email,
      userId: user.id,
    });

    logAudit("login", "user", user.id, null, { email: user.email }, req, { userId: user.id });

    const { permissions, isAdmin } = await AccessControlService.getUserPermissions(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        permissions: permissions,
        isAdmin: isAdmin,
        reportsTo: user.reportsTo,
        hierarchyPath: user.hierarchyPath,
        pfp: (user as any).pfp, // in case pfp exists
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// Heartbeat to keep user online status updated
authRouter.post("/heartbeat", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw unauthorized();
    }

    await UserModel.findByIdAndUpdate(req.user.id, {
      isOnline: true,
      lastHeartbeatAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Logout endpoint to set user offline
authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw unauthorized();
    }

    await UserModel.findByIdAndUpdate(req.user.id, {
      isOnline: false,
    });

    logAudit("logout", "user", req.user.id, null, null, req);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});



