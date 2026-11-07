export interface RunnerRegistrationResponse {
  runner: {
    id: string;
    workspaceId: string;
    name: string;
    hostname?: string;
    status: "ONLINE" | "OFFLINE" | "BUSY";
    token: string;
    registeredAt: string;
  };
}

export interface RunnerJob {
  runId: string;
  taskId: string;
  workspaceId: string;
  taskTitle: string;
  taskDescription?: string;
  targetBranch: string;
  priority: string;
  attemptNumber: number;
  repoName?: string;
}

export interface RunnerClientConfig {
  apiBaseUrl: string;
  userToken?: string;
  runnerToken?: string;
}

export class RunnerClient {
  private apiBaseUrl: string;
  private userToken?: string;
  private runnerToken?: string;

  constructor(config: RunnerClientConfig) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.userToken = config.userToken;
    this.runnerToken = config.runnerToken;
  }

  public setRunnerToken(token: string): void {
    this.runnerToken = token;
  }

  public getRunnerToken(): string | undefined {
    return this.runnerToken;
  }

  public setUserToken(token: string): void {
    this.userToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const baseHasV1 = this.apiBaseUrl.endsWith("/v1");
    const endpointHasV1 = cleanEndpoint.startsWith("/v1/");
    const finalPath =
      baseHasV1 || endpointHasV1 ? cleanEndpoint : `/v1${cleanEndpoint}`;
    const url = `${this.apiBaseUrl}${finalPath}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.userToken) {
      headers["Authorization"] = `Bearer ${this.userToken}`;
    }
    if (this.runnerToken) {
      headers["x-runner-token"] = this.runnerToken;
    }

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        (data as any)?.error?.message ||
          (data as any)?.message ||
          `HTTP error ${res.status}`,
      );
    }

    return data as T;
  }

  public async register(
    workspaceId: string,
    name: string,
    hostname?: string,
  ): Promise<RunnerRegistrationResponse> {
    const data = await this.request<RunnerRegistrationResponse>(
      `/workspaces/${workspaceId}/runners/register`,
      {
        method: "POST",
        body: JSON.stringify({ name, hostname }),
      },
    );
    this.runnerToken = data.runner.token;
    return data;
  }

  public async heartbeat(
    workspaceId: string,
    runnerId: string,
    status: "ONLINE" | "BUSY" | "OFFLINE" = "ONLINE",
    currentRunId?: string | null,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workspaces/${workspaceId}/runners/${runnerId}/heartbeat`,
      {
        method: "POST",
        body: JSON.stringify({ status, currentRunId }),
      },
    );
  }

  public async pollJob(
    workspaceId: string,
    runnerId: string,
  ): Promise<{ job: RunnerJob | null }> {
    return this.request<{ job: RunnerJob | null }>(
      `/workspaces/${workspaceId}/runners/${runnerId}/poll`,
      {
        method: "POST",
      },
    );
  }

  public async completeJob(
    workspaceId: string,
    runnerId: string,
    runId: string,
    status: "COMPLETED" | "FAILED",
    diff?: string,
    exitCode?: number,
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workspaces/${workspaceId}/runners/${runnerId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ runId, status, diff, exitCode }),
      },
    );
  }
}
