/**
 * Structured Application Errors
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SANDBOX_ERROR"
  | "AGENT_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details ?? {},
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied for current role or workspace") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const msg = identifier
      ? `${resource} '${identifier}' not found`
      : `${resource} not found`;
    super(msg, "NOT_FOUND", 404, { resource, identifier });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "PRECONDITION_FAILED", 412, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests; please retry later") {
    super(message, "RATE_LIMITED", 429);
  }
}
