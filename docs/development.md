# AgentForge Local Development Guide

## 1. Prerequisites

- **Node.js**: >= 20.0.0 (Node v22.19.0 recommended)
- **npm**: >= 10.0.0
- **Git**: >= 2.40.0
- **Docker & Docker Compose**: (Docker Desktop with Linux engine for Postgres 16, Redis 7, MinIO)

---

## 2. Environment Setup

1. Copy the example configuration:

   ```bash
   cp .env.example .env
   ```

2. Start local infrastructure containers:

   ```bash
   docker compose up -d
   ```

   This spins up:
   - PostgreSQL 16 on port `5432` (`agentforge_dev` database)
   - Redis 7 on port `6379`
   - MinIO Object Storage on ports `9000` (API) and `9001` (Console)

3. Install all monorepo dependencies:

   ```bash
   npm install
   ```

4. Generate Prisma client & apply database migrations:
   ```bash
   npm run prisma:generate --workspace=@agentforge/db
   ```

---

## 3. Running Services Locally

- **Run all tests**:

  ```bash
  npm run test
  ```

- **Typecheck all packages & apps**:

  ```bash
  npm run typecheck
  ```

- **Run API server**:

  ```bash
  npm run dev --workspace=@agentforge/api
  ```

  API is accessible at `http://localhost:4000/v1`.

- **Run Worker daemon**:

  ```bash
  npm run dev --workspace=@agentforge/worker
  ```

- **Run Web dashboard**:
  ```bash
  npm run dev --workspace=@agentforge/web
  ```
  Web interface is accessible at `http://localhost:3000`.

---

## 4. Architectural Boundaries Check

- **Never execute untrusted code in the API process**: Code execution must always be dispatched to BullMQ and executed inside `packages/sandbox` drivers.
- **Tenant Isolation**: Always pass and verify `workspaceId` in every query and WebSocket room subscription.
