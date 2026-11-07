import { describe, it, expect } from "vitest";
import { MockAgentAdapter, AgentEvent } from "./index.js";

describe("MockAgentAdapter", () => {
  it("executes task successfully and streams events", async () => {
    const adapter = new MockAgentAdapter();
    const events: AgentEvent[] = [];

    const result = await adapter.executeTask(
      {
        taskId: "task-123",
        taskTitle: "Add rate limiting to auth endpoint",
        taskDescription: "Use Redis token bucket",
        repoOwner: "agentforge",
        repoName: "backend-demo",
        targetBranch: "main",
        workspaceDir: "/workspace",
      },
      (ev) => {
        events.push(ev);
      },
    );

    expect(result.success).toBe(true);
    expect(result.filesModified).toContain("src/index.ts");
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events[0].type).toBe("THOUGHT");
  });

  it("handles simulated failure cleanly", async () => {
    const adapter = new MockAgentAdapter({
      shouldFail: true,
      failureMessage: "Anthropic rate limit exceeded",
    });
    const events: AgentEvent[] = [];

    const result = await adapter.executeTask(
      {
        taskId: "task-fail",
        taskTitle: "Broken task",
        taskDescription: "Will fail",
        repoOwner: "org",
        repoName: "repo",
        targetBranch: "main",
        workspaceDir: "/workspace",
      },
      (ev) => {
        events.push(ev);
      },
    );

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Anthropic rate limit exceeded");
  });
});
