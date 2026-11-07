"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  apiClient,
  type WorkspaceItem,
  type ProjectItem,
  type TaskItem,
  type TaskStatus,
} from "../../lib/api-client";

// ── Types & Provider Configurations ─────────────────────────────────
interface ProviderConfig {
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

interface GitHubUser {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  token: string;
  repo: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    icon: "✦",
    description: "Multimodal frontier reasoning, huge 2M context window, high-speed streaming.",
    models: ["gemini-2.0-flash", "gemini-2.0-pro-exp", "gemini-1.5-pro"],
    keyPlaceholder: "AIzaSy...",
    apiKey: "",
    status: "CONNECTED",
    latencyMs: 38,
    isDefault: true,
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    icon: "✺",
    description: "Real-time web grounding, live citation verification, research synthesis.",
    models: ["sonar-reasoning-pro", "sonar-pro", "sonar"],
    keyPlaceholder: "pplx-...",
    apiKey: "pplx-mock-key-configured",
    status: "CONNECTED",
    latencyMs: 64,
    isDefault: false,
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    icon: "✳",
    description: "Frontier code refactoring, complex multi-file architectural planning.",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    keyPlaceholder: "sk-ant-...",
    apiKey: "sk-ant-mock-key-configured",
    status: "CONNECTED",
    latencyMs: 52,
    isDefault: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "⚙",
    description: "General intelligence, deterministic structured JSON, broad tool ecosystem.",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    keyPlaceholder: "sk-proj-...",
    apiKey: "sk-proj-mock-key-configured",
    status: "CONNECTED",
    latencyMs: 44,
    isDefault: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "◇",
    description: "Deep mathematical reasoning and high-precision code generation.",
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

// Precise Telemetry Waveform Data Series per Range
interface WaveformPoint {
  x: number;
  y: number;
  val: number;
  label: string;
}

const WAVEFORM_SERIES = {
  "7D": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    desktop: [96, 114, 138, 128, 156, 88, 76],
    workers: [52, 68, 86, 78, 98, 54, 44],
    maxVal: 200,
  },
  "30D": {
    labels: ["Oct 10", "Oct 14", "Oct 18", "Oct 22", "Oct 26", "Oct 30", "Nov 3", "Nov 7"],
    desktop: [105, 122, 134, 152, 144, 168, 178, 194],
    workers: [62, 76, 84, 98, 90, 112, 122, 136],
    maxVal: 220,
  },
  "90D": {
    labels: ["Aug W1", "Aug W3", "Sep W1", "Sep W3", "Oct W1", "Oct W3", "Nov W1"],
    desktop: [84, 108, 132, 158, 184, 218, 252],
    workers: [48, 66, 82, 102, 118, 146, 176],
    maxVal: 300,
  },
};

function buildSmoothSpline(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const TELEMETRY_RANGES = {
  "7D": {
    tasksCompleted: 32,
    tasksDelta: "+8% vs prior",
    sandboxesActive: 3,
    sandboxesDelta: "+1 vs prior",
    testPassRate: "99.2%",
    testPassDelta: "+0.6 pts",
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
    sandboxesActive: 3,
    sandboxesDelta: "+1 vs prior",
    testPassRate: "99.4%",
    testPassDelta: "+1.8 pts",
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
    sandboxesActive: 3,
    sandboxesDelta: "+1 vs prior",
    testPassRate: "98.9%",
    testPassDelta: "+1.2 pts",
    mergeRate: "92%",
    mergeDelta: "+1 pt",
    desktopCurve:
      "M0 140 C40 140 40 110 80 110 C120 110 120 90 160 90 C200 90 200 60 240 60 C280 60 280 40 320 40 C360 40 360 45 400 45 C440 45 440 60 480 60 C520 60 520 25 560 25 C600 25 600 45 640 45",
    workersCurve:
      "M0 170 C40 170 40 155 80 155 C120 155 120 160 160 160 C200 160 200 130 240 130 C280 130 280 140 320 140 C360 140 360 110 400 110 C440 110 440 120 480 120 C520 120 520 95 560 95 C600 95 600 105 640 105",
  },
};

// Specialized Squad Manifest
const SQUAD_AGENTS = {
  SQUAD: {
    id: "SQUAD",
    name: "Full Squad (Auto-Routing)",
    role: "Sequential Autonomous Pipeline",
    model: "Orchestrated Multi-Model",
    color: "#10b981",
    badge: "Full Pipeline",
    handle: "@squad",
    ctx: "Dynamic Routing",
    instructionPlaceholder: "State your feature, bug fix, or refactor requirement...",
  },
  ARCHITECT: {
    id: "ARCHITECT",
    name: "Architect Agent",
    role: "System Decomposition & API Contracts",
    model: "Claude 3.7 Sonnet (Reasoning)",
    color: "#8b3dff",
    badge: "Reasoning Model",
    handle: "@architect",
    ctx: "200k Context",
    instructionPlaceholder: "Ask Architect to design architecture, interfaces, or review specs...",
  },
  DEVELOPER: {
    id: "DEVELOPER",
    name: "Developer Agent",
    role: "Implementation & Git Worktree Branching",
    model: "Gemini 2.0 Flash / Pro",
    color: "#22d3ee",
    badge: "Multimodal Code",
    handle: "@developer",
    ctx: "1M Context",
    instructionPlaceholder: "Instruct Developer to implement functions, modules, or fix bugs...",
  },
  TESTER: {
    id: "TESTER",
    name: "Tester Agent",
    role: "Vitest Assertions & TDD Test Harness",
    model: "DeepSeek R1 (Math & Logic)",
    color: "#ffb800",
    badge: "Deep Reasoning",
    handle: "@tester",
    ctx: "128k Context",
    instructionPlaceholder: "Direct Tester to generate edge cases, fixtures, or run vitest suites...",
  },
  SECURITY: {
    id: "SECURITY",
    name: "Security Auditor",
    role: "AST Taint Analysis & Secret Scanning",
    model: "OpenAI GPT-4o (Strict Schema)",
    color: "#ff5a1f",
    badge: "Deterministic",
    handle: "@security",
    ctx: "128k Context",
    instructionPlaceholder: "Prompt Security to audit dependencies, secret exposure, or OWASP risks...",
  },
};

// Code Review PR Dataset
interface PrReviewItem {
  id: string;
  title: string;
  branch: string;
  author: string;
  files: number;
  tests: string;
  diff: string;
  status: "AWAITING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED";
  filePath: string;
  oldLines: string[];
  newLines: string[];
  diffLines: { type: "header" | "add" | "delete" | "context"; text: string }[];
}

const PR_REVIEWS_DATASET: PrReviewItem[] = [
  {
    id: "1",
    title: "Fix auth timeout on token refresh",
    branch: "fix/auth-timeout",
    author: "@developer (Gemini 2.0)",
    files: 3,
    tests: "14/14 passed",
    diff: "+22 −6",
    status: "AWAITING_REVIEW",
    filePath: "src/auth/session.ts",
    oldLines: [
      "import { REFRESH_URL } from \"./config\";",
      "import { SessionError } from \"./errors\";",
      "",
      "export async function refreshSession(token: string) {",
      "  const res = await fetch(REFRESH_URL, {",
      "    method: \"POST\",",
      "    headers: { Authorization: `Bearer ${token}` },",
      "  });",
      "  if (!res.ok) throw new SessionError(\"refresh_failed\");",
      "  return await res.json();",
      "}",
    ],
    newLines: [
      "import { REFRESH_URL, REFRESH_TIMEOUT_MS } from \"./config\";",
      "import { SessionError } from \"./errors\";",
      "",
      "export async function refreshSession(token: string) {",
      "  // abort the request if the server stalls",
      "  const ctrl = new AbortController();",
      "  const tid = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);",
      "  try {",
      "    const res = await fetch(REFRESH_URL, {",
      "      method: \"POST\",",
      "      headers: { Authorization: `Bearer ${token}` },",
      "      signal: ctrl.signal,",
      "    });",
      "    if (!res.ok) throw new SessionError(\"refresh_failed\");",
      "    return await res.json();",
      "  } finally {",
      "    clearTimeout(tid);",
      "  }",
      "}",
    ],
    diffLines: [
      { type: "header", text: "@@ -38,7 +38,15 @@ export async function refreshSession(token: string)" },
      { type: "delete", text: "-  const res = await fetch(REFRESH_URL, { headers: { Authorization: token } });" },
      { type: "delete", text: "-  return await res.json();" },
      { type: "add", text: "+  // abort the request if the server stalls" },
      { type: "add", text: "+  const ctrl = new AbortController();" },
      { type: "add", text: "+  const tid = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);" },
      { type: "add", text: "+  try {" },
      { type: "add", text: "+    const res = await fetch(REFRESH_URL, { method: \"POST\", signal: ctrl.signal });" },
      { type: "add", text: "+    if (!res.ok) throw new SessionError(\"refresh_failed\");" },
      { type: "add", text: "+    return await res.json();" },
      { type: "add", text: "+  } finally { clearTimeout(tid); }" },
    ],
  },
  {
    id: "2",
    title: "Add pagination to audit log API",
    branch: "feature/audit-pagination",
    author: "@architect (Claude 3.7)",
    files: 7,
    tests: "31/31 passed",
    diff: "+214 −38",
    status: "AWAITING_REVIEW",
    filePath: "src/api/audit.ts",
    oldLines: [
      "export async function listAuditEvents(workspaceId: string) {",
      "  return await db.auditEvent.findMany({",
      "    where: { workspaceId },",
      "    orderBy: { createdAt: \"desc\" },",
      "  });",
      "}",
    ],
    newLines: [
      "export async function listAuditEvents(workspaceId: string, cursor?: string, limit = 50) {",
      "  const safeLimit = Math.min(Math.max(limit, 1), 100);",
      "  const items = await db.auditEvent.findMany({",
      "    where: { workspaceId },",
      "    take: safeLimit + 1,",
      "    cursor: cursor ? { id: cursor } : undefined,",
      "    orderBy: { createdAt: \"desc\" },",
      "  });",
      "  const hasMore = items.length > safeLimit;",
      "  const data = hasMore ? items.slice(0, safeLimit) : items;",
      "  return { items: data, nextCursor: hasMore ? data[data.length - 1].id : null };",
      "}",
    ],
    diffLines: [
      { type: "header", text: "@@ -12,5 +12,14 @@ export async function listAuditEvents(workspaceId: string)" },
      { type: "delete", text: "-  return await db.auditEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: \"desc\" } });" },
      { type: "add", text: "+  const safeLimit = Math.min(Math.max(limit, 1), 100);" },
      { type: "add", text: "+  const items = await db.auditEvent.findMany({" },
      { type: "add", text: "+    where: { workspaceId }," },
      { type: "add", text: "+    take: safeLimit + 1," },
      { type: "add", text: "+    cursor: cursor ? { id: cursor } : undefined," },
      { type: "add", text: "+    orderBy: { createdAt: \"desc\" }," },
      { type: "add", text: "+  });" },
      { type: "add", text: "+  const hasMore = items.length > safeLimit;" },
      { type: "add", text: "+  return { items: hasMore ? items.slice(0, safeLimit) : items, nextCursor: hasMore ? items[safeLimit - 1].id : null };" },
    ],
  },
  {
    id: "3",
    title: "Rate-limit middleware for public routes",
    branch: "feature/rate-limit",
    author: "@developer (DeepSeek R1)",
    files: 5,
    tests: "22/24 passed",
    diff: "+156 −12",
    status: "AWAITING_REVIEW",
    filePath: "src/middleware/rate-limiter.ts",
    oldLines: [
      "export function rateLimiter(req, res, next) {",
      "  // basic in-memory counter placeholder",
      "  next();",
      "}",
    ],
    newLines: [
      "import { TokenBucket } from \"../lib/token-bucket\";",
      "",
      "const globalLimiter = new TokenBucket({ capacity: 100, refillRate: 10 });",
      "",
      "export function rateLimiter(req: Request, res: Response, next: NextFunction) {",
      "  const ip = req.headers[\"x-forwarded-for\"] || req.socket.remoteAddress;",
      "  if (!globalLimiter.consume(String(ip))) {",
      "    return res.status(429).json({ error: \"rate_limit_exceeded\", retryAfter: 1 });",
      "  }",
      "  next();",
      "}",
    ],
    diffLines: [
      { type: "header", text: "@@ -1,4 +1,11 @@ export function rateLimiter(req, res, next)" },
      { type: "delete", text: "-  // basic in-memory counter placeholder" },
      { type: "delete", text: "-  next();" },
      { type: "add", text: "+  import { TokenBucket } from \"../lib/token-bucket\";" },
      { type: "add", text: "+  const globalLimiter = new TokenBucket({ capacity: 100, refillRate: 10 });" },
      { type: "add", text: "+  const ip = req.headers[\"x-forwarded-for\"] || req.socket.remoteAddress;" },
      { type: "add", text: "+  if (!globalLimiter.consume(String(ip))) {" },
      { type: "add", text: "+    return res.status(429).json({ error: \"rate_limit_exceeded\", retryAfter: 1 });" },
      { type: "add", text: "+  }" },
      { type: "add", text: "+  next();" },
    ],
  },
  {
    id: "4",
    title: "Harden CORS configuration",
    branch: "fix/cors-hardening",
    author: "@security (GPT-4o)",
    files: 2,
    tests: "8/8 passed",
    diff: "+18 −4",
    status: "AWAITING_REVIEW",
    filePath: "src/middleware/cors.ts",
    oldLines: [
      "export const corsOptions = {",
      "  origin: \"*\",",
      "  methods: [\"GET\", \"POST\", \"PUT\", \"DELETE\"],",
      "};",
    ],
    newLines: [
      "const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(\",\") || [\"http://localhost:3000\"];",
      "",
      "export const corsOptions = {",
      "  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {",
      "    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);",
      "    callback(new Error(\"CORS rejection: origin not permitted\"));",
      "  },",
      "  credentials: true,",
      "  maxAge: 86400,",
      "};",
    ],
    diffLines: [
      { type: "header", text: "@@ -1,4 +1,10 @@ export const corsOptions = {" },
      { type: "delete", text: "-  origin: \"*\"," },
      { type: "add", text: "+  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(\",\") || [\"http://localhost:3000\"];" },
      { type: "add", text: "+  origin: (origin, callback) => {" },
      { type: "add", text: "+    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);" },
      { type: "add", text: "+    callback(new Error(\"CORS rejection: origin not permitted\"));" },
      { type: "add", text: "+  }," },
      { type: "add", text: "+  credentials: true," },
      { type: "add", text: "+  maxAge: 86400," },
    ],
  },
];

// Concurrent Worktree Sandboxes Dataset
interface WorktreeLease {
  id: string;
  leaseHex: string;
  branch: string;
  base: string;
  pid: string;
  diskUsage: string;
  filesCount: number;
  active: boolean;
  files: {
    path: string;
    status: string;
    additions: number;
    deletions: number;
    size: string;
    content: string;
  }[];
}

const WORKTREE_LEASES_DATASET: WorktreeLease[] = [
  {
    id: "wt-9f18a24c",
    leaseHex: "0x9f18a24c",
    branch: "fix/auth-timeout",
    base: "main @ 7d02e1b",
    pid: "48213",
    diskUsage: "14.2 MB",
    filesCount: 3,
    active: true,
    files: [
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
  },
  {
    id: "wt-3d82f1b4",
    leaseHex: "0x3d82f1b4",
    branch: "feature/audit-pagination",
    base: "main @ 7d02e1b",
    pid: "51092",
    diskUsage: "28.6 MB",
    filesCount: 3,
    active: true,
    files: [
      {
        path: "src/api/audit.ts",
        status: "MODIFIED",
        additions: 42,
        deletions: 11,
        size: "4.1 KB",
        content: `import { Router } from "express";
import { listAuditEvents } from "../services/audit-service";

export const auditRouter = Router();

auditRouter.get("/audit/events", async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = parseInt(req.query.limit as string || "50", 10);
  const result = await listAuditEvents(req.workspaceId, cursor, limit);
  res.json(result);
});`,
      },
      {
        path: "src/repositories/audit-repository.ts",
        status: "MODIFIED",
        additions: 36,
        deletions: 8,
        size: "5.2 KB",
        content: `import { prisma } from "../db";

export class AuditRepository {
  static async findPaginated(workspaceId: string, cursor?: string, take = 50) {
    return prisma.auditLog.findMany({
      where: { workspaceId },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }
}`,
      },
      {
        path: "src/api/audit.test.ts",
        status: "ADDED",
        additions: 31,
        deletions: 0,
        size: "3.2 KB",
        content: `import { describe, it, expect } from "vitest";

describe("Audit Pagination", () => {
  it("clamps limit parameter to max 100", () => {
    expect(Math.min(250, 100)).toBe(100);
  });
});`,
      },
    ],
  },
  {
    id: "wt-7a41c90e",
    leaseHex: "0x7a41c90e",
    branch: "feature/rate-limit",
    base: "main @ 7d02e1b",
    pid: "53401",
    diskUsage: "19.4 MB",
    filesCount: 2,
    active: true,
    files: [
      {
        path: "src/middleware/rate-limiter.ts",
        status: "MODIFIED",
        additions: 28,
        deletions: 4,
        size: "2.9 KB",
        content: `import { Request, Response, NextFunction } from "express";

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // 100 requests per minute per IP token bucket
  next();
}`,
      },
      {
        path: "src/lib/token-bucket.ts",
        status: "ADDED",
        additions: 65,
        deletions: 0,
        size: "3.7 KB",
        content: `export class TokenBucket {
  private tokens: number;
  constructor(private options: { capacity: number; refillRate: number }) {
    this.tokens = options.capacity;
  }
  consume(key: string, count = 1): boolean {
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }
}`,
      },
    ],
  },
];

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/realtime";

export default function DashboardPage() {
  // ── Global App Navigation ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    "studio" | "dashboard" | "tasks" | "review" | "worktree" | "split" | "providers" | "preview"
  >("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // ── Authentication Gate ────────────────────────────────────────
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (!saved) {
        window.location.href = "/login?redirect=/dashboard";
        return;
      }
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.login) {
          setCurrentUser(parsed);
          setIsAuthChecking(false);
          return;
        }
      } catch (e) {
        // ignore
      }
      window.location.href = "/login?redirect=/dashboard";
    }
  }, []);

  // ── Authentication & GitHub State ──────────────────────────────
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.login) {
            return parsed;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return null;
  });
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [githubLoginInput, setGithubLoginInput] = useState<string>("");
  const [githubTokenInput, setGithubTokenInput] = useState<string>("");

  // ── Core API State ──────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([
    { id: "ws-main", name: "Engineering Monorepo", slug: "agentforge-monorepo", role: "OWNER" },
    { id: "ws-calc", name: "Calculator Fullstack", slug: "calc-fullstack", role: "DEVELOPER" },
    { id: "ws-demo", name: "Autonomous Sandbox", slug: "agent-sandbox", role: "ADMIN" },
  ]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceItem | null>({
    id: "ws-main",
    name: "Engineering Monorepo",
    slug: "agentforge-monorepo",
    role: "OWNER",
  });
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState<boolean>(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Toast & Notifications ──────────────────────────────────────
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // ── Global Command Palette (⌘K) ────────────────────────────────
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [paletteQuery, setPaletteQuery] = useState<string>("");
  const paletteInputRef = useRef<HTMLInputElement>(null);

  // ── Providers State ─────────────────────────────────────────────
  const [providers, setProviders] = useState<ProviderConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_providers");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return DEFAULT_PROVIDERS;
  });
  const [editingProviderKey, setEditingProviderKey] = useState<{ [key: string]: string }>({});
  const [visibleKey, setVisibleKey] = useState<{ [key: string]: boolean }>({});

  // ── Dashboard Telemetry State ──────────────────────────────────
  const [telemetryRange, setTelemetryRange] = useState<"7D" | "30D" | "90D">("30D");
  const [waveformHover, setWaveformHover] = useState<{
    x: number;
    desktopY: number;
    workerY: number;
    label: string;
    desktopVal: number;
    workerVal: number;
  } | null>(null);

  const currentWaveform = useMemo(() => {
    const data = WAVEFORM_SERIES[telemetryRange];
    const plotLeft = 45;
    const plotRight = 615;
    const plotTop = 20;
    const plotBottom = 165;
    const width = plotRight - plotLeft;
    const height = plotBottom - plotTop;

    const pointsDesktop: WaveformPoint[] = data.desktop.map((val, i) => {
      const x = plotLeft + (i / (data.desktop.length - 1)) * width;
      const y = plotBottom - (val / data.maxVal) * height;
      return { x, y, val, label: data.labels[i] };
    });

    const pointsWorkers: WaveformPoint[] = data.workers.map((val, i) => {
      const x = plotLeft + (i / (data.workers.length - 1)) * width;
      const y = plotBottom - (val / data.maxVal) * height;
      return { x, y, val, label: data.labels[i] };
    });

    const desktopLinePath = buildSmoothSpline(pointsDesktop);
    const workersLinePath = buildSmoothSpline(pointsWorkers);

    const desktopAreaPath = `${desktopLinePath} L ${pointsDesktop[pointsDesktop.length - 1].x.toFixed(1)} ${plotBottom} L ${pointsDesktop[0].x.toFixed(1)} ${plotBottom} Z`;
    const workersAreaPath = `${workersLinePath} L ${pointsWorkers[pointsWorkers.length - 1].x.toFixed(1)} ${plotBottom} L ${pointsWorkers[0].x.toFixed(1)} ${plotBottom} Z`;

    const yTicks = [
      { val: data.maxVal, y: plotTop },
      { val: Math.round(data.maxVal * 0.75), y: plotTop + height * 0.25 },
      { val: Math.round(data.maxVal * 0.5), y: plotTop + height * 0.5 },
      { val: Math.round(data.maxVal * 0.25), y: plotTop + height * 0.75 },
      { val: 0, y: plotBottom },
    ];

    return {
      data,
      pointsDesktop,
      pointsWorkers,
      desktopLinePath,
      workersLinePath,
      desktopAreaPath,
      workersAreaPath,
      plotLeft,
      plotRight,
      plotBottom,
      yTicks,
    };
  }, [telemetryRange]);

  // ── CLI Studio State ───────────────────────────────────────────
  const [studioTargetAgent, setStudioTargetAgent] = useState<
    "SQUAD" | "ARCHITECT" | "DEVELOPER" | "TESTER" | "SECURITY"
  >("SQUAD");
  const [studioPrompt, setStudioPrompt] = useState<string>("");
  const [promptHistory, setPromptHistory] = useState<string[]>([
    "Fix auth timeout on token refresh in src/auth/session.ts",
    "Audit packages for token leaks, AST taint, and secret exposures",
    "Run vitest test harness across all packages with coverage",
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isStudioExecuting, setIsStudioExecuting] = useState<boolean>(false);
  const [activeSquadStep, setActiveSquadStep] = useState<string>("IDLE");
  const [terminalFilter, setTerminalFilter] = useState<"ALL" | "AGENT" | "SHELL" | "SUCCESS" | "SECURITY">("ALL");
  const [terminalSearch, setTerminalSearch] = useState<string>("");
  const [terminalLogs, setTerminalLogs] = useState<
    { id: string; time: string; type: string; message: string }[]
  >([
    { id: "1", time: "10:14:02", type: "SYSTEM", message: "AgentForge CLI Daemon v1.0.0 initialized." },
    { id: "2", time: "10:14:03", type: "STATUS", message: "Worktree pool online: 3 ephemeral sandboxes provisioned." },
    { id: "3", time: "10:14:05", type: "ENGINE", message: "Primary router connected to Gemini 2.0 Flash / Pro." },
    { id: "4", time: "10:15:21", type: "SUCCESS", message: "Security gate ready. Zero secret leaks detected." },
  ]);

  // ── Code Review State ──────────────────────────────────────────
  const [prReviews, setPrReviews] = useState<PrReviewItem[]>(PR_REVIEWS_DATASET);
  const [selectedPrId, setSelectedPrId] = useState<string>("1");
  const [diffViewMode, setDiffViewMode] = useState<"unified" | "split">("unified");
  const [reviewCommentOpen, setReviewCommentOpen] = useState<boolean>(false);
  const [reviewCommentText, setReviewCommentText] = useState<string>("");

  const activePr = useMemo(() => {
    return prReviews.find((p) => p.id === selectedPrId) || prReviews[0];
  }, [prReviews, selectedPrId]);

  // ── Worktree Sandboxes State ───────────────────────────────────
  const [worktreeLeases, setWorktreeLeases] = useState<WorktreeLease[]>(WORKTREE_LEASES_DATASET);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("wt-9f18a24c");
  const activeLease = useMemo(() => {
    return worktreeLeases.find((l) => l.id === selectedLeaseId) || worktreeLeases[0];
  }, [worktreeLeases, selectedLeaseId]);
  const [selectedWorktreeFile, setSelectedWorktreeFile] = useState<string>("src/auth/session.ts");

  // Keep selectedWorktreeFile aligned with lease files
  useEffect(() => {
    if (activeLease && activeLease.files.length > 0) {
      if (!activeLease.files.some((f) => f.path === selectedWorktreeFile)) {
        setSelectedWorktreeFile(activeLease.files[0].path);
      }
    }
  }, [activeLease, selectedWorktreeFile]);

  // ── Split View State ───────────────────────────────────────────
  const [splitPanesLayout, setSplitPanesLayout] = useState<1 | 2 | 3 | 4>(2);
  const [splitTab1, setSplitTab1] = useState<"session.ts" | "refresh.ts">("session.ts");
  const [splitBottomTab, setSplitBottomTab] = useState<"logs" | "problems" | "output">("logs");
  const [isVitestRunning, setIsVitestRunning] = useState<boolean>(false);
  const [isAuditRunning, setIsAuditRunning] = useState<boolean>(false);
  const [isSchemaVerifying, setIsSchemaVerifying] = useState<boolean>(false);
  const [vitestOutputLines, setVitestOutputLines] = useState<string[]>([
    "Ready. Click '▶ Run Vitest in Worktree' to trigger runner simulation.",
  ]);
  const [splitAgents, setSplitAgents] = useState<
    { role: string; status: string; statusColor: string; isPulse: boolean }[]
  >([
    { role: "Developer Agent", status: "Pane 1 · session.ts", statusColor: "#10b981", isPulse: true },
    { role: "Tester Agent", status: "Pane 2 · session.test.ts", statusColor: "#ffb800", isPulse: true },
  ]);

  // ── Preview State ───────────────────────────────────────────────
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // ── Tasks Filter & Modal State ─────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskDesc, setNewTaskDesc] = useState<string>("");
  const [newTaskSquad, setNewTaskSquad] = useState<string>("full-stack");
  const [newTaskBudget, setNewTaskBudget] = useState<number>(5.0);
  const [isSubmittingTask, setIsSubmittingTask] = useState<boolean>(false);

  const termEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Bento Telemetry Static Seed Data
  const bentoRevenue = useMemo(() => [8200, 8450, 8900, 8750, 9134, 9400, 9620, 9890, 10120, 10450], []);
  const bentoDesktop = useMemo(() => [[12, 14, 18, 22, 28, 35, 42, 38, 32, 29, 24, 18, 14, 12]], []);
  const bentoMobile = useMemo(() => [[6, 8, 11, 15, 19, 24, 28, 26, 22, 18, 15, 11, 8, 6]], []);

  // Default provider helper
  const defaultProvider = useMemo(() => {
    return providers.find((p) => p.isDefault) || providers[0];
  }, [providers]);

  // Keyboard shortcut listener for Command Palette (⌘K / Ctrl+K) & Sidebar toggle (Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setReviewCommentOpen(false);
        setIsGitHubModalOpen(false);
        setIsUserMenuOpen(false);
        setIsWorkspaceDropdownOpen(false);
        setIsViewDropdownOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Terminal Auto-scroll
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
        const res = await apiClient.getWorkspaces().catch(() => ({ workspaces: [] }));
        const wsList = (res.workspaces || []).map((w) => w.workspace);
        if (wsList.length > 0) {
          setWorkspaces(wsList);
          setSelectedWorkspace(wsList[0]);
          const prjRes = await apiClient.getProjects(wsList[0].id).catch(() => ({ projects: [] }));
          const prjList = prjRes.projects || [];
          setProjects(prjList);
          if (prjList.length > 0) setSelectedProject(prjList[0]);
          const taskRes = await apiClient.getTasks(wsList[0].id).catch(() => ({ tasks: [] }));
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

  // Filtered Terminal Logs
  const filteredTerminalLogs = useMemo(() => {
    return terminalLogs.filter((log) => {
      if (terminalFilter === "AGENT" && !["ARCHITECT", "DEVELOPER", "TESTER", "SECURITY"].includes(log.type)) return false;
      if (terminalFilter === "SHELL" && !["SYSTEM", "PROMPT"].includes(log.type)) return false;
      if (terminalFilter === "SUCCESS" && log.type !== "SUCCESS") return false;
      if (terminalFilter === "SECURITY" && log.type !== "SECURITY") return false;
      if (terminalSearch.trim()) {
        const q = terminalSearch.toLowerCase();
        return log.message.toLowerCase().includes(q) || log.type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [terminalLogs, terminalFilter, terminalSearch]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => ["IN_PROGRESS", "RUNNING", "QUEUED"].includes(t.status)).length;
    const awaitingReview = prReviews.filter((p) => p.status === "AWAITING_REVIEW").length;
    const completed = tasks.filter((t) => ["COMPLETED", "APPROVED", "MERGED"].includes(t.status)).length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 94;
    return {
      totalTasks: total || 24,
      runningSessions: inProgress || 6,
      awaitingReview: awaitingReview || 4,
      mergedOrApproved: completed || 14,
      successRate,
    };
  }, [tasks, prReviews]);

  // Toast Helper
  const triggerToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // ── GitHub Login Action ─────────────────────────────────────────
  const handleGitHubLogin = (loginHandle = "vedant-dev", customToken = "") => {
    const token = customToken || `ghp_mock_${Date.now()}`;
    const user: GitHubUser = {
      id: `gh-${Math.floor(Math.random() * 9000000) + 1000000}`,
      login: loginHandle.trim() || "vedant-dev",
      name: loginHandle.trim() === "vedant-dev" ? "Vedant" : loginHandle.trim(),
      email: `${loginHandle.trim()}@agentforge.dev`,
      avatarUrl: `https://avatars.githubusercontent.com/u/9919?s=200&v=4`,
      token,
      repo: `${loginHandle.trim()}/AgentForge`,
    };

    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("agentforge_github_user", JSON.stringify(user));
    }
    apiClient.setToken(token);

    // Sync with backend API
    apiClient
      .syncUser({
        externalId: user.id,
        email: user.email,
        fullName: user.name,
        avatarUrl: user.avatarUrl,
      })
      .catch(() => {});

    setIsGitHubModalOpen(false);
    triggerToast(`Authenticated with GitHub as @${user.login}! Ready for PR & branch operations.`);
  };

  // ── Studio Prompt Dispatch ──────────────────────────────────────
  const handleExecuteStudioPrompt = (customPrompt?: string, targetOverride?: string) => {
    const prompt = customPrompt || studioPrompt;
    const target = targetOverride || studioTargetAgent;
    if (!prompt.trim()) return;

    // Save to history
    setPromptHistory((prev) => [prompt, ...prev.filter((p) => p !== prompt)].slice(0, 20));
    setHistoryIndex(-1);

    setIsStudioExecuting(true);
    const time = new Date().toLocaleTimeString();

    if (target === "ARCHITECT") {
      setActiveSquadStep("ARCHITECT");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge dispatch --target @architect --model claude-3-7-sonnet "${prompt}"` },
        { id: Math.random().toString(), time, type: "ARCHITECT", message: `[Architect @ Claude 3.7] Reading codebase AST and generating interface contract...` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time, type: "ARCHITECT", message: `[Architect @ Claude 3.7] Interface contract drafted. Defined AbortController guard for token refresh.` },
          { id: Math.random().toString(), time, type: "SUCCESS", message: `Architect specification complete. Ready for Developer handoff.` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        triggerToast("Architect (Claude 3.7) completed architectural spec!");
      }, 1400);
    } else if (target === "DEVELOPER") {
      setActiveSquadStep("DEVELOPER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge dispatch --target @developer --model gemini-2.0 "${prompt}"` },
        { id: Math.random().toString(), time, type: "DEVELOPER", message: `[Developer @ Gemini 2.0] Checkout ephemeral worktree .agentforge/wt-9f18a24c on fix/auth-timeout` },
        { id: Math.random().toString(), time, type: "DEVELOPER", message: `[Developer @ Gemini 2.0] Writing AbortController guard into src/auth/session.ts...` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time, type: "DEVELOPER", message: `[Developer @ Gemini 2.0] Patch applied. +18 −6 lines. Passing AST typechecker.` },
          { id: Math.random().toString(), time, type: "SUCCESS", message: `Developer generated patch successfully in isolated worktree.` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        triggerToast("Developer (Gemini 2.0) applied code changes in worktree sandbox!");
      }, 1500);
    } else if (target === "TESTER") {
      setActiveSquadStep("TESTER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge dispatch --target @tester --model deepseek-r1 "${prompt}"` },
        { id: Math.random().toString(), time, type: "TESTER", message: `[Tester @ DeepSeek R1] Constructing Vitest test harness in src/auth/session.test.ts...` },
        { id: Math.random().toString(), time, type: "TESTER", message: `[Tester @ DeepSeek R1] vitest run src/auth/session.test.ts` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time, type: "TESTER", message: `[Tester @ DeepSeek R1] ✓ 14/14 tests passing. Coverage: 98.4%. Regressions: 0.` },
          { id: Math.random().toString(), time, type: "SUCCESS", message: `All test assertions satisfied.` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        triggerToast("Tester (DeepSeek R1) verified 14/14 tests in sandbox!");
      }, 1400);
    } else if (target === "SECURITY") {
      setActiveSquadStep("SECURITY");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge dispatch --target @security --model gpt-4o "${prompt}"` },
        { id: Math.random().toString(), time, type: "SECURITY", message: `[Security @ GPT-4o] Performing AST taint analysis & secret scan in worktree sandbox...` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time, type: "SECURITY", message: `[Security @ GPT-4o] Static audit passed. Zero API keys leaked. Authorization intact.` },
          { id: Math.random().toString(), time, type: "SUCCESS", message: `Security gate verified clean.` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        triggerToast("Security (GPT-4o) completed security gate audit!");
      }, 1300);
    } else {
      // Full Squad Pipeline
      setActiveSquadStep("ARCHITECT");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: `$ agentforge run --squad full-stack "${prompt}"` },
        { id: Math.random().toString(), time, type: "ARCHITECT", message: `[Architect @ Claude 3.7] Reading codebase AST and generating interface contract...` },
      ]);

      setTimeout(() => {
        setActiveSquadStep("DEVELOPER");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: `[Developer @ Gemini 2.0] git worktree add .agentforge/wt-9f18a24c -b fix/auth-timeout` },
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: `[Developer @ Gemini 2.0] Implemented AbortController guard in src/auth/session.ts` },
        ]);
      }, 800);

      setTimeout(() => {
        setActiveSquadStep("TESTER");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: `[Tester @ DeepSeek R1] Running test harness: vitest run src/auth/session.test.ts` },
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: `[Tester @ DeepSeek R1] 14/14 tests passing. Zero regressions in worktree sandbox.` },
        ]);
      }, 1600);

      setTimeout(() => {
        setActiveSquadStep("SECURITY");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "SECURITY", message: `[Security @ GPT-4o] Static analysis passed. Zero token leaks. Ready for review.` },
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "SUCCESS", message: `Full-Stack Squad completed pipeline run.` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        triggerToast("Agent Squad successfully drafted and verified the patch across all 4 models!");
      }, 2400);
    }

    if (!customPrompt) setStudioPrompt("");
  };

  // ── Prompt History Navigation (Up / Down Arrow) ─────────────────
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecuteStudioPrompt();
      return;
    }

    if (e.key === "ArrowUp" && (studioPrompt === "" || historyIndex !== -1)) {
      e.preventDefault();
      const nextIdx = Math.min(historyIndex + 1, promptHistory.length - 1);
      if (promptHistory[nextIdx]) {
        setHistoryIndex(nextIdx);
        setStudioPrompt(promptHistory[nextIdx]);
      }
    } else if (e.key === "ArrowDown" && historyIndex !== -1) {
      e.preventDefault();
      const prevIdx = historyIndex - 1;
      if (prevIdx >= 0) {
        setHistoryIndex(prevIdx);
        setStudioPrompt(promptHistory[prevIdx]);
      } else {
        setHistoryIndex(-1);
        setStudioPrompt("");
      }
    }
  };

  // ── Provider API Key Management ─────────────────────────────────
  const handleTestProvider = (providerId: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, status: "TESTING" as const } : p))
    );

    setTimeout(() => {
      const mockLatency = Math.floor(Math.random() * 50) + 32;
      setProviders((prev) => {
        const updated = prev.map((p) =>
          p.id === providerId ? { ...p, status: "CONNECTED" as const, latencyMs: mockLatency } : p
        );
        if (typeof window !== "undefined") {
          localStorage.setItem("agentforge_providers", JSON.stringify(updated));
        }
        return updated;
      });
      triggerToast(`Provider ${providerId.toUpperCase()} ping successful (${mockLatency}ms)!`);
    }, 550);
  };

  const handleSaveProviderKey = (providerId: string) => {
    const keyVal = editingProviderKey[providerId];
    if (!keyVal) return;

    setProviders((prev) => {
      const updated = prev.map((p) =>
        p.id === providerId ? { ...p, apiKey: keyVal, status: "CONNECTED" as const, latencyMs: 45 } : p
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

    triggerToast(`API key for ${providerId.toUpperCase()} saved & verified!`);
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
    triggerToast(`Default foundation engine set to ${found?.name || providerId}!`);
  };

  // ── Worktree Sandbox Actions ────────────────────────────────────
  const handleReleaseLease = (leaseId: string) => {
    setWorktreeLeases((prev) =>
      prev.map((l) => (l.id === leaseId ? { ...l, active: false, diskUsage: "0 MB" } : l))
    );
    triggerToast(`Worktree lease ${leaseId} released and filesystem unmounted.`);
  };

  const handleCopyGitWorktree = (lease: WorktreeLease) => {
    const cmd = `git worktree add .agentforge/${lease.id} -b ${lease.branch}`;
    navigator.clipboard.writeText(cmd);
    triggerToast(`Copied to clipboard: "${cmd}"`);
  };

  const handleSendToReview = (lease: WorktreeLease) => {
    triggerToast(`Worktree branch ${lease.branch} queued into Code Review!`);
    setActiveTab("review");
  };

  // ── Code Review Actions ─────────────────────────────────────────
  const handleApprovePr = (prId: string) => {
    setPrReviews((prev) =>
      prev.map((p) => (p.id === prId ? { ...p, status: "APPROVED" as const } : p))
    );
    triggerToast(`Patch #${prId} approved with HMAC-SHA256 cryptographic sign-off!`);
  };

  const handleRequestChanges = (prId: string) => {
    if (!reviewCommentText.trim()) return;
    setPrReviews((prev) =>
      prev.map((p) => (p.id === prId ? { ...p, status: "CHANGES_REQUESTED" as const } : p))
    );
    setReviewCommentOpen(false);
    setReviewCommentText("");
    triggerToast(`Changes requested on PR #${prId}. Squad notified in worktree.`);
  };

  // ── Split View Live Vitest Simulation ───────────────────────────
  const handleRunVitestInSplit = () => {
    setIsVitestRunning(true);
    setSplitBottomTab("output");
    setVitestOutputLines([
      "RUN  v2.1.8 /worktrees/wt-9f18a24c",
      "  ❯ vitest run src/auth/session.test.ts",
      "  Compiling TypeScript AST...",
    ]);

    setTimeout(() => {
      setVitestOutputLines((prev) => [
        ...prev,
        "  ✓ src/auth/session.test.ts > refreshSession > aborts when server stalls past timeout (24ms)",
      ]);
    }, 450);

    setTimeout(() => {
      setVitestOutputLines((prev) => [
        ...prev,
        "  ✓ src/auth/session.test.ts > refreshSession > returns session payload on valid response (18ms)",
        "",
        " Test Files  1 passed (1)",
        "      Tests  2 passed (2)",
        "   Duration  284ms (transform 42ms, setup 18ms, collect 32ms, tests 42ms)",
        " ✓ WORKTREE SANDBOX CLEAN: All 2 assertions green.",
      ]);
      setIsVitestRunning(false);
      triggerToast("Vitest run completed: 2/2 tests passed in worktree sandbox!");
    }, 1100);
  };

  // ── Split View Add Agent ────────────────────────────────────────
  // ── Split View Live Security AST Audit ──────────────────────────
  const handleRunAuditInSplit = () => {
    setIsAuditRunning(true);
    setSplitBottomTab("output");
    setVitestOutputLines([
      "🛡️ RUNNING SECURITY AST TAINT ANALYSIS...",
      "  Target: src/auth/auth.security.ts",
      "  Scanner: OpenAI GPT-4o Security Linter + Semgrep AST Engine",
      "  Checking: Secrets, Hardcoded Tokens, Prototype Pollution, SQL/Command Injection...",
    ]);

    setTimeout(() => {
      setVitestOutputLines((prev) => [
        ...prev,
        "  ✓ Token sanitization verified: sanitizeToken(token) called before header dispatch",
        "  ✓ Taint check: 0 untrusted inputs leaked into system boundary",
        "  ✓ Cryptographic signature: ed25519-valid",
        " 🛡️ AUDIT PASSED: 0 critical vulnerabilities, 0 taint warnings.",
      ]);
      setIsAuditRunning(false);
      triggerToast("Security AST Audit: PASSED (0 taint warnings, ed25519 verified)");
    }, 900);
  };

  // ── Split View Live Architect Schema Verification ───────────────
  const handleVerifySchemaInSplit = () => {
    setIsSchemaVerifying(true);
    setSplitBottomTab("output");
    setVitestOutputLines([
      "📐 RUNNING CONTRACT SCHEMA VERIFICATION...",
      "  Target: src/auth/session.types.ts",
      "  Model: Claude 3.7 Sonnet Architect Engine",
      "  Comparing TypeScript types with OpenAPI / GraphQL schema contracts...",
    ]);

    setTimeout(() => {
      setVitestOutputLines((prev) => [
        ...prev,
        "  ✓ SessionRefreshContract: matches API specification RFC-6749",
        "  ✓ SecurityContext: 3/3 required fields implemented with strict type guards",
        " 📐 SCHEMA VERIFIED: Interface contracts 100% compliant with spec.",
      ]);
      setIsSchemaVerifying(false);
      triggerToast("Architect Spec: 100% schema contracts verified successfully!");
    }, 850);
  };

  // ── Split Layout & Squad Roster Synchronization ────────────────
  const handleSetSplitLayout = (n: 1 | 2 | 3 | 4) => {
    setSplitPanesLayout(n);
    if (n === 1) {
      setSplitAgents([
        { role: "Developer Agent", status: "Pane 1 · session.ts", statusColor: "#10b981", isPulse: true },
      ]);
      triggerToast("Switched to 1P: Developer Single Focus");
    } else if (n === 2) {
      setSplitAgents([
        { role: "Developer Agent", status: "Pane 1 · session.ts", statusColor: "#10b981", isPulse: true },
        { role: "Tester Agent", status: "Pane 2 · session.test.ts", statusColor: "#ffb800", isPulse: true },
      ]);
      triggerToast("Switched to 2P: Developer + Tester Dual Split");
    } else if (n === 3) {
      setSplitAgents([
        { role: "Developer Agent", status: "Pane 1 · session.ts", statusColor: "#10b981", isPulse: true },
        { role: "Tester Agent", status: "Pane 2 · session.test.ts", statusColor: "#ffb800", isPulse: true },
        { role: "Security Auditor", status: "Pane 3 · auth.security.ts", statusColor: "#ef4444", isPulse: true },
      ]);
      triggerToast("Switched to 3P: Developer + Tester + Security Triple Split");
    } else if (n === 4) {
      setSplitAgents([
        { role: "Developer Agent", status: "Pane 1 · session.ts", statusColor: "#10b981", isPulse: true },
        { role: "Tester Agent", status: "Pane 2 · session.test.ts", statusColor: "#ffb800", isPulse: true },
        { role: "Security Auditor", status: "Pane 3 · auth.security.ts", statusColor: "#ef4444", isPulse: true },
        { role: "Architect Agent", status: "Pane 4 · session.types.ts", statusColor: "#38bdf8", isPulse: true },
      ]);
      triggerToast("Switched to 4P: Full Squad 4-Pane Matrix");
    }
  };

  // ── Split View Add Agent ────────────────────────────────────────
  const handleAddAgentToSplit = () => {
    if (splitPanesLayout === 1) {
      handleSetSplitLayout(2);
    } else if (splitPanesLayout === 2) {
      handleSetSplitLayout(3);
    } else if (splitPanesLayout === 3) {
      handleSetSplitLayout(4);
    } else {
      triggerToast("All 4 squad agent slots are already actively writing and reviewing code!");
    }
  };

  // ── Task Creation ───────────────────────────────────────────────
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
        priority: "MEDIUM",
        targetBranch: "main",
      });

      if (res.task) {
        setTasks((prev) => [res.task, ...prev]);
        setIsCreateModalOpen(false);
        setNewTaskTitle("");
        setNewTaskDesc("");
        triggerToast(`Task "${res.task.title}" created & queued for agent squad!`);
      }
    } catch (err: any) {
      console.error("Failed to create task:", err);
      // fallback for offline/mock demo
      const mockTask: TaskItem = {
        id: `mock-${Date.now()}`,
        workspaceId: selectedWorkspace.id,
        projectId: selectedProject?.id || "proj-1",
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        status: "QUEUED",
        priority: "MEDIUM",
        targetBranch: "main",
        version: 1,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [mockTask, ...prev]);
      setIsCreateModalOpen(false);
      setNewTaskTitle("");
      setNewTaskDesc("");
      triggerToast(`Task "${mockTask.title}" created & dispatched!`);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // ── Command Palette Actions ─────────────────────────────────────
  const COMMAND_ITEMS = useMemo(() => {
    return [
      { id: "tab-studio", title: "Open CLI Studio", category: "Navigation", icon: "⌨", action: () => setActiveTab("studio") },
      { id: "tab-dash", title: "Open Dashboard Telemetry", category: "Navigation", icon: "📊", action: () => setActiveTab("dashboard") },
      { id: "tab-tasks", title: "Open Tasks Queue", category: "Navigation", icon: "✓", action: () => setActiveTab("tasks") },
      { id: "tab-review", title: "Open Code Review & Sign-Off", category: "Navigation", icon: "🔍", action: () => setActiveTab("review") },
      { id: "tab-worktree", title: "Open Worktree Sandboxes", category: "Navigation", icon: "📂", action: () => setActiveTab("worktree") },
      { id: "tab-split", title: "Open Split View Live Editor", category: "Navigation", icon: "▥", action: () => setActiveTab("split") },
      { id: "tab-providers", title: "Configure AI Providers & Keys", category: "Navigation", icon: "⚙", action: () => setActiveTab("providers") },
      { id: "auth-github", title: currentUser ? `Signed in as @${currentUser.login}` : "Sign In with GitHub", category: "Authentication", icon: "🐙", action: () => setIsGitHubModalOpen(true) },
      { id: "run-full", title: "Run Full-Stack Squad Pipeline", category: "Agent Squad", icon: "⚡", action: () => { setActiveTab("studio"); handleExecuteStudioPrompt("Fix auth timeout on token refresh in src/auth/session.ts", "SQUAD"); } },
      { id: "run-sec", title: "Trigger Security Gate Audit (@security)", category: "Agent Squad", icon: "🛡️", action: () => { setActiveTab("studio"); handleExecuteStudioPrompt("Audit packages for secret exposures and AST taint", "SECURITY"); } },
      { id: "run-vitest", title: "Run Vitest Suite in Worktree", category: "Testing", icon: "🧪", action: () => { setActiveTab("split"); handleRunVitestInSplit(); } },
      { id: "new-task", title: "Create New Agent Task (+)", category: "Tasks", icon: "➕", action: () => setIsCreateModalOpen(true) },
      { id: "copy-wt", title: "Copy Git Worktree Command", category: "Git Operations", icon: "📋", action: () => handleCopyGitWorktree(activeLease) },
      { id: "ping-providers", title: "Ping Default AI Provider", category: "Providers", icon: "📶", action: () => handleTestProvider(defaultProvider.id) },
    ];
  }, [activeLease, defaultProvider, currentUser]);

  const filteredCommands = useMemo(() => {
    if (!paletteQuery.trim()) return COMMAND_ITEMS;
    const q = paletteQuery.toLowerCase();
    return COMMAND_ITEMS.filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [COMMAND_ITEMS, paletteQuery]);

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

  if (isAuthChecking && !currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08080a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "Inter, -apple-system, sans-serif",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            background: "#cc0000",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: "18px",
            boxShadow: "0 0 24px rgba(204,0,0,0.6)",
          }}
        >
          +
        </div>
        <div style={{ fontSize: "13px", color: "#888", letterSpacing: "0.02em" }}>
          Verifying security credentials &amp; cryptographic leases...
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${sidebarCollapsed ? "collapsed" : ""}`}>
      {/* ── SIDEBAR NAVIGATION ───────────────────────────────────── */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand Header */}
        <div
          className="brand"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            padding: sidebarCollapsed ? "6px 0" : "6px 4px",
            height: "52px",
            width: "100%",
          }}
        >
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="brand-badge"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                background: "#ffffff",
                color: "#0b0b0d",
                fontWeight: 800,
                fontSize: "14px",
                display: "grid",
                placeItems: "center",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                transition: "transform 0.15s ease",
              }}
              title="Expand sidebar (Ctrl+B)"
            >
              AF
            </button>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flex: 1,
                  minWidth: 0,
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("dashboard")}
              >
                <div
                  className="brand-badge"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#0b0b0d",
                    fontWeight: 800,
                    fontSize: "13px",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  AF
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>AgentForge</span>
                    <span style={{ fontSize: "9px", background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "1px 5px", borderRadius: "4px", fontWeight: 700, lineHeight: "12px" }}>PRO</span>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Autonomous Orchestrator
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarCollapsed(true);
                }}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  fontSize: "11px",
                  flexShrink: 0,
                }}
                title="Collapse sidebar (Ctrl+B)"
              >
                ←
              </button>
            </>
          )}
        </div>

        <nav className="nav">
          {/* CORE SECTION */}
          <div className="nav-group">
            <div className="nav-label">Core Engine</div>
            <a
              className={`nav-link ${activeTab === "studio" ? "active" : ""}`}
              onClick={() => setActiveTab("studio")}
              title="CLI Studio"
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
              title="Dashboard Telemetry"
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
              title="Tasks Pipeline"
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
              title="Code Review Queue"
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
              title="Worktree Sandboxes"
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <span>Sandboxes</span>
              <b className="count" style={{ background: "rgba(59,240,140,0.15)", color: "#3bf08c" }}>{worktreeLeases.filter(l => l.active).length}</b>
            </a>

            <a
              className={`nav-link ${activeTab === "split" ? "active" : ""}`}
              onClick={() => setActiveTab("split")}
              title="Split View Live Coding"
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
              title="AI Providers"
            >
              <svg viewBox="0 0 24 24">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Providers</span>
              <b className="count" style={{ background: "rgba(139,61,255,0.15)", color: "#8b3dff" }}>6</b>
            </a>

            <a
              className={`nav-link ${activeTab === "preview" ? "active" : ""}`}
              onClick={() => setActiveTab("preview")}
              title="Live Preview"
            >
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="m10 10 2 2 4-4" />
              </svg>
              <span>Preview</span>
              <b className="count" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>Live</b>
            </a>
          </div>
        </nav>

        {/* Sidebar Status Footer */}
        <div style={{ padding: sidebarCollapsed ? "10px 4px" : "12px 14px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
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
                <span>{worktreeLeases.filter(l => l.active).length} worktrees active</span>
                <span style={{ fontSize: "10px" }}>● live</span>
              </div>
            </>
          )}

          {/* User Profile in Sidebar Footer */}
          <div
            className="profile"
            onClick={() => {
              if (currentUser) {
                setIsUserMenuOpen(!isUserMenuOpen);
              } else {
                setIsGitHubModalOpen(true);
              }
            }}
            style={{
              marginTop: "4px",
              padding: sidebarCollapsed ? "4px" : "6px 8px",
              cursor: "pointer",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            title={currentUser ? `Signed in as @${currentUser.login}` : "Click to sign in with GitHub"}
          >
            {currentUser ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.login}
                style={{ width: "24px", height: "24px", borderRadius: "50%", border: "1px solid #10b981", flexShrink: 0 }}
              />
            ) : (
              <span className="avatar">🐙</span>
            )}

            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <div className="profile-name" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {currentUser ? `@${currentUser.login}` : "Sign In with GitHub"}
                </div>
                <div style={{ fontSize: "10px", color: currentUser ? "#10b981" : "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                  {currentUser ? "● GitHub Active" : "Click to connect"}
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
          <div className="crumbs" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  fontSize: "12px",
                  marginRight: "2px",
                }}
                title="Expand sidebar (Ctrl+B)"
              >
                ☰
              </button>
            )}
            {/* 1. AgentForge Brand Button -> Redirects to Landing Page (Home) */}
            <Link
              href="/"
              style={{
                textDecoration: "none",
                background: "transparent",
                color: "var(--muted)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--muted)";
                e.currentTarget.style.background = "transparent";
              }}
              title="Return to Landing Page"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Home</span>
            </Link>

            <span className="crumb-sep" style={{ color: "var(--border)" }}>/</span>

            {/* 2. Interactive Workspace Dropdown Switcher Button */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen);
                  setIsViewDropdownOpen(false);
                }}
                style={{
                  background: isWorkspaceDropdownOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  border: isWorkspaceDropdownOpen ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "4px 9px",
                  color: "var(--text)",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Click to switch workspace"
              >
                <span style={{ color: "#10b981", fontSize: "10px" }}>●</span>
                <span>{selectedWorkspace?.name || "Engineering Monorepo"}</span>
                <span style={{ fontSize: "9px", color: "var(--muted)", transform: isWorkspaceDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>▼</span>
              </button>

              {/* Backdrop to close on click outside */}
              {isWorkspaceDropdownOpen && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setIsWorkspaceDropdownOpen(false)}
                />
              )}

              {isWorkspaceDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    width: "260px",
                    background: "#121217",
                    border: "1px solid #282834",
                    borderRadius: "10px",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
                    padding: "6px",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", padding: "4px 8px", textTransform: "uppercase" }}>
                    Select Workspace
                  </div>
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      onClick={() => {
                        setSelectedWorkspace(ws);
                        setIsWorkspaceDropdownOpen(false);
                        triggerToast(`Switched workspace to "${ws.name}"`);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: selectedWorkspace?.id === ws.id ? "rgba(16,185,129,0.12)" : "transparent",
                        border: selectedWorkspace?.id === ws.id ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                        color: selectedWorkspace?.id === ws.id ? "#10b981" : "var(--text)",
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedWorkspace?.id !== ws.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        if (selectedWorkspace?.id !== ws.id) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{ws.name}</span>
                        <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{ws.slug}</span>
                      </div>
                      <span className="pill" style={{ fontSize: "9px", padding: "1px 5px" }}>{ws.role || "MEMBER"}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "4px" }}>
                    <button
                      onClick={() => {
                        setIsWorkspaceDropdownOpen(false);
                        const wsName = prompt("Enter new workspace name:");
                        if (wsName && wsName.trim()) {
                          const newWs: WorkspaceItem = {
                            id: `ws-${Date.now()}`,
                            name: wsName.trim(),
                            slug: wsName.toLowerCase().replace(/\s+/g, "-"),
                            role: "OWNER",
                          };
                          setWorkspaces((prev) => [...prev, newWs]);
                          setSelectedWorkspace(newWs);
                          triggerToast(`Workspace "${newWs.name}" created!`);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        background: "none",
                        border: "none",
                        color: "#34d399",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      + Create Workspace...
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="crumb-sep" style={{ color: "var(--border)" }}>/</span>

            {/* 3. Screen / View Switcher Dropdown Button */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setIsViewDropdownOpen(!isViewDropdownOpen);
                  setIsWorkspaceDropdownOpen(false);
                }}
                style={{
                  background: isViewDropdownOpen ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                  border: isViewDropdownOpen ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "4px 9px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Click to switch views & screens"
              >
                <span>
                  {activeTab === "studio"
                    ? "⌨ CLI Studio"
                    : activeTab === "dashboard"
                    ? "📊 Dashboard"
                    : activeTab === "tasks"
                    ? "✓ Tasks"
                    : activeTab === "review"
                    ? "🔍 Code Review"
                    : activeTab === "worktree"
                    ? "📂 Sandboxes"
                    : activeTab === "split"
                    ? "▥ Split View"
                    : activeTab === "providers"
                    ? "⚙ Providers"
                    : activeTab === "preview"
                    ? "🖥 Live Preview"
                    : "📊 Dashboard"}
                </span>
                <span style={{ fontSize: "9px", color: "var(--muted)", transform: isViewDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>▼</span>
              </button>

              {/* Backdrop to close on click outside */}
              {isViewDropdownOpen && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setIsViewDropdownOpen(false)}
                />
              )}

              {isViewDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    width: "240px",
                    background: "#121217",
                    border: "1px solid #282834",
                    borderRadius: "10px",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
                    padding: "6px",
                    zIndex: 100,
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted)", padding: "4px 8px", textTransform: "uppercase" }}>
                    Switch Screen
                  </div>
                  {[
                    { id: "dashboard", label: "Dashboard", icon: "📊", desc: "Telemetry overview" },
                    { id: "studio", label: "CLI Studio", icon: "⌨", desc: "Prompt & command deck" },
                    { id: "tasks", label: "Tasks", icon: "✓", desc: "Pipeline runs & review" },
                    { id: "review", label: "Code Review", icon: "🔍", desc: "PR diffs & human sign-off" },
                    { id: "worktree", label: "Sandboxes", icon: "📂", desc: "Ephemeral Git checkouts" },
                    { id: "split", label: "Split View", icon: "▥", desc: "Live code editor & runner" },
                    { id: "providers", label: "Providers", icon: "⚙", desc: "API keys & models" },
                    { id: "preview", label: "Live Preview", icon: "🖥", desc: "Generated app preview" },
                  ].map((s) => {
                    const isActive = activeTab === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setActiveTab(s.id as any);
                          setIsViewDropdownOpen(false);
                          triggerToast(`Switched view to ${s.label}`);
                        }}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "6px",
                          background: isActive ? "rgba(16,185,129,0.12)" : "transparent",
                          border: isActive ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                          color: isActive ? "#10b981" : "var(--text)",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          transition: "background 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>{s.icon}</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontSize: "10px", color: "var(--muted)" }}>{s.desc}</span>
                        </div>
                        {isActive && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#10b981" }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Quick Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: "11.5px",
                cursor: "pointer",
              }}
              title="Global Command Palette (Press Ctrl+K or ⌘K)"
            >
              <span style={{ fontSize: "13px" }}>⌘</span>
              <span>Quick Actions</span>
              <kbd style={{ padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", fontSize: "10px", color: "var(--text)" }}>⌘K</kbd>
            </button>

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
            </div>

            {/* ── LOGIN WITH GITHUB OPTION (WORKING) ─────────────── */}
            {currentUser ? (
              <div style={{ position: "relative" }}>
                <div
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "3px 10px 3px 4px",
                    borderRadius: "20px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                  }}
                  title="GitHub Account Menu"
                >
                  <img
                    src={currentUser?.avatarUrl || "https://avatars.githubusercontent.com/u/9919?s=200&v=4"}
                    alt={currentUser?.login || "User"}
                    style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #10b981" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: "1.1" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text)" }}>@{currentUser?.login || "developer"}</span>
                    <span style={{ fontSize: "9px", color: "#10b981" }}>● GitHub</span>
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--muted)", marginLeft: "2px" }}>▼</span>
                </div>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "115%",
                      right: 0,
                      width: "230px",
                      background: "#121217",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                      padding: "8px",
                      zIndex: 100,
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{currentUser?.name || "Developer"}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>{currentUser?.email || "developer@agentforge.dev"}</div>
                      <div style={{ fontSize: "10.5px", color: "#34d399", fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>
                        Repo: {currentUser?.repo || "local/AgentForge"}
                      </div>
                    </div>
                    <button
                      onClick={() => { setActiveTab("providers"); setIsUserMenuOpen(false); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "transparent",
                        border: "none",
                        color: "var(--text)",
                        fontSize: "12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>⚙️</span> Provider & Model Settings
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem("agentforge_github_user");
                        setCurrentUser(null);
                        setIsUserMenuOpen(false);
                        triggerToast("Signed out of GitHub account.");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "transparent",
                        border: "none",
                        color: "#ff5a5a",
                        fontSize: "12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn"
                onClick={() => setIsGitHubModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  background: "#24292f",
                  color: "#fff",
                  border: "1px solid #30363d",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>Sign in with GitHub</span>
              </button>
            )}

            {/* New Task Trigger Button */}
            <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
              <svg viewBox="0 0 24 24">
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
              {/* Top Row: System Header & Active Worktree Status */}
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
                    Agent CLI Studio · Command & Orchestration Deck
                  </h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Target specific specialized agent roles backed by frontier foundation models
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                    <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono, monospace)", color: "#10b981" }}>
                      {activeLease.id} · {activeLease.branch}
                    </span>
                  </div>
                  <button className="btn" onClick={() => setActiveTab("split")} style={{ fontSize: "11.5px" }}>
                    Split View ↗
                  </button>
                </div>
              </div>

              {/* ── AGENT ROSTER & MODEL ASSIGNMENT MANIFEST ────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Squad Roster · Click to target specific agent or run full squad
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Target: <b style={{ color: SQUAD_AGENTS[studioTargetAgent].color }}>{SQUAD_AGENTS[studioTargetAgent].name}</b> ({SQUAD_AGENTS[studioTargetAgent].model})
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" }}>
                  {[
                    SQUAD_AGENTS.SQUAD,
                    SQUAD_AGENTS.ARCHITECT,
                    SQUAD_AGENTS.DEVELOPER,
                    SQUAD_AGENTS.TESTER,
                    SQUAD_AGENTS.SECURITY,
                  ].map((ag) => {
                    const isTarget = studioTargetAgent === ag.id;
                    return (
                      <div
                        key={ag.id}
                        onClick={() => setStudioTargetAgent(ag.id as any)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: isTarget ? "rgba(255,255,255,0.08)" : "#0e0e12",
                          border: isTarget ? `1.5px solid ${ag.color}` : "1px solid #23232a",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          transition: "all 0.15s ease",
                          boxShadow: isTarget ? `0 0 14px -4px ${ag.color}44` : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ag.color }} />
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isTarget ? "#fff" : "var(--text)" }}>
                              {ag.name}
                            </span>
                          </div>
                          <span
                            className="pill"
                            style={{
                              fontSize: "9.5px",
                              borderColor: isTarget ? `${ag.color}55` : "var(--border)",
                              color: isTarget ? ag.color : "var(--muted)",
                              background: isTarget ? `${ag.color}15` : "transparent",
                            }}
                          >
                            {ag.badge}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          <span style={{ fontFamily: "var(--font-mono, monospace)", color: isTarget ? ag.color : "var(--text-2)", fontWeight: 600 }}>
                            {ag.model}
                          </span>
                          <span style={{ fontSize: "10px", opacity: 0.8 }}>{ag.ctx}</span>
                        </div>

                        <span style={{ fontSize: "10.5px", color: "var(--muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginTop: "2px" }}>
                          {ag.role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── COMMAND DECK & PROMPT WORKSPACE ────────────────── */}
              <div
                style={{
                  background: "#08080a",
                  border: "1px solid #1f1f26",
                  borderRadius: "var(--radius-card)",
                  overflow: "hidden",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Command Deck Header: Routing Target & Directive Flags */}
                <div
                  style={{
                    background: "#0e0e12",
                    padding: "12px 18px",
                    borderBottom: "1px solid #1a1a20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Active Recipient:
                    </span>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "8px",
                        background: `${SQUAD_AGENTS[studioTargetAgent].color}22`,
                        border: `1px solid ${SQUAD_AGENTS[studioTargetAgent].color}55`,
                        color: SQUAD_AGENTS[studioTargetAgent].color,
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {SQUAD_AGENTS[studioTargetAgent].handle || SQUAD_AGENTS[studioTargetAgent].name} &rarr; {SQUAD_AGENTS[studioTargetAgent].model}
                    </span>
                  </div>

                  {/* Directive Chips (Quick Command Modifiers) */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { label: "--branch fix/auth-timeout", val: " --branch fix/auth-timeout" },
                      { label: "--strict-types", val: " --strict-types" },
                      { label: "--vitest-coverage", val: " --vitest-coverage" },
                    ].map((flag) => (
                      <button
                        key={flag.label}
                        type="button"
                        onClick={() => setStudioPrompt((prev) => prev + flag.val)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#14141a",
                          border: "1px solid #282832",
                          color: "var(--muted)",
                          fontSize: "10.5px",
                          fontFamily: "var(--font-mono, monospace)",
                          cursor: "pointer",
                        }}
                      >
                        + {flag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multiline Prompt Workspace Area */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ position: "relative" }}>
                    <textarea
                      rows={3}
                      value={studioPrompt}
                      onChange={(e) => setStudioPrompt(e.target.value)}
                      onKeyDown={handlePromptKeyDown}
                      placeholder={`Specify instructions for ${SQUAD_AGENTS[studioTargetAgent].name} (${SQUAD_AGENTS[studioTargetAgent].model})...\ne.g. In src/auth/session.ts, wrap token refresh in an AbortController with a 5000ms timeout guard, add error boundary, and write matching vitest assertions in session.test.ts (Use ↑/↓ for history)`}
                      style={{
                        width: "100%",
                        background: "#0d0d12",
                        border: "1px solid #282834",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        color: "var(--text)",
                        fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                        fontSize: "12.5px",
                        lineHeight: "1.6",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Actions & Preset Shortcuts Bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    {/* Quick Presets */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Quick commands:</span>
                      {[
                        { label: "⚡ Fix Auth Timeout", target: "DEVELOPER", prompt: "Fix auth timeout on token refresh in src/auth/session.ts" },
                        { label: "🧪 Run All Tests", target: "TESTER", prompt: "Run vitest test harness across all packages with coverage" },
                        { label: "🛡️ Security Audit", target: "SECURITY", prompt: "Audit packages for token leaks, AST taint, and secret exposures" },
                        { label: "📐 System Spec", target: "ARCHITECT", prompt: "Decompose payment webhook architecture and draft interface contract" },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          className="btn"
                          style={{ padding: "3px 10px", fontSize: "11px", borderRadius: "14px" }}
                          onClick={() => {
                            setStudioTargetAgent(chip.target as any);
                            setStudioPrompt(chip.prompt);
                            handleExecuteStudioPrompt(chip.prompt, chip.target);
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Dispatch Button & Clear */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        ⌘+Enter to dispatch
                      </span>
                      {studioPrompt && (
                        <button
                          type="button"
                          onClick={() => setStudioPrompt("")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--muted)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn primary"
                        disabled={isStudioExecuting || !studioPrompt.trim()}
                        onClick={() => handleExecuteStudioPrompt()}
                        style={{
                          padding: "8px 18px",
                          gap: "8px",
                          opacity: isStudioExecuting || !studioPrompt.trim() ? 0.6 : 1,
                        }}
                      >
                        {isStudioExecuting ? (
                          <>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff", animation: "ping 1s infinite" }} />
                            <span>Routing to {SQUAD_AGENTS[studioTargetAgent].name}...</span>
                          </>
                        ) : (
                          <>
                            <span>Dispatch {SQUAD_AGENTS[studioTargetAgent].badge}</span>
                            <span>&rarr;</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── STREAMING TERMINAL WITH FILTERS & SEARCH ──────── */}
                <div style={{ borderTop: "1px solid #1a1a20", background: "#050507", padding: "12px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                        Console Logs
                      </span>
                      {/* Log Level Filters */}
                      <div style={{ display: "inline-flex", background: "#111116", padding: "2px", borderRadius: "6px", border: "1px solid #1f1f26" }}>
                        {(["ALL", "AGENT", "SHELL", "SUCCESS", "SECURITY"] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setTerminalFilter(lvl)}
                            style={{
                              padding: "2px 8px",
                              fontSize: "10px",
                              borderRadius: "4px",
                              border: "none",
                              background: terminalFilter === lvl ? "#22222a" : "transparent",
                              color: terminalFilter === lvl ? "#fff" : "var(--muted)",
                              cursor: "pointer",
                            }}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="text"
                        placeholder="Filter output..."
                        value={terminalSearch}
                        onChange={(e) => setTerminalSearch(e.target.value)}
                        style={{
                          background: "#0e0e14",
                          border: "1px solid #23232c",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "11px",
                          color: "var(--text)",
                          width: "130px",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => setTerminalLogs([])}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "11px", cursor: "pointer" }}
                        title="Clear terminal logs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      height: "220px",
                      overflowY: "auto",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "11.5px",
                      lineHeight: "1.7",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    {filteredTerminalLogs.map((log) => {
                      let typeColor = "#71717a";
                      if (log.type === "PROMPT") typeColor = "#22d3ee";
                      if (log.type === "ARCHITECT") typeColor = "#8b3dff";
                      if (log.type === "DEVELOPER") typeColor = "#22d3ee";
                      if (log.type === "TESTER") typeColor = "#ffb800";
                      if (log.type === "SECURITY") typeColor = "#ff5a1f";
                      if (log.type === "SUCCESS") typeColor = "#10b981";
                      return (
                        <div key={log.id} style={{ display: "flex", gap: "8px" }}>
                          <span style={{ color: "#454550", minWidth: "55px" }}>{log.time}</span>
                          <span style={{ color: typeColor, minWidth: "85px", fontWeight: 600 }}>[{log.type}]</span>
                          <span style={{ color: log.type === "PROMPT" ? "#fff" : "#b0b0bb", wordBreak: "break-all" }}>{log.message}</span>
                        </div>
                      );
                    })}
                    <div ref={termEndRef} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 2: BENTO DASHBOARD TELEMETRY (OVERVIEW)           */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Header with Title and 7D / 30D / 90D range selector */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>
                    Telemetry Overview
                  </h1>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--muted)" }}>
                    Multi-agent orchestrator throughput, velocity &amp; worktree analytics
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "inline-flex", background: "#17171d", padding: "3px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    {(["7D", "30D", "90D"] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTelemetryRange(range)}
                        style={{
                          padding: "6px 14px",
                          fontSize: "12px",
                          borderRadius: "8px",
                          background: telemetryRange === range ? "#23232a" : "transparent",
                          color: telemetryRange === range ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {range}
                      </button>
                    ))}
                  </div>

                  <button className="btn" onClick={() => exportCSV()}>
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* 4 Bento KPI Cards - Engineering Telemetry */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Tasks Completed</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksCompleted}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Across all squads</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Active Sandboxes</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].sandboxesActive}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].sandboxesDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Isolated Git worktrees</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Test Harness Pass Rate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].testPassRate}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].testPassDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Zero test regressions</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Merge Rate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeRate}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>First-pass human sign-off</span>
                </div>
              </div>

              {/* Main Telemetry Waveform & Live Squad Widget */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                {/* SVG Telemetry Chart Card with Interactive Hover */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600 }}>Activity Waveform</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                          <span style={{ color: "var(--text)" }}>Desktop Sessions</span>
                          <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#10b981", marginLeft: "2px" }}>
                            {waveformHover ? waveformHover.desktopVal : currentWaveform.data.desktop[currentWaveform.data.desktop.length - 1]}
                          </b>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 6px #06b6d4" }} />
                          <span style={{ color: "var(--text)" }}>Worker Agents</span>
                          <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#06b6d4", marginLeft: "2px" }}>
                            {waveformHover ? waveformHover.workerVal : currentWaveform.data.workers[currentWaveform.data.workers.length - 1]}
                          </b>
                        </span>
                      </div>
                    </div>

                    <span className="pill" style={{ fontSize: "10.5px", background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "#12392d" }}>
                      ● Live Concurrency
                    </span>
                  </div>

                  {/* SVG Waveform Chart with scrub handler */}
                  <div
                    style={{ position: "relative", height: "230px", width: "100%", cursor: "crosshair", userSelect: "none" }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                      const pct = relX / rect.width;
                      
                      const idx = Math.min(
                        currentWaveform.pointsDesktop.length - 1,
                        Math.max(0, Math.round(pct * (currentWaveform.pointsDesktop.length - 1)))
                      );
                      const ptDesk = currentWaveform.pointsDesktop[idx];
                      const ptWork = currentWaveform.pointsWorkers[idx];

                      setWaveformHover({
                        x: ptDesk.x,
                        desktopY: ptDesk.y,
                        workerY: ptWork.y,
                        label: ptDesk.label,
                        desktopVal: ptDesk.val,
                        workerVal: ptWork.val,
                      });
                    }}
                    onMouseLeave={() => setWaveformHover(null)}
                  >
                    <svg viewBox="0 0 640 215" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                      <defs>
                        <linearGradient id="desktopGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="workersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.20" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Y-Axis Horizontal Grid Lines & Ticks */}
                      {currentWaveform.yTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1={currentWaveform.plotLeft}
                            y1={tick.y}
                            x2={currentWaveform.plotRight}
                            y2={tick.y}
                            stroke="#1a1a22"
                            strokeWidth="1"
                            strokeDasharray={i === currentWaveform.yTicks.length - 1 ? "none" : "3 3"}
                          />
                          <text
                            x={currentWaveform.plotLeft - 8}
                            y={tick.y + 3}
                            fill="#555562"
                            fontSize="9.5"
                            fontFamily="var(--font-mono, monospace)"
                            textAnchor="end"
                          >
                            {tick.val}
                          </text>
                        </g>
                      ))}

                      {/* Worker Agents Gradient Area & Line */}
                      <path d={currentWaveform.workersAreaPath} fill="url(#workersGrad)" />
                      <path
                        d={currentWaveform.workersLinePath}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Desktop Sessions Gradient Area & Line */}
                      <path d={currentWaveform.desktopAreaPath} fill="url(#desktopGrad)" />
                      <path
                        d={currentWaveform.desktopLinePath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* X-Axis Ticks & Labels */}
                      {currentWaveform.pointsDesktop.map((pt, i) => (
                        <g key={i}>
                          <line x1={pt.x} y1={currentWaveform.plotBottom} x2={pt.x} y2={currentWaveform.plotBottom + 4} stroke="#2e2e38" strokeWidth="1" />
                          <text
                            x={pt.x}
                            y={currentWaveform.plotBottom + 18}
                            fill="#727280"
                            fontSize="10"
                            fontFamily="var(--font-mono, monospace)"
                            textAnchor="middle"
                          >
                            {pt.label}
                          </text>
                        </g>
                      ))}

                      {/* Small Dots on Curve Points */}
                      {currentWaveform.pointsDesktop.map((pt, i) => (
                        <circle key={`dp-${i}`} cx={pt.x} cy={pt.y} r="3" fill="#0b0b0d" stroke="#10b981" strokeWidth="2" />
                      ))}
                      {currentWaveform.pointsWorkers.map((pt, i) => (
                        <circle key={`wp-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#0b0b0d" stroke="#06b6d4" strokeWidth="1.8" />
                      ))}

                      {/* Dynamic Crosshair & Exact-Snap Dots on Hover */}
                      {waveformHover ? (
                        <>
                          <line
                            x1={waveformHover.x}
                            y1={15}
                            x2={waveformHover.x}
                            y2={currentWaveform.plotBottom}
                            stroke="#555566"
                            strokeDasharray="3 3"
                            strokeWidth="1.5"
                          />
                          {/* Desktop Snap Dot */}
                          <circle cx={waveformHover.x} cy={waveformHover.desktopY} r="7" fill="rgba(16,185,129,0.25)" />
                          <circle cx={waveformHover.x} cy={waveformHover.desktopY} r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />

                          {/* Workers Snap Dot */}
                          <circle cx={waveformHover.x} cy={waveformHover.workerY} r="6" fill="rgba(6,182,212,0.25)" />
                          <circle cx={waveformHover.x} cy={waveformHover.workerY} r="4" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
                        </>
                      ) : (
                        (() => {
                          const lastDesk = currentWaveform.pointsDesktop[currentWaveform.pointsDesktop.length - 1];
                          const lastWork = currentWaveform.pointsWorkers[currentWaveform.pointsWorkers.length - 1];
                          return (
                            <>
                              <line
                                x1={lastDesk.x}
                                y1={15}
                                x2={lastDesk.x}
                                y2={currentWaveform.plotBottom}
                                stroke="#2e2e38"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <circle cx={lastDesk.x} cy={lastDesk.y} r="5" fill="#10b981" stroke="#0b0b0d" strokeWidth="2" />
                              <circle cx={lastWork.x} cy={lastWork.y} r="4.5" fill="#06b6d4" stroke="#0b0b0d" strokeWidth="2" />
                            </>
                          );
                        })()
                      )}
                    </svg>

                    {/* Tooltip HUD */}
                    <div
                      style={{
                        position: "absolute",
                        left: waveformHover
                          ? `${Math.min(76, Math.max(6, (waveformHover.x / 640) * 100))}%`
                          : "72%",
                        top: "8px",
                        background: "#16161d",
                        border: "1px solid #2d2d38",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "11px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        pointerEvents: "none",
                        transition: "left 0.08s ease-out",
                        zIndex: 10,
                      }}
                    >
                      <span style={{ color: "#9a9aa6", fontWeight: 600 }}>
                        {waveformHover ? waveformHover.label : currentWaveform.data.labels[currentWaveform.data.labels.length - 1]}
                      </span>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                          Desktop:
                        </span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#fff" }}>
                          {waveformHover ? waveformHover.desktopVal : currentWaveform.data.desktop[currentWaveform.data.desktop.length - 1]} active
                        </b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#06b6d4", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06b6d4" }} />
                          Workers:
                        </span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#fff" }}>
                          {waveformHover ? waveformHover.workerVal : currentWaveform.data.workers[currentWaveform.data.workers.length - 1]} queued
                        </b>
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
                    <span className="pill" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                      Distribution
                    </span>
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
                            {cat.pct}%
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
                      { title: "Fix auth timeout on token refresh", branch: "fix/auth-timeout", status: "In review", duration: "1m 42s", statusColor: "#ffb800" },
                      { title: "Add pagination to audit log API", branch: "feature/audit-pagination", status: "In review", duration: "2m 18s", statusColor: "#ffb800" },
                      { title: "Dependency bump security scan", branch: "chore/sec-deps", status: "Completed", duration: "45s", statusColor: "#10b981" },
                      { title: "Rate-limit middleware for public routes", branch: "feature/rate-limit", status: "In review", duration: "3m 05s", statusColor: "#ffb800" },
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
                            {run.duration}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


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

              {/* Filter Pills and Search */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { label: "All", count: tasks.length || 24, val: "ALL" },
                    { label: "In Progress", count: 6, val: "IN_PROGRESS" },
                    { label: "In Review", count: 4, val: "AWAITING_REVIEW" },
                    { label: "Completed", count: 14, val: "MERGED" },
                  ].map((filter) => (
                    <button
                      key={filter.label}
                      onClick={() => setStatusFilter(filter.val as any)}
                      className={`pill ${statusFilter === filter.val ? "active" : ""}`}
                      style={{
                        padding: "6px 14px",
                        cursor: "pointer",
                        background: statusFilter === filter.val ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                        borderColor: statusFilter === filter.val ? "rgba(255,255,255,0.3)" : "var(--border)",
                        color: statusFilter === filter.val ? "#fff" : "var(--muted)",
                      }}
                    >
                      <span>{filter.label}</span>
                      <b style={{ marginLeft: "6px" }}>{filter.count}</b>
                    </button>
                  ))}
                </div>

                <div className="search" style={{ width: "260px" }}>
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    type="text"
                    placeholder="Search tasks or branches..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Tasks List */}
              <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", overflow: "hidden" }}>
                {(filteredTasks.length > 0 ? filteredTasks : [
                  { id: "1", title: "Fix auth timeout on token refresh", status: "AWAITING_REVIEW", priority: "HIGH", targetBranch: "fix/auth-timeout", createdAt: "10 mins ago" },
                  { id: "2", title: "Add pagination to audit log API", status: "AWAITING_REVIEW", priority: "MEDIUM", targetBranch: "feature/audit-pagination", createdAt: "24 mins ago" },
                  { id: "3", title: "Rate-limit middleware for public routes", status: "IN_PROGRESS", priority: "HIGH", targetBranch: "feature/rate-limit", createdAt: "1 hr ago" },
                  { id: "4", title: "Harden CORS configuration", status: "MERGED", priority: "LOW", targetBranch: "fix/cors-hardening", createdAt: "2 hrs ago" },
                  { id: "5", title: "Implement SSE heartbeat for desktop clients", status: "MERGED", priority: "MEDIUM", targetBranch: "feature/sse-heartbeat", createdAt: "3 hrs ago" },
                ]).map((t: any, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 20px",
                      borderTop: i > 0 ? "1px solid var(--border)" : "none",
                      gap: "16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background:
                            t.status === "MERGED" || t.status === "COMPLETED"
                              ? "#10b981"
                              : t.status === "AWAITING_REVIEW"
                              ? "#ffb800"
                              : "#06b6d4",
                        }}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{t.title}</span>
                        <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                          <span>{t.targetBranch || "main"}</span>
                          <span>·</span>
                          <span>{t.priority}</span>
                          <span>·</span>
                          <span>{t.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button
                        className="btn"
                        style={{ padding: "4px 10px", fontSize: "11.5px" }}
                        onClick={() => {
                          setSelectedPrId(t.id === "1" ? "1" : t.id === "2" ? "2" : "3");
                          setActiveTab("review");
                        }}
                      >
                        Diff
                      </button>
                      <button
                        className="btn"
                        style={{ padding: "4px 10px", fontSize: "11.5px" }}
                        onClick={() => {
                          setPreviewTaskId(t.id);
                          setActiveTab("preview");
                        }}
                      >
                        Preview
                      </button>
                      <button
                        className="btn"
                        style={{ padding: "4px 10px", fontSize: "11.5px" }}
                        onClick={() => {
                          setStudioTargetAgent("DEVELOPER");
                          setStudioPrompt(`Continue work on task: ${t.title}`);
                          setActiveTab("studio");
                        }}
                      >
                        Run
                      </button>
                      <button
                        className="btn primary"
                        style={{ padding: "4px 12px", fontSize: "11.5px" }}
                        onClick={() => {
                          handleApprovePr(t.id);
                        }}
                      >
                        Merge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 4: CODE REVIEW & HUMAN-IN-THE-LOOP SIGN-OFF        */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Code Review</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Nothing reaches main without human sign-off · HMAC cryptographically verified
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Unified vs Split Mode Toggle */}
                  <div style={{ display: "inline-flex", background: "#17171d", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <button
                      onClick={() => setDiffViewMode("unified")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        background: diffViewMode === "unified" ? "#23232a" : "transparent",
                        color: diffViewMode === "unified" ? "#fff" : "var(--muted)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Unified
                    </button>
                    <button
                      onClick={() => setDiffViewMode("split")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        background: diffViewMode === "split" ? "#23232a" : "transparent",
                        color: diffViewMode === "split" ? "#fff" : "var(--muted)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Side-by-Side
                    </button>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Review queue · <b style={{ color: "#fff" }}>{prReviews.filter(p => p.status === "AWAITING_REVIEW").length} pending</b>
                  </div>
                </div>
              </div>

              {/* Split Review Queue & Diff Inspector */}
              <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: "16px", minHeight: "560px" }}>
                {/* Left: Review Queue List */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                    Pending Pull Requests ({prReviews.length})
                  </span>
                  {prReviews.map((item) => {
                    const isSelected = selectedPrId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedPrId(item.id)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: isSelected ? "rgba(255,255,255,0.08)" : "transparent",
                          border: isSelected ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: isSelected ? "#fff" : "var(--text)" }}>{item.title}</span>
                          <span
                            className="pill"
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderColor: item.status === "APPROVED" ? "#10b98155" : item.status === "CHANGES_REQUESTED" ? "#ff5a1f55" : "var(--border)",
                              color: item.status === "APPROVED" ? "#10b981" : item.status === "CHANGES_REQUESTED" ? "#ff5a1f" : "#ffb800",
                            }}
                          >
                            {item.status === "APPROVED" ? "Approved" : item.status === "CHANGES_REQUESTED" ? "Changes Req." : "Pending"}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                          <span>{item.branch} · {item.files} files</span>
                          <span style={{ color: "#34d399" }}>{item.diff}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                          <span className="pill" style={{ fontSize: "10px", background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "#12392d" }}>
                            ✓ {item.tests}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--muted)" }}>{item.author}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Diff Viewer with Request Changes & Approve buttons */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  {/* Diff Header */}
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0e0e12" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{activePr.filePath}</span>
                      <span className="pill" style={{ color: "#34d399" }}>{activePr.diff}</span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>branch: {activePr.branch}</span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn"
                        onClick={() => setReviewCommentOpen(true)}
                        style={{ fontSize: "12px" }}
                      >
                        Request Changes
                      </button>
                      <button
                        className="btn primary"
                        disabled={activePr.status === "APPROVED"}
                        onClick={() => handleApprovePr(activePr.id)}
                        style={{ fontSize: "12px" }}
                      >
                        {activePr.status === "APPROVED" ? "✓ Approved (Signed)" : "Approve & Sign-Off"}
                      </button>
                    </div>
                  </div>

                  {/* Inline Request Changes Dialog */}
                  {reviewCommentOpen && (
                    <div style={{ padding: "12px 18px", background: "#16161d", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                        Specify required changes for {activePr.author}:
                      </span>
                      <textarea
                        rows={2}
                        value={reviewCommentText}
                        onChange={(e) => setReviewCommentText(e.target.value)}
                        placeholder="e.g. Please add error handling for DNS timeout and add 1 more vitest assertion..."
                        style={{
                          width: "100%",
                          background: "#0d0d12",
                          border: "1px solid #2e2e38",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          color: "#fff",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button className="btn" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => setReviewCommentOpen(false)}>Cancel</button>
                        <button className="btn primary" style={{ fontSize: "11px", padding: "4px 12px" }} onClick={() => handleRequestChanges(activePr.id)}>Submit Request</button>
                      </div>
                    </div>
                  )}

                  {/* Diff Body: Unified vs Split */}
                  {diffViewMode === "unified" ? (
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
                      {activePr.diffLines.map((line, idx) => {
                        if (line.type === "header") {
                          return <div key={idx} style={{ color: "#54545d" }}>{line.text}</div>;
                        }
                        if (line.type === "delete") {
                          return (
                            <div key={idx} style={{ color: "#ff4d4d", background: "rgba(255,77,77,0.1)", padding: "1px 6px" }}>
                              {line.text}
                            </div>
                          );
                        }
                        return (
                          <div key={idx} style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "1px 6px" }}>
                            {line.text}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Side-by-Side (Split) Diff View */
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflowY: "auto", background: "#08080a" }}>
                      {/* Left: Old (Base) */}
                      <div style={{ borderRight: "1px solid #1f1f26", padding: "14px 16px", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7" }}>
                        <div style={{ color: "#54545d", marginBottom: "8px", borderBottom: "1px solid #1a1a20", paddingBottom: "4px" }}>
                          BASE: main (Previous)
                        </div>
                        {activePr.oldLines.map((line, idx) => (
                          <div key={idx} style={{ color: "#b0b0bb" }}>
                            <span style={{ color: "#444450", width: "24px", display: "inline-block" }}>{idx + 1}</span> {line}
                          </div>
                        ))}
                      </div>

                      {/* Right: New (Head / Worktree) */}
                      <div style={{ padding: "14px 16px", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", background: "rgba(16,185,129,0.02)" }}>
                        <div style={{ color: "#10b981", marginBottom: "8px", borderBottom: "1px solid #1a1a20", paddingBottom: "4px" }}>
                          HEAD: {activePr.branch} (Agent Patch)
                        </div>
                        {activePr.newLines.map((line, idx) => (
                          <div key={idx} style={{ color: "#ededf0" }}>
                            <span style={{ color: "#10b981", width: "24px", display: "inline-block" }}>{idx + 1}</span> {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 5: WORKTREE SANDBOXES (EPHEMERAL CHECKOUTS)        */}
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
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Worktree Sandboxes</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Isolated, ephemeral git checkouts for each squad execution
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn" onClick={() => handleCopyGitWorktree(activeLease)}>
                    📋 Copy git worktree command
                  </button>
                  <button className="btn" onClick={() => handleReleaseLease(activeLease.id)}>
                    Release Lease
                  </button>
                  <button className="btn primary" onClick={() => handleSendToReview(activeLease)}>
                    Send to Review &rarr;
                  </button>
                </div>
              </div>

              {/* Lease Selector Pills */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                  Active Sandboxes:
                </span>
                {worktreeLeases.map((lease) => (
                  <button
                    key={lease.id}
                    onClick={() => setSelectedLeaseId(lease.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "10px",
                      background: selectedLeaseId === lease.id ? "rgba(255,255,255,0.08)" : "#0e0e12",
                      border: selectedLeaseId === lease.id ? "1.5px solid #10b981" : "1px solid #23232a",
                      color: selectedLeaseId === lease.id ? "#fff" : "var(--muted)",
                      cursor: "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: lease.active ? "#10b981" : "#888" }} />
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{lease.id}</span>
                    <span>({lease.branch})</span>
                  </button>
                ))}
              </div>

              {/* Lease Metadata Row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Lease Hex</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>{activeLease.leaseHex}</span>
                    <span className="pill" style={{ color: activeLease.active ? "#10b981" : "#888" }}>
                      {activeLease.active ? "Active" : "Released"}
                    </span>
                  </div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Process ID</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>{activeLease.pid}</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Branch</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>{activeLease.branch}</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Base</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>{activeLease.base}</div>
                </div>

                <div className="card" style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>Disk usage</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)", marginTop: "4px" }}>{activeLease.diskUsage}</div>
                </div>
              </div>

              {/* Split File Explorer & Code Inspector */}
              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", height: "480px" }}>
                {/* File Tree */}
                <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", overflowY: "auto", padding: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Files ({activeLease.files.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {activeLease.files.map((f) => {
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
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "#0e0e12", fontSize: "12px", fontFamily: "var(--font-mono, monospace)", display: "flex", justifyContent: "space-between" }}>
                    <span>{selectedWorktreeFile}</span>
                    <span style={{ color: "var(--muted)" }}>Worktree: {activeLease.id}</span>
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
                    {activeLease.files.find((f) => f.path === selectedWorktreeFile)?.content || "// Select a file to preview"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 6: SPLIT VIEW (MULTI-AGENT LIVE CODING)            */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "split" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header with Title, Layout Switcher, and Add Agent Button */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>Split View</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#9a9aa6" }}>Watch several agents write code side by side in real time</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* Pane Layout Toggles */}
                  <div style={{ display: "inline-flex", background: "#17171d", padding: "3px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleSetSplitLayout(n as any)}
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
                    <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono, monospace)", color: "#34d399" }}>{activeLease.leaseHex}</span>
                    <span style={{ fontSize: "10.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{activeLease.branch}</span>
                  </div>
                </div>

                {/* Right: Side-by-Side Live Code Panes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      splitPanesLayout === 1
                        ? "1fr"
                        : splitPanesLayout === 2
                        ? "repeat(2, minmax(0, 1fr))"
                        : splitPanesLayout === 3
                        ? "repeat(3, minmax(0, 1fr))"
                        : "repeat(4, minmax(240px, 1fr))",
                    gap: "12px",
                    overflowX: splitPanesLayout === 4 ? "auto" : "visible",
                  }}
                >
                  {/* Pane 1: Developer editing session.ts / refresh.ts */}
                  <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <span
                          className="pill"
                          onClick={() => setSplitTab1("session.ts")}
                          style={{
                            background: splitTab1 === "session.ts" ? "#23232a" : "transparent",
                            color: splitTab1 === "session.ts" ? "#fff" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          session.ts <span style={{ color: "#ffb800", marginLeft: "4px" }}>M</span>
                        </span>
                        <span
                          className="pill"
                          onClick={() => setSplitTab1("refresh.ts")}
                          style={{
                            background: splitTab1 === "refresh.ts" ? "#23232a" : "transparent",
                            color: splitTab1 === "refresh.ts" ? "#fff" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          refresh.ts
                        </span>
                      </div>
                      <span className="pill" style={{ color: "#34d399", borderColor: "#14523f", background: "rgba(16,185,129,0.08)" }}>
                        ● Developer (Writing)
                      </span>
                    </div>

                    {/* Code Lines with Syntax Coloring */}
                    <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                      {splitTab1 === "session.ts" ? (
                        <>
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
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>50</span> &#125;</div>
                        </>
                      ) : (
                        <>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; Router &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;express&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; refreshSession &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;../auth/session&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#22d3ee" }}>export const</span> refreshRouter = <span style={{ color: "#ffb800" }}>Router</span>();</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span></div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span> refreshRouter.<span style={{ color: "#ffb800" }}>post</span>(<span style={{ color: "#10b981" }}>&quot;/refresh&quot;</span>, <span style={{ color: "#22d3ee" }}>async</span> (req, res) =&gt; &#123;</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span>   <span style={{ color: "#22d3ee" }}>const</span> token = req.headers.authorization?.<span style={{ color: "#ffb800" }}>replace</span>(<span style={{ color: "#10b981" }}>&quot;Bearer &quot;</span>, <span style={{ color: "#10b981" }}>&quot;&quot;</span>);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>   <span style={{ color: "#8b3dff" }}>if</span> (!token) <span style={{ color: "#8b3dff" }}>return</span> res.<span style={{ color: "#ffb800" }}>status</span>(401).json(&#123; error: <span style={{ color: "#10b981" }}>&quot;missing_token&quot;</span> &#125;);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span>   <span style={{ color: "#22d3ee" }}>const</span> result = <span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>refreshSession</span>(token);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  res.<span style={{ color: "#ffb800" }}>json</span>(result);</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span> &#125;</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pane 2: Tester writing session.test.ts + Live Vitest Trigger */}
                  {splitPanesLayout >= 2 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            session.test.ts <span style={{ color: "#34d399", marginLeft: "4px" }}>A</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isVitestRunning}
                            onClick={handleRunVitestInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px" }}
                          >
                            {isVitestRunning ? "Testing..." : "▶ Run Vitest in Worktree"}
                          </button>
                          <span className="pill" style={{ color: "#fbbf24", borderColor: "#3a3020", background: "rgba(251,191,36,0.08)" }}>
                            ● Tester
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Vitest Suite */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; describe, it, expect, vi &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;vitest&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; refreshSession &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./session&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#ffb800" }}>describe</span>(<span style={{ color: "#10b981" }}>&quot;refreshSession&quot;</span>, () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   <span style={{ color: "#ffb800" }}>it</span>(<span style={{ color: "#10b981" }}>&quot;aborts when server stalls past timeout&quot;</span>, <span style={{ color: "#22d3ee" }}>async</span> () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>     vi.<span style={{ color: "#ffb800" }}>useFakeTimers</span>();</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#22d3ee" }}>const</span> p = <span style={{ color: "#ffb800" }}>refreshSession</span>(<span style={{ color: "#10b981" }}>&quot;stale-tok&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>     vi.<span style={{ color: "#ffb800" }}>advanceTimersByTime</span>(5000);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>expect</span>(p).<span style={{ color: "#ffb800" }}>rejects</span>.toThrow(<span style={{ color: "#10b981" }}>&quot;refresh_failed&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  &#125;);</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span> &#125;</div>
                      </div>
                    </div>
                  )}

                  {/* Pane 3: Security Auditor (auth.security.ts) */}
                  {splitPanesLayout >= 3 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            auth.security.ts <span style={{ color: "#ef4444", marginLeft: "4px" }}>A</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isAuditRunning}
                            onClick={handleRunAuditInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px", background: "#ef4444", borderColor: "#dc2626" }}
                          >
                            {isAuditRunning ? "Auditing..." : "🛡️ Run AST Audit"}
                          </button>
                          <span className="pill" style={{ color: "#ef4444", borderColor: "#551b1b", background: "rgba(239,68,68,0.08)" }}>
                            ● Security (Auditing)
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Security Auditor */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto", overflowX: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; SecurityContext, sanitizeToken &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;@agentforge/security&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; TokenPayload &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./session.types&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#22d3ee" }}>export function</span> <span style={{ color: "#ffb800" }}>auditSessionSecurity</span>(token: <span style={{ color: "#06b6d4" }}>string</span>): <span style={{ color: "#06b6d4" }}>SecurityContext</span> &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   <span style={{ color: "#22d3ee" }}>const</span> sanitized = <span style={{ color: "#ffb800" }}>sanitizeToken</span>(token);</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>   <span style={{ color: "#8b3dff" }}>if</span> (!sanitized.isSigned) &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span>     <span style={{ color: "#8b3dff" }}>throw new</span> <span style={{ color: "#ef4444" }}>SecurityException</span>(<span style={{ color: "#10b981" }}>&quot;UNTRUSTED_ISSUER_HEADER&quot;</span>);</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>   &#125;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span>   <span style={{ color: "#8b3dff" }}>return</span> &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>    taintCheck: <span style={{ color: "#10b981" }}>&quot;PASSED&quot;</span>,</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span>    cryptographicProof: <span style={{ color: "#10b981" }}>&quot;ed25519-valid&quot;</span>,</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>12</span>    verifiedAt: <span style={{ color: "#ffb800" }}>Date.now</span>(),</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>13</span>  &#125;;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>14</span> &#125;</div>
                      </div>
                    </div>
                  )}

                  {/* Pane 4: Architect Agent (session.types.ts) */}
                  {splitPanesLayout >= 4 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            session.types.ts <span style={{ color: "#38bdf8", marginLeft: "4px" }}>C</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isSchemaVerifying}
                            onClick={handleVerifySchemaInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px", background: "#0284c7", borderColor: "#0369a1" }}
                          >
                            {isSchemaVerifying ? "Verifying..." : "📐 Verify Schema"}
                          </button>
                          <span className="pill" style={{ color: "#38bdf8", borderColor: "#0c4a6e", background: "rgba(56,189,248,0.08)" }}>
                            ● Architect (Spec Verified)
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Architect Agent */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto", overflowX: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>export interface</span> <span style={{ color: "#38bdf8" }}>SessionRefreshContract</span> &#123;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span>   sessionId: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span>   expiresInSeconds: <span style={{ color: "#ffb800" }}>number</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span>   refreshToken: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   fingerprint: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>   scope: <span style={{ color: "#10b981" }}>&quot;read:code&quot;</span> | <span style={{ color: "#10b981" }}>&quot;write:code&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span> &#125;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span> <span style={{ color: "#8b3dff" }}>export interface</span> <span style={{ color: "#38bdf8" }}>SecurityContext</span> &#123;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  verifiedAt: <span style={{ color: "#ffb800" }}>number</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span>  taintCheck: <span style={{ color: "#10b981" }}>&quot;PASSED&quot;</span> | <span style={{ color: "#ef4444" }}>&quot;FAILED&quot;</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>12</span>  cryptographicProof: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>13</span> &#125;</div>
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
                      {tab === "logs" ? "Agent Log" : tab === "problems" ? "Problems 0" : "Output (Vitest Runner)"}
                    </button>
                  ))}
                </div>

                <div style={{ padding: "14px 18px", height: "130px", overflowY: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: "11.5px", background: "#08080a" }}>
                  {splitBottomTab === "logs" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ color: "#71717a" }}>10:14:02 [squad] Worktree sandbox mounted at .agentforge/wt-9f18a24c</div>
                      <div style={{ color: "#10b981" }}>10:14:05 [developer] Opened src/auth/session.ts - writing AbortController guard</div>
                      <div style={{ color: "#ffb800" }}>10:14:18 [tester] Opened src/auth/session.test.ts - mocking fake timers for timeout test</div>
                    </div>
                  )}
                  {splitBottomTab === "problems" && (
                    <div style={{ color: "#10b981" }}>No problems detected in workspace. TypeScript AST check clean.</div>
                  )}
                  {splitBottomTab === "output" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {vitestOutputLines.map((line, idx) => (
                        <div key={idx} style={{ color: line.includes("✓") ? "#10b981" : line.includes("RUN") ? "#22d3ee" : "#b0b0bb" }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 7: API PROVIDERS & FRONTIER MODEL KEYS            */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "providers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em" }}>
                  Model Providers &amp; API Keys
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#9a9aa6" }}>
                  AgentForge routes each squad step to frontier models. Bring your own keys or run locally with Ollama.
                </p>
              </div>

              {/* Providers Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                {providers.map((p) => {
                  return (
                    <div
                      key={p.id}
                      className="card"
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        border: p.isDefault ? "1.5px solid rgba(16,185,129,0.5)" : "1px solid var(--border)",
                        background: p.isDefault ? "rgba(16,185,129,0.02)" : "var(--panel)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "22px" }}>{p.icon}</span>
                          <div>
                            <div style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                              <span>{p.name}</span>
                              {p.isDefault && (
                                <span className="pill" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "#14523f", fontSize: "10px" }}>
                                  Default Engine
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {p.latencyMs ? `${p.latencyMs}ms latency` : "Not verified"}
                            </span>
                          </div>
                        </div>

                        <span
                          className="pill"
                          style={{
                            borderColor: p.status === "CONNECTED" ? "#14523f" : p.status === "TESTING" ? "#ffb80055" : "var(--border)",
                            color: p.status === "CONNECTED" ? "#34d399" : p.status === "TESTING" ? "#ffb800" : "#888",
                            background: p.status === "CONNECTED" ? "rgba(16,185,129,0.08)" : "transparent",
                          }}
                        >
                          ● {p.status}
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: "12.5px", color: "#9a9aa6", lineHeight: "1.5" }}>
                        {p.description}
                      </p>

                      {/* Supported Models Badges */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {p.models.map((m) => (
                          <span
                            key={m}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: "#18181f",
                              border: "1px solid #23232c",
                              fontSize: "10.5px",
                              fontFamily: "var(--font-mono, monospace)",
                              color: "var(--text-2)",
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>

                      {/* Key Input Field */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "auto" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)" }}>API KEY / HOST</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type={visibleKey[p.id] ? "text" : "password"}
                            placeholder={p.apiKey ? "••••••••••••••••••••" : p.keyPlaceholder}
                            value={editingProviderKey[p.id] !== undefined ? editingProviderKey[p.id] : (p.apiKey ? "••••••••••••••••••••" : "")}
                            onChange={(e) =>
                              setEditingProviderKey((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            onFocus={() => {
                              if (editingProviderKey[p.id] === undefined && p.apiKey) {
                                setEditingProviderKey((prev) => ({ ...prev, [p.id]: p.apiKey }));
                              }
                            }}
                            style={{
                              flex: 1,
                              background: "#0c0c10",
                              border: "1px solid #23232c",
                              borderRadius: "8px",
                              padding: "8px 12px",
                              fontSize: "12px",
                              fontFamily: "var(--font-mono, monospace)",
                              color: "var(--text)",
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setVisibleKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                            style={{ padding: "0 10px", fontSize: "11px" }}
                            title="Show/hide key"
                          >
                            {visibleKey[p.id] ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {editingProviderKey[p.id] !== undefined && (
                            <button
                              className="btn primary"
                              onClick={() => handleSaveProviderKey(p.id)}
                              style={{ padding: "5px 12px", fontSize: "11.5px" }}
                            >
                              Save
                            </button>
                          )}
                          <button
                            className="btn"
                            disabled={p.status === "TESTING"}
                            onClick={() => handleTestProvider(p.id)}
                            style={{ padding: "5px 12px", fontSize: "11.5px" }}
                          >
                            {p.status === "TESTING" ? "Testing..." : "Test Connection"}
                          </button>
                        </div>

                        {!p.isDefault && (
                          <button
                            className="btn"
                            onClick={() => handleSetDefaultProvider(p.id)}
                            style={{ padding: "5px 10px", fontSize: "11px", color: "var(--muted)" }}
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 8: LIVE PREVIEW (Calculator & Task Outputs)       */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "preview" && (() => {
            const CALCULATOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Calculator — Generated by AgentForge</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0b0b0d;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',system-ui,sans-serif}
  .calc{background:#151519;border:1px solid #2a2a34;border-radius:20px;padding:24px;width:320px;box-shadow:0 24px 64px rgba(0,0,0,0.6)}
  .display{background:#0a0a0e;border:1px solid #1e1e28;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:right}
  .expr{font-size:12px;color:#555;min-height:18px;font-family:monospace;margin-bottom:4px}
  .value{font-size:38px;font-weight:600;color:#fff;letter-spacing:-0.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  button{padding:18px 0;border-radius:12px;border:none;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.12s ease}
  .num{background:#1e1e28;color:#fff}.num:hover{background:#2a2a36;transform:scale(1.04)}
  .op{background:#8b3dff22;color:#8b3dff;border:1px solid #8b3dff33}.op:hover{background:#8b3dff33}
  .eq{background:#10b981;color:#fff;grid-column:span 2}.eq:hover{background:#0ea571}
  .clr{background:#ff4d4d22;color:#ff4d4d;border:1px solid #ff4d4d33}.clr:hover{background:#ff4d4d33}
  .zero{grid-column:span 2}
  .meta{margin-top:14px;display:flex;justify-content:space-between;font-size:10px;color:#444}
  .badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase}
  .openai-badge{background:rgba(16,163,127,0.15);color:#10a37f;border:1px solid #10a37f33}
  .gemini-badge{background:rgba(66,133,244,0.15);color:#4285f4;border:1px solid #4285f433}
</style>
</head>
<body>
<div class="calc">
  <div class="display">
    <div class="expr" id="expr"></div>
    <div class="value" id="val">0</div>
  </div>
  <div class="grid">
    <button class="clr" onclick="calcAC()">AC</button>
    <button class="num" onclick="calcNeg()">+/&#8722;</button>
    <button class="num" onclick="calcPct()">%</button>
    <button class="op" onclick="calcOp('div')">&#247;</button>
    <button class="num" onclick="calcNum('7')">7</button>
    <button class="num" onclick="calcNum('8')">8</button>
    <button class="num" onclick="calcNum('9')">9</button>
    <button class="op" onclick="calcOp('mul')">&#215;</button>
    <button class="num" onclick="calcNum('4')">4</button>
    <button class="num" onclick="calcNum('5')">5</button>
    <button class="num" onclick="calcNum('6')">6</button>
    <button class="op" onclick="calcOp('sub')">&#8722;</button>
    <button class="num" onclick="calcNum('1')">1</button>
    <button class="num" onclick="calcNum('2')">2</button>
    <button class="num" onclick="calcNum('3')">3</button>
    <button class="op" onclick="calcOp('add')">+</button>
    <button class="num zero" onclick="calcNum('0')">0</button>
    <button class="num" onclick="calcDot()">.</button>
    <button class="eq" onclick="calcEq()">=</button>
  </div>
  <div class="meta">
    <span><span class="badge openai-badge">OpenAI GPT-4o</span> UI/UX</span>
    <span><span class="badge gemini-badge">Gemini 2.0</span> Logic</span>
  </div>
</div>
<script>
var cur='0',prev='',op='',fresh=true;
var D=document.getElementById('val'),E=document.getElementById('expr');
function update(){D.textContent=cur;E.textContent=prev&&op?prev+' '+op:'';}
function calcNum(n){if(fresh){cur=n;fresh=false;}else cur=cur==='0'?n:cur+n;update();}
function calcDot(){if(fresh){cur='0.';fresh=false;}else if(cur.indexOf('.')<0)cur+='.';update();}
function calcOp(o){if(op&&!fresh)calcEq();prev=cur;op=o;fresh=true;update();}
function calcEq(){if(!op||!prev)return;var a=parseFloat(prev),b=parseFloat(cur),r=0;
if(op==='add')r=a+b;else if(op==='sub')r=a-b;else if(op==='mul')r=a*b;else if(op==='div')r=b!==0?a/b:NaN;
E.textContent=prev+' '+op+' '+cur+' =';
cur=isNaN(r)?'Error':parseFloat(r.toFixed(10)).toString();prev='';op='';fresh=true;D.textContent=cur;}
function calcAC(){cur='0';prev='';op='';fresh=true;update();}
function calcNeg(){if(cur!=='0')cur=cur[0]==='-'?cur.slice(1):'-'+cur;update();}
function calcPct(){cur=(parseFloat(cur)/100).toString();update();}
update();
</script>
</body>
</html>`;

            const PREVIEW_TASKS = [
              { id: "calc-1", title: "Calculator UI — OpenAI GPT-4o", model: "OpenAI GPT-4o", role: "Frontend UI / CSS", status: "MERGED" },
              { id: "calc-2", title: "Calculator Logic — Gemini 2.0 Flash", model: "Gemini 2.0 Flash", role: "JS Computation Engine", status: "MERGED" },
            ];
            const selectedId = previewTaskId || "calc-1";

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Live Preview</h2>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                      Calculator generated by AgentForge — UI via OpenAI GPT-4o, Logic via Gemini 2.0
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn" onClick={() => setActiveTab("tasks")} style={{ fontSize: "11.5px" }}>
                      ← Back to Tasks
                    </button>
                    <button
                      className="btn primary"
                      style={{ fontSize: "11.5px" }}
                      onClick={() => {
                        const blob = new Blob([CALCULATOR_HTML], { type: "text/html" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "calculator-agentforge.html";
                        a.click();
                      }}
                    >
                      ↓ Export HTML
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  {PREVIEW_TASKS.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setPreviewTaskId(t.id)}
                      style={{
                        padding: "10px 16px", borderRadius: "12px", cursor: "pointer", flex: 1,
                        background: selectedId === t.id ? "rgba(16,185,129,0.08)" : "#0e0e12",
                        border: selectedId === t.id ? "1.5px solid #10b98155" : "1px solid #23232a",
                        display: "flex", flexDirection: "column", gap: "4px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: selectedId === t.id ? "#10b981" : "#fff" }}>{t.title}</span>
                        <span className="pill" style={{ fontSize: "9px", color: "#10b981", borderColor: "#12392d", background: "rgba(16,185,129,0.08)" }}>✓ {t.status}</span>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>{t.model} · {t.role}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", alignItems: "start" }}>
                  <div style={{ background: "#0a0a0e", border: "1px solid #23232a", borderRadius: "16px", overflow: "hidden" }}>
                    <div style={{ background: "#0e0e12", padding: "10px 16px", borderBottom: "1px solid #1f1f26", display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {["#ff5f57","#febb2d","#28c840"].map((c,i) => (
                          <span key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c }} />
                        ))}
                      </div>
                      <span style={{ flex: 1, textAlign: "center", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        agentforge://preview/calculator
                      </span>
                      <span className="pill" style={{ fontSize: "9.5px", color: "#10b981", borderColor: "#12392d", background: "rgba(16,185,129,0.08)" }}>● Live</span>
                    </div>
                    <iframe
                      title="Calculator Preview"
                      srcDoc={CALCULATOR_HTML}
                      style={{ width: "100%", height: "520px", border: "none", background: "#0b0b0d" }}
                      sandbox="allow-scripts"
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div className="card" style={{ padding: "18px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Model Attribution</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "rgba(16,163,127,0.06)", border: "1px solid rgba(16,163,127,0.2)" }}>
                          <span style={{ fontSize: "18px" }}>⚙</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#10a37f" }}>OpenAI GPT-4o</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>UI / Button layout / CSS design</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: "rgba(66,133,244,0.06)", border: "1px solid rgba(66,133,244,0.2)" }}>
                          <span style={{ fontSize: "18px" }}>✦</span>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#4285f4" }}>Gemini 2.0 Flash</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>Arithmetic engine / JS logic</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ padding: "18px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Feature Checklist</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                        {["Add / Subtract","Multiply / Divide","Decimal Input","Percentage (%)","Toggle +/−","AC (All Clear)","Chained Operations","Divide-by-Zero Guard","Expression Preview","Model Attribution Labels"].map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" }}>
                            <span style={{ color: "#10b981", fontSize: "14px" }}>✓</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card" style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => setActiveTab("review")}>
                        Open Code Review →
                      </button>
                      <button
                        className="btn primary"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          const blob = new Blob([CALCULATOR_HTML], { type: "text/html" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "calculator-agentforge.html";
                          a.click();
                        }}
                      >
                        ↓ Export as HTML
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>Choose a squad pipeline and target git branch</small>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wrap token refresh in AbortController with 5s timeout"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{
                    background: "#0c0c10",
                    border: "1px solid #23232c",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    color: "#fff",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Provide context, acceptance criteria, or specific file targets..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  style={{
                    background: "#0c0c10",
                    border: "1px solid #23232c",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    color: "#fff",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600 }}>Squad Pipeline</label>
                  <select
                    value={newTaskSquad}
                    onChange={(e) => setNewTaskSquad(e.target.value)}
                    style={{
                      background: "#0c0c10",
                      border: "1px solid #23232c",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      color: "#fff",
                      outline: "none",
                    }}
                  >
                    <option value="full-stack">Full Squad (Architect &rarr; Dev &rarr; Test &rarr; Sec)</option>
                    <option value="dev-test">Developer &rarr; Tester</option>
                    <option value="security-audit">Security Audit Only</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600 }}>Target Branch</label>
                  <input
                    type="text"
                    defaultValue="main"
                    placeholder="e.g. main or feature/branch"
                    style={{
                      background: "#0c0c10",
                      border: "1px solid #23232c",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      color: "#fff",
                      outline: "none",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="btn" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={isSubmittingTask || !newTaskTitle.trim()}>
                  {isSubmittingTask ? "Dispatching..." : "Launch Task &rarr;"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── GITHUB LOGIN MODAL (WORKING) ─────────────────────────── */}
      {isGitHubModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsGitHubModalOpen(false)}
          style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="modal-card"
            style={{ maxWidth: "480px", background: "#0e0e13", border: "1px solid #282834", padding: "24px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "28px" }}>🐙</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", color: "#fff" }}>Sign in with GitHub</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--muted)" }}>
                    Authenticate to commit to branches & create pull requests
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGitHubModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Quick 1-Click Authorize Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={() => handleGitHubLogin(githubLoginInput || "vedant-dev", githubTokenInput)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#238636",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(35,134,54,0.3)",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>Authorize & Connect with GitHub</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>or custom credentials</span>
                <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              </div>

              {/* Custom Handle / PAT */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 600 }}>GitHub Handle / Username</label>
                <input
                  type="text"
                  placeholder="e.g. vedant-dev"
                  value={githubLoginInput}
                  onChange={(e) => setGithubLoginInput(e.target.value)}
                  style={{
                    background: "#08080c",
                    border: "1px solid #282834",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    color: "#fff",
                    fontFamily: "var(--font-mono, monospace)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 600 }}>Personal Access Token (PAT) (Optional)</label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubTokenInput}
                  onChange={(e) => setGithubTokenInput(e.target.value)}
                  style={{
                    background: "#08080c",
                    border: "1px solid #282834",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    color: "#fff",
                    fontFamily: "var(--font-mono, monospace)",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "10px", color: "var(--muted)" }}>Requires `repo` and `read:user` permissions to trigger remote workflows.</span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsGitHubModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => handleGitHubLogin(githubLoginInput || "vedant-dev", githubTokenInput)}
                >
                  Confirm & Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL COMMAND PALETTE (⌘K) MODAL ─────────────────────── */}
      {isCommandPaletteOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCommandPaletteOpen(false)}
          style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="modal-card"
            style={{ maxWidth: "560px", padding: 0, overflow: "hidden", background: "#0e0e13", border: "1px solid #282834" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Palette Search Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid #1f1f26" }}>
              <span style={{ fontSize: "16px", color: "var(--muted)" }}>🔍</span>
              <input
                ref={paletteInputRef}
                type="text"
                placeholder="Type a command or jump to screen... (ESC to close)"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  fontSize: "14px",
                  color: "#fff",
                  outline: "none",
                }}
              />
              <kbd style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(255,255,255,0.08)", fontSize: "10px", color: "var(--muted)" }}>ESC</kbd>
            </div>

            {/* Commands List */}
            <div style={{ maxHeight: "320px", overflowY: "auto", padding: "8px" }}>
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setIsCommandPaletteOpen(false);
                      setPaletteQuery("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{cmd.icon}</span>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>{cmd.title}</span>
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", fontFamily: "var(--font-mono, monospace)" }}>
                      {cmd.category}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                  No matching commands found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
