# AgentForge

<div align="center">

![AgentForge Overview](docs/screenshots/landing-page.png)

### Multiple autonomous AI coding agents collaborating on a single project simultaneously.

AgentForge coordinates specialized AI coding agents across software development tasks. Delegate work, execute code in isolated Git worktrees, supervise progress in real time, and approve code changes before they merge.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-brightgreen?logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

---

## Overview

When multiple AI coding agents operate on the same codebase, coordinating changes becomes essential. Without isolation and controls, autonomous agents risk overwriting files, polluting git history, and making unreviewed commits to protected branches.

AgentForge orchestrates multiple AI agents working together on a single project:
- **Parallel Task Execution**: Different agents can analyze, implement, and test separate tasks simultaneously.
- **Isolated Git Worktrees**: Every task executes in an ephemeral worktree, keeping your main working tree clean.
- **Human Governance**: Automated tests and diffs must be reviewed and signed off before code reaches protected branches.
- **Real-Time Visibility**: Live WebSocket event streams allow monitoring agent actions, file modifications, and test executions as they happen.

---

## Application Screenshots

### Governance & Code Review

The code review interface displays pending pull requests, automated test pass rates, unified diffs, and explicit human sign-off buttons before any branch merge.

![Code Review Dashboard](docs/screenshots/dashboard.png)

---

### Worktree Sandboxes

Each task execution receives an isolated Git worktree checkout with an active lease, tracked process ID, branch mapping, and disk usage limit.

![Worktree Sandboxes](docs/screenshots/worktree-sandboxes.png)

---

## Verified Core Features

- **Multi-Agent Coordination**: Sequential agent execution pipelines (Architect → Developer → Tester → Security Reviewer) with typed artifact handoffs (`ArchitectPlan`, `DeveloperOutput`, `TesterOutput`, `SecurityOutput`).
- **Git Worktree Isolation**: Safely creates, validates, and cleans up task-specific Git worktrees (`packages/sandbox/src/worktree.ts`) while guarding protected branches (`main`, `master`, `dev`, `release/*`).
- **Human-in-the-Loop Review**: Pre-merge safety verification requiring explicit approval on unified diffs before merges can proceed.
- **Real-Time Telemetry Streaming**: Socket.io server and client integration delivering live log lines, tool execution states, and test output.
- **Provider-Neutral Agent Adapter**: Standardized agent interface (`IAgentAdapter`) with implementations for Anthropic Claude, Google Gemini, OpenAI, and local mock testing.
- **Multi-Tenant Data Scoping**: Tenant-isolated workspace models with role-based access control (`VIEWER`, `DEVELOPER`, `ADMIN`, `OWNER`).

---

## Verified Technology Stack

| Category | Technology | Actual Usage |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14.2.20 | App Router web application (`apps/web`) with pages for landing, dashboard, login, and analytics. |
| **UI & Styling** | React 18, Tailwind CSS 3.4, Framer Motion | Dashboard components, modal dialogues, animations, and dark bento styling. |
| **Backend API** | Express 4.21.2 | REST API (`apps/api`) serving `/v1` endpoints for workspaces, tasks, projects, and runs. |
| **Real-Time** | Socket.io 4.8.1 | WebSocket server in `apps/api` and client hook in `apps/web` for run event streaming. |
| **Database & ORM** | PostgreSQL & Prisma 6.19.3 | Relational schema in `packages/db` for users, workspaces, tasks, and audit logs. *(Optional in local frontend demo mode).* |
| **Validation** | Zod 3.23.8 | Runtime schema validation for API payloads, environment variables, and agent handoffs. |
| **Security** | Helmet 8.0, CORS 2.8 | Security headers, cross-origin request handling, and constant-time JWT signature verification. |
| **Execution Sandbox** | Git Worktrees | Worktree lifecycle management and branch protection in `packages/sandbox`. |
| **Background Queue** | BullMQ 5.31.2 & IORedis 5.4.1 | Asynchronous queue driver in `apps/worker`. *(Local development supports direct in-memory execution).* |
| **Testing** | Vitest 2.1.6, TypeScript 5.7.2 | Monorepo test suites (28 test files) and static type checking across all packages. |

---

## Getting Started

### Prerequisites

- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.40.0`
- **PostgreSQL & Redis**: Optional for local mock development; required for persistent database backend.

---

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/agentforge/agentforge.git
   cd agentforge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env

   # Linux / macOS
   cp .env.example .env
   ```

4. **Start development servers:**

   **Web Dashboard (Port 3000):**
   ```bash
   npm run dev --workspace=@agentforge/web
   ```

   **API Server (Port 4000):**
   ```bash
   npm run dev --workspace=@agentforge/api
   ```

   **Background Worker:**
   ```bash
   npm run dev --workspace=@agentforge/worker
   ```

---

## Environment Variables

AgentForge validates configuration at startup using Zod (`packages/shared/src/env.ts`). Configure the following variables in `.env`:

| Variable | Description | Required | Default / Placeholder |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Application environment mode | Yes | `development` |
| `PORT` | API server port | Yes | `4000` |
| `API_BASE_URL` | Base URL for REST endpoints | Yes | `http://localhost:4000` |
| `WEB_BASE_URL` | Frontend origin for CORS | Yes | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | Optional in mock mode | `postgresql://user:password@localhost:5432/agentforge_dev` |
| `REDIS_URL` | Redis connection string for BullMQ | Optional in mock mode | `redis://localhost:6379` |
| `AUTH_PROVIDER` | Authentication strategy (`mock` or `clerk`) | Yes | `mock` |
| `AGENT_PROVIDER` | AI provider adapter (`mock`, `anthropic`, `gemini`, `openai`) | Yes | `mock` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude agents | Optional | `YOUR_API_KEY` |
| `SANDBOX_DRIVER` | Sandbox execution driver (`mock`, `docker`, `e2b`) | Yes | `mock` |

---

## Testing & Verification

Run the automated test suite across all monorepo workspaces:

```bash
# Run Vitest test suites
npm run test

# Typecheck all packages
npm run typecheck

# Build frontend and backend packages
npm run build
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Verify your changes pass checks:
   ```bash
   npm run typecheck
   npm run test
   ```
4. Commit your changes using conventional commits: `git commit -m "feat: add feature"`.
5. Open a pull request.

---

## License

AgentForge is currently private. License terms will be provided upon public release.
