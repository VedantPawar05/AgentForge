# AgentForge

<div align="center">

![AgentForge Banner](docs/assets/screenshots/landing.png)

### **Your AI Engineering Team. Under Your Control.**

An enterprise-grade, multi-agent AI coding orchestration platform that coordinates autonomous developer squads across isolated Git worktrees with mandatory human-in-the-loop governance.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Tests-28%20Suites%20Passing-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Security](https://img.shields.io/badge/Sandboxed-Git%20Worktree-red)](#security-architecture)

---

[**Explore Architecture**](#how-agentforge-works) • [**Product Screenshots**](#product-screenshots) • [**Multi-Agent Squads**](#multi-agent-workflow) • [**Getting Started**](#getting-started) • [**API Reference**](#api-documentation) • [**Roadmap**](#roadmap)

</div>

---

## Why AgentForge?

Deploying autonomous AI agents into enterprise software codebases introduces critical risks: **uncoordinated file edits**, **host filesystem contamination**, **destructive branch overwrites**, and **runaway token consumption**. Simple conversational chatbots cannot safely touch production repositories.

AgentForge solves this by functioning as an **industrial command-and-control plane**:

| Challenge with AI Coding Agents | How AgentForge Solves It |
| :--- | :--- |
| **Dirty Host Environments** | Every task executes inside an ephemeral, cryptographically leased **Git worktree sandbox**. The host filesystem is never modified directly. |
| **Uncoordinated Agent Hallucinations** | Specialized agent squads (**Architect → Developer → Tester → Security**) collaborate sequentially with typed handoffs. |
| **Unchecked Code Merges** | Branch heads and unified diffs are frozen until authorized with cryptographic, role-enforced **human sign-off**. |
| **Token & Financial Budget Explosions** | Hard token bucket caps, sliding window rate limits, and per-task spend cutoffs ($5.00 default cap) prevent infinite retry loops. |
| **Black-Box Execution** | Monotonically sequenced **WebSocket event streaming** exposes real-time tool calls, terminal outputs, and test logs. |

---

## Product Screenshots

### 1. Control Plane & Mission Landing
The high-altitude mission control dashboard surfaces active agent squads, global repository health, task distribution, and telemetry waveforms.

![AgentForge Landing Page](docs/assets/screenshots/landing.png)

---

### 2. Live Command Dashboard
Real-time orchestration overview displaying multi-tenant workspaces, active task status pipelines, and system connectivity metrics.

![AgentForge Dashboard](docs/assets/screenshots/dashboard.png)

---

### 3. Project Workspace & Monorepo Controls
Granular repository context mapping, task lifecycle state tracking, and branch-level isolation controls.

![Project Workspace](docs/assets/screenshots/project-workspace.png)

---

### 4. Multi-Agent Execution & Split View
Simultaneous multi-agent inspection across 1P, 2P, 3P, and 4P split view layouts, displaying streaming execution output side-by-side.

![Multi-Agent Execution](docs/assets/screenshots/agent-execution.png)

---

### 5. Execution Console & Live Telemetry
Low-latency real-time telemetry streaming showing tool execution sequences, test runners, and file diff generation.

![Execution Console](docs/assets/screenshots/execution-console.png)

---

## Core Features

- 🤖 **Autonomous Multi-Agent Squads**: Sequential multi-stage execution pipelines where specialized agents execute dedicated roles:
  - **Architect**: Ingests issue specifications, reads repository AST, and authors structured implementation plans.
  - **Developer**: Applies atomic code edits across files inside isolated worktrees.
  - **Tester**: Automatically discovers and executes test suites; reports stack traces back to the developer for automated self-healing.
  - **Security Reviewer**: Performs automated static analysis, detects secret leakage, and prepares unified diff summaries.
- 🛡️ **Ephemeral Git Worktree Sandboxes**: Full workspace isolation using Git worktrees with temporary cryptographic leases (`agentforge/task-{id}-{timestamp}`). Host execution is strictly prevented.
- 🚦 **Mandatory Human Sign-off Gates**: Pre-merge safety verification guarantees that tasks cannot merge into protected branches without explicit human approval (rejects unapproved merges with `412 Precondition Failed`).
- ⚡ **Real-Time Telemetry & WebSocket Gateway**: Authenticated room-isolated WebSocket streaming delivering live logs, tool invocation payloads, and test diagnostics.
- 📦 **Transactional Outbox & Reliable Queue**: PostgreSQL Transactional Outbox pattern paired with Redis BullMQ ensures at-least-once task delivery, worker heartbeat leases, and automatic stale-run recovery.
- 🔑 **Bring Your Own Key (BYOK)**: Provider-neutral agent adapter interface supporting Anthropic Claude 3.7 / 3.5 Sonnet, Google Gemini 2.0, OpenAI GPT-4o, and local models via Ollama.
- 👥 **Enterprise RBAC & Multi-Tenancy**: Workspace-level data isolation via Row-Level Security (RLS) and strict role checks (`VIEWER`, `DEVELOPER`, `ADMIN`, `OWNER`).
- 📝 **Immutable Audit Trail**: Append-only audit logs recording every administrative action, runner event, and human merge approval.

---

## How AgentForge Works

AgentForge decouples the user-facing control plane from the untrusted execution plane. The architecture relies on an asynchronous event-driven model:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client Layer"]
        Web["Next.js 14 Web Command Center\n(React 18 / Tailwind / Swiss UI)"]
        Desktop["Desktop Companion\n(Always-on-top Dynamic Island)"]
    end

    subgraph ControlPlane ["2. Control Plane & API Gateway"]
        API["Express API Server (/v1 REST)"]
        SocketServer["Socket.io Real-Time Server"]
        AuthGuard["JWT & RBAC Middleware\n(Tenant Scoping)"]
        StateEngine["Task State Machine\n(Optimistic Concurrency)"]
    end

    subgraph Persistence ["3. Persistence & Relational Store"]
        DB[("PostgreSQL 16\n(Prisma ORM + Tenant Scoping)")]
        OutboxTable[("Transactional Outbox")]
        RedisQueue[("Redis 7 + BullMQ\n(Reliable Job Queues)")]
    end

    subgraph ExecutionPlane ["4. Execution Plane (Workers & Daemons)"]
        Worker["BullMQ Worker Process"]
        OutboxRelay["Outbox Relay Service"]
        LeaseEngine["Worker Heartbeat & Lease Reaper"]
        SquadEngine["Squad Orchestrator\n(Tool Loop & Token Budget Caps)"]
        Sandbox["Git Worktree Sandbox Driver\n(Zero Host Modification)"]
    end

    subgraph TargetInfra ["5. External Infrastructure"]
        GitHub["GitHub App\n(Branching, PRs, Webhooks)"]
        LLM["AI Providers (BYOK)\n(Claude / Gemini / GPT-4o / Ollama)"]
    end

    %% Client Interactions
    Web -->|HTTPS REST| API
    Web <-->|WSS Auth Rooms| SocketServer
    Desktop -->|Local IPC & API| API

    %% Control Plane Flow
    API --> AuthGuard
    AuthGuard --> StateEngine
    StateEngine --> DB
    StateEngine --> OutboxTable

    %% Asynchronous Processing
    OutboxTable -.->|Tail & Publish| OutboxRelay
    OutboxRelay --> RedisQueue
    RedisQueue --> Worker

    %% Worker Execution
    Worker --> LeaseEngine
    LeaseEngine --> DB
    Worker --> SquadEngine
    SquadEngine --> LLM
    SquadEngine --> Sandbox
    Sandbox --> GitHub
```

### Execution Lifecycle

1. **Task Ingestion**: The developer defines a task with priority, target branch, and repository context via the Web Dashboard or API.
2. **State & Outbox Commit**: The task is validated and saved to PostgreSQL with status `QUEUED`. In the same database transaction, a dispatch event is written to the `outbox` table.
3. **Queue Distribution**: The Outbox Relay sweeps pending events and enqueues jobs into BullMQ with deduplication keys (`jobId = runId`).
4. **Lease Acquisition & Worktree Provisioning**: An active worker claims the job, establishes an ephemeral lease, and creates an isolated Git worktree branch (`agentforge/task-{taskId}-{timestamp}`).
5. **Sequential Squad Dispatch**: The Squad Orchestrator cycles through the pipeline (**Architect → Developer → Tester → Security Reviewer**), streaming tool calls and terminal logs through Socket.io.
6. **Unified Diff & Review**: Once tests pass, the run generates a unified diff and enters `AWAITING_REVIEW`.
7. **Human Approval & Protected Merge**: A authorized reviewer inspects the diff and grants cryptographic approval, triggering an authenticated merge to the target branch.

---

## Multi-Agent Workflow

AgentForge implements structured, sequential agent collaboration using typed handoff schemas:

```mermaid
sequenceDiagram
    autonumber
    actor User as Human Lead
    participant Arch as 1. Architect Agent
    participant Dev as 2. Developer Agent
    participant Test as 3. Tester Agent
    participant Sec as 4. Security Reviewer
    participant Worktree as Git Worktree Sandbox
    participant GH as GitHub Target Branch

    User->>Arch: Assign Task & Issue Spec
    Arch->>Worktree: Inspect Repository AST & Dependencies
    Arch->>Dev: Typed Plan (ArchitectPlan)
    Dev->>Worktree: Atomic Code Edits (read/write/search)
    Dev->>Test: Hand off Modified Workspace
    Test->>Worktree: Run Test Suites & Collect Stack Traces
    alt Tests Failed
        Test-->>Dev: Pass Failure Logs (Self-Healing Loop)
        Dev->>Worktree: Patch Defect & Re-test
    end
    Test->>Sec: Test Pass Evidence (TesterOutput)
    Sec->>Worktree: Static Security Audit & Diff Verification
    Sec->>User: Consolidated Report & Unified Diff
    User->>GH: Authorized Cryptographic Merge Sign-off
```

- **Implemented Squad Presets**:
  - `FULL_STACK_FEATURE`: Architect → Developer → Tester → Security Reviewer
  - `HOTFIX_CREW`: Developer → Tester → Security Reviewer
  - `SECURITY_SWEEP`: Architect → Security Reviewer

---

## Technology Stack

The AgentForge monorepo is engineered using a verified, modern TypeScript stack:

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | [Next.js 14.2](https://nextjs.org/) (App Router) | High-performance dashboard, server-side layouts, Swiss bento UI |
| **Styling & Motion** | [Tailwind CSS 3.4](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/) | Responsive interface with dark bento theme and animated telemetry |
| **Backend API** | [Express 4.21](https://expressjs.com/) & [Node.js 22](https://nodejs.org/) | RESTful control plane, middleware pipelines, and health monitors |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/) & [Prisma 6.0](https://www.prisma.io/) | Relational state, multi-tenant schemas, optimistic concurrency |
| **Job Queue** | [BullMQ 5.34](https://docs.bullmq.io/) & [IORedis 5.4](https://github.com/redis/ioredis) | Asynchronous task distribution, worker leases, exponential retry |
| **Real-Time Gateway** | [Socket.io 4.8](https://socket.io/) | Tenant-isolated WebSocket event streaming and run telemetry |
| **Code Isolation** | [Git Worktree](https://git-scm.com/docs/git-worktree) & Sandbox Drivers | Ephemeral task branches, zero direct host mutation |
| **Schema Validation** | [Zod 3.24](https://zod.dev/) | End-to-end type validation across API, environment, and agent handoffs |
| **Security & Headers** | [Helmet](https://helmetjs.github.io/) & [CORS](https://github.com/expressjs/cors) | HTTP header hardening, rate limiting, and timing-safe JWT verification |
| **Test Framework** | [Vitest 2.1](https://vitest.dev/) | Blazing-fast unit, integration, and E2E workflow test execution |

---

## Getting Started

### Prerequisites

Ensure the following tools are installed on your host machine:

- **Node.js**: `>= 20.0.0` (Recommended: `v22.x`)
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.40.0`
- **PostgreSQL**: `16.x` or `18.x` (or Docker)
- **Redis**: `7.x` (or Docker)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/agentforge/agentforge.git
cd agentforge
```

---

### Step 2: Install Monorepo Dependencies

```bash
npm install
```

---

### Step 3: Configure Environment Variables

Create your local `.env` file by copying the sanitized `.env.example` template:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

> [!NOTE]
> For standard local development, the default mock configuration in `.env.example` allows booting the web dashboard and API without requiring paid cloud API keys.

---

### Step 4: Database Setup & Migrations

Ensure your local PostgreSQL instance is running, then generate the Prisma client and apply database migrations:

```bash
# Generate Prisma Client for all packages
npm run db:generate --workspace=@agentforge/db

# Deploy initial database schema
npm run db:migrate:deploy --workspace=@agentforge/db
```

---

### Step 5: Start Local Development Servers

You can start the frontend and backend services concurrently or independently:

**Start Next.js Frontend Dashboard (Port 3000):**
```bash
npm run dev --workspace=@agentforge/web
```

**Start Express REST API & WebSocket Server (Port 4000):**
```bash
npm run dev --workspace=@agentforge/api
```

**Start Background Worker Daemon:**
```bash
npm run dev --workspace=@agentforge/worker
```

Once running:
- Open your browser to **`http://localhost:3000`** to access the AgentForge Dashboard.
- The API is available at **`http://localhost:4000/v1`**.
- Health checks: **`http://localhost:4000/health`** and **`http://localhost:4000/healthz`**.

---

## Environment Variables

AgentForge enforces strict startup validation via Zod schemas (`packages/shared/src/env.ts`). All variables must conform to their expected types:

| Variable | Description | Required | Default / Example Placeholder |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | Yes | `development` |
| `PORT` | HTTP port for the Express REST and WebSocket server | Yes | `4000` |
| `API_BASE_URL` | Canonical base URL for backend API routes | Yes | `http://localhost:4000` |
| `WEB_BASE_URL` | Allowed origin URL for CORS and frontend redirects | Yes | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://user:password@localhost:5432/agentforge_dev` |
| `REDIS_URL` | Redis instance connection string for BullMQ | Yes | `redis://localhost:6379` |
| `AUTH_PROVIDER` | Authentication strategy (`mock` or `clerk`) | Yes | `mock` |
| `CLERK_SECRET_KEY` | Clerk authentication backend secret key | Prod only | `sk_test_placeholder` |
| `AGENT_PROVIDER` | Default LLM provider adapter (`mock`, `anthropic`, `gemini`, `openai`) | Yes | `mock` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key for coding agents (BYOK) | Optional | `sk-ant-placeholder` |
| `GEMINI_API_KEY` | Google Gemini API key (BYOK) | Optional | `AIzaSy_placeholder` |
| `OPENAI_API_KEY` | OpenAI GPT-4o API key (BYOK) | Optional | `sk-proj-placeholder` |
| `SANDBOX_DRIVER` | Sandbox execution driver (`mock`, `docker`, `e2b`) | Yes | `mock` |
| `MAX_TASK_EXECUTION_SECONDS`| Hard execution timeout cutoff per task run | Yes | `600` |

---

## AI Provider Configuration (BYOK)

AgentForge operates under a **Bring Your Own Key (BYOK)** model. You maintain complete control over your LLM billing, data retention policies, and enterprise rate limits directly with the providers.

To connect your provider credentials, set the corresponding environment variables in your `.env` file:

```ini
# Anthropic Claude (Recommended for coding squads: Claude 3.7 / 3.5 Sonnet)
AGENT_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Google Gemini (High-speed 2M context reasoning)
# AGENT_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI GPT-4o
# AGENT_PROVIDER=openai
# OPENAI_API_KEY=your_openai_api_key_here
```

> [!IMPORTANT]
> AgentForge never transmits your API keys to third parties. All provider requests originate directly from your self-hosted worker or runner daemon. Provider pricing and usage terms are separate from AgentForge.

---

## Security Architecture

AgentForge is built around defense-in-depth principles:

- **Isolated Ephemeral Worktrees**: Code modifications are applied exclusively within transient Git worktrees. Agents possess zero direct access to the host repository's `.git/` folder or production branches.
- **Constant-Time Cryptographic Verification**: JWT tokens and HMAC signatures are validated using constant-time comparisons (`crypto.timingSafeEqual`) to prevent timing attack vulnerabilities.
- **Automated Secret Scrubbing**: The structured JSON logger automatically intercepts and sanitizes sensitive tokens, passwords, authorization headers, and runner secrets before writing to disk or stdout.
- **Tenant Isolation**: Database queries enforce tenant scoping (`WHERE workspaceId = ...`). Cross-tenant access attempts are strictly rejected with `403 Forbidden`.
- **Pre-Merge Invariant Checks**: The review service asserts that the branch head matches the reviewed commit SHA before triggering merges, preventing race conditions and unauthorized code injections.

---

## API Documentation

The REST API is versioned under `/v1` and returns standard JSON envelopes.

### Authentication & Workspaces

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/auth/me` | Return profile and active memberships of authenticated user | Authenticated |
| `POST` | `/v1/auth/sync` | Synchronize external auth user with local database | Authenticated |
| `GET` | `/v1/workspaces` | List all workspaces accessible to the user | Authenticated |
| `POST` | `/v1/workspaces` | Create new workspace (assigns creator as `OWNER`) | Authenticated |
| `GET` | `/v1/workspaces/:id/members` | List members and roles for a workspace | `MEMBER` |

### Projects, Tasks & Runs

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/workspaces/:id/projects` | List projects bound to repository configurations | `MEMBER` |
| `POST` | `/v1/workspaces/:id/projects` | Register a new repository project | `DEVELOPER+` |
| `GET` | `/v1/workspaces/:id/tasks` | List tasks across workspace with status/priority filters | `MEMBER` |
| `POST` | `/v1/workspaces/:id/projects/:pid/tasks` | Create and enqueue a new task | `DEVELOPER+` |
| `PATCH` | `/v1/workspaces/:id/tasks/:tid` | Update task metadata (protected by optimistic concurrency) | `DEVELOPER+` |
| `POST` | `/v1/workspaces/:id/tasks/:tid/runs` | Dispatch a new execution run for a task | `DEVELOPER+` |
| `POST` | `/v1/workspaces/:id/tasks/:tid/runs/:rid/cancel` | Cancel an in-flight execution run | `DEVELOPER+` |

### Reviews, Diffs & Merges

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/workspaces/:id/tasks/:tid/diff` | Retrieve unified diff metadata and file change lists | `MEMBER` |
| `POST` | `/v1/workspaces/:id/tasks/:tid/approvals` | Grant or request changes on an execution run | `DEVELOPER+` |
| `POST` | `/v1/workspaces/:id/tasks/:tid/merge` | Execute authorized merge to target branch | `DEVELOPER+` |
| `GET` | `/v1/workspaces/:id/audit-logs` | Retrieve immutable workspace audit history | `ADMIN, OWNER` |

### System Health & Diagnostics

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` / `/healthz` | Liveness probe returning process uptime and timestamp | Public |
| `GET` | `/ready` | Readiness probe verifying DB, queue, and API connectivity | Public |
| `GET` | `/metrics` | Prometheus metrics exposition endpoint | Public |

---

## Testing & Verification

AgentForge maintains a comprehensive automated testing suite:

```bash
# Run entire Vitest test suite across all monorepo workspaces
npm run test

# Run TypeScript typechecks across all 9 packages and apps
npm run typecheck

# Run Next.js and API production builds
npm run build

# Run end-to-end integration workflow tests
npm run test:e2e

# Run staging smoke tests
npm run test:smoke
```

### Verified Test Coverage

```
 Test Files  28 passed (28)
      Tests  166+ passed
   Duration  ~25s
   Typecheck 0 errors across 9 workspaces
 Production Next.js 14 prerendered cleanly (4 static pages)
```

- **Unit & Integration Suites**:
  - `apps/api`: REST routes, JWT verification, rate limiting, task state machines, audit trails, and review workflows (9 suites).
  - `apps/worker`: BullMQ queues, worker leases, Outbox relay, and stale-run recovery reapers (3 suites).
  - `packages/agent-adapters`: Tool loops, budget caps, Anthropic Claude integration, and multi-agent squads (3 suites).
  - `packages/sandbox`: Git worktree isolation, branch creation, and security boundaries (3 suites).
  - `packages/shared`: State machines, DAG cycle detection, metrics, and structured logging (6 suites).
  - `packages/db`: Prisma repository CRUD and tenant isolation (1 suite).

---

## Roadmap

Tracked via [`docs/implementation-status.md`](docs/implementation-status.md):

- [x] **Phase 0–3: Core Foundations**: Multi-tenant database, JWT engines, task state machines, optimistic concurrency.
- [x] **Phase 4: Reliable Queue Processing**: BullMQ job queues, PostgreSQL Outbox relay, worker heartbeats, and stale-run reapers.
- [x] **Phase 5: GitHub Integration**: GitHub App RS256 JWT auth, branch creation, HMAC webhooks, and pull request generation.
- [x] **Phase 6–7: Multi-Agent Squads**: Sequential squad pipelines (Architect → Developer → Tester → Security Reviewer) with typed handoffs.
- [x] **Phase 8: Desktop Companion**: Dynamic island floating window controller with quick task approval actions.
- [x] **Phase 9–10: Production Hardening & Frontend**: Next.js App Router dashboard, Swiss UI bento kit, Prometheus telemetry, and Token Bucket rate limiting.
- [ ] **Phase 11: MicroVM Isolation (In Progress)**: Dedicated Firecracker / Kata MicroVM drivers for untrusted binary execution.
- [ ] **Phase 12: Parallel Squad Swarms (Planned)**: Concurrent agent branches with automated semantic three-way merge resolution.

---

## Project Structure

```
AgentForge/
├── apps/
│   ├── web/                     # Next.js 14+ Frontend Command Center (App Router)
│   ├── api/                     # Express.js REST API & Socket.io Real-Time Server
│   ├── worker/                  # BullMQ Background Worker & Outbox Relay Daemon
│   └── desktop/                 # Floating Desktop Companion & Dynamic Island Controller
├── packages/
│   ├── db/                      # Prisma ORM Schema, Client & Migrations
│   ├── shared/                  # Zod Schemas, Domain Enums, State Machines, Logger
│   ├── agent-adapters/          # Provider-Neutral Agent Interfaces & Squad Orchestrators
│   ├── sandbox/                 # Git Worktree Sandbox & Execution Drivers
│   └── runner/                  # Local Runner Daemon for Self-Hosted Execution
├── docs/                        # Architecture, ERD, Threat Model, ADRs, and Runbooks
│   └── assets/screenshots/      # Application Screenshots & Documentation Visuals
├── infra/                       # Terraform AWS IaC & Kubernetes Helm Charts
└── scripts/                     # Staging Smoke Tests & E2E Workflow Verification
```

---

## Contributing

We welcome community contributions, architectural reviews, and bug fixes:

1. **Fork the Repository**: Create an isolated fork under your GitHub account.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/agent-capability
   ```
3. **Commit Atomic Changes**: Follow conventional commit guidelines (`feat:`, `fix:`, `docs:`, `test:`).
4. **Run Verification Commands**:
   ```bash
   npm run typecheck
   npm run test
   npm run lint
   ```
5. **Open a Pull Request**: Submit your pull request with a detailed summary and test verification logs.

---

## License

AgentForge is currently licensed under private / proprietary terms. See repository release documentation for licensing updates.

<div align="center">

**AgentForge** — *Ship code at agent speed without losing control.*

</div>
