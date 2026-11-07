# AgentForge

> **Production-Minded Multi-Tenant SaaS Platform Orchestrating Autonomous AI Coding Agents**

AgentForge is a web-based command center where engineering teams assign real software development tasks to autonomous AI coding agents and supervise their execution from start to finish.

Unlike toys or simulated chat demos, AgentForge executes real tasks in isolated sandboxes, clones actual Git repositories, runs test suites, captures execution diffs, and enforces human-in-the-loop review before any code reaches a protected branch.

---

## Key Capabilities

- **Isolated Code Execution**: Tasks execute inside secured, resource-capped sandboxes (hardened Docker containers or hardware-isolated MicroVMs). Host execution is strictly prevented.
- **Durable Relational State**: PostgreSQL 16 is the single source of truth, protected by multi-tenant Row-Level Security (RLS) and optimistic concurrency locks.
- **Reliable Asynchronous Processing**: Background jobs are dispatched via the Transactional Outbox Pattern to Redis and BullMQ, featuring distributed worker leases, heartbeats, and automatic stale-run recovery.
- **Live Real-Time Supervision**: Streaming execution logs, tool invocation traces, and test results delivered over authenticated, tenant-isolated WebSockets.
- **Human-in-the-Loop Governance**: Inspect unified diffs, review test logs, and authorize merges with granular role-based access control (RBAC).
- **Comprehensive Audit Trail**: Every administrative, code-execution, and approval event is immutably recorded for compliance and security auditing.

---

## Architecture & Documentation

- [Architecture Blueprint](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/architecture.md)
- [Entity Relationship Diagram (ERD)](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/erd.md)
- [Threat Model & Security Boundary](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/threat-model.md)
- [API & WebSocket Protocol Specification](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/api.md)
- [Implementation Status & Roadmap](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/implementation-status.md)
- Architecture Decision Records:
  - [ADR-001: Modular Monorepo Architecture](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/adr/ADR-001-modular-monorepo-structure.md)
  - [ADR-002: Hardened Sandbox Execution Model](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/adr/ADR-002-sandbox-execution-model.md)
  - [ADR-003: Transactional Outbox Pattern](file:///c:/Users/vedant/OneDrive/Desktop/AgentForge/docs/adr/ADR-003-outbox-pattern-and-job-idempotency.md)

---

## Repository Structure

```
AgentForge/
├── apps/
│   ├── web/                     # Next.js 14+ Frontend Dashboard
│   ├── api/                     # Express.js REST API & WebSocket Gateway
│   └── worker/                  # BullMQ Worker Daemon & Orchestration Supervisor
├── packages/
│   ├── db/                      # Prisma ORM Schema, Migrations & Database Client
│   ├── shared/                  # TypeScript Types, Zod Schemas, Domain Enums
│   ├── agent-adapters/          # Provider-neutral AI Agent Contract & Implementations
│   └── sandbox/                 # Sandbox Abstraction (Docker & MicroVM Drivers)
├── docs/                        # Architecture, ERD, Threat Model, API Specs, ADRs
└── docker-compose.yml           # Local Infrastructure (PostgreSQL 16, Redis 7, MinIO)
```

---

## Local Development Prerequisites

- Node.js >= 20.x (Detected: Node v22.19.0)
- npm >= 10.x
- Git >= 2.40.x
- Docker & Docker Compose (for local PostgreSQL, Redis, MinIO)
