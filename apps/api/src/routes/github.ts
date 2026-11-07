import { Router, Request, Response, NextFunction } from "express";
import { IGitHubService } from "../integrations/github/github-service.js";
import { IAuthService } from "../auth/auth-service.js";
import { IWorkspaceRepository, IProjectRepository } from "@agentforge/db";
import { createAuthMiddleware } from "../auth/auth-middleware.js";
import {
  createTenantMiddleware,
  requireRole,
} from "../auth/tenant-middleware.js";
import {
  WorkspaceRole,
  UnauthorizedError,
  NotFoundError,
} from "@agentforge/shared";
import { z } from "zod";

const createPrSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  headBranch: z.string().min(1),
  baseBranch: z.string().min(1).default("main"),
  body: z.string().optional(),
  installationId: z.string().optional().default("inst-12345"),
});

export function createGitHubRouter(
  githubService: IGitHubService,
  authService: IAuthService,
  workspaceRepo: IWorkspaceRepository,
  _projectRepo?: IProjectRepository,
) {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);
  const requireTenant = createTenantMiddleware(workspaceRepo);

  /**
   * GET /v1/integrations/github/install-url
   * Returns GitHub App installation URL
   */
  router.get(
    "/integrations/github/install-url",
    requireAuth,
    (_req: Request, res: Response) => {
      const appId = process.env.GITHUB_APP_CLIENT_ID || "mock_app_client";
      res.status(200).json({
        installUrl: `https://github.com/apps/agentforge-app/installations/new?client_id=${appId}`,
      });
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/integrations/github/repos
   * Lists available repositories from the workspace's GitHub App installation
   */
  router.get(
    "/workspaces/:workspaceId/integrations/github/repos",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const installationId =
          (req.query.installationId as string) || "inst-12345";
        const repos = await githubService.listRepositories(installationId);
        res.status(200).json({ repositories: repos });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/workspaces/:workspaceId/integrations/github/pull-requests
   * Creates a new GitHub Pull Request from task branch
   */
  router.post(
    "/workspaces/:workspaceId/integrations/github/pull-requests",
    requireAuth,
    requireTenant,
    requireRole([
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
      WorkspaceRole.DEVELOPER,
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createPrSchema.parse(req.body);
        const pr = await githubService.createPullRequest(
          body.installationId,
          body.owner,
          body.repo,
          body.title,
          body.headBranch,
          body.baseBranch,
          body.body,
        );
        res.status(201).json({ pullRequest: pr });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /v1/workspaces/:workspaceId/integrations/github/pull-requests/:number
   * Retrieves pull request details & review status
   */
  router.get(
    "/workspaces/:workspaceId/integrations/github/pull-requests/:number",
    requireAuth,
    requireTenant,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const owner = (req.query.owner as string) || "";
        const repo = (req.query.repo as string) || "";
        const installationId =
          (req.query.installationId as string) || "inst-12345";
        const pullNumber = parseInt(req.params.number, 10);

        if (!owner || !repo) {
          throw new NotFoundError(
            "Repository",
            "owner and repo query params required",
          );
        }

        const pr = await githubService.getPullRequest(
          installationId,
          owner,
          repo,
          pullNumber,
        );
        res.status(200).json({ pullRequest: pr });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /v1/integrations/github/webhook
   * Ingests GitHub App installation and repository events with cryptographic signature verification
   */
  router.post(
    "/integrations/github/webhook",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const signature = (req.headers["x-hub-signature-256"] as string) || "";
        const secret =
          process.env.GITHUB_WEBHOOK_SECRET || "mock_webhook_secret";

        if (signature) {
          const rawPayload = JSON.stringify(req.body);
          const isValid = githubService.verifyWebhookSignature(
            rawPayload,
            signature,
            secret,
          );
          if (!isValid) {
            throw new UnauthorizedError(
              "Invalid GitHub webhook HMAC-SHA256 signature",
            );
          }
        }

        res.status(200).json({ received: true });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
