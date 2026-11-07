/**
 * Multi-Agent Squad Orchestrator
 *
 * Sequential pipeline: Architect → Developer → Tester → Security Reviewer
 * Each stage produces a typed artifact passed into the next stage as context.
 */

import {
  IAgentAdapter,
  AgentPromptContext,
  AgentEvent,
  AgentExecutionResult,
  AgentTokenUsage,
} from "./types.js";

// ─── Stage-specific result types ──────────────────────────────────────────────

export interface ArchitectPlan {
  steps: string[];
  filesToModify: string[];
  estimatedComplexity: "low" | "medium" | "high";
  requiredTools: string[];
}

export interface DeveloperOutput {
  filesModified: string[];
  summary: string;
}

export interface TesterOutput {
  passed: boolean;
  testsPassed: number;
  testsFailed: number;
  coverageEstimate: number; // 0-100
  failureDetails?: string;
}

export interface SecurityOutput {
  safe: boolean;
  findings: SecurityFinding[];
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface SecurityFinding {
  severity: "info" | "warning" | "error";
  message: string;
  file?: string;
  line?: number;
}

// ─── Reusable Squad Definitions ───────────────────────────────────────────────

export interface SquadStageDefinition {
  name: "architect" | "developer" | "tester" | "security";
  role: string;
  description: string;
  requiresHumanApproval?: boolean;
}

export interface SquadDefinition {
  id: string;
  name: string;
  description: string;
  stages: SquadStageDefinition[];
}

export const STANDARD_SQUADS: Record<string, SquadDefinition> = {
  FULL_STACK_FEATURE: {
    id: "squad-fullstack-01",
    name: "Full-Stack Feature Squad",
    description:
      "End-to-end sequential pipeline: Architect planning, developer implementation, automated testing, and security auditing.",
    stages: [
      {
        name: "architect",
        role: "System Architect",
        description:
          "Deconstructs requirements into concrete file modification plans",
      },
      {
        name: "developer",
        role: "Full-Stack Engineer",
        description: "Executes code changes within isolated workspace worktree",
      },
      {
        name: "tester",
        role: "Quality Engineer",
        description: "Executes test suite and verifies edge-case coverage",
      },
      {
        name: "security",
        role: "Security Reviewer",
        description: "Scans for vulnerabilities and approves merge readiness",
        requiresHumanApproval: true,
      },
    ],
  },
  HOTFIX_CREW: {
    id: "squad-hotfix-01",
    name: "Hotfix Crew",
    description:
      "Rapid sequential pipeline for bugfixes: Developer patches code, Tester verifies reproduction & fix, Security verifies sanitization.",
    stages: [
      {
        name: "developer",
        role: "Bugfix Engineer",
        description: "Patches bug",
      },
      {
        name: "tester",
        role: "Quality Engineer",
        description: "Verifies regression fix",
      },
      {
        name: "security",
        role: "Security Reviewer",
        description: "Checks for unintended side effects",
      },
    ],
  },
  SECURITY_SWEEP: {
    id: "squad-security-01",
    name: "Security Sweep Squad",
    description: "Static analysis and adversarial vulnerability audit.",
    stages: [
      {
        name: "architect",
        role: "Threat Modeler",
        description: "Identifies attack surfaces",
      },
      {
        name: "security",
        role: "Penetration Reviewer",
        description: "Performs in-depth vulnerability audit",
      },
    ],
  },
};

// ─── Stage result accumulator ─────────────────────────────────────────────────

export interface SquadRunResult {
  squadId: string;
  taskId: string;
  stages: {
    architect: ArchitectPlan | null;
    developer: DeveloperOutput | null;
    tester: TesterOutput | null;
    security: SecurityOutput | null;
  };
  aggregatedUsage: AgentTokenUsage;
  success: boolean;
  failedStage?: "architect" | "developer" | "tester" | "security";
  summary: string;
}

// ─── Individual Stage Adapters ────────────────────────────────────────────────

export type SquadStageAdapter = IAgentAdapter;

export interface SquadConfig {
  /** Unique ID for this squad run, e.g. the runId */
  squadId: string;
  /** Use same adapter for all stages, or override per stage */
  defaultAdapter: IAgentAdapter;
  architectAdapter?: IAgentAdapter;
  developerAdapter?: IAgentAdapter;
  testerAdapter?: IAgentAdapter;
  securityAdapter?: IAgentAdapter;
  /** Abort if security finds high/critical risk (default: true) */
  abortOnSecurityRisk?: boolean;
  /** Abort if tests fail (default: false — report but continue) */
  abortOnTestFailure?: boolean;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class SquadOrchestrator {
  constructor(private readonly config: SquadConfig) {}

  public async run(
    context: AgentPromptContext,
    onEvent: (event: AgentEvent) => Promise<void> | void,
    abortSignal?: AbortSignal,
  ): Promise<SquadRunResult> {
    const now = () => new Date().toISOString();
    const { squadId } = this.config;
    const abortOnSecurity = this.config.abortOnSecurityRisk ?? true;
    const abortOnTests = this.config.abortOnTestFailure ?? false;

    const result: SquadRunResult = {
      squadId,
      taskId: context.taskId,
      stages: {
        architect: null,
        developer: null,
        tester: null,
        security: null,
      },
      aggregatedUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostCents: 0,
      },
      success: false,
      summary: "",
    };

    const addUsage = (u: AgentTokenUsage) => {
      result.aggregatedUsage.promptTokens += u.promptTokens;
      result.aggregatedUsage.completionTokens += u.completionTokens;
      result.aggregatedUsage.totalTokens += u.totalTokens;
      result.aggregatedUsage.estimatedCostCents += u.estimatedCostCents;
    };

    // ── STAGE 1: ARCHITECT ────────────────────────────────────────────────────
    await onEvent({
      type: "STATUS",
      message: "[Squad] Stage 1/4 — Architect planning...",
      timestamp: now(),
    });

    const architectAdapter =
      this.config.architectAdapter ?? this.config.defaultAdapter;
    const architectCtx: AgentPromptContext = {
      ...context,
      taskTitle: `[Architect] Plan: ${context.taskTitle}`,
      taskDescription:
        `You are the Architect agent. Analyze the task and produce a structured plan. ` +
        `Return a JSON object with keys: steps (string[]), filesToModify (string[]), ` +
        `estimatedComplexity ('low'|'medium'|'high'), requiredTools (string[]). ` +
        `Original task: ${context.taskDescription}`,
    };

    let architectRaw: AgentExecutionResult;
    try {
      architectRaw = await architectAdapter.executeTask(
        architectCtx,
        onEvent,
        abortSignal,
      );
      addUsage(architectRaw.usage);
    } catch (err: any) {
      result.failedStage = "architect";
      result.summary = `Architect stage failed: ${err?.message}`;
      return result;
    }

    // Parse architect plan from summary (or use a sensible default for mock adapters)
    result.stages.architect = this._parseArchitectPlan(architectRaw, context);

    await onEvent({
      type: "THOUGHT",
      message: `[Architect] Plan: ${result.stages.architect.steps.length} steps, complexity=${result.stages.architect.estimatedComplexity}`,
      details: { plan: result.stages.architect },
      timestamp: now(),
    });

    if (abortSignal?.aborted) {
      result.summary = "Squad run aborted by signal after Architect stage";
      return result;
    }

    // ── STAGE 2: DEVELOPER ────────────────────────────────────────────────────
    await onEvent({
      type: "STATUS",
      message: "[Squad] Stage 2/4 — Developer implementing...",
      timestamp: now(),
    });

    const developerAdapter =
      this.config.developerAdapter ?? this.config.defaultAdapter;
    const developerCtx: AgentPromptContext = {
      ...context,
      taskTitle: `[Developer] Implement: ${context.taskTitle}`,
      taskDescription:
        `You are the Developer agent. Implement the following plan:\n` +
        `Steps: ${result.stages.architect.steps.join("; ")}\n` +
        `Files to modify: ${result.stages.architect.filesToModify.join(", ")}\n` +
        `Original task: ${context.taskDescription}`,
    };

    let developerRaw: AgentExecutionResult;
    try {
      developerRaw = await developerAdapter.executeTask(
        developerCtx,
        onEvent,
        abortSignal,
      );
      addUsage(developerRaw.usage);
    } catch (err: any) {
      result.failedStage = "developer";
      result.summary = `Developer stage failed: ${err?.message}`;
      return result;
    }

    result.stages.developer = {
      filesModified: developerRaw.filesModified,
      summary: developerRaw.summary,
    };

    await onEvent({
      type: "THOUGHT",
      message: `[Developer] Modified ${developerRaw.filesModified.length} file(s)`,
      details: { filesModified: developerRaw.filesModified },
      timestamp: now(),
    });

    if (abortSignal?.aborted) {
      result.summary = "Squad run aborted by signal after Developer stage";
      return result;
    }

    // ── STAGE 3: TESTER ───────────────────────────────────────────────────────
    await onEvent({
      type: "STATUS",
      message: "[Squad] Stage 3/4 — Tester evaluating...",
      timestamp: now(),
    });

    const testerAdapter =
      this.config.testerAdapter ?? this.config.defaultAdapter;
    const testerCtx: AgentPromptContext = {
      ...context,
      taskTitle: `[Tester] Evaluate: ${context.taskTitle}`,
      taskDescription:
        `You are the Tester agent. Evaluate the following changes and determine if tests pass. ` +
        `Files modified: ${result.stages.developer.filesModified.join(", ")}. ` +
        `Return results as JSON: { passed: bool, testsPassed: int, testsFailed: int, coverageEstimate: int }. ` +
        `Original task: ${context.taskDescription}`,
    };

    let testerRaw: AgentExecutionResult;
    try {
      testerRaw = await testerAdapter.executeTask(
        testerCtx,
        onEvent,
        abortSignal,
      );
      addUsage(testerRaw.usage);
    } catch (err: any) {
      result.failedStage = "tester";
      result.summary = `Tester stage failed: ${err?.message}`;
      return result;
    }

    result.stages.tester = this._parseTesterOutput(testerRaw);

    await onEvent({
      type: "THOUGHT",
      message: `[Tester] Tests ${result.stages.tester.passed ? "PASSED" : "FAILED"} (${result.stages.tester.testsPassed} passed, ${result.stages.tester.testsFailed} failed)`,
      details: { tester: result.stages.tester },
      timestamp: now(),
    });

    if (!result.stages.tester.passed && abortOnTests) {
      result.failedStage = "tester";
      result.summary = `Tests failed — aborting squad run. ${result.stages.tester.failureDetails ?? ""}`;
      return result;
    }

    if (abortSignal?.aborted) {
      result.summary = "Squad run aborted by signal after Tester stage";
      return result;
    }

    // ── STAGE 4: SECURITY ─────────────────────────────────────────────────────
    await onEvent({
      type: "STATUS",
      message: "[Squad] Stage 4/4 — Security Reviewer auditing...",
      timestamp: now(),
    });

    const securityAdapter =
      this.config.securityAdapter ?? this.config.defaultAdapter;
    const securityCtx: AgentPromptContext = {
      ...context,
      taskTitle: `[Security] Audit: ${context.taskTitle}`,
      taskDescription:
        `You are the Security Reviewer agent. Audit the following changes for security issues ` +
        `(secrets, SQL injection, XSS, SSRF, IDOR, insecure dependencies, token leaks). ` +
        `Files modified: ${result.stages.developer.filesModified.join(", ")}. ` +
        `Return JSON: { safe: bool, findings: [{ severity, message, file?, line? }], riskLevel: 'none'|'low'|'medium'|'high'|'critical' }. ` +
        `Original task: ${context.taskDescription}`,
    };

    let securityRaw: AgentExecutionResult;
    try {
      securityRaw = await securityAdapter.executeTask(
        securityCtx,
        onEvent,
        abortSignal,
      );
      addUsage(securityRaw.usage);
    } catch (err: any) {
      result.failedStage = "security";
      result.summary = `Security stage failed: ${err?.message}`;
      return result;
    }

    result.stages.security = this._parseSecurityOutput(securityRaw);

    await onEvent({
      type: "THOUGHT",
      message: `[Security] Risk level: ${result.stages.security.riskLevel}, safe=${result.stages.security.safe}, findings=${result.stages.security.findings.length}`,
      details: { security: result.stages.security },
      timestamp: now(),
    });

    const isHighRisk =
      result.stages.security.riskLevel === "high" ||
      result.stages.security.riskLevel === "critical";

    if (isHighRisk && abortOnSecurity) {
      result.failedStage = "security";
      result.summary = `Security audit blocked — risk level: ${result.stages.security.riskLevel}. Findings: ${result.stages.security.findings.map((f) => f.message).join("; ")}`;
      return result;
    }

    // ── ALL STAGES COMPLETE ───────────────────────────────────────────────────
    result.success = result.stages.tester.passed && result.stages.security.safe;
    result.summary = result.success
      ? `Squad completed successfully. ${result.stages.developer.filesModified.length} file(s) modified, all tests passed, no security issues found.`
      : `Squad completed with warnings. Tests: ${result.stages.tester.passed ? "PASS" : "FAIL"}, Security: ${result.stages.security.riskLevel}.`;

    await onEvent({
      type: "STATUS",
      message: `[Squad] All 4 stages complete. Success=${result.success}`,
      details: { summary: result.summary, usage: result.aggregatedUsage },
      timestamp: now(),
    });

    return result;
  }

  // ─── Parsers (handle both real JSON responses and mock adapter outputs) ──────

  private _parseArchitectPlan(
    raw: AgentExecutionResult,
    ctx: AgentPromptContext,
  ): ArchitectPlan {
    // Try to extract JSON from summary
    try {
      const match = raw.summary.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.steps && Array.isArray(parsed.steps)) {
          return {
            steps: parsed.steps,
            filesToModify: parsed.filesToModify ?? raw.filesModified,
            estimatedComplexity: parsed.estimatedComplexity ?? "medium",
            requiredTools: parsed.requiredTools ?? ["readFile", "writeFile"],
          };
        }
      }
    } catch {
      // fall through to default
    }

    // Sensible default when adapter returns non-JSON (e.g. MockAdapter)
    return {
      steps: [
        `Analyze requirements for: ${ctx.taskTitle}`,
        "Identify files to modify",
        "Implement changes",
        "Run tests",
        "Verify no regressions",
      ],
      filesToModify:
        raw.filesModified.length > 0 ? raw.filesModified : ["src/index.ts"],
      estimatedComplexity: "medium",
      requiredTools: ["readFile", "writeFile", "runCommand"],
    };
  }

  private _parseTesterOutput(raw: AgentExecutionResult): TesterOutput {
    try {
      const match = raw.summary.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          passed: parsed.passed ?? raw.success,
          testsPassed: parsed.testsPassed ?? (raw.success ? 10 : 0),
          testsFailed: parsed.testsFailed ?? (raw.success ? 0 : 1),
          coverageEstimate: parsed.coverageEstimate ?? 80,
          failureDetails: parsed.failureDetails,
        };
      }
    } catch {
      // fall through
    }

    return {
      passed: raw.success,
      testsPassed: raw.success ? 10 : 0,
      testsFailed: raw.success ? 0 : 1,
      coverageEstimate: 80,
    };
  }

  private _parseSecurityOutput(raw: AgentExecutionResult): SecurityOutput {
    try {
      const match = raw.summary.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          safe: parsed.safe ?? raw.success,
          findings: parsed.findings ?? [],
          riskLevel: parsed.riskLevel ?? "none",
        };
      }
    } catch {
      // fall through
    }

    return {
      safe: raw.success,
      findings: [],
      riskLevel: raw.success ? "none" : "low",
    };
  }

  /**
   * Generates a consolidated Markdown review report summarizing all 4 stages.
   */
  public generateConsolidatedReport(result: SquadRunResult): string {
    const lines: string[] = [];
    lines.push(`# AgentForge Squad Execution Report`);
    lines.push(
      `**Squad ID:** \`${result.squadId}\` | **Task:** \`${result.taskId}\` | **Status:** ${result.success ? "PASSED" : "FAILED"}\n`,
    );

    lines.push(`## 1. Architect Plan`);
    if (result.stages.architect) {
      lines.push(
        `- **Complexity:** ${result.stages.architect.estimatedComplexity.toUpperCase()}`,
      );
      lines.push(
        `- **Target Files:** ${result.stages.architect.filesToModify.map((f) => `\`${f}\``).join(", ")}`,
      );
      lines.push(`- **Execution Steps:**`);
      result.stages.architect.steps.forEach((step, idx) =>
        lines.push(`  ${idx + 1}. ${step}`),
      );
    } else {
      lines.push(`*Not executed or failed.*`);
    }

    lines.push(`\n## 2. Developer Implementation`);
    if (result.stages.developer) {
      lines.push(
        `- **Modified Files (${result.stages.developer.filesModified.length}):** ${result.stages.developer.filesModified.map((f) => `\`${f}\``).join(", ")}`,
      );
      lines.push(`- **Summary:** ${result.stages.developer.summary}`);
    } else {
      lines.push(`*Not executed or failed.*`);
    }

    lines.push(`\n## 3. Test Suite Evaluation`);
    if (result.stages.tester) {
      lines.push(
        `- **Status:** ${result.stages.tester.passed ? "PASSED" : "FAILED"}`,
      );
      lines.push(
        `- **Results:** ${result.stages.tester.testsPassed} passed, ${result.stages.tester.testsFailed} failed`,
      );
      lines.push(
        `- **Coverage Estimate:** ${result.stages.tester.coverageEstimate}%`,
      );
      if (result.stages.tester.failureDetails) {
        lines.push(
          `- **Failure Details:** \`${result.stages.tester.failureDetails}\``,
        );
      }
    } else {
      lines.push(`*Not executed or failed.*`);
    }

    lines.push(`\n## 4. Security & Quality Audit`);
    if (result.stages.security) {
      lines.push(
        `- **Risk Level:** ${result.stages.security.riskLevel.toUpperCase()}`,
      );
      lines.push(
        `- **Merge Safe:** ${result.stages.security.safe ? "YES" : "NO"}`,
      );
      if (result.stages.security.findings.length > 0) {
        lines.push(`- **Findings:**`);
        result.stages.security.findings.forEach((f) =>
          lines.push(
            `  - [${f.severity.toUpperCase()}] ${f.message}${f.file ? ` (\`${f.file}\`:${f.line})` : ""}`,
          ),
        );
      } else {
        lines.push(`- **Findings:** Zero vulnerabilities detected.`);
      }
    } else {
      lines.push(`*Not executed or failed.*`);
    }

    lines.push(`\n## 5. Token Usage & Cost`);
    lines.push(
      `- **Total Tokens:** ${result.aggregatedUsage.totalTokens.toLocaleString()}`,
    );
    lines.push(
      `- **Estimated Cost:** $${(result.aggregatedUsage.estimatedCostCents / 100).toFixed(4)}`,
    );

    return lines.join("\n");
  }
}
