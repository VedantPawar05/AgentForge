# ADR-001: Modular Monorepo Architecture with Independent Runtime Targets

## Status

Accepted

## Context

AgentForge requires multiple software components:

- A modern web UI with SSR and reactive WebSocket client.
- A REST API server handling request validation, authorization, and tenant data access.
- A resilient worker process handling BullMQ queues, Git operations, and agent execution.
- Shared database models, validation schemas (Zod), and domain event definitions.

We evaluated three potential architectural approaches:

1. **Separate Repositories (Polyrepo)**: Independent repos for web, api, and worker.
2. **Distributed Microservices**: Breaking the API into 5+ separate HTTP services (Auth Service, Task Service, Run Service, etc.).
3. **Modular Monorepo**: A single version-controlled repository containing dedicated applications (`apps/`) and reusable packages (`packages/`), deployable as independent runtime units.

## Decision

We choose the **Modular Monorepo** pattern managed via npm workspaces:

- `apps/web`: Next.js 14+ frontend application.
- `apps/api`: Express.js REST API and WebSocket gateway.
- `apps/worker`: BullMQ queue processor and execution supervisor.
- `packages/db`: Prisma schema, migrations, and database client wrapper.
- `packages/shared`: Shared domain entities, Zod schemas, state machine definitions, and error classes.
- `packages/agent-adapters`: Abstract agent interfaces and concrete LLM provider drivers.
- `packages/sandbox`: Isolated execution boundary abstraction and container/microVM drivers.

## Consequences

### Positive:

- Single source of truth for TypeScript types and Zod schemas across frontend, backend, and workers. No schema drift.
- Atomic commits across database schema changes, API endpoints, and worker consumers.
- Simplified local development: one command boots all dependent services.
- Clean physical separation of concerns prevents monolithic code entanglements while avoiding microservice networking latency and complexity.

### Negative:

- Monorepo tooling and build orchestration requires disciplined workspace dependency declarations.
- CI pipelines must test all affected packages.
