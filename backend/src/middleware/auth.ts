import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { unauthorized, forbidden } from "../utils/httpError";
import { UserModel } from "../models/user";
import { RoleModel } from "../models/role";
import { UserRoleModel } from "../models/userRole";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { logger } from "../config/logger";
import { AccessControlService } from "../services/auth/AccessControlService";

export interface AuthUser {
  id: string;
  email: string;
  roleId?: string;
  isAdmin?: boolean;
  /** Hard-delete / elevated ops (aligned with PostcardCRM; defaults to isAdmin when using profile-based auth). */
  isSystemAdmin?: boolean;
  permissions?: string[];
  descendants?: string[]; // IDs of subordinates
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
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

    const { permissions, isAdmin } = await AccessControlService.getUserPermissions(user.id);

    // Populate descendants for "Own" scope checks
    // optimization: only if user has management capabilities?
    // for now, always fetch to be safe.
    const descendants = await AccessControlService.getDescendants(user.id);

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId?.toString(),
      isAdmin,
      isSystemAdmin: isAdmin,
      permissions,
      descendants,
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

  // Super Admins override all
  if (user.isAdmin) return true;

  const userPerms = user.permissions ?? [];
  return userPerms.includes(permission);
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
    // const source = getRequestSource(req); // helper not exported? it is in this file.

    if (!req.user) {
      return next(unauthorized());
    }

    if (hasAnyPermission(req.user, required)) {
      return next();
    }

    return next(forbidden("Insufficient permissions"));
  };
}

/**
 * Middleware to check scoped permissions.
 * Usage: requireResourcePermission("leads", "read", req => ({ regionId: req.params.regionId }))
 */
export function requireResourcePermission(
  resource: string,
  action: string,
  contextResolver: (req: Request) => Promise<any>
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(unauthorized());

      const context = await contextResolver(req);
      const allowed = await AccessControlService.hasPermission(req.user, resource, action, context);

      if (!allowed) {
        return next(forbidden("Insufficient permissions for this resource"));
      }
      return next();
    } catch (err) {
      next(err);
    }
  };
}
