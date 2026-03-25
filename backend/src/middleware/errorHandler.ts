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
    const logDetails = {
      requestId,
      userId,
      method: req.method,
      path: req.originalUrl,
      status: err.status,
      code: err.code,
      message: err.message,
    };

    if (err.status === 401 || err.status === 403) {
      // For expected auth errors, a warning without a stack trace is sufficient
      logger.warn("HTTP auth error occurred", logDetails);
    } else if (err.status === 409) {
      logger.warn("HTTP conflict", logDetails);
    } else {
      // For other client/server errors, log as error with stack trace if appropriate
      logger.error("HTTP error occurred", logDetails, err);
    }

    return res.status(err.status).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err.details && Object.keys(err.details).length > 0
          ? { details: err.details }
          : {}),
      },
    });
  }

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

  // Expose Error.message so API clients (CRM UI) can show validation / business failures.
  // Unexpected errors should still throw Error with a safe, user-facing message.
  const clientMessage =
    err instanceof Error && typeof err.message === "string" && err.message.trim() !== ""
      ? err.message
      : "Internal server error";

  return res.status(500).json({
    error: {
      message: clientMessage,
      code: "INTERNAL_ERROR",
    },
  });
}



