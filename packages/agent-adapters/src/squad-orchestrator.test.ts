import { describe, it, expect, vi } from "vitest";
import { SquadOrchestrator } from "./squad-orchestrator.js";
import { MockAgentAdapter } from "./mock-adapter.js";
import type { AgentEvent, AgentPromptContext } from "./types.js";

const baseContext: AgentPromptContext = {
  taskId: "task-squad-1",
  taskTitle: "Add user avatar to profile page",
  taskDescription:
    "Display the user avatar in the top-right corner of the profile page.",
  repoOwner: "acme",
  repoName: "webapp",
  targetBranch: "main",
  workspaceDir: "/tmp/squad-test",
};

function collectEvents(events: AgentEvent[]): (e: AgentEvent) => void {
  return (e) => events.push(e);
}

describe("SquadOrchestrator", () => {
  it("runs all 4 stages in sequence and returns success", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-1",
      defaultAdapter: adapter,
    });

    const events: AgentEvent[] = [];
    const result = await orchestrator.run(baseContext, collectEvents(events));

    expect(result.squadId).toBe("sq-1");
    expect(result.taskId).toBe("task-squad-1");
    expect(result.stages.architect).not.toBeNull();
    expect(result.stages.developer).not.toBeNull();
    expect(result.stages.tester).not.toBeNull();
    expect(result.stages.security).not.toBeNull();
    expect(result.success).toBe(true);
  });

  it("emits STATUS events for each stage", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-2",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    await orchestrator.run(baseContext, collectEvents(events));

    const statusMessages = events
      .filter((e) => e.type === "STATUS")
      .map((e) => e.message);
    expect(statusMessages.some((m) => m.includes("Architect"))).toBe(true);
    expect(statusMessages.some((m) => m.includes("Developer"))).toBe(true);
    expect(statusMessages.some((m) => m.includes("Tester"))).toBe(true);
    expect(statusMessages.some((m) => m.includes("Security"))).toBe(true);
  });

  it("accumulates token usage across all stages", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-3",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    const result = await orchestrator.run(baseContext, collectEvents(events));

    expect(result.aggregatedUsage.totalTokens).toBeGreaterThan(0);
    expect(result.aggregatedUsage.promptTokens).toBeGreaterThan(0);
    expect(result.aggregatedUsage.completionTokens).toBeGreaterThan(0);
  });

  it("allows different adapters per stage", async () => {
    const spy = vi.fn().mockResolvedValue({
      success: true,
      summary: "Security scan complete",
      filesModified: [],
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCostCents: 1,
      },
    });

    const defaultAdapter = new MockAgentAdapter();
    const securityAdapter = {
      providerName: "custom-security",
      executeTask: spy,
    };

    const orchestrator = new SquadOrchestrator({
      squadId: "sq-4",
      defaultAdapter,
      securityAdapter,
    });

    const events: AgentEvent[] = [];
    const result = await orchestrator.run(baseContext, collectEvents(events));

    expect(spy).toHaveBeenCalledOnce();
    expect(result.stages.security).not.toBeNull();
  });

  it("aborts on signal cancellation after Architect stage", async () => {
    const controller = new AbortController();
    const adapter = new MockAgentAdapter();

    // Cancel after Architect finishes (first executeTask call)
    let callCount = 0;
    const wrappedAdapter = {
      providerName: "mock",
      executeTask: vi.fn().mockImplementation(async (...args: any[]) => {
        callCount++;
        const result = await adapter.executeTask(
          ...(args as Parameters<typeof adapter.executeTask>),
        );
        if (callCount === 1) controller.abort(); // abort after first (architect) call completes
        return result;
      }),
    };

    const orchestrator = new SquadOrchestrator({
      squadId: "sq-5",
      defaultAdapter: wrappedAdapter,
    });

    const events: AgentEvent[] = [];
    const result = await orchestrator.run(
      baseContext,
      collectEvents(events),
      controller.signal,
    );

    // Architect succeeded, Developer should not have been called
    expect(result.stages.architect).not.toBeNull();
    expect(result.stages.developer).toBeNull();
    expect(result.success).toBe(false);
    expect(result.summary).toContain("aborted");
  });

  it("architect plan has required fields", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-6",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    const result = await orchestrator.run(baseContext, collectEvents(events));

    const plan = result.stages.architect!;
    expect(Array.isArray(plan.steps)).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(Array.isArray(plan.filesToModify)).toBe(true);
    expect(["low", "medium", "high"]).toContain(plan.estimatedComplexity);
    expect(Array.isArray(plan.requiredTools)).toBe(true);
  });

  it("tester output reports test counts", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-7",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    const result = await orchestrator.run(baseContext, collectEvents(events));

    const tester = result.stages.tester!;
    expect(typeof tester.passed).toBe("boolean");
    expect(typeof tester.testsPassed).toBe("number");
    expect(typeof tester.testsFailed).toBe("number");
    expect(tester.coverageEstimate).toBeGreaterThanOrEqual(0);
    expect(tester.coverageEstimate).toBeLessThanOrEqual(100);
  });

  it("security output reports risk level", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-8",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    const result = await orchestrator.run(baseContext, collectEvents(events));

    const security = result.stages.security!;
    expect(typeof security.safe).toBe("boolean");
    expect(Array.isArray(security.findings)).toBe(true);
    expect(["none", "low", "medium", "high", "critical"]).toContain(
      security.riskLevel,
    );
  });

  it("exports reusable standard squads", async () => {
    const { STANDARD_SQUADS } = await import("./squad-orchestrator.js");
    expect(STANDARD_SQUADS.FULL_STACK_FEATURE).toBeDefined();
    expect(STANDARD_SQUADS.HOTFIX_CREW).toBeDefined();
    expect(STANDARD_SQUADS.SECURITY_SWEEP).toBeDefined();
    expect(STANDARD_SQUADS.FULL_STACK_FEATURE.stages.length).toBe(4);
    expect(
      STANDARD_SQUADS.FULL_STACK_FEATURE.stages.some(
        (s) => s.requiresHumanApproval,
      ),
    ).toBe(true);
  });

  it("generates structured consolidated markdown report", async () => {
    const adapter = new MockAgentAdapter();
    const orchestrator = new SquadOrchestrator({
      squadId: "sq-9",
      defaultAdapter: adapter,
    });
    const events: AgentEvent[] = [];

    const result = await orchestrator.run(baseContext, collectEvents(events));
    const report = orchestrator.generateConsolidatedReport(result);

    expect(report).toContain("# AgentForge Squad Execution Report");
    expect(report).toContain("1. Architect Plan");
    expect(report).toContain("2. Developer Implementation");
    expect(report).toContain("3. Test Suite Evaluation");
    expect(report).toContain("4. Security & Quality Audit");
    expect(report).toContain("5. Token Usage & Cost");
  });
});
