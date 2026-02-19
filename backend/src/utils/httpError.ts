export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
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

export function internalError(message = "Internal Server Error"): HttpError {
  return new HttpError(500, message, "INTERNAL_ERROR");
}



