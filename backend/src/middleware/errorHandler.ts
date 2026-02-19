import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { logger } from "../config/logger";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  const requestId = req.requestId;
  const userId = req.user?.id;

  if (err instanceof HttpError) {
    logger.error("HTTP error occurred", {
      requestId,
      userId,
      method: req.method,
      path: req.originalUrl,
      status: err.status,
      code: err.code,
      message: err.message,
    }, err);
    
    return res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  const message =
    err instanceof Error ? err.message : "Unexpected error occurred";
  const error = err instanceof Error ? err : new Error(String(err));
  
  logger.error("Unhandled error occurred", {
    requestId,
    userId,
    method: req.method,
    path: req.originalUrl,
    body: req.body,
    query: req.query,
    params: req.params,
  }, error);

  return res.status(500).json({
    error: {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
}



