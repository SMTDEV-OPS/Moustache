export class HttpError extends Error {
  status: number;
  code?: string;
  /** Optional machine-readable context (e.g. existing lead id) for clients */
  details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, code?: string): HttpError {
  return new HttpError(400, message, code ?? "BAD_REQUEST");
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}

export function notFound(message = "Not Found"): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

/** Business rule conflict (e.g. duplicate active lead). Prefer over generic 500. */
export function conflict(
  message: string,
  details?: Record<string, unknown>
): HttpError {
  return new HttpError(409, message, "CONFLICT", details);
}

export function internalError(message = "Internal Server Error"): HttpError {
  return new HttpError(500, message, "INTERNAL_ERROR");
}



