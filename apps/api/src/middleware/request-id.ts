import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers["x-request-id"];
  const id =
    typeof existingId === "string" && existingId.length > 0
      ? existingId
      : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
