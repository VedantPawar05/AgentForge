import { logger } from "@agentforge/shared";

export interface DesktopCompanionConfig {
  apiBaseUrl: string;
  workspaceId: string;
  userToken: string;
  alwaysOnTop?: boolean;
  enableNotifications?: boolean;
  pollIntervalMs?: number;
}

export interface CompanionTask {
  id: string;
  title: string;
  status:
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "BLOCKED"
    | "AWAITING_REVIEW"
    | "PAUSED";
  progressPercent: number;
  priority: string;
}

export interface PermissionRequest {
  id: string;
  taskId: string;
  title: string;
  action: "MERGE" | "BRANCH_PUSH" | "EXECUTE_COMMAND";
  details: string;
}

export class DesktopCompanionController {
  public isExpanded = false;
  public isVisible = true;
  public alwaysOnTop: boolean;
  public enableNotifications: boolean;
  public tasks: CompanionTask[] = [];
  public pendingPermissions: PermissionRequest[] = [];
  public emittedNotifications: Array<{ title: string; body: string }> = [];
  private pollTimer: NodeJS.Timeout | null = null;
  public isConnected = false;

  constructor(private readonly config: DesktopCompanionConfig) {
    this.alwaysOnTop = config.alwaysOnTop ?? true;
    this.enableNotifications = config.enableNotifications ?? true;
  }

  public getWindowBounds(): {
    width: number;
    height: number;
    alwaysOnTop: boolean;
    mode: "island" | "expanded";
  } {
    return {
      width: this.isExpanded ? 420 : 320,
      height: this.isExpanded ? 540 : 52,
      alwaysOnTop: this.alwaysOnTop,
      mode: this.isExpanded ? "expanded" : "island",
    };
  }

  public toggleExpand(): boolean {
    this.isExpanded = !this.isExpanded;
    logger.info(
      { isExpanded: this.isExpanded },
      "[DesktopCompanion] Toggled dynamic island expand/collapse",
    );
    return this.isExpanded;
  }

  public show(): void {
    this.isVisible = true;
    logger.info("[DesktopCompanion] Panel shown");
  }

  public hide(): void {
    this.isVisible = false;
    // Closing or hiding the panel MUST NOT terminate background tasks
    logger.info(
      "[DesktopCompanion] Panel hidden to tray. Background executions continue.",
    );
  }

  public async syncTasks(): Promise<void> {
    const url = `${this.config.apiBaseUrl}/v1/workspaces/${this.config.workspaceId}/tasks`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.userToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.status}`);
      }

      const data: any = await res.json();
      const rawTasks = data.tasks || [];

      const prevRunning = new Set(
        this.tasks.filter((t) => t.status === "RUNNING").map((t) => t.id),
      );

      this.tasks = rawTasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progressPercent:
          t.status === "COMPLETED" || t.status === "MERGED"
            ? 100
            : t.status === "RUNNING"
              ? 65
              : 20,
        priority: t.priority,
      }));

      // Find tasks that just finished to trigger desktop notifications
      for (const t of this.tasks) {
        if (prevRunning.has(t.id)) {
          if (t.status === "COMPLETED" || t.status === "AWAITING_REVIEW") {
            this.sendNotification(
              "Task Ready for Review",
              `Task "${t.title}" finished execution and is awaiting review.`,
            );
          } else if (t.status === "FAILED") {
            this.sendNotification(
              "Task Execution Failed",
              `Task "${t.title}" failed during execution.`,
            );
          }
        }
      }

      // Check pending review permissions
      this.pendingPermissions = this.tasks
        .filter((t) => t.status === "AWAITING_REVIEW")
        .map((t) => ({
          id: `perm-${t.id}`,
          taskId: t.id,
          title: t.title,
          action: "MERGE",
          details: `Approve changes for merge into main`,
        }));

      this.isConnected = true;
    } catch (err: any) {
      this.isConnected = false;
      logger.warn(
        { err: err?.message },
        "[DesktopCompanion] Failed to sync tasks with hosted platform",
      );
    }
  }

  public async reviewPermission(
    permissionId: string,
    decision: "APPROVED" | "REJECTED",
  ): Promise<boolean> {
    const perm = this.pendingPermissions.find((p) => p.id === permissionId);
    if (!perm) return false;

    const url = `${this.config.apiBaseUrl}/v1/workspaces/${this.config.workspaceId}/tasks/${perm.taskId}/approvals`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
          reviewNotes: `Reviewed via Desktop Companion (${decision})`,
        }),
      });

      if (res.ok) {
        this.pendingPermissions = this.pendingPermissions.filter(
          (p) => p.id !== permissionId,
        );
        await this.syncTasks();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async controlTask(
    taskId: string,
    action: "pause" | "resume" | "cancel",
  ): Promise<boolean> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;

    if (action === "cancel") {
      const url = `${this.config.apiBaseUrl}/v1/workspaces/${this.config.workspaceId}/tasks/${taskId}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.config.userToken}`,
        },
      });
      if (res.ok) {
        await this.syncTasks();
        return true;
      }
      return false;
    }

    if (action === "pause") {
      task.status = "PAUSED";
      logger.info({ taskId }, "[DesktopCompanion] Paused task locally");
      return true;
    }

    if (action === "resume") {
      task.status = "RUNNING";
      logger.info({ taskId }, "[DesktopCompanion] Resumed task locally");
      return true;
    }

    return false;
  }

  public sendNotification(title: string, body: string): void {
    if (!this.enableNotifications) return;
    this.emittedNotifications.push({ title, body });
    logger.info(
      { title, body },
      "[DesktopCompanion] Emitted desktop system notification",
    );
  }

  public start(): void {
    const interval = this.config.pollIntervalMs || 5000;
    this.pollTimer = setInterval(async () => {
      await this.syncTasks();
    }, interval);
    this.syncTasks().catch(() => {});
  }

  public stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
