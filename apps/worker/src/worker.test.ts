import { describe, it, expect } from "vitest";
import { TaskExecutionWorker } from "./worker.js";
import { RunStatus } from "@agentforge/shared";
import { MockAgentAdapter } from "@agentforge/agent-adapters";
import { MockSandboxDriver } from "@agentforge/sandbox";

describe("TaskExecutionWorker", () => {
  it("successfully processes a job from provisioning to test and diff collection", async () => {
    const worker = new TaskExecutionWorker(
      "worker-test-1",
      new MockAgentAdapter(),
      new MockSandboxDriver(),
    );

    await worker.start();
    expect(worker.active).toBe(true);

    const result = await worker.processJob({
      taskId: "task-abc",
      runId: "run-xyz",
      attemptNumber: 1,
      workspaceId: "ws-123",
    });

    expect(result.status).toBe(RunStatus.COMPLETED);
    expect(result.diff).toContain("diff --git");

    await worker.stop();
    expect(worker.active).toBe(false);
  });

  it("marks run as FAILED when agent fails", async () => {
    const worker = new TaskExecutionWorker(
      "worker-test-fail",
      new MockAgentAdapter({
        shouldFail: true,
        failureMessage: "Model timeout",
      }),
      new MockSandboxDriver(),
    );

    const result = await worker.processJob({
      taskId: "task-fail",
      runId: "run-fail",
      attemptNumber: 1,
      workspaceId: "ws-123",
    });

    expect(result.status).toBe(RunStatus.FAILED);
  });
});
