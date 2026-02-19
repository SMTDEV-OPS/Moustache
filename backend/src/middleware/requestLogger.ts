import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../config/logger";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Generate unique request ID
  const requestId = randomUUID();
  req.requestId = requestId;

  const startTime = Date.now();
  const userId = (req.user as { id?: string })?.id;

  // Log incoming request
  logger.info("Incoming request", {
    requestId,
    userId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? "error" : "info";
    const logMessage = logLevel === "error" ? "Request completed with error" : "Request completed";

    logger[logLevel](logMessage, {
      requestId,
      userId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}

