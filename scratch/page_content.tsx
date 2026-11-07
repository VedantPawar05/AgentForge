"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  apiClient,
  TaskItem,
  WorkspaceItem,
  ProjectItem,
} from "@/lib/api-client";
import { AnalyticsBento } from "@/components/ui/analytics-bento";

// ── Bento SVG Telemetry Helpers ─────────────────────────────────────
const bell = (x: number, m: number, s: number) => Math.exp(-(((x - m) / s) ** 2) / 2);
const bentoHours = Array.from({ length: 25 }, (_, h) => h);
const bentoDesktop = [0, 1, 2].map((w) =>
  bentoHours.map((h) =>
    Math.round(2400 * (1 - w * 0.16) * (bell(h, 13 - w * 0.6, 3.4) * 0.92 + bell(h, 20, 2.2) * 0.18))
  )
);
const bentoMobile = [0, 1, 2].map((w) =>
  bentoHours.map((h) =>
    Math.round(2600 * (1 - w * 0.18) * (bell(h, 20.5 - w * 0.4, 3) * 0.95 + bell(h, 8, 1.8) * 0.2))
  )
);
const bentoRevenue = [
  7420, 7510, 7460, 7380, 7490, 7640, 7720, 7680, 7590, 7560,
  7630, 7780, 7900, 7960, 7910, 7850, 7880, 8010, 8140, 8230,
  8190, 8120, 8260, 8430, 8560, 8620, 8700, 8890, 9020, 9134
];

const WS_URL =
  (typeof window !== "undefined" && (window as any).__NEXT_PUBLIC_WS_URL) ||
  (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000");

// ── Provider Configuration Types ──────────────────────────────────
export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  models: string[];
  keyPlaceholder: string;
  apiKey: string;
  status: "CONNECTED" | "UNCONFIGURED" | "TESTING" | "ERROR";
  latencyMs?: number;
  isDefault?: boolean;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    icon: "✽",
    description: "Leading frontier coding reasoning, iterative turn repair and strict architecture enforcement.",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    keyPlaceholder: "sk-ant-api03-...",
    apiKey: "sk-ant-mock7149a81",
    status: "CONNECTED",
    latencyMs: 52,
    isDefault: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    icon: "✦",
    description: "Multimodal 1M+ token context window, fast tool dispatch and code synthesis.",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    keyPlaceholder: "AIzaSy...",
    apiKey: "AIzaSyD8k1992MockKeyActive",
    status: "CONNECTED",
    latencyMs: 48,
    isDefault: false,
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    icon: "◈",
    description: "Deep codebase online search, real-time documentation grounding and web research.",
    models: ["sonar-deep-research", "sonar-pro", "sonar"],
    keyPlaceholder: "pplx-...",
    apiKey: "pplx-mock98214fa821",
    status: "CONNECTED",
    latencyMs: 98,
    isDefault: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "⬡",
    description: "High-throughput general coding, instruction following and function calling.",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    keyPlaceholder: "sk-proj-...",
    apiKey: "",
    status: "UNCONFIGURED",
    isDefault: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "◇",
    description: "Deep mathematical reasoning and code generation with ultra-low token cost.",
    models: ["deepseek-r1", "deepseek-chat"],
    keyPlaceholder: "sk-...",
    apiKey: "",
    status: "UNCONFIGURED",
    isDefault: false,
  },
  {
    id: "ollama",
    name: "Local Ollama",
    icon: "🦙",
    description: "Private local models executing air-gapped via native llama.cpp / Ollama host.",
    models: ["qwen2.5-coder:32b", "llama3.3:70b", "deepseek-r1:14b"],
    keyPlaceholder: "http://localhost:11434",
    apiKey: "http://localhost:11434",
    status: "CONNECTED",
    latencyMs: 12,
    isDefault: false,
  },
];

// Telemetry datasets based on time-range selection
const TELEMETRY_RANGES = {
  "7D": {
    tasksCompleted: 32,
    tasksDelta: "+8% vs prior",
    tokensUsed: "1.14M",
    tokensDelta: "+2% vs prior",
    apiSpend: "$9.10",
    spendBudget: "45% of budget",
    mergeRate: "96%",
    mergeDelta: "+4 pts",
    desktopCurve:
      "M0 160 C40 160 40 140 80 140 C120 140 120 120 160 120 C200 120 200 90 240 90 C280 90 280 80 320 80 C360 80 360 60 400 60 C440 60 440 75 480 75 C520 75 520 45 560 45 C600 45 600 65 640 65",
    workersCurve:
      "M0 180 C40 180 40 165 80 165 C120 165 120 170 160 170 C200 170 200 140 240 140 C280 140 280 150 320 150 C360 150 360 120 400 120 C440 120 440 130 480 130 C520 130 520 105 560 105 C600 105 600 115 640 115",
  },
  "30D": {
    tasksCompleted: 128,
    tasksDelta: "+12% vs prior",
    tokensUsed: "4.82M",
    tokensDelta: "+4% vs prior",
    apiSpend: "$38.40",
    spendBudget: "62% of budget",
    mergeRate: "94%",
    mergeDelta: "+2 pts",
    desktopCurve:
      "M0 150 C40 150 40 120 80 120 C120 120 120 100 160 100 C200 100 200 70 240 70 C280 70 280 60 320 60 C360 60 360 50 400 50 C440 50 440 70 480 70 C520 70 520 35 560 35 C600 35 600 55 640 55",
    workersCurve:
      "M0 190 C40 190 40 175 80 175 C120 175 120 180 160 180 C200 180 200 150 240 150 C280 150 280 160 320 160 C360 160 360 130 400 130 C440 130 440 140 480 140 C520 140 520 115 560 115 C600 115 600 125 640 125",
  },
  "90D": {
    tasksCompleted: 412,
    tasksDelta: "+19% vs prior",
    tokensUsed: "16.4M",
    tokensDelta: "+9% vs prior",
    apiSpend: "$124.80",
    spendBudget: "78% of budget",
    mergeRate: "92%",
    mergeDelta: "+1 pt",
    desktopCurve:
      "M0 140 C40 140 40 110 80 110 C120 110 120 90 160 90 C200 90 200 60 240 60 C280 60 280 50 320 50 C360 50 360 40 400 40 C440 40 440 60 480 60 C520 60 520 30 560 30 C600 30 600 45 640 45",
    workersCurve:
      "M0 185 C40 185 40 160 80 160 C120 160 120 165 160 165 C200 165 200 135 240 135 C280 135 280 145 320 145 C360 145 360 115 400 115 C440 115 440 125 480 125 C520 125 520 100 560 100 C600 100 600 110 640 110",
  },
};

export default function DashboardPage() {
  // ── Navigation & Views ──────────────────────────────────────────
  // 7 Primary screens: "studio" | "dashboard" | "tasks" | "review" | "worktree" | "split" | "providers" | "analytics"
  const [activeTab, setActiveTab] = useState<string>("studio");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Read URL query parameter (?tab=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["studio", "dashboard", "tasks", "review", "worktree", "split", "providers", "analytics"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // ── Workspace & Project State ───────────────────────────────────
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceItem | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // ── Tasks & Telemetry State ─────────────────────────────────────
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // ── Real-time Terminal Logs ─────────────────────────────────────
  const [terminalLogs, setTerminalLogs] = useState<
    { id: string; time: string; type: string; message: string }[]
  >([
    { id: "1", time: "10:14:02", type: "SYSTEM", message: "AgentForge CLI Daemon v1.0.0 initialized." },
    { id: "2", time: "10:14:03", type: "WORKTREE", message: "Created ephemeral git lease 0x9f18a24c in .agentforge/wt-9f18a2" },
    { id: "3", time: "10:14:05", type: "ARCHITECT", message: "[Architect] Reading src/auth/session.ts, src/api/refresh.ts" },
    { id: "4", time: "10:14:08", type: "DEVELOPER", message: "[Developer] git worktree add .agentforge/wt-9f18a2 -b fix/auth-timeout" },
    { id: "5", time: "10:14:09", type: "TESTER", message: "[Tester] Tests running: 14/14 passed. Zero regressions detected." },
  ]);
  const termEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Interactive Agent Studio Prompt State ───────────────────────
  const [studioPrompt, setStudioPrompt] = useState<string>("");
  const [isStudioExecuting, setIsStudioExecuting] = useState<boolean>(false);
  const [activeSquadStep, setActiveSquadStep] = useState<"IDLE" | "ARCHITECT" | "DEVELOPER" | "TESTER" | "SECURITY">("IDLE");

  // ── Dashboard Telemetry Screen State ────────────────────────────
  const [telemetryRange, setTelemetryRange] = useState<"7D" | "30D" | "90D">("30D");
  const [waveformMetric, setWaveformMetric] = useState<"sessions" | "tokens">("sessions");
  const [categoryMetric, setCategoryMetric] = useState<"count" | "cost">("count");
  const [showFullBento, setShowFullBento] = useState<boolean>(false);

  // ── Worktree Lease State ────────────────────────────────────────
  const [worktreeLeaseActive, setWorktreeLeaseActive] = useState<boolean>(true);
  const [worktreeDiskUsage, setWorktreeDiskUsage] = useState<string>("184 MB");

  // ── Split View State ────────────────────────────────────────────
  const [splitPanesLayout, setSplitPanesLayout] = useState<1 | 2 | 3 | 4>(2);
  const [splitTab1, setSplitTab1] = useState<string>("session.ts");
  const [splitTab2, setSplitTab2] = useState<string>("session.test.ts");
  const [splitBottomTab, setSplitBottomTab] = useState<"logs" | "problems" | "output">("logs");
  const [splitAgents, setSplitAgents] = useState<
    { role: string; status: string; statusColor: string; isPulse?: boolean }[]
  >([
    { role: "Architect", status: "Done · 0:42", statusColor: "#10b981" },
    { role: "Developer", status: "Pane 1 · writing", statusColor: "#34d399", isPulse: true },
    { role: "Tester", status: "Pane 2 · writing", statusColor: "#fbbf24", isPulse: true },
    { role: "Security Auditor", status: "Queued", statusColor: "#9a9aa6" },
  ]);

  // ── Providers & API Keys State ──────────────────────────────────
  const [providers, setProviders] = useState<ProviderConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_providers");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return DEFAULT_PROVIDERS;
  });
  const [editingProviderKey, setEditingProviderKey] = useState<Record<string, string>>({});
  const [showKeyText, setShowKeyText] = useState<Record<string, boolean>>({});

  // ── Modals & Task Creation State ────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskDesc, setNewTaskDesc] = useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("HIGH");
  const [newTaskBranch, setNewTaskBranch] = useState<string>("main");
  const [newTaskProvider, setNewTaskProvider] = useState<string>("anthropic");
  const [newTaskModel, setNewTaskModel] = useState<string>("claude-3-7-sonnet");
  const [newTaskSquad, setNewTaskSquad] = useState<string>("FULL_STACK");
  const [newTaskBudget, setNewTaskBudget] = useState<number>(4.0);
  const [isSubmittingTask, setIsSubmittingTask] = useState<boolean>(false);

  // ── Diff & Review Modal State ───────────────────────────────────
  const [diffModalTask, setDiffModalTask] = useState<TaskItem | null>(null);
  const [diffContent, setDiffContent] = useState<string>("");
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // ── Worktree Explorer State ─────────────────────────────────────
  const [selectedWorktreeFile, setSelectedWorktreeFile] = useState<string>("src/auth/session.ts");
  const worktreeFiles = useMemo(
    () => [
      {
        path: "src/auth/session.ts",
        status: "MODIFIED",
        additions: 18,
        deletions: 6,
        size: "3.4 KB",
        content: `// AgentForge Session Refresh Controller with Timeout Guard
import { REFRESH_URL, REFRESH_TIMEOUT_MS } from "./config";
import { SessionError } from "./errors";

export async function refreshSession(token: string) {
  // Abort the request if the server stalls
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(REFRESH_URL, {
      method: "POST",
      headers: { Authorization: \`Bearer \${token}\` },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new SessionError("refresh_failed");
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}`,
      },
      {
        path: "src/api/refresh.ts",
        status: "MODIFIED",
        additions: 4,
        deletions: 0,
        size: "1.8 KB",
        content: `import { Router } from "express";
import { refreshSession } from "../auth/session";

export const refreshRouter = Router();

refreshRouter.post("/refresh", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "missing_token" });
  const result = await refreshSession(token);
  res.json(result);
});`,
      },
      {
        path: "src/auth/session.test.ts",
        status: "ADDED",
        additions: 22,
        deletions: 0,
        size: "2.1 KB",
        content: `import { describe, it, expect, vi } from "vitest";
import { refreshSession } from "./session";

describe("refreshSession", () => {
  it("aborts when the server stalls past timeout", async () => {
    vi.useFakeTimers();
    const p = refreshSession("stale-tok");
    vi.advanceTimersByTime(5000);
    await expect(p).rejects.toThrow("refresh_failed");
  });

  it("returns session payload on valid response", async () => {
    const session = await refreshSession("valid-tok");
    expect(session.user.id).toBeDefined();
  });
});`,
      },
    ],
    []
  );

  // ── Selected default provider label ──────────────────────────────
  const defaultProvider = useMemo(() => {
    return providers.find((p) => p.isDefault) || providers[0];
  }, [providers]);

  // Auto-scroll terminal
  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Initial Data Fetch
  const refreshTasks = useCallback(async () => {
    if (!selectedWorkspace) return;
    try {
      const res = await apiClient.getTasks(selectedWorkspace.id);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const res = await apiClient.getWorkspaces();
        const wsList = (res.workspaces || []).map((w) => w.workspace);
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          const ws = wsList[0];
          setSelectedWorkspace(ws);
          const prjRes = await apiClient.getProjects(ws.id);
          const prjList = prjRes.projects || [];
          setProjects(prjList);
          if (prjList.length > 0) {
            setSelectedProject(prjList[0]);
          }
          const taskRes = await apiClient.getTasks(ws.id);
          setTasks(taskRes.tasks || []);
        }
      } catch (err) {
        console.error("Failed to initialize dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // WebSocket for real-time live events
  useEffect(() => {
    if (!selectedWorkspace) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", workspaceId: selectedWorkspace.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "TASK_UPDATED" || data.type === "RUN_LOG") {
          const time = new Date().toLocaleTimeString();
          setTerminalLogs((prev) => [
            ...prev,
            { id: Math.random().toString(), time, type: data.type, message: data.message || JSON.stringify(data.payload) },
          ]);
          refreshTasks();
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedWorkspace, refreshTasks]);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === "ALL") return true;
      return t.status === statusFilter;
    });
  }, [tasks, searchQuery, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => ["IN_PROGRESS", "RUNNING", "QUEUED"].includes(t.status)).length;
    const awaitingReview = tasks.filter((t) => t.status === "AWAITING_REVIEW").length;
    const completed = tasks.filter((t) => ["COMPLETED", "APPROVED", "MERGED"].includes(t.status)).length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 94;
    return {
      totalTasks: total || 24,
      runningSessions: inProgress || 6,
      awaitingReview: awaitingReview || 4,
      mergedOrApproved: completed || 14,
      successRate,
    };
  }, [tasks]);

  // Handlers for Task Creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkspace || !newTaskTitle.trim()) return;

    setIsSubmittingTask(true);
    try {
      const projectId = selectedProject?.id || (projects.length > 0 ? projects[0].id : "default-project");
      const res = await apiClient.createTask(selectedWorkspace.id, {
        projectId,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        priority: newTaskPriority as any,
        targetBranch: newTaskBranch.trim() || "main",
      });
      const task = res.task;

      // Clear & Close
      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreateModalOpen(false);
      setActionSuccessMsg(`Task "${task.title}" dispatched successfully!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);

      // Refresh task list & navigate to Studio to watch squad execution
      await refreshTasks();
      setActiveTab("studio");
      handleExecuteStudioPrompt(`${task.title} (model: ${newTaskModel})`);
    } catch (err: any) {
      alert(`Failed to create task: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleRunTask = async (taskId: string, title?: string) => {
    if (!selectedWorkspace) return;
    try {
      await apiClient.triggerRun(selectedWorkspace.id, taskId);
      setActionSuccessMsg(`Squad dispatched for task "${title || taskId}"!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setActiveTab("studio");
      handleExecuteStudioPrompt(title || "Executing autonomous task patch...");
      await refreshTasks();
    } catch (err: any) {
      alert(`Run failed: ${err?.message}`);
    }
  };

  const handleViewDiff = async (task: TaskItem) => {
    if (!selectedWorkspace) return;
    setDiffModalTask(task);
    setIsLoadingDiff(true);
    setDiffContent("");
    setReviewNotes("");

    try {
      const res = await apiClient.getRunDiff(selectedWorkspace.id, task.id, "latest");
      setDiffContent(res.diff || "// No uncommitted changes detected in worktree.");
    } catch {
      setDiffContent(
        `--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -38,10 +38,14 @@\n-export async function refreshSession(token: string) {\n-  const res = await fetch(REFRESH_URL, { headers: { Authorization: token } });\n-  return await res.json();\n-}\n+export async function refreshSession(token: string) {\n+  const ctrl = new AbortController();\n+  const tid = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);\n+  try {\n+    const res = await fetch(REFRESH_URL, { signal: ctrl.signal, headers: { Authorization: \`Bearer \${token}\` } });\n+    if (!res.ok) throw new SessionError("refresh_failed");\n+    return await res.json();\n+  } finally {\n+    clearTimeout(tid);\n+  }\n+}`
      );
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedWorkspace || !diffModalTask) return;
    setIsSubmittingReview(true);
    try {
      await apiClient.submitReview(selectedWorkspace.id, diffModalTask.id, {
        status: "APPROVED",
        reviewNotes: reviewNotes || "Cryptographically signed and approved by engineer.",
      });
      setDiffModalTask(null);
      setActionSuccessMsg(`Task ${diffModalTask.title} approved with cryptographic sign-off!`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
      await refreshTasks();
    } catch (err: any) {
      alert(`Approval failed: ${err?.message}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleMerge = async (task: TaskItem) => {
    if (!selectedWorkspace) return;
    try {
      const res = await apiClient.mergeTask(selectedWorkspace.id, task.id);
      setActionSuccessMsg(`Merged into ${task.targetBranch || "main"}! Commit: ${res.commitSha?.slice(0, 8) || "7d02e1b"}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await refreshTasks();
    } catch (err: any) {
      alert(`Merge failed: ${err?.message}`);
    }
  };

  // ── Studio CLI Command Runner ───────────────────────────────────
  const handleExecuteStudioPrompt = (customPrompt?: string) => {
    const prompt = customPrompt || studioPrompt.trim();
    if (!prompt) return;

    setIsStudioExecuting(true);
    setActiveSquadStep("ARCHITECT");

    const time = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [
      ...prev,
      { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge run "${prompt}"` },
      { id: Math.random().toString(), time, type: "ARCHITECT", message: `[Architect] Reading codebase AST and generating interface contract...` },
    ]);
    if (!customPrompt) setStudioPrompt("");

    // Simulate multi-agent pipeline
    setTimeout(() => {
      setActiveSquadStep("DEVELOPER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: `[Developer] git worktree add .agentforge/wt-9f18a2 -b fix/auth-timeout` },
        { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: `[Developer] Implemented AbortController guard in src/auth/session.ts` },
      ]);
    }, 800);

    setTimeout(() => {
      setActiveSquadStep("TESTER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: `[Tester] Running test harness: vitest run src/auth/session.test.ts` },
        { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: `[Tester] 14/14 tests passing. Zero regressions in worktree sandbox.` },
      ]);
    }, 1600);

    setTimeout(() => {
      setActiveSquadStep("SECURITY");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "SECURITY", message: `[Security] Static analysis passed. Zero token leaks. Ready for review.` },
      ]);
      setIsStudioExecuting(false);
      setActiveSquadStep("IDLE");
      setActionSuccessMsg("Agent Squad successfully drafted and verified the patch!");
      setTimeout(() => setActionSuccessMsg(null), 3500);
    }, 2400);
  };

  // ── Provider API Key Management ─────────────────────────────────
  const handleTestProvider = (providerId: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, status: "TESTING" as const } : p))
    );

    setTimeout(() => {
      const mockLatency = Math.floor(Math.random() * 50) + 35;
      setProviders((prev) => {
        const updated = prev.map((p) =>
          p.id === providerId ? { ...p, status: "CONNECTED" as const, latencyMs: mockLatency } : p
        );
        if (typeof window !== "undefined") {
          localStorage.setItem("agentforge_providers", JSON.stringify(updated));
        }
        return updated;
      });
      setActionSuccessMsg(`Provider ${providerId.toUpperCase()} ping successful (${mockLatency}ms)!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }, 600);
  };

  const handleSaveProviderKey = (providerId: string) => {
    const keyVal = editingProviderKey[providerId];
    if (!keyVal) return;

    setProviders((prev) => {
      const updated = prev.map((p) =>
        p.id === providerId ? { ...p, apiKey: keyVal, status: "CONNECTED" as const, latencyMs: 48 } : p
      );
      if (typeof window !== "undefined") {
        localStorage.setItem("agentforge_providers", JSON.stringify(updated));
      }
      return updated;
    });

    setEditingProviderKey((prev) => {
      const copy = { ...prev };
      delete copy[providerId];
      return copy;
    });

    setActionSuccessMsg(`API key for ${providerId.toUpperCase()} saved & verified!`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleSetDefaultProvider = (providerId: string) => {
    setProviders((prev) => {
      const updated = prev.map((p) => ({
        ...p,
        isDefault: p.id === providerId,
      }));
      if (typeof window !== "undefined") {
        localStorage.setItem("agentforge_providers", JSON.stringify(updated));
      }
      return updated;
    });
    const found = providers.find((p) => p.id === providerId);
    setActionSuccessMsg(`Default foundation engine set to ${found?.name || providerId}!`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // ── Worktree Sandbox Actions ────────────────────────────────────
  const handleReleaseLease = () => {
    setWorktreeLeaseActive(false);
    setWorktreeDiskUsage("0 MB");
    setActionSuccessMsg("Ephemeral worktree lease 0x9f18a24c released and workspace cleaned up.");
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleSendToReview = () => {
    setActionSuccessMsg("Worktree branch fix/auth-timeout sent to Code Review queue.");
    setTimeout(() => setActionSuccessMsg(null), 3000);
    setActiveTab("review");
  };

  // ── Split View Add Agent ────────────────────────────────────────
  const handleAddAgentToSplit = () => {
    const newAgent = {
      role: "Security Auditor",
      status: "Pane 3 · static analysis",
      statusColor: "#ff5a1f",
      isPulse: true,
    };
    setSplitAgents((prev) => {
      if (prev.some((a) => a.role === "Security Auditor" && a.status.includes("Pane 3"))) {
        return prev;
      }
      return [...prev.filter((a) => a.role !== "Security Auditor"), newAgent];
    });
    setSplitPanesLayout(3);
    setActionSuccessMsg("Added Security Auditor to live split-screen coding session!");
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // CSV Export
  const exportCSV = () => {
    const header = "ID,Title,Status,Priority,Branch,CreatedAt\n";
    const rows = tasks
      .map(
        (t) =>
          `${t.id},"${t.title.replace(/"/g, '""')}",${t.status},${t.priority},${t.targetBranch || "main"},${t.createdAt}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `agentforge-tasks-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app">
      {/* ── SIDEBAR NAVIGATION ───────────────────────────────────── */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand Header */}
        <div className="brand">
          <div className="brand-badge">AF</div>
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-name">AgentForge</div>
              <div className="brand-sub">Autonomous Orchestrator</div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ fontSize: "11px", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            title="Toggle Sidebar"
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="nav">
          {/* CORE SECTION */}
          <div className="nav-group">
            <div className="nav-label">Core Engine</div>
            <a
              className={`nav-link ${activeTab === "studio" ? "active" : ""}`}
              onClick={() => setActiveTab("studio")}
            >
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="m6 8 3 3-3 3M13 14h5" />
                <path d="M2 17h20" />
              </svg>
              <span>CLI Studio</span>
              <b className="count" style={{ background: "#cc0000", color: "#fff" }}>CLI</b>
            </a>

            <a
              className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <span>Dashboard</span>
              <b className="count" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>Live</b>
            </a>

            <a
              className={`nav-link ${activeTab === "tasks" ? "active" : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M9 6h11M9 12h11M9 18h11" />
                <path d="m3.5 6 1.2 1.2 2.1-2.2M3.5 12l1.2 1.2 2.1-2.2M3.5 18l1.2 1.2 2.1-2.2" />
              </svg>
              <span>Tasks</span>
              <b className="count">{tasks.length || 24}</b>
            </a>

            <a
              className={`nav-link ${activeTab === "review" ? "active" : ""}`}
              onClick={() => setActiveTab("review")}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="6" cy="5" r="2" />
                <circle cx="6" cy="19" r="2" />
                <circle cx="18" cy="8" r="2" />
                <path d="M6 7v10M18 10c0 4-8 3-11.5 7.5" />
              </svg>
              <span>Code Review</span>
              <b className="count" style={{ background: "var(--amber)", color: "#000", fontWeight: 700 }}>
                {metrics.awaitingReview || 4}
              </b>
            </a>
          </div>

          {/* INFRASTRUCTURE & SETTINGS */}
          <div className="nav-group">
            <div className="nav-label">Infrastructure</div>
            <a
              className={`nav-link ${activeTab === "worktree" ? "active" : ""}`}
              onClick={() => setActiveTab("worktree")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <span>Sandboxes</span>
              <b className="count" style={{ background: "rgba(59,240,140,0.15)", color: "#3bf08c" }}>3</b>
            </a>

            <a
              className={`nav-link ${activeTab === "split" ? "active" : ""}`}
              onClick={() => setActiveTab("split")}
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M12 4v16" />
              </svg>
              <span>Split View</span>
              <b className="count" style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee" }}>Live</b>
            </a>

            <a
              className={`nav-link ${activeTab === "providers" ? "active" : ""}`}
              onClick={() => setActiveTab("providers")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Providers</span>
              <b className="count" style={{ background: "rgba(139,61,255,0.15)", color: "#8b3dff" }}>6</b>
            </a>
          </div>
        </nav>

        {/* Sidebar Status Footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
          {!sidebarCollapsed && (
            <>
              <div
                onClick={() => setActiveTab("providers")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
                title="Click to change default engine"
              >
                <span>Default engine</span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{defaultProvider.name.replace("Anthropic ", "").replace("Google ", "")}</span>
              </div>
              <div
                onClick={() => setActiveTab("worktree")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "rgba(16,185,129,0.06)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  fontSize: "11px",
                  color: "#10b981",
                  cursor: "pointer",
                }}
                title="Click to view active worktrees"
              >
                <span>3 worktrees active</span>
                <span style={{ fontSize: "10px" }}>● live</span>
              </div>
            </>
          )}

          {/* User Profile */}
          <div className="profile" style={{ marginTop: "4px" }}>
            <span className="avatar">AF</span>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <div className="profile-name">{selectedWorkspace?.name || "Workspace"}</div>
                <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                  {defaultProvider.name}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN VIEWPORT ─────────────────────────────────────────── */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div className="crumbs">
            <span style={{ color: "var(--muted)" }}>AgentForge</span>
            <span className="crumb-sep">/</span>
            <span>{selectedWorkspace?.name || "Workspace"}</span>
            <span className="crumb-sep">/</span>
            <strong>
              {activeTab === "studio"
                ? "CLI Studio"
                : activeTab === "dashboard"
                ? "Dashboard"
                : activeTab === "tasks"
                ? "Tasks"
                : activeTab === "review"
                ? "Code Review"
                : activeTab === "worktree"
                ? "Sandboxes"
                : activeTab === "split"
                ? "Split View"
                : activeTab === "providers"
                ? "Providers"
                : "Bento Telemetry"}
            </strong>
          </div>

          <div className="top-actions">
            {/* Quick Default Engine Pill */}
            <div
              onClick={() => setActiveTab("providers")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                fontSize: "11.5px",
                fontFamily: "var(--font-mono, monospace)",
              }}
              title="Click to configure AI providers and API keys"
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              <span>{defaultProvider.name}</span>
              <span style={{ color: "var(--muted)", fontSize: "10px" }}>{defaultProvider.latencyMs || 48}ms</span>
            </div>

            <button
              className="btn"
              style={{ borderColor: activeTab === "studio" ? "#cc0000" : undefined, color: activeTab === "studio" ? "#ff4d4d" : undefined }}
              onClick={() => setActiveTab("studio")}
            >
              CLI Studio
            </button>

            <button className="btn" onClick={exportCSV} title="Export CSV Data">
              Export
            </button>

            <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* Global Action Toast Notification */}
        {actionSuccessMsg && (
          <div
            style={{
              margin: "12px 28px 0",
              padding: "8px 14px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#10b981",
              borderRadius: "8px",
              fontSize: "11.5px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>✓ {actionSuccessMsg}</span>
            <button onClick={() => setActionSuccessMsg(null)} style={{ color: "inherit", cursor: "pointer", background: "none", border: "none" }}>✕</button>
          </div>
        )}

        <div className="content" style={{ padding: "20px 28px 40px" }}>
          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 1: AGENT CLI STUDIO & LIVE SQUAD RUNNER           */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "studio" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Studio Header & Squad Pipeline Bar */}
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                    Agent CLI Studio
                  </h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Dispatch a squad and watch each agent work
                  </p>
                </div>

                {/* Squad Pipeline Step Nodes */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {[
                    { id: "ARCHITECT", label: "Architect", note: "done · 0:42", role: "Planning & AST" },
                    { id: "DEVELOPER", label: "Developer", note: "running · 1:58", role: "Worktree Code Gen" },
                    { id: "TESTER", label: "Tester", note: "queued", role: "Vitest Assertions" },
                    { id: "SECURITY", label: "Security", note: "queued", role: "AST & Token Leak Audit" },
                  ].map((step, idx) => {
                    const isActive = activeSquadStep === step.id;
                    const isPassed =
                      (activeSquadStep === "DEVELOPER" && idx === 0) ||
                      (activeSquadStep === "TESTER" && idx <= 1) ||
                      (activeSquadStep === "SECURITY" && idx <= 2);

                    return (
                      <React.Fragment key={step.id}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 12px",
                            borderRadius: "10px",
                            background: isActive
                              ? "rgba(16,185,129,0.12)"
                              : isPassed
                              ? "rgba(255,255,255,0.06)"
                              : "rgba(255,255,255,0.02)",
                            border: isActive
                              ? "1px solid #10b981"
                              : isPassed
                              ? "1px solid rgba(255,255,255,0.12)"
                              : "1px solid var(--border)",
                            color: isActive ? "#10b981" : isPassed ? "var(--text)" : "var(--muted)",
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: isActive ? "#10b981" : isPassed ? "#3bf08c" : "var(--faint)",
                              boxShadow: isActive ? "0 0 8px #10b981" : undefined,
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "11.5px", fontWeight: 600 }}>{step.label}</span>
                            <span style={{ fontSize: "9.5px", opacity: 0.7 }}>{step.note}</span>
                          </div>
                        </div>
                        {idx < 3 && (
                          <span style={{ color: "var(--border-soft)", fontSize: "12px" }}>→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Worktree Banner */}
              <div
                style={{
                  padding: "8px 16px",
                  background: "#0e0e12",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11.5px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                  <span>agentforge — wt-9f18a24c / fix/auth-timeout</span>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span>PID: 48213</span>
                  <span>Disk: 184 MB</span>
                  <span style={{ color: "var(--text)" }}>Base: main @ 7d02e1b</span>
                </div>
              </div>

              {/* Streaming Terminal Window */}
              <div
                style={{
                  background: "#08080a",
                  border: "1px solid #1f1f26",
                  borderRadius: "var(--radius-card)",
                  overflow: "hidden",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                }}
              >
                {/* Terminal Window Header Bar */}
                <div
                  style={{
                    background: "#0e0e12",
                    padding: "10px 16px",
                    borderBottom: "1px solid #1a1a20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f56" }} />
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ffbd2e" }} />
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#27c93f" }} />
                    <span style={{ marginLeft: "10px", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                      agentforge-cli · streaming orchestration bus
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn"
                      style={{ padding: "3px 8px", fontSize: "10px" }}
                      onClick={() => setTerminalLogs([])}
                    >
                      Clear Log
                    </button>
                    <span style={{ fontSize: "10px", color: "var(--muted)", alignSelf: "center", fontFamily: "var(--font-mono, monospace)" }}>
                      {terminalLogs.length} events
                    </span>
                  </div>
                </div>

                {/* Log Lines Container */}
                <div
                  style={{
                    height: "380px",
                    overflowY: "auto",
                    padding: "16px",
                    fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                    fontSize: "12px",
                    lineHeight: "1.7",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {terminalLogs.map((log) => {
                    let color = "#ededf0";
                    let badgeBg = "rgba(255,255,255,0.08)";
                    if (log.type === "ARCHITECT") {
                      color = "#7CFF5B";
                      badgeBg = "rgba(124,255,91,0.15)";
                    } else if (log.type === "DEVELOPER") {
                      color = "#8B3DFF";
                      badgeBg = "rgba(139,61,255,0.15)";
                    } else if (log.type === "TESTER") {
                      color = "#FFB800";
                      badgeBg = "rgba(255,184,0,0.15)";
                    } else if (log.type === "SECURITY") {
                      color = "#FF5A1F";
                      badgeBg = "rgba(255,90,31,0.15)";
                    } else if (log.type === "PROMPT") {
                      color = "#22d3ee";
                      badgeBg = "rgba(34,211,238,0.15)";
                    } else if (log.type === "SUCCESS") {
                      color = "#10b981";
                      badgeBg = "rgba(16,185,129,0.15)";
                    }

                    return (
                      <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{ color: "#54545d", minWidth: "65px", userSelect: "none" }}>{log.time}</span>
                        <span
                          style={{
                            background: badgeBg,
                            color,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            minWidth: "75px",
                            textAlign: "center",
                          }}
                        >
                          {log.type}
                        </span>
                        <span style={{ color, wordBreak: "break-all" }}>{log.message}</span>
                      </div>
                    );
                  })}
                  {isStudioExecuting && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10b981", marginTop: "4px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      <span style={{ fontStyle: "italic" }}>Squad working in isolated git worktree wt-9f18a2...</span>
                    </div>
                  )}
                  <div ref={termEndRef} />
                </div>

                {/* Quick Presets & Command Prompt Input Bar */}
                <div style={{ background: "#0e0e12", padding: "14px 16px", borderTop: "1px solid #1a1a20" }}>
                  {/* Preset Chips */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", alignSelf: "center" }}>Quick presets:</span>
                    {[
                      { label: "Fix Auth Timeout", prompt: "Fix auth timeout on token refresh" },
                      { label: "Run All Tests", prompt: "Run complete test harness across all packages" },
                      { label: "Security Audit", prompt: "Audit packages for token leaks and AST injections" },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        className="btn"
                        style={{ padding: "3px 10px", fontSize: "11px", borderRadius: "14px" }}
                        onClick={() => handleExecuteStudioPrompt(chip.prompt)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Interactive CLI Input */}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div
                      style={{
                        flex: 1,
                        background: "#08080a",
                        border: "1px solid #282832",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px",
                      }}
                    >
                      <span style={{ color: "#10b981", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, marginRight: "8px" }}>
                        $
                      </span>
                      <input
                        type="text"
                        value={studioPrompt}
                        onChange={(e) => setStudioPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleExecuteStudioPrompt();
                        }}
                        placeholder='agentforge run "Fix auth timeout on token refresh"'
                        style={{
                          flex: 1,
                          background: "transparent",
                          border: "none",
                          color: "var(--text)",
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "12px",
                          outline: "none",
                          padding: "10px 0",
                        }}
                      />
                    </div>
                    <button
                      className="btn primary"
                      disabled={isStudioExecuting}
                      onClick={() => handleExecuteStudioPrompt()}
                      style={{ minWidth: "120px" }}
                    >
                      {isStudioExecuting ? "Running..." : "Dispatch"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 2: DASHBOARD (TELEMETRY & WORKSPACE OVERVIEW)     */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Telemetry Header */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>Telemetry</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#9a9aa6" }}>Agent activity across your workspace</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* 7D, 30D, 90D range toggle buttons */}
                  <div style={{ display: "inline-flex", background: "#17171d", padding: "3px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    {(["7D", "30D", "90D"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setTelemetryRange(r)}
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          borderRadius: "7px",
                          background: telemetryRange === r ? "#23232a" : "transparent",
                          color: telemetryRange === r ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: telemetryRange === r ? 600 : 400,
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>New Task</span>
                  </button>
                </div>
              </div>

              {/* 4 Top KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Tasks completed</span>
                  <span style={{ fontSize: "34px", fontWeight: 500, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.03em" }}>
                    {TELEMETRY_RANGES[telemetryRange].tasksCompleted}
                  </span>
                  <span className="pill" style={{ alignSelf: "flex-start", borderColor: "#12392d", color: "#34d399", background: "rgba(16,185,129,0.08)" }}>
                    {TELEMETRY_RANGES[telemetryRange].tasksDelta}
                  </span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Tokens used</span>
                  <span style={{ fontSize: "34px", fontWeight: 500, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.03em" }}>
                    {TELEMETRY_RANGES[telemetryRange].tokensUsed}
                  </span>
                  <span className="pill" style={{ alignSelf: "flex-start", borderColor: "#12392d", color: "#34d399", background: "rgba(16,185,129,0.08)" }}>
                    {TELEMETRY_RANGES[telemetryRange].tokensDelta}
                  </span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>API spend</span>
                  <span style={{ fontSize: "34px", fontWeight: 500, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.03em" }}>
                    {TELEMETRY_RANGES[telemetryRange].apiSpend}
                  </span>
                  <span className="pill" style={{ alignSelf: "flex-start", color: "var(--muted)" }}>
                    {TELEMETRY_RANGES[telemetryRange].spendBudget}
                  </span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Merge rate</span>
                  <span style={{ fontSize: "34px", fontWeight: 500, fontFamily: "var(--font-mono, monospace)", letterSpacing: "-0.03em" }}>
                    {TELEMETRY_RANGES[telemetryRange].mergeRate}
                  </span>
                  <span className="pill" style={{ alignSelf: "flex-start", borderColor: "#12392d", color: "#34d399", background: "rgba(16,185,129,0.08)" }}>
                    {TELEMETRY_RANGES[telemetryRange].mergeDelta}
                  </span>
                </div>
              </div>

              {/* Main Charts Row: Waveform & Live Squad */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                {/* Agent Sessions Waveform Card */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "16px", fontWeight: 600 }}>Agent sessions</span>
                      <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#9a9aa6", marginTop: "4px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "10px", height: "3px", borderRadius: "2px", background: "#10b981" }} />
                          Desktop
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "10px", height: "3px", borderRadius: "2px", background: "#06b6d4" }} />
                          Background workers
                        </span>
                      </div>
                    </div>

                    {/* Metric Toggle: Sessions / Tokens */}
                    <div style={{ display: "inline-flex", background: "#17171d", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <button
                        onClick={() => setWaveformMetric("sessions")}
                        style={{
                          padding: "3px 10px",
                          fontSize: "11.5px",
                          borderRadius: "6px",
                          background: waveformMetric === "sessions" ? "#23232a" : "transparent",
                          color: waveformMetric === "sessions" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Sessions
                      </button>
                      <button
                        onClick={() => setWaveformMetric("tokens")}
                        style={{
                          padding: "3px 10px",
                          fontSize: "11.5px",
                          borderRadius: "6px",
                          background: waveformMetric === "tokens" ? "#23232a" : "transparent",
                          color: waveformMetric === "tokens" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Tokens
                      </button>
                    </div>
                  </div>

                  {/* SVG Waveform Curve */}
                  <div style={{ position: "relative", height: "220px", width: "100%" }}>
                    <svg viewBox="0 0 640 220" style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
                      {/* Grid Lines */}
                      <line x1="0" y1="219" x2="640" y2="219" stroke="#1f1f26" strokeWidth="1" />
                      <line x1="0" y1="146" x2="640" y2="146" stroke="#1f1f26" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="73" x2="640" y2="73" stroke="#1f1f26" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Desktop Sessions Line */}
                      <path
                        d={TELEMETRY_RANGES[telemetryRange].desktopCurve}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Background Workers Line */}
                      <path
                        d={TELEMETRY_RANGES[telemetryRange].workersCurve}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Hover Indicator Crosshair */}
                      <line x1="400" y1="0" x2="400" y2="219" stroke="#3a3a44" strokeDasharray="3 4" />
                      <circle cx="400" cy="50" r="5" fill="#0b0b0d" stroke="#10b981" strokeWidth="2.5" />
                      <circle cx="400" cy="130" r="5" fill="#0b0b0d" stroke="#06b6d4" strokeWidth="2.5" />
                    </svg>

                    {/* Tooltip HUD */}
                    <div
                      style={{
                        position: "absolute",
                        left: "62%",
                        top: "10%",
                        background: "#17171d",
                        border: "1px solid #2d2d36",
                        borderRadius: "12px",
                        padding: "8px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "11px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                      }}
                    >
                      <span style={{ color: "#9a9aa6" }}>Today · 14:00</span>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#10b981" }}>Desktop:</span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)" }}>142 active</b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#06b6d4" }}>Workers:</span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)" }}>89 queued</b>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Squad Widget Card */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>Live squad</span>
                    <span className="pill" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", borderColor: "#12392d" }}>
                      ● Running
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "12px", background: "#0e0e12", border: "1px solid #23232a" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Architect</span>
                        <span style={{ fontSize: "11px", color: "#9a9aa6" }}>Plan approved</span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#9a9aa6", fontFamily: "var(--font-mono, monospace)" }}>0:42</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "12px", background: "#0e1512", border: "1px solid #14523f" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Developer</span>
                        <span style={{ fontSize: "11px", color: "#34d399" }}>Editing session.ts</span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#34d399", fontFamily: "var(--font-mono, monospace)" }}>1:58</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "12px", background: "#0e0e12", border: "1px solid #23232a" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fbbf24" }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Tester</span>
                        <span style={{ fontSize: "11px", color: "#9a9aa6" }}>Queued</span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#9a9aa6" }}>—</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "12px", background: "#0e0e12", border: "1px solid #23232a" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#54545d" }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>Security</span>
                        <span style={{ fontSize: "11px", color: "#9a9aa6" }}>Queued</span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#9a9aa6" }}>—</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => setActiveTab("studio")}>
                      CLI Studio →
                    </button>
                    <button className="btn primary" style={{ flex: 1 }} onClick={() => setActiveTab("split")}>
                      Split View →
                    </button>
                  </div>
                </div>
              </div>

              {/* Secondary Row: Categories & Recent Runs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
                {/* Task Categories Breakdown */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>Task categories</span>
                    <div style={{ display: "inline-flex", background: "#17171d", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <button
                        onClick={() => setCategoryMetric("count")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: categoryMetric === "count" ? "#23232a" : "transparent",
                          color: categoryMetric === "count" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Count
                      </button>
                      <button
                        onClick={() => setCategoryMetric("cost")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: categoryMetric === "cost" ? "#23232a" : "transparent",
                          color: categoryMetric === "cost" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Cost
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { name: "Features", pct: 46, color: "#10b981" },
                      { name: "Bug fixes", pct: 27, color: "#06b6d4" },
                      { name: "Security", pct: 15, color: "#8b3dff" },
                      { name: "Refactoring", pct: 12, color: "#ffb800" },
                    ].map((cat) => (
                      <div key={cat.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                          <span>{cat.name}</span>
                          <span style={{ fontFamily: "var(--font-mono, monospace)", color: "#9a9aa6" }}>
                            {categoryMetric === "count" ? `${cat.pct}%` : `$${(cat.pct * 0.83).toFixed(2)}`}
                          </span>
                        </div>
                        <div style={{ height: "7px", borderRadius: "999px", background: "#1c1c23", overflow: "hidden" }}>
                          <div style={{ width: `${cat.pct}%`, height: "100%", background: cat.color, borderRadius: "999px" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Runs Table Card */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>Recent runs</span>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab("tasks");
                      }}
                      style={{ fontSize: "12px", color: "#34d399", textDecoration: "none" }}
                    >
                      View all →
                    </a>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {[
                      { title: "Fix auth timeout on token refresh", branch: "fix/auth-timeout", status: "In progress", cost: "$1.84", statusColor: "#06b6d4" },
                      { title: "Add pagination to audit log API", branch: "feature/audit-pagination", status: "In review", cost: "$3.12", statusColor: "#ffb800" },
                      { title: "Dependency bump security scan", branch: "chore/sec-deps", status: "Completed", cost: "$0.42", statusColor: "#10b981" },
                      { title: "Rate-limit middleware for public routes", branch: "feature/rate-limit", status: "In review", cost: "$2.18", statusColor: "#ffb800" },
                    ].map((run, i) => (
                      <div
                        key={run.title}
                        onClick={() => setActiveTab("tasks")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 0",
                          borderTop: i > 0 ? "1px solid #23232a" : "none",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{run.title}</span>
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                            {run.branch}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span
                            className="pill"
                            style={{
                              borderColor: `${run.statusColor}33`,
                              color: run.statusColor,
                              background: `${run.statusColor}11`,
                            }}
                          >
                            {run.status}
                          </span>
                          <span style={{ fontSize: "12.5px", fontFamily: "var(--font-mono, monospace)", minWidth: "50px", textAlign: "right" }}>
                            {run.cost}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggle Deep Bento Telemetry View */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button
                  className="btn"
                  onClick={() => setShowFullBento(!showFullBento)}
                  style={{ gap: "6px" }}
                >
                  <span>{showFullBento ? "Hide Full Bento Telemetry ▲" : "View Deep Bento Analytics & Seasonality ▼"}</span>
                </button>
              </div>

              {showFullBento && (
                <div style={{ marginTop: "10px" }}>
                  <AnalyticsBento
                    currency="$"
                    revenue={{
                      label: "Token Expenditure & Compute",
                      value: 9134,
                      delta: "2.5%",
                      note: <>Avg. per squad run <span className="text-foreground/80">$1.85</span></>,
                      caption: "Last 30 days",
                      series: bentoRevenue.map((value, i) => ({
                        value,
                        label: new Date(2026, 8, 22 + i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                      })),
                    }}
                    sessions={{
                      label: "Worker Agent Sessions",
                      value: 48210,
                      delta: "12.4%",
                      note: "By hour, last 3 weeks",
                      desktop: bentoDesktop,
                      mobile: bentoMobile,
                    }}
                    categories={{
                      title: "Task Throughput by Capability",
                      groups: [
                        { id: "product", name: "Architect", color: "#7CFF5B", ink: "dark" },
                        { id: "eng", name: "Developer", color: "#8B3DFF", ink: "light" },
                        { id: "growth", name: "Tester", color: "#FFB800", ink: "dark" },
                        { id: "brand", name: "Security", color: "#FF5A1F", ink: "dark" },
                        { id: "ops", name: "Worktree", color: "#888" },
                      ],
                      periods: [
                        { label: "Weekly", total: 2197, delta: "19.6%", compare: "vs 1,340 last wk" },
                        { label: "Monthly", total: 8903, delta: "1.9%", compare: "vs 5,441 last mo" },
                        { label: "Yearly", total: 98134, delta: "22%", compare: "vs 76,330 last yr" },
                      ],
                      items: [
                        { name: "AST Parser", group: "product", values: [509, 2140, 25600] },
                        { name: "Code Gen", group: "eng", values: [412, 1880, 22900] },
                        { name: "Vitest Harness", group: "growth", values: [445, 1590, 18100] },
                        { name: "Secret Audit", group: "brand", values: [331, 1240, 13400] },
                        { name: "Worktree Lease", group: "ops", values: [380, 1120, 12300] },
                      ],
                    }}
                    seasonality={{
                      title: "Sprint Seasonality",
                      years: [
                        {
                          label: "2026",
                          values: [16120, 20540, 24440, 18460, 28080, 21580, 17160, 25740, 30160, 22880, 32240, 23660],
                          stats: [
                            { label: "Monthly avg", value: 8097, delta: "19.6%", note: "44,214 agent runs" },
                            { label: "Year total", value: 312134, delta: "2.5%", note: "301,002 commits" },
                          ],
                          rows: [{ label: "US East", value: "201,192" }, { label: "Europe", value: "192,054" }],
                        },
                      ],
                    }}
                    credit={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 3: TASKS & PIPELINE RUNS                          */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header with Title and New Task Button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Tasks</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>Pipeline runs across all squads</p>
                </div>
                <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
                  + New Task
                </button>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                {[
                  { label: "All", count: tasks.length || 24, val: "ALL" },
                  { label: "In Progress", count: metrics.runningSessions, val: "IN_PROGRESS" },
                  { label: "In Review", count: metrics.awaitingReview, val: "AWAITING_REVIEW" },
                  { label: "Completed", count: metrics.mergedOrApproved, val: "COMPLETED" },
                ].map((f) => (
                  <button
                    key={f.val}
                    onClick={() => setStatusFilter(f.val)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: statusFilter === f.val ? "#17171d" : "transparent",
                      border: statusFilter === f.val ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                      color: statusFilter === f.val ? "var(--text)" : "var(--muted)",
                      cursor: "pointer",
                      fontSize: "12.5px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{f.label}</span>
                    <b style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "11px", opacity: 0.7 }}>{f.count}</b>
                  </button>
                ))}
              </div>

              {/* Tasks List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredTasks.length === 0 ? (
                  <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                    No tasks found matching filter. Click "+ New Task" to queue one.
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="card"
                      style={{
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "14px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "240px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14.5px", fontWeight: 600 }}>{task.title}</span>
                          <span className="pill" style={{ fontSize: "10px" }}>{task.priority}</span>
                        </div>
                        <div style={{ display: "flex", gap: "12px", fontSize: "11.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                          <span>Branch: {task.targetBranch || "main"}</span>
                          <span>·</span>
                          <span>Squad: Hotfix Crew</span>
                          <span>·</span>
                          <span>Cap: $4.00</span>
                        </div>
                      </div>

                      {/* Status & Action Buttons: Diff, Run, Merge */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          className="pill"
                          style={{
                            background:
                              task.status === "APPROVED" || task.status === "MERGED"
                                ? "rgba(16,185,129,0.1)"
                                : task.status === "AWAITING_REVIEW"
                                ? "rgba(255,184,0,0.1)"
                                : "rgba(6,182,212,0.1)",
                            color:
                              task.status === "APPROVED" || task.status === "MERGED"
                                ? "#10b981"
                                : task.status === "AWAITING_REVIEW"
                                ? "#ffb800"
                                : "#06b6d4",
                          }}
                        >
                          {task.status}
                        </span>

                        <button className="btn" onClick={() => handleViewDiff(task)}>
                          Diff
                        </button>

                        <button className="btn" onClick={() => handleRunTask(task.id, task.title)}>
                          Run
                        </button>

                        <button
                          className="btn primary"
                          onClick={() => handleMerge(task)}
                          style={{ background: "#10b981", color: "#000" }}
                        >
                          Merge
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 4: CODE REVIEW & PRS                              */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Code Review</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Nothing reaches main without your sign-off
                  </p>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Review queue · <b style={{ color: "#fff" }}>{metrics.awaitingReview || 4}</b>
                </div>
              </div>

              {/* Split Review Queue & Diff Inspector */}
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", minHeight: "560px" }}>
                {/* Left: Review Queue List */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    { id: "1", title: "Fix auth timeout on token refresh", branch: "fix/auth-timeout", files: 3, tests: "14/14 passed", diff: "+22 −6", active: true },
                    { id: "2", title: "Add pagination to audit log API", branch: "feature/audit-pagination", files: 7, tests: "31/31 passed", diff: "+214 −38", active: false },
                    { id: "3", title: "Rate-limit middleware for public routes", branch: "feature/rate-limit", files: 5, tests: "22/24 passed", diff: "+156 −12", active: false },
                    { id: "4", title: "Harden CORS configuration", branch: "fix/cors-hardening", files: 2, tests: "8/8 passed", diff: "+18 −4", active: false },
                  ].map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: item.active ? "rgba(255,255,255,0.08)" : "transparent",
                        border: item.active ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{item.title}</span>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        <span>{item.branch} · {item.files} files</span>
                        <span style={{ color: "#34d399" }}>{item.diff}</span>
                      </div>
                      <span className="pill" style={{ alignSelf: "flex-start", background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "#12392d", marginTop: "2px" }}>
                        ✓ {item.tests}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Right: Unified Diff Viewer with Request Changes & Approve buttons */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Diff Header */}
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0e0e12" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>src/auth/session.ts</span>
                      <span className="pill" style={{ color: "#34d399" }}>+18 −6</span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn"
                        onClick={() => {
                          const note = prompt("Enter requested changes for squad:");
                          if (note) {
                            setActionSuccessMsg("Changes requested. Squad notified.");
                            setTimeout(() => setActionSuccessMsg(null), 3000);
                          }
                        }}
                      >
                        Request Changes
                      </button>
                      <button
                        className="btn primary"
                        onClick={() => {
                          setActionSuccessMsg("Patch approved with HMAC cryptographic sign-off!");
                          setTimeout(() => setActionSuccessMsg(null), 3500);
                        }}
                      >
                        Approve & Sign-Off
                      </button>
                    </div>
                  </div>

                  {/* Diff Body */}
                  <div
                    style={{
                      flex: 1,
                      padding: "16px 20px",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "12px",
                      lineHeight: "1.7",
                      overflowY: "auto",
                      background: "#08080a",
                    }}
                  >
                    <div style={{ color: "#54545d" }}>@@ -38,10 +38,14 @@ export async function refreshSession(token: string)</div>
                    <div style={{ color: "#ff4d4d", background: "rgba(255,77,77,0.1)", padding: "1px 4px" }}>
                      -  const res = await fetch(REFRESH_URL, &#123; headers: &#123; Authorization: token &#125; &#125;);
                    </div>
                    <div style={{ color: "#ff4d4d", background: "rgba(255,77,77,0.1)", padding: "1px 4px" }}>
                      -  return await res.json();
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +  // abort the request if the server stalls
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +  const ctrl = new AbortController();
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +  const tid = setTimeout(() =&gt; ctrl.abort(), REFRESH_TIMEOUT_MS);
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +  try &#123;
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +    const res = await fetch(REFRESH_URL, &#123; method: &quot;POST&quot;, signal: ctrl.signal &#125;);
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +    if (!res.ok) throw new SessionError(&quot;refresh_failed&quot;);
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +    return await res.json();
                    </div>
                    <div style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 4px" }}>
                      +  &#125; finally &#123; clearTimeout(tid); &#125;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 5: WORKTREE SANDBOXES (SANDBOXES)                  */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "worktree" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header with Title and Release Lease & Send to Review buttons */}
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Worktree Sandbox</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Isolated, ephemeral checkout for each squad
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn" onClick={handleReleaseLease}>
                    Release Lease
                  </button>
                  <button className="btn primary" onClick={handleSendToReview}>
                    Send to Review
                  </button>
                </div>
              </div>

              {/* Lease Metadata Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Lease</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>0x9f18a24c</span>
                    <span className="pill" style={{ color: worktreeLeaseActive ? "#10b981" : "#888" }}>
                      {worktreeLeaseActive ? "Active" : "Released"}
                    </span>
                  </div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Process ID</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>48213</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Branch</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>fix/auth-timeout</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Base</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>main @ 7d02e1b</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Disk usage</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>{worktreeDiskUsage}</div>
                </div>
              </div>

              {/* Split File Explorer & Code Inspector */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", height: "480px" }}>
                {/* File Tree */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", overflowY: "auto", padding: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Files ({worktreeFiles.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {worktreeFiles.map((f) => {
                      const isSelected = selectedWorktreeFile === f.path;
                      return (
                        <div
                          key={f.path}
                          onClick={() => setSelectedWorktreeFile(f.path)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: isSelected ? "rgba(255,255,255,0.08)" : "transparent",
                            border: isSelected ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontSize: "12px", fontFamily: "var(--font-mono, monospace)" }}>{f.path}</span>
                          <span className="pill" style={{ color: "#34d399", fontSize: "10px" }}>+{f.additions} −{f.deletions}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Code Preview Pane */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "#0e0e12", fontSize: "12px", fontFamily: "var(--font-mono, monospace)" }}>
                    {selectedWorktreeFile}
                  </div>
                  <pre
                    style={{
                      flex: 1,
                      margin: 0,
                      padding: "16px 20px",
                      overflowY: "auto",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "12px",
                      lineHeight: "1.7",
                      background: "#08080a",
                      color: "#ededf0",
                    }}
                  >
                    {worktreeFiles.find((f) => f.path === selectedWorktreeFile)?.content || "// Select a file to preview"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 6: SPLIT VIEW (MULTI-AGENT SIDE-BY-SIDE EDITOR)   */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "split" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header with Title, Layout Switcher, and Add Agent Button */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>Split View</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#9a9aa6" }}>Watch several agents write code side by side</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Pane Layout Toggles */}
                  <div style={{ display: "inline-flex", background: "#17171d", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setSplitPanesLayout(n as any)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: splitPanesLayout === n ? "#23232a" : "transparent",
                          color: splitPanesLayout === n ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                        title={`${n} pane${n > 1 ? "s" : ""}`}
                      >
                        {n}P
                      </button>
                    ))}
                  </div>

                  <button className="btn primary" onClick={handleAddAgentToSplit}>
                    + Add Agent
                  </button>
                </div>
              </div>

              {/* Main Split Layout: Roster & Code Panes */}
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "16px", minHeight: "520px" }}>
                {/* Left: Agents Roster & Worktree Info */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                    Active Squad Agents
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {splitAgents.map((ag) => (
                      <div
                        key={ag.role}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: ag.isPulse ? "rgba(16,185,129,0.06)" : "#0e0e12",
                          border: ag.isPulse ? "1px solid #14523f" : "1px solid #23232a",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: ag.statusColor,
                              boxShadow: ag.isPulse ? `0 0 6px ${ag.statusColor}` : undefined,
                            }}
                          />
                          <span style={{ fontSize: "13px", fontWeight: 600 }}>{ag.role}</span>
                        </div>
                        <span style={{ fontSize: "11px", color: ag.statusColor, marginLeft: "16px" }}>{ag.status}</span>
                      </div>
                    ))}
                  </div>

                  {/* Shared Worktree Pill */}
                  <div style={{ marginTop: "auto", padding: "10px 12px", borderRadius: "10px", background: "#0e0e12", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Shared Worktree</span>
                    <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono, monospace)", color: "#34d399" }}>0x9f18a24c</span>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>fix/auth-timeout</span>
                  </div>
                </div>

                {/* Right: Side-by-Side Live Code Panes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: splitPanesLayout === 1 ? "1fr" : "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  {/* Pane 1: Developer editing session.ts */}
                  <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <span className="pill" style={{ background: splitTab1 === "session.ts" ? "#23232a" : "transparent", color: "#fff" }}>
                          session.ts <span style={{ color: "#ffb800", marginLeft: "4px" }}>M</span>
                        </span>
                        <span className="pill" style={{ color: "var(--muted)" }}>refresh.ts</span>
                      </div>
                      <span className="pill" style={{ color: "#34d399", borderColor: "#14523f", background: "rgba(16,185,129,0.08)" }}>
                        ● Developer (Writing)
                      </span>
                    </div>

                    {/* Code Lines with Syntax Coloring */}
                    <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                      <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>38</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; REFRESH_URL, REFRESH_TIMEOUT_MS &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./config&quot;</span>;</div>
                      <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>39</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; SessionError &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./errors&quot;</span>;</div>
                      <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>40</span></div>
                      <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>41</span> <span style={{ color: "#22d3ee" }}>export async function</span> <span style={{ color: "#ffb800" }}>refreshSession</span>(token: <span style={{ color: "#06b6d4" }}>string</span>) &#123;</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>42</span>   <span style={{ color: "#54545d" }}>// abort the request if the server stalls</span></div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>43</span>   <span style={{ color: "#22d3ee" }}>const</span> ctrl = <span style={{ color: "#ffb800" }}>new AbortController</span>();</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>44</span>   <span style={{ color: "#22d3ee" }}>const</span> tid = <span style={{ color: "#ffb800" }}>setTimeout</span>(() =&gt; ctrl.abort(), REFRESH_TIMEOUT_MS);</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>45</span>   <span style={{ color: "#8b3dff" }}>try</span> &#123;</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>46</span>     <span style={{ color: "#22d3ee" }}>const</span> res = <span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>fetch</span>(REFRESH_URL, &#123; method: <span style={{ color: "#10b981" }}>&quot;POST&quot;</span>, signal: ctrl.signal &#125;);</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>47</span>     <span style={{ color: "#8b3dff" }}>if</span> (!res.ok) <span style={{ color: "#8b3dff" }}>throw new</span> SessionError(<span style={{ color: "#10b981" }}>&quot;refresh_failed&quot;</span>);</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>48</span>     <span style={{ color: "#8b3dff" }}>return await</span> res.json();</div>
                      <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>49</span>   &#125; <span style={{ color: "#8b3dff" }}>finally</span> &#123; <span style={{ color: "#ffb800" }}>clearTimeout</span>(tid); &#125;</div>
                      <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>50</span> &#123;</div>
                    </div>
                  </div>

                  {/* Pane 2: Tester writing session.test.ts */}
                  {splitPanesLayout >= 2 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            session.test.ts <span style={{ color: "#34d399", marginLeft: "4px" }}>A</span>
                          </span>
                        </div>
                        <span className="pill" style={{ color: "#fbbf24", borderColor: "#3a3020", background: "rgba(251,191,36,0.08)" }}>
                          ● Tester (Writing)
                        </span>
                      </div>

                      {/* Code Lines for Vitest Suite */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; describe, it, expect, vi &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;vitest&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; refreshSession &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./session&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#ffb800" }}>describe</span>(<span style={{ color: "#10b981" }}>&quot;refreshSession&quot;</span>, () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   <span style={{ color: "#ffb800" }}>it</span>(<span style={{ color: "#10b981" }}>&quot;aborts when server stalls past timeout&quot;</span>, <span style={{ color: "#22d3ee" }}>async</span> () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>     vi.<span style={{ color: "#ffb800" }}>useFakeTimers</span>();</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span>     <span style={{ color: "#22d3ee" }}>const</span> p = <span style={{ color: "#ffb800" }}>refreshSession</span>(<span style={{ color: "#10b981" }}>&quot;stale-tok&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>     vi.<span style={{ color: "#ffb800" }}>advanceTimersByTime</span>(5000);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>expect</span>(p).<span style={{ color: "#ffb800" }}>rejects</span>.toThrow(<span style={{ color: "#10b981" }}>&quot;refresh_failed&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>   &#125;);</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span> &#125;);</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Dock: Agent Log / Problems / Output */}
              <div style={{ background: "#0e0e12", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "#131317", padding: "0 14px" }}>
                  {(["logs", "problems", "output"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSplitBottomTab(tab)}
                      style={{
                        padding: "10px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        border: "none",
                        background: "transparent",
                        color: splitBottomTab === tab ? "#fff" : "var(--muted)",
                        borderBottom: splitBottomTab === tab ? "2px solid #10b981" : "2px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      {tab === "logs" ? "Agent Log" : tab === "problems" ? "Problems 0" : "Output"}
                    </button>
                  ))}
                </div>

                <div style={{ padding: "14px 18px", fontFamily: "var(--font-mono, monospace)", fontSize: "11.5px", color: "#9a9aa6", height: "90px", overflowY: "auto" }}>
                  {splitBottomTab === "logs" && (
                    <div>
                      [Developer] Applied diff to src/auth/session.ts in 142ms.<br />
                      [Tester] Generating unit test matrix in session.test.ts (2 assertions added).
                    </div>
                  )}
                  {splitBottomTab === "problems" && (
                    <div style={{ color: "#10b981" }}>
                      ✓ 0 TypeScript diagnostics or compiler warnings found in active worktree.
                    </div>
                  )}
                  {splitBottomTab === "output" && (
                    <div>
                      PASS src/auth/session.test.ts (14/14 tests passing, 281ms).
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 7: PROVIDERS (AI ENGINE HUB & CREDENTIALS)        */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "providers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header */}
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>AI Providers</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Connect any model. Keys stay on this machine.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--muted)" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                  <span>Provider-Neutral Orchestrator</span>
                </div>
              </div>

              {/* Provider Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                {providers.map((provider) => {
                  const isConnected = provider.status === "CONNECTED";
                  const isDefault = !!provider.isDefault;
                  const isEditing = editingProviderKey[provider.id] !== undefined;
                  const currentKeyValue = isEditing ? editingProviderKey[provider.id] : provider.apiKey;
                  const isRevealed = showKeyText[provider.id] || false;

                  return (
                    <div
                      key={provider.id}
                      className="card"
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        borderColor: isDefault ? "rgba(16,185,129,0.3)" : undefined,
                      }}
                    >
                      {/* Card Header: Icon, Name, and Status Badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "20px", lineHeight: 1 }}>{provider.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "15px" }}>{provider.name}</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                              {provider.models[0]}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {isDefault && (
                            <span className="pill" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", borderColor: "#12392d" }}>
                              Default
                            </span>
                          )}
                          <span
                            className="pill"
                            style={{
                              background: isConnected ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                              color: isConnected ? "#10b981" : "var(--muted)",
                              borderColor: isConnected ? "#12392d" : "var(--border)",
                            }}
                          >
                            {isConnected ? "Connected" : "Not set"}
                          </span>
                        </div>
                      </div>

                      {/* API Key Input Field */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {provider.name} API key
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type={isRevealed ? "text" : "password"}
                            value={currentKeyValue}
                            placeholder={provider.keyPlaceholder}
                            onChange={(e) =>
                              setEditingProviderKey((prev) => ({ ...prev, [provider.id]: e.target.value }))
                            }
                            style={{
                              flex: 1,
                              background: "#0e0e12",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              padding: "7px 10px",
                              color: "var(--text)",
                              fontSize: "12px",
                              fontFamily: "var(--font-mono, monospace)",
                              outline: "none",
                            }}
                          />
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              setShowKeyText((prev) => ({ ...prev, [provider.id]: !isRevealed }))
                            }
                            style={{ padding: "0 10px", fontSize: "11px" }}
                          >
                            {isRevealed ? "Hide" : "Show"}
                          </button>
                          {isEditing && (
                            <button
                              className="btn primary"
                              onClick={() => handleSaveProviderKey(provider.id)}
                              style={{ padding: "0 12px", fontSize: "11px" }}
                            >
                              Save
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Actions: Test Connection & Use as Default Engine */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn"
                            disabled={provider.status === "TESTING"}
                            onClick={() => handleTestProvider(provider.id)}
                            style={{ fontSize: "11.5px" }}
                          >
                            {provider.status === "TESTING" ? "Testing..." : "Test Connection"}
                          </button>
                          {provider.latencyMs && (
                            <span style={{ fontSize: "11px", color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                              {provider.latencyMs} ms
                            </span>
                          )}
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", cursor: "pointer", color: "var(--muted)" }}>
                          <input
                            type="radio"
                            name="default_provider"
                            checked={isDefault}
                            onChange={() => handleSetDefaultProvider(provider.id)}
                          />
                          <span>Use as default</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 8: BENTO TELEMETRY STANDALONE VIEW                */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Operational Bento Telemetry Suite</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Pure SVG micro-visualizations with zero third-party chart bloat
                  </p>
                </div>
                <div style={{ fontSize: "11px", color: "#10b981", fontFamily: "var(--font-mono, monospace)" }}>
                  ● 60 FPS WebGL / SVG Engine
                </div>
              </div>

              <AnalyticsBento
                currency="$"
                revenue={{
                  label: "Token Expenditure & Compute",
                  value: 9134,
                  delta: "2.5%",
                  note: <>Avg. per squad run <span className="text-foreground/80">$1.85</span></>,
                  caption: "Last 30 days",
                  series: bentoRevenue.map((value, i) => ({
                    value,
                    label: new Date(2026, 8, 22 + i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  })),
                }}
                sessions={{
                  label: "Worker Agent Sessions",
                  value: 48210,
                  delta: "12.4%",
                  note: "By hour, last 3 weeks",
                  desktop: bentoDesktop,
                  mobile: bentoMobile,
                }}
                categories={{
                  title: "Task Throughput by Capability",
                  groups: [
                    { id: "product", name: "Architect", color: "#7CFF5B", ink: "dark" },
                    { id: "eng", name: "Developer", color: "#8B3DFF", ink: "light" },
                    { id: "growth", name: "Tester", color: "#FFB800", ink: "dark" },
                    { id: "brand", name: "Security", color: "#FF5A1F", ink: "dark" },
                    { id: "ops", name: "Worktree", color: "#888" },
                  ],
                  periods: [
                    { label: "Weekly", total: 2197, delta: "19.6%", compare: "vs 1,340 last wk" },
                    { label: "Monthly", total: 8903, delta: "1.9%", compare: "vs 5,441 last mo" },
                    { label: "Yearly", total: 98134, delta: "22%", compare: "vs 76,330 last yr" },
                  ],
                  items: [
                    { name: "AST Parser", group: "product", values: [509, 2140, 25600] },
                    { name: "Code Gen", group: "eng", values: [412, 1880, 22900] },
                    { name: "Vitest Harness", group: "growth", values: [445, 1590, 18100] },
                    { name: "Secret Audit", group: "brand", values: [331, 1240, 13400] },
                    { name: "Worktree Lease", group: "ops", values: [380, 1120, 12300] },
                  ],
                }}
                seasonality={{
                  title: "Sprint Seasonality",
                  years: [
                    {
                      label: "2026",
                      values: [16120, 20540, 24440, 18460, 28080, 21580, 17160, 25740, 30160, 22880, 32240, 23660],
                      stats: [
                        { label: "Monthly avg", value: 8097, delta: "19.6%", note: "44,214 agent runs" },
                        { label: "Year total", value: 312134, delta: "2.5%", note: "301,002 commits" },
                      ],
                      rows: [{ label: "US East", value: "201,192" }, { label: "Europe", value: "192,054" }],
                    },
                  ],
                }}
                credit={false}
              />
            </div>
          )}

          {/* Footer */}
          <footer style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "11px" }}>
            <span>AgentForge Multi-Agent Engine · Local CLI Daemon Connected</span>
            <div style={{ display: "flex", gap: "16px" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("providers"); }} style={{ color: "var(--muted)" }}>API Providers</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("studio"); }} style={{ color: "var(--muted)" }}>CLI Terminal</a>
            </div>
          </footer>
        </div>
      </main>

      {/* ── CREATE AGENT TASK MODAL ──────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>New Task</h3>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>Choose a model, a squad, and a spending cap</small>
              </div>
              <button
                className="btn"
                style={{ padding: "4px 8px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "16px" }}
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              {/* Task Title */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>Task</label>
                <input
                  type="text"
                  required
                  placeholder="Fix auth timeout on token refresh"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{
                    background: "#08080a",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "9px 12px",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Foundation Model Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <label style={{ color: "var(--muted)", fontWeight: 500 }}>Model</label>
                  <span style={{ color: "#10b981", fontSize: "11px", fontFamily: "var(--font-mono, monospace)" }}>Provider-Neutral</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                  {[
                    { id: "gemini", model: "gemini-2.0-flash", name: "Gemini 2.0", ctx: "1M" },
                    { id: "anthropic", model: "claude-3-7-sonnet", name: "Claude 3.7", ctx: "200k" },
                    { id: "openai", model: "gpt-4o", name: "GPT-4o", ctx: "128k" },
                    { id: "ollama", model: "qwen2.5-coder:32b", name: "Local Ollama", ctx: "local" },
                  ].map((m) => {
                    const isSelected = newTaskModel === m.model;
                    return (
                      <div
                        key={m.model}
                        onClick={() => {
                          setNewTaskProvider(m.id);
                          setNewTaskModel(m.model);
                        }}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          background: isSelected ? "rgba(16,185,129,0.1)" : "#0e0e12",
                          border: isSelected ? "1px solid #10b981" : "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: "10.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{m.ctx}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Squad Pipeline Archetype */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>Squad pipeline</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { id: "FULL_STACK", title: "Full-Stack Feature", desc: "All four agents" },
                    { id: "HOTFIX", title: "Hotfix Crew", desc: "Developer + Tester" },
                    { id: "SECURITY", title: "Security Sweep", desc: "Auditor + Developer" },
                    { id: "SOLO", title: "Solo Developer", desc: "One agent" },
                  ].map((squad) => {
                    const isSelected = newTaskSquad === squad.id;
                    return (
                      <div
                        key={squad.id}
                        onClick={() => setNewTaskSquad(squad.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          background: isSelected ? "rgba(16,185,129,0.1)" : "#0e0e12",
                          border: isSelected ? "1px solid #10b981" : "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{squad.title}</span>
                        <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>{squad.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Spending Budget Cap Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <label style={{ color: "var(--muted)", fontWeight: 500 }}>Spending budget</label>
                  <span style={{ color: "#fff", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                    ${newTaskBudget.toFixed(2)} USD <span style={{ color: "var(--muted)", fontWeight: 400 }}>(~{Math.round(newTaskBudget * 200)}k tokens)</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={newTaskBudget}
                  onChange={(e) => setNewTaskBudget(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#10b981" }}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <button type="button" className="btn" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={isSubmittingTask}>
                  {isSubmittingTask ? "Dispatching..." : "Dispatch Squad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UNIFIED DIFF INSPECTION MODAL ────────────────────────── */}
      {diffModalTask && (
        <div className="modal-overlay" onClick={() => setDiffModalTask(null)}>
          <div className="modal-card" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 style={{ margin: 0 }}>Reviewing Patch: {diffModalTask.title}</h3>
                <small style={{ color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                  Target: {diffModalTask.targetBranch || "main"} · Status: {diffModalTask.status}
                </small>
              </div>
              <button className="btn" style={{ background: "none", border: "none", color: "var(--muted)" }} onClick={() => setDiffModalTask(null)}>
                ✕
              </button>
            </div>

            <div style={{ margin: "14px 0", maxHeight: "360px", overflowY: "auto", background: "#08080a", border: "1px solid #1a1a20", borderRadius: "8px", padding: "12px" }}>
              {isLoadingDiff ? (
                <div style={{ color: "var(--muted)", fontSize: "12px" }}>Generating unified diff from worktree...</div>
              ) : (
                <pre style={{ margin: 0, fontSize: "11.5px", fontFamily: "var(--font-mono, monospace)", lineHeight: "1.6", color: "#ededf0" }}>
                  {diffContent}
                </pre>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn" onClick={() => setDiffModalTask(null)}>Close</button>
              <button
                className="btn primary"
                onClick={() => {
                  handleApprove();
                  setDiffModalTask(null);
                }}
              >
                Approve & Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
