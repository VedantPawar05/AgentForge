import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AnthropicAgentAdapter,
  AgentEvent,
  ANTHROPIC_CODING_TOOLS,
} from "./index.js";

describe("AnthropicAgentAdapter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "agentforge-anthropic-test-"),
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  const getContext = (overrides = {}) => ({
    taskId: "task-auth-01",
    taskTitle: "Implement rate limiting middleware",
    taskDescription: "Protect /v1/auth endpoints from brute force attempts",
    repoOwner: "agentforge",
    repoName: "core-backend",
    targetBranch: "main",
    workspaceDir: tempDir,
    ...overrides,
  });

  it("exports expected coding tools schema", () => {
    const toolNames = ANTHROPIC_CODING_TOOLS.map((t) => t.name);
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("write_file");
    expect(toolNames).toContain("list_directory");
    expect(toolNames).toContain("search_workspace");
    expect(toolNames).toContain("execute_command");
    expect(toolNames).toContain("run_tests");
  });

  it("throws an error if API key is missing", async () => {
    const adapter = new AnthropicAgentAdapter({ apiKey: "" });
    await expect(adapter.executeTask(getContext(), () => {})).rejects.toThrow(
      "Anthropic API key is missing",
    );
  });

  it("executes task in test mode, streams events, and records token usage & cost", async () => {
    const adapter = new AnthropicAgentAdapter({
      apiKey: "test-ant-key",
      model: "claude-3-7-sonnet-20250219",
    });

    const events: AgentEvent[] = [];
    const result = await adapter.executeTask(getContext(), (event) => {
      events.push(event);
    });

    expect(result.success).toBe(true);
    expect(result.filesModified).toContain("src/index.ts");
    expect(result.usage.promptTokens).toBe(1420);
    expect(result.usage.completionTokens).toBe(480);
    expect(result.usage.totalTokens).toBe(1900);
    expect(result.usage.estimatedCostCents).toBeGreaterThan(0);

    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events[0].type).toBe("THOUGHT");
    expect(events.some((e) => e.type === "TOOL_CALL")).toBe(true);
    expect(events.some((e) => e.type === "TOOL_RESULT")).toBe(true);
    expect(events.some((e) => e.type === "STATUS")).toBe(true);
  });

  it("rejects when abort signal is already aborted", async () => {
    const adapter = new AnthropicAgentAdapter({ apiKey: "test-ant-key" });
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.executeTask(getContext(), () => {}, controller.signal),
    ).rejects.toThrow("Agent execution aborted");
  });

  it("enforces workspace budget limit", async () => {
    const adapter = new AnthropicAgentAdapter({
      apiKey: "test-ant-key",
      maxBudgetUsd: 0.0001,
    });

    await expect(adapter.executeTask(getContext(), () => {})).rejects.toThrow(
      "exceeded workspace budget limit",
    );
  });

  it("executes real multi-turn tool calling loop via fetch", async () => {
    // Pre-create an initial file in workspace
    fs.writeFileSync(
      path.join(tempDir, "README.md"),
      "# Existing Project\n",
      "utf-8",
    );

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url, _options) => {
      callCount++;
      if (callCount === 1) {
        // Turn 1: Model asks to read README.md and write a new file
        return {
          ok: true,
          json: async () => ({
            id: "msg_01",
            stop_reason: "tool_use",
            usage: { input_tokens: 300, output_tokens: 100 },
            content: [
              {
                type: "text",
                text: "I will inspect the README and write src/auth.ts",
              },
              {
                type: "tool_use",
                id: "call_1",
                name: "read_file",
                input: { path: "README.md" },
              },
              {
                type: "tool_use",
                id: "call_2",
                name: "write_file",
                input: {
                  path: "src/auth.ts",
                  content: "export const rateLimiter = () => true;\n",
                },
              },
            ],
          }),
        };
      } else {
        // Turn 2: Model finishes task
        return {
          ok: true,
          json: async () => ({
            id: "msg_02",
            stop_reason: "end_turn",
            usage: { input_tokens: 400, output_tokens: 80 },
            content: [
              {
                type: "text",
                text: "Task completed successfully. All files written.",
              },
            ],
          }),
        };
      }
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new AnthropicAgentAdapter({
      apiKey: "live-production-sk-ant-1234567890",
      model: "claude-3-7-sonnet-20250219",
      maxTurns: 5,
    });

    const events: AgentEvent[] = [];
    const result = await adapter.executeTask(getContext(), (event) => {
      events.push(event);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.filesModified).toContain("src/auth.ts");
    expect(result.usage.promptTokens).toBe(700);
    expect(result.usage.completionTokens).toBe(180);

    // Verify file actually written to workspace
    const createdFile = path.join(tempDir, "src/auth.ts");
    expect(fs.existsSync(createdFile)).toBe(true);
    expect(fs.readFileSync(createdFile, "utf-8")).toContain(
      "export const rateLimiter",
    );

    // Verify events emitted
    expect(
      events.some(
        (e) => e.type === "TOOL_CALL" && e.message.includes("read_file"),
      ),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.type === "TOOL_CALL" && e.message.includes("write_file"),
      ),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.type === "THOUGHT" && e.message.includes("Task completed"),
      ),
    ).toBe(true);
  });

  it("handles API errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Invalid API key provided",
      }),
    );

    const adapter = new AnthropicAgentAdapter({
      apiKey: "sk-ant-invalid-token",
    });

    await expect(adapter.executeTask(getContext(), () => {})).rejects.toThrow(
      "Anthropic API request failed with status 401",
    );
  });
});
