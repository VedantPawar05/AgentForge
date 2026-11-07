import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@agentforge/shared";

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id || "unknown";

  // Handle known AppError subclasses
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
        requestId,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "root";
      formattedErrors[path] = formattedErrors[path] ?? [];
      formattedErrors[path].push(issue.message);
    }

    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload validation failed",
        details: formattedErrors,
        requestId,
      },
    });
    return;
  }

  // Unhandled internal server error (never leak raw stack trace in production)
  const isDev = process.env.NODE_ENV === "development";
  const errorMessage =
    err instanceof Error ? err.message : "An unexpected error occurred";

  console.error(`[API Error] Request ${requestId}:`, err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: isDev ? errorMessage : "Internal server error",
      details: isDev && err instanceof Error ? { stack: err.stack } : {},
      requestId,
    },
  });
}
