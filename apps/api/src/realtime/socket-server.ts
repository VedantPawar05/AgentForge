import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { IAuthService, AuthUser } from "../auth/auth-service.js";
import {
  IWorkspaceRepository,
  ITaskRepository,
  IRunEventRepository,
  RunEventRecord,
} from "@agentforge/db";

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthUser;
  };
}

export class AgentForgeSocketServer {
  public readonly io: SocketIOServer;

  constructor(
    httpServer: HttpServer,
    private readonly authService: IAuthService,
    private readonly workspaceRepo: IWorkspaceRepository,
    private readonly taskRepo: ITaskRepository,
    private readonly runEventRepo?: IRunEventRepository,
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      path: "/socket.io",
    });

    this.setupAuthMiddleware();
    this.setupConnectionHandlers();
  }

  private setupAuthMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const authHeader =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;

        if (!authHeader) {
          return next(new Error("Authentication error: Missing token"));
        }

        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : authHeader.trim();

        const user = await this.authService.authenticateToken(token);
        if (!user) {
          return next(new Error("Authentication error: Invalid token"));
        }

        socket.data.user = user;
        next();
      } catch (err: any) {
        next(new Error(`Authentication error: ${err.message}`));
      }
    });
  }

  private setupConnectionHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      const user = socket.data.user as AuthUser;

      // Join task room with strict multi-tenant authorization
      socket.on(
        "join:task",
        async (
          data: { taskId: string; workspaceId: string },
          callback?: (response: {
            success: boolean;
            error?: string;
            room?: string;
          }) => void,
        ) => {
          try {
            if (!data?.taskId || !data?.workspaceId) {
              const err =
                "Invalid subscription payload: taskId and workspaceId are required";
              socket.emit("error:subscription", { error: err });
              callback?.({ success: false, error: err });
              return;
            }

            // Verify user belongs to workspace
            const membership = await this.workspaceRepo.findMembership(
              data.workspaceId,
              user.id,
            );

            if (!membership) {
              const err = "Forbidden: Access denied to workspace";
              socket.emit("error:subscription", {
                error: err,
                taskId: data.taskId,
              });
              callback?.({ success: false, error: err });
              return;
            }

            // Verify task belongs to this workspace
            const task = await this.taskRepo.findById(data.taskId);
            if (!task || task.workspaceId !== data.workspaceId) {
              const err =
                "Not found: Task does not belong to specified workspace";
              socket.emit("error:subscription", {
                error: err,
                taskId: data.taskId,
              });
              callback?.({ success: false, error: err });
              return;
            }

            const room = `task:${data.taskId}`;
            await socket.join(room);

            socket.emit("joined:task", { taskId: data.taskId, room });
            callback?.({ success: true, room });
          } catch (err: any) {
            socket.emit("error:subscription", {
              error: err.message,
              taskId: data?.taskId,
            });
            callback?.({ success: false, error: err.message });
          }
        },
      );

      socket.on("leave:task", (data: { taskId: string }) => {
        if (data?.taskId) {
          socket.leave(`task:${data.taskId}`);
        }
      });
    });
  }

  /**
   * Broadcasts a run event to authorized clients subscribed to task room.
   */
  public broadcastRunEvent(
    workspaceId: string,
    taskId: string,
    runId: string,
    event: RunEventRecord,
  ): void {
    this.io.to(`task:${taskId}`).emit("run:event", {
      workspaceId,
      taskId,
      runId,
      event,
    });
  }

  /**
   * Appends an event to repository and broadcasts it to subscribed clients.
   */
  public async emitAndRecordEvent(
    workspaceId: string,
    taskId: string,
    runId: string,
    type: "LOG" | "STATUS_CHANGE" | "TOOL_CALL" | "TEST_RESULT" | "METRIC",
    payload: Record<string, unknown>,
  ): Promise<RunEventRecord> {
    if (!this.runEventRepo) {
      throw new Error("RunEventRepository not configured on SocketServer");
    }

    const event = await this.runEventRepo.appendEvent({
      runId,
      type,
      payload,
    });

    this.broadcastRunEvent(workspaceId, taskId, runId, event);
    return event;
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => resolve());
    });
  }
}
