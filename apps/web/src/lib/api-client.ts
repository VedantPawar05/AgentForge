/**
 * AgentForge Client-Side API & Real-Time Connection Library
 *
 * Covers all /v1 REST endpoints for workspaces, projects, tasks, runs,
 * reviews, and audit logs.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/v1";

// ─── Domain Types ────────────────────────────────────────────────

export type TaskStatus =
  | "QUEUED"
  | "PROVISIONING"
  | "RUNNING"
  | "TESTING"
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "MERGED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "CHANGES_REQUESTED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskItem {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  targetBranch: string;
  branchName?: string;
  version: number;
  createdAt: string;
  createdById?: string;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

export interface ProjectItem {
  id: string;
  workspaceId: string;
  name: string;
  repoOwner: string;
  repoName: string;
  defaultBranch?: string;
  createdAt?: string;
}

export interface RunItem {
  id: string;
  taskId: string;
  workspaceId?: string;
  attemptNumber: number;
  status: string;
  workerId?: string;
  durationMs?: number;
  exitCode?: number;
  costCents?: number;
  promptTokens?: number;
  completionTokens?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RunEventPayload {
  id: string;
  runId: string;
  sequenceNumber: number;
  type: "LOG" | "STATUS_CHANGE" | "TOOL_CALL" | "TEST_RESULT" | "METRIC";
  payload: Record<string, any>;
  createdAt: string;
}

export interface MemberItem {
  id: string;
  userId: string;
  workspaceId: string;
  role: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
  createdAt?: string;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface ApprovalItem {
  id: string;
  taskId: string;
  reviewerId: string;
  status: string;
  reviewNotes?: string;
  runId?: string;
  createdAt: string;
}

// ─── API Client ──────────────────────────────────────────────────

export class AgentForgeApiClient {
  private token: string;

  constructor(token = "") {
    this.token = token;
    if (!token && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agentforge_github_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.token) {
            this.token = parsed.token;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  public setToken(token: string): void {
    this.token = token;
  }

  public getToken(): string {
    if (!this.token && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agentforge_github_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.token) {
            this.token = parsed.token;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    const activeToken = this.getToken();
    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    const res = await fetch(url, { ...options, headers });
    let data: any = {};
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          `API error ${res.status}: ${res.statusText}`,
      );
    }

    return data as T;
  }

  // ── Auth ───────────────────────────────────────────────────────

  public async authenticateMe(): Promise<{ user: any }> {
    return this.request("/auth/me");
  }

  public async syncUser(data: {
    externalId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
  }): Promise<{ user: any }> {
    return this.request("/auth/sync", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Workspaces ─────────────────────────────────────────────────

  public async getWorkspaces(): Promise<{
    workspaces: { workspace: WorkspaceItem; role: string }[];
  }> {
    return this.request("/workspaces");
  }

  public async getWorkspace(
    workspaceId: string,
  ): Promise<{ workspace: WorkspaceItem; membership: any }> {
    return this.request(`/workspaces/${workspaceId}`);
  }

  public async createWorkspace(data: {
    name: string;
    slug: string;
  }): Promise<{ workspace: WorkspaceItem }> {
    return this.request("/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Members ────────────────────────────────────────────────────

  public async getMembers(
    workspaceId: string,
  ): Promise<{ members: MemberItem[] }> {
    return this.request(`/workspaces/${workspaceId}/members`);
  }

  public async inviteMember(
    workspaceId: string,
    data: { email: string; role: string },
  ): Promise<{ invitation: any }> {
    return this.request(`/workspaces/${workspaceId}/invitations`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  public async updateMemberRole(
    workspaceId: string,
    memberId: string,
    role: string,
  ): Promise<{ membership: MemberItem }> {
    return this.request(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  public async removeMember(
    workspaceId: string,
    memberId: string,
  ): Promise<void> {
    return this.request(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  // ── Projects ───────────────────────────────────────────────────

  public async getProjects(
    workspaceId: string,
  ): Promise<{ projects: ProjectItem[] }> {
    return this.request(`/workspaces/${workspaceId}/projects`);
  }

  public async createProject(
    workspaceId: string,
    data: {
      name: string;
      repoOwner: string;
      repoName: string;
      defaultBranch?: string;
    },
  ): Promise<{ project: ProjectItem }> {
    return this.request(`/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────

  public async getTasks(
    workspaceId: string,
    params?: { status?: string; priority?: string; search?: string },
  ): Promise<{ tasks: TaskItem[]; pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.priority) query.set("priority", params.priority);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request(
      `/workspaces/${workspaceId}/tasks${qs ? `?${qs}` : ""}`,
    );
  }

  public async getTask(
    workspaceId: string,
    taskId: string,
  ): Promise<{ task: TaskItem }> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}`);
  }

  public async createTask(
    workspaceId: string,
    data: {
      projectId: string;
      title: string;
      description?: string;
      priority?: string;
      targetBranch?: string;
    },
  ): Promise<{ task: TaskItem }> {
    return this.request(
      `/workspaces/${workspaceId}/projects/${data.projectId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  public async updateTask(
    workspaceId: string,
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: string;
      status: string;
      version: number;
    }>,
  ): Promise<{ task: TaskItem }> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  public async deleteTask(workspaceId: string, taskId: string): Promise<void> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  // ── Runs ───────────────────────────────────────────────────────

  public async triggerRun(
    workspaceId: string,
    taskId: string,
  ): Promise<{ run: RunItem }> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}/runs`, {
      method: "POST",
    });
  }

  public async getRuns(
    workspaceId: string,
    taskId: string,
  ): Promise<{ runs: RunItem[] }> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}/runs`);
  }

  public async getRun(
    workspaceId: string,
    taskId: string,
    runId: string,
  ): Promise<{ run: RunItem }> {
    return this.request(
      `/workspaces/${workspaceId}/tasks/${taskId}/runs/${runId}`,
    );
  }

  public async cancelRun(
    workspaceId: string,
    taskId: string,
    runId: string,
  ): Promise<{ run: RunItem }> {
    return this.request(
      `/workspaces/${workspaceId}/tasks/${taskId}/runs/${runId}/cancel`,
      {
        method: "POST",
      },
    );
  }

  // ── Run Events ─────────────────────────────────────────────────

  public async getRunEvents(
    workspaceId: string,
    taskId: string,
    runId: string,
    sinceSeq?: number,
  ): Promise<{ events: RunEventPayload[] }> {
    const query = sinceSeq !== undefined ? `?sinceSeq=${sinceSeq}` : "";
    return this.request(
      `/workspaces/${workspaceId}/tasks/${taskId}/runs/${runId}/events${query}`,
    );
  }

  // ── Reviews & Merge ────────────────────────────────────────────

  public async getRunDiff(
    workspaceId: string,
    taskId: string,
    runId: string,
  ): Promise<{ diff: string; runId: string }> {
    return this.request(
      `/workspaces/${workspaceId}/tasks/${taskId}/runs/${runId}/diff`,
    );
  }

  public async submitReview(
    workspaceId: string,
    taskId: string,
    data: {
      status: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
      reviewNotes?: string;
      runId?: string;
    },
  ): Promise<{ approval: ApprovalItem }> {
    return this.request(
      `/workspaces/${workspaceId}/tasks/${taskId}/approvals`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  public async mergeTask(
    workspaceId: string,
    taskId: string,
  ): Promise<{ success: boolean; commitSha: string; branchMerged: string }> {
    return this.request(`/workspaces/${workspaceId}/tasks/${taskId}/merge`, {
      method: "POST",
    });
  }

  // ── Audit Logs ─────────────────────────────────────────────────

  public async getAuditLogs(
    workspaceId: string,
  ): Promise<{ logs: AuditLogEntry[] }> {
    return this.request(`/workspaces/${workspaceId}/audit-logs`);
  }
}

export const apiClient = new AgentForgeApiClient();
