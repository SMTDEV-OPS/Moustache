import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { unauthorized, forbidden } from "../utils/httpError";
import { UserModel } from "../models/user";
import { RoleModel } from "../models/role";
import { UserRoleModel } from "../models/userRole";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { logger } from "../config/logger";

export interface AuthUser {
  id: string;
  email: string;
  roleId?: string;
  isAdmin?: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser & { permissions?: string[]; isAdmin?: boolean };
  }
}

export function signJwt(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

/**
 * Extract request source information (IP, user agent, referer)
 */
function getRequestSource(req: Request) {
  return {
    ip: req.ip || req.socket.remoteAddress || req.headers["x-forwarded-for"] || "unknown",
    userAgent: req.get("user-agent") || "unknown",
    referer: req.get("referer") || req.get("referrer") || undefined,
    origin: req.get("origin") || undefined,
  };
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const requestId = req.requestId;
  const authHeader = req.headers.authorization;
  const source = getRequestSource(req);

  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  } else if (req.method === "GET" && req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    logger.warn("Authentication failed: missing or invalid auth token", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      ...source,
    });
    return next(unauthorized());
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      roleId?: string;
    };

    const user = await UserModel.findById(decoded.sub);
    if (!user || user.status !== "ACTIVE") {
      logger.warn("Authentication failed: user not found or inactive", {
        requestId,
        userId: decoded.sub,
        email: decoded.email,
        userStatus: user?.status,
        method: req.method,
        path: req.originalUrl,
        ...source,
      });
      return next(unauthorized());
    }

    let permissions: string[] | undefined;
    let isAdmin = false;

    const explicitAssignments = await UserRoleModel.find({
      userId: user._id,
    }).lean();

    const explicitRoleIds = explicitAssignments.map((a) => a.roleId);

    // Roles coming from groups
    const groups = await EmployeeGroupModel.find({
      memberUserIds: user._id,
      isActive: true,
    }).lean();

    const groupRoleIds = groups.flatMap((g) => g.roleIds ?? []);

    // Roles where user is an owner (SPOC) - they get ownerPermissions
    const ownedRoles = await RoleModel.find({
      $or: [
        { ownerUserId: user._id },
        { ownerUserIds: user._id },
      ],
    }).lean();

    const ownerRoleIds = ownedRoles.map((r) => r._id);

    let roleIds = [...explicitRoleIds, ...groupRoleIds];

    // Fallback to legacy single roleId on user / token
    if (roleIds.length === 0) {
      const fallbackRoleId = user.roleId ?? decoded.roleId;
      if (fallbackRoleId) {
        roleIds = [fallbackRoleId as any];
      }
    }

    const permsSet = new Set<string>();

    // Process regular roles (from assignments and groups)
    // Group members get memberPermissions from roles
    if (roleIds.length > 0) {
      const uniqueIds = Array.from(new Set(roleIds.map((id) => id.toString())));
      const roles = await RoleModel.find({ _id: { $in: uniqueIds } }).lean();

      for (const role of roles) {
        // Use memberPermissions if available, fallback to legacy permissions field
        const memberPerms = role.memberPermissions && role.memberPermissions.length > 0
          ? role.memberPermissions
          : role.permissions ?? []; // Fallback to legacy permissions

        for (const p of memberPerms) {
          permsSet.add(p);
        }
        // Check for admin role - case-insensitive and also check isSystemRole
        if (role.name?.toLowerCase() === "admin" || role.isSystemRole) {
          isAdmin = true;
        }
      }
    }

    // Process owner permissions (from roles where user is an owner/SPOC)
    // Role owners get ownerPermissions
    for (const role of ownedRoles) {
      const ownerPerms = role.ownerPermissions && role.ownerPermissions.length > 0
        ? role.ownerPermissions
        : []; // No fallback - owners must have explicit ownerPermissions

      for (const p of ownerPerms) {
        permsSet.add(p);
      }

      // Check for admin role - case-insensitive and also check isSystemRole
      if (role.name?.toLowerCase() === "admin" || role.isSystemRole) {
        isAdmin = true;
      }
    }

    if (permsSet.size > 0) {
      permissions = Array.from(permsSet);
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId?.toString(),
      isAdmin,
      permissions,
    };

    logger.debug("User authenticated successfully", {
      requestId,
      userId: user.id,
      email: user.email,
      isAdmin,
      permissionCount: permissions?.length ?? 0,
      ...source,
    });

    return next();
  } catch (error) {
    const source = getRequestSource(req);

    // Check if it's a token expiration error
    if (error instanceof Error && error.name === "TokenExpiredError") {
      const expiredError = error as { expiredAt?: Date };
      logger.warn("Authentication failed: token expired", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        expiredAt: expiredError.expiredAt,
        ...source,
      });
      const httpError = unauthorized("Token expired");
      httpError.code = "TOKEN_EXPIRED";
      return next(httpError);
    }

    // Check if it's a token verification error (invalid token, malformed, etc.)
    if (error instanceof Error && error.name === "JsonWebTokenError") {
      logger.warn("Authentication failed: invalid token", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        errorName: error.name,
        errorMessage: error.message,
        ...source,
      });
      const httpError = unauthorized("Invalid token");
      httpError.code = "INVALID_TOKEN";
      return next(httpError);
    }

    // Other errors
    logger.error("Authentication failed: token verification error", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      ...source,
    }, error instanceof Error ? error : new Error(String(error)));
    return next(unauthorized());
  }
}

export function hasPermission(
  user: (AuthUser & { permissions?: string[]; isAdmin?: boolean }) | undefined,
  permission: string
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;

  const userPerms = user.permissions ?? [];
  if (userPerms.includes(permission)) {
    return true;
  }

  // Special-case: `leads.manage` acts as a super-permission for all `leads.*` permissions.
  if (
    permission.startsWith("leads.") &&
    userPerms.includes("leads.manage")
  ) {
    return true;
  }

  // Special-case: `tickets.manage` acts as a super-permission for all `tickets.*` permissions.
  if (
    permission.startsWith("tickets.") &&
    userPerms.includes("tickets.manage")
  ) {
    return true;
  }

  return false;
}

export function hasAnyPermission(
  user: (AuthUser & { permissions?: string[]; isAdmin?: boolean }) | undefined,
  required: string[]
): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return required.some((perm) => hasPermission(user, perm));
}

export function requirePermissions(required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const requestId = req.requestId;
    const source = getRequestSource(req);

    if (!req.user) {
      logger.warn("Permission check failed: user not authenticated", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        requiredPermissions: required,
        ...source,
      });
      return next(unauthorized());
    }

    if (req.user.isAdmin) {
      return next();
    }

    const missing = required.filter((p) => !hasPermission(req.user, p));
    if (missing.length > 0) {
      logger.warn("Permission check failed: insufficient permissions", {
        requestId,
        userId: req.user.id,
        method: req.method,
        path: req.originalUrl,
        requiredPermissions: required,
        missingPermissions: missing,
        userPermissions: req.user.permissions,
        ...source,
      });
      return next(forbidden("Insufficient permissions"));
    }
    return next();
  };
}

export function requireAnyPermission(required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const requestId = req.requestId;
    const source = getRequestSource(req);

    if (!req.user) {
      logger.warn("Permission check failed: user not authenticated", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        requiredPermissions: required,
        ...source,
      });
      return next(unauthorized());
    }

    if (hasAnyPermission(req.user, required)) {
      return next();
    }

    logger.warn("Permission check failed: insufficient permissions", {
      requestId,
      userId: req.user.id,
      method: req.method,
      path: req.originalUrl,
      requiredPermissions: required,
      userPermissions: req.user.permissions,
      ...source,
    });
    return next(forbidden("Insufficient permissions"));
  };
}
