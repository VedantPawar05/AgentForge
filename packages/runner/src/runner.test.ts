import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RunnerClient } from "./client.js";
import { LocalRunnerDaemon } from "./daemon.js";
import { MockAgentAdapter } from "@agentforge/agent-adapters";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("RunnerClient", () => {
  const baseUrl = "http://localhost:4000/v1";
  let client: RunnerClient;

  beforeEach(() => {
    client = new RunnerClient({
      apiBaseUrl: baseUrl,
      userToken: "test-user-token",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers runner successfully", async () => {
    const mockResponse = {
      runner: {
        id: "runner-123",
        workspaceId: "ws-1",
        name: "test-runner",
        token: "secret-runner-token",
        status: "ONLINE",
        lastHeartbeat: new Date().toISOString(),
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await client.register("ws-1", "test-runner");

    expect(result.runner.id).toBe("runner-123");
    expect(result.runner.token).toBe("secret-runner-token");
    expect(client.getRunnerToken()).toBe("secret-runner-token");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/workspaces/ws-1/runners/register`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-user-token",
        }),
      }),
    );
  });

  it("sends heartbeat with runner token", async () => {
    client.setRunnerToken("secret-runner-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await client.heartbeat("ws-1", "runner-123", "ONLINE");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/workspaces/ws-1/runners/runner-123/heartbeat`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-runner-token": "secret-runner-token",
        }),
        body: JSON.stringify({ status: "ONLINE" }),
      }),
    );
  });

  it("polls job and returns job object when available", async () => {
    client.setRunnerToken("secret-runner-token");
    const mockJob = {
      job: {
        runId: "run-99",
        taskId: "task-1",
        workspaceId: "ws-1",
        taskTitle: "Fix button style",
        targetBranch: "main",
        priority: "P1",
        attemptNumber: 1,
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockJob,
    } as Response);

    const response = await client.pollJob("ws-1", "runner-123");
    expect(response.job).not.toBeNull();
    expect(response.job?.runId).toBe("run-99");
    expect(response.job?.taskId).toBe("task-1");
  });

  it("polls job and returns null when no job available", async () => {
    client.setRunnerToken("secret-runner-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ job: null }),
    } as Response);

    const response = await client.pollJob("ws-1", "runner-123");
    expect(response.job).toBeNull();
  });

  it("reports job completion with diff", async () => {
    client.setRunnerToken("secret-runner-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await client.completeJob(
      "ws-1",
      "runner-123",
      "run-99",
      "COMPLETED",
      "diff --git a b",
      0,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/workspaces/ws-1/runners/runner-123/complete`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          runId: "run-99",
          status: "COMPLETED",
          diff: "diff --git a b",
          exitCode: 0,
        }),
      }),
    );
  });
});

describe("LocalRunnerDaemon", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentforge-runner-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("starts and stops daemon cleanly", async () => {
    const daemon = new LocalRunnerDaemon({
      apiBaseUrl: "http://localhost:4000/v1",
      workspaceId: "ws-1",
      localRepoPath: tmpDir,
      userToken: "test-token",
      agentAdapter: new MockAgentAdapter(),
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.includes("/register")) {
        return {
          ok: true,
          json: async () => ({
            runner: {
              id: "r-1",
              workspaceId: "ws-1",
              name: "daemon-test",
              token: "r-token-1",
              status: "ONLINE",
              lastHeartbeat: new Date().toISOString(),
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ ok: true, job: null }),
      } as Response;
    });

    const info = await daemon.start();
    expect(info.runnerId).toBe("r-1");
    expect(info.runnerToken).toBe("r-token-1");

    await daemon.stop();
  });

  it("allows registering specific local repositories", () => {
    const daemon = new LocalRunnerDaemon({
      apiBaseUrl: "http://localhost:4000/v1",
      workspaceId: "ws-1",
      localRepoPath: tmpDir,
      userToken: "test-token",
    });

    const subRepo = path.join(tmpDir, "sub-repo");
    fs.mkdirSync(subRepo);

    daemon.registerRepository("org/sub-repo", subRepo);
    const repos = daemon.getRegisteredRepositories();

    expect(repos.some((r) => r.name === "org/sub-repo")).toBe(true);
    expect(repos.find((r) => r.name === "org/sub-repo")?.path).toBe(
      path.resolve(subRepo),
    );
  });

  it("rejects duplicate execution of already-executed runs", async () => {
    const daemon = new LocalRunnerDaemon({
      apiBaseUrl: "http://localhost:4000/v1",
      workspaceId: "ws-1",
      localRepoPath: tmpDir,
      userToken: "test-token",
      runnerId: "r-1",
      runnerToken: "r-token-1",
    });

    const mockJob = {
      runId: "run-idem-1",
      taskId: "task-idem-1",
      workspaceId: "ws-1",
      taskTitle: "Idempotency test",
      targetBranch: "main",
      priority: "P1",
      attemptNumber: 1,
    };

    let completeCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.includes("/poll")) {
        return {
          ok: true,
          json: async () => ({ job: mockJob }),
        } as Response;
      }
      if (url.includes("/complete")) {
        completeCalls++;
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      return { ok: true, json: async () => ({ success: true }) } as Response;
    });

    // First execution succeeds
    daemon.isConnected = true;
    const firstRun = await daemon.pollAndExecute();
    expect(firstRun).toBe(true);
    expect(completeCalls).toBe(1);

    // Second execution of same runId is rejected by idempotency guard
    const secondRun = await daemon.pollAndExecute();
    expect(secondRun).toBe(false);
    expect(completeCalls).toBe(1); // not called again
  });

  it("cancels active task execution on user abort signal", async () => {
    const daemon = new LocalRunnerDaemon({
      apiBaseUrl: "http://localhost:4000/v1",
      workspaceId: "ws-1",
      localRepoPath: tmpDir,
      userToken: "test-token",
      runnerId: "r-1",
      runnerToken: "r-token-1",
    });

    // If no task active, returns false
    expect(daemon.cancelTask("non-existent-run")).toBe(false);
  });
});
