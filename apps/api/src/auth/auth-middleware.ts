import { Request, Response, NextFunction } from "express";
import { IAuthService } from "./auth-service.js";
import { UnauthorizedError } from "@agentforge/shared";

export function createAuthMiddleware(authService: IAuthService) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError(
          "Missing or malformed Authorization header (expected Bearer <token>)",
        );
      }

      const token = authHeader.slice(7).trim();
      const user = await authService.authenticateToken(token);
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
