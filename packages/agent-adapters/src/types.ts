/**
 * Provider-Neutral Agent Adapter Types & Interfaces
 */

export interface AgentPromptContext {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  repoOwner: string;
  repoName: string;
  targetBranch: string;
  testCommand?: string;
  buildCommand?: string;
  workspaceDir: string;
}

export interface AgentToolCall {
  id: string;
  name: "readFile" | "writeFile" | "listFiles" | "runCommand";
  args: Record<string, unknown>;
}

export interface AgentToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

export type AgentEventType =
  "THOUGHT" | "TOOL_CALL" | "TOOL_RESULT" | "LOG" | "STATUS";

export interface AgentEvent {
  type: AgentEventType;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface AgentTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
}

export interface AgentExecutionResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  usage: AgentTokenUsage;
  errorMessage?: string;
}

export interface IAgentAdapter {
  readonly providerName: string;

  executeTask(
    context: AgentPromptContext,
    onEvent: (event: AgentEvent) => Promise<void> | void,
    abortSignal?: AbortSignal,
  ): Promise<AgentExecutionResult>;
}
