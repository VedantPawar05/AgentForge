import {
  IAgentAdapter,
  AgentPromptContext,
  AgentEvent,
  AgentExecutionResult,
} from "./types.js";

export interface MockAdapterOptions {
  shouldFail?: boolean;
  failureMessage?: string;
  simulatedFilesModified?: string[];
  mockFilesModified?: string[];
  mockSummary?: string;
  simulatedDelayMs?: number;
}

export class MockAgentAdapter implements IAgentAdapter {
  public readonly providerName = "mock";

  constructor(private readonly options: MockAdapterOptions = {}) {}

  public async executeTask(
    context: AgentPromptContext,
    onEvent: (event: AgentEvent) => Promise<void> | void,
    abortSignal?: AbortSignal,
  ): Promise<AgentExecutionResult> {
    const now = () => new Date().toISOString();

    // Event 1: Initial Reasoning
    await onEvent({
      type: "THOUGHT",
      message: `Analyzing task "${context.taskTitle}" for repository ${context.repoOwner}/${context.repoName}...`,
      timestamp: now(),
    });

    if (abortSignal?.aborted) {
      throw new Error("Agent execution cancelled");
    }

    if (this.options.simulatedDelayMs) {
      await new Promise((r) => setTimeout(r, this.options.simulatedDelayMs));
    }

    // Event 2: Tool Call (Listing repository files)
    await onEvent({
      type: "TOOL_CALL",
      message: "Invoking tool: listFiles",
      details: { directory: context.workspaceDir },
      timestamp: now(),
    });

    await onEvent({
      type: "TOOL_RESULT",
      message: "Found files: src/index.ts, package.json, tsconfig.json",
      details: { filesCount: 3 },
      timestamp: now(),
    });

    // Check failure simulation
    if (this.options.shouldFail) {
      const errorMsg =
        this.options.failureMessage ?? "Simulated agent reasoning failure";
      await onEvent({
        type: "STATUS",
        message: `Agent encountered error: ${errorMsg}`,
        timestamp: now(),
      });
      return {
        success: false,
        summary: "Agent execution failed during implementation phase",
        filesModified: [],
        usage: {
          promptTokens: 450,
          completionTokens: 80,
          totalTokens: 530,
          estimatedCostCents: 1,
        },
        errorMessage: errorMsg,
      };
    }

    // Event 3: Tool Call (Modifying file)
    const modified = this.options.simulatedFilesModified ??
      this.options.mockFilesModified ?? ["src/index.ts"];
    for (const file of modified) {
      await onEvent({
        type: "TOOL_CALL",
        message: `Invoking tool: writeFile on ${file}`,
        details: { file },
        timestamp: now(),
      });

      await onEvent({
        type: "TOOL_RESULT",
        message: `Successfully updated ${file}`,
        details: { file },
        timestamp: now(),
      });
    }

    // Final Success Event
    await onEvent({
      type: "STATUS",
      message: "Agent completed requested modifications successfully",
      timestamp: now(),
    });

    return {
      success: true,
      summary:
        this.options.mockSummary ??
        `Successfully addressed task: ${context.taskTitle}`,
      filesModified: modified,
      usage: {
        promptTokens: 1250,
        completionTokens: 420,
        totalTokens: 1670,
        estimatedCostCents: 3,
      },
    };
  }
}
