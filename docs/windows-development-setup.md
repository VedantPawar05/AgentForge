# AgentForge — Windows Local Development & Infrastructure Setup Guide

This guide details the exact prerequisites, infrastructure configuration, and reproducible steps to run AgentForge locally on Windows with real infrastructure and coding-agent providers.

---

## 1. Environment & Infrastructure Audit

| Component             | Status on Current Host | Details / Action Required                                                                                   |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Node.js**           | **INSTALLED**          | v22.19.0 (Meets `>= 20.0.0` requirement)                                                                    |
| **npm**               | **INSTALLED**          | v10.9.3 (Meets `>= 10.0.0` requirement)                                                                     |
| **Git**               | **INSTALLED**          | v2.51.0.windows.2 with worktree & branch support                                                            |
| **PostgreSQL 18**     | **RUNNING**            | Windows Service `postgresql-x64-18` active on port `5432`. Needs valid password configured in `.env`.       |
| **Redis 7**           | **NOT RUNNING**        | Port `6379` inactive. Required for BullMQ job queue and Pub/Sub.                                            |
| **Docker Desktop**    | **NOT RUNNING**        | Docker engine pipe `//./pipe/dockerDesktopLinuxEngine` not active. Required for Docker container sandboxes. |
| **Anthropic API Key** | **MISSING**            | `ANTHROPIC_API_KEY` not configured in environment. Required for live LLM coding task execution.             |

---

## 2. Infrastructure Setup Options

### Option A: Using Docker Desktop (Recommended)

If Docker Desktop for Windows is installed:

1. Start **Docker Desktop**.
2. Start local dependencies using Docker Compose:
   ```bash
   docker compose up -d postgres redis minio
   ```
   This spins up:
   - PostgreSQL 16 on `localhost:5432` (`postgres:postgres`)
   - Redis 7 on `localhost:6379`
   - MinIO Object Storage on `localhost:9000` (`minioadmin:minioadmin`)

---

### Option B: Using Native Windows Services / WSL2

If running without Docker Desktop:

1. **PostgreSQL**:
   Your host already has PostgreSQL 18 running as a service on port `5432`.
   - Connect using `psql -U postgres` or pgAdmin 4.
   - Create the development database:
     ```sql
     CREATE DATABASE agentforge_dev;
     ```
   - Set the database connection in `.env`:
     ```env
     DATABASE_URL="postgresql://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/agentforge_dev?schema=public"
     ```

2. **Redis**:
   Install Redis via WSL2 (Ubuntu: `sudo apt install redis-server && sudo service redis-server start`) or use Memurai / Redis for Windows port on `6379`.
   ```env
   REDIS_URL="redis://localhost:6379"
   ```

---

## 3. Environment Configuration (`.env`)

Create a local `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Set the following required keys in `.env`:

```env
# Application
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000

# Database & Cache
DATABASE_URL="postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/agentforge_dev?schema=public"
REDIS_URL="redis://localhost:6379"

# AI Coding Agent Provider (Configure ONE real provider)
AGENT_PROVIDER=anthropic
ANTHROPIC_API_KEY="sk-ant-api03-YOUR_KEY_HERE"

# Execution Mode
AUTH_PROVIDER=mock
SANDBOX_DRIVER=mock
```

---

## 4. Database Schema Setup

Once PostgreSQL is accessible:

```bash
# Generate Prisma Client
npm run prisma:generate --workspace=@agentforge/db

# Push schema to development database
npx prisma db push --schema=packages/db/prisma/schema.prisma
```

---

## 5. Executing the Real-Provider Coding Task Lifecycle

Once `ANTHROPIC_API_KEY` is provided:

```bash
# Run the complete 20-step end-to-end lifecycle verification script
npx tsx scripts/e2e-real-provider-test.ts
```

This script automatically executes:

1. Test user identity creation.
2. Isolated workspace and project creation.
3. Disposable Git repository initialization.
4. Task creation with transactional outbox event.
5. Worker lease acquisition.
6. Isolated task branch creation (`agentforge/task-*`).
7. Real Anthropic Claude 3.7 / 3.5 Sonnet agent tool execution loop.
8. Execution event capture, token accounting, and cost calculation.
9. Repository test suite execution.
10. Unified Git diff verification.
11. No-op change prevention check.
12. Approval request creation and denial verification (blocks merge).
13. Approval authorization on subsequent review.
14. Controlled merge to target branch with full audit trail.
15. Safe resource cleanup.

---

## 6. Reliability & Failure-Recovery Test Suite

All 9 failure recovery and resiliency scenarios can be executed locally without live cloud credentials:

```bash
# Run all worker queue, retry, cancellation, lease, and timeout tests
npx vitest run apps/worker/src/queue.test.ts

# Run worktree boundary defense and protected branch safety tests
npx vitest run packages/sandbox/src/worktree.test.ts packages/sandbox/src/adversarial.test.ts

# Run replayed approval, replayed merge, and RBAC rejection tests
npx vitest run apps/api/src/reviews.test.ts

# Run durable event history and reconnection recovery tests
npx vitest run apps/api/src/realtime.test.ts

# Run full project test suite (103 passing tests)
npm test
```
