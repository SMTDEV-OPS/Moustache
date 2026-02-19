import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

/**
 * Wrapper for async route handlers that automatically catches errors and logs them
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const requestId = req.requestId;
      const userId = req.user?.id;

      logger.error("Route handler error", {
        requestId,
        userId,
        method: req.method,
        path: req.originalUrl,
        body: req.body,
        query: req.query,
        params: req.params,
      }, error instanceof Error ? error : new Error(String(error)));

      next(error);
    });
  };
}

