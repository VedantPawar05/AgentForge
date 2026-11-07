# ADR-003: Transactional Outbox Pattern and Worker Job Idempotency

## Status

Accepted

## Context

When an API user initiates a task execution or requests a cancellation, state changes must be committed in PostgreSQL and an asynchronous job must be enqueued in Redis (BullMQ).

Directly enqueuing to BullMQ inside or after the database transaction creates the dual-write problem:

1. If the database commit succeeds but the Redis call fails (network drop, timeout), the task is stuck in `QUEUED` without any worker picking it up (lost work).
2. If the Redis job is enqueued first and the database transaction rolls back, the worker attempts to execute a non-existent or stale task (phantom work).
3. If Redis redelivers a job (at-least-once delivery), workers must not duplicate execution or corrupt run history.

## Decision

1. **Transactional Outbox in PostgreSQL**:
   - Every task state change that requires asynchronous execution or real-time event distribution writes an `outbox_events` record within the **exact same PostgreSQL transaction** as the business entity update.
   - An Outbox Relay daemon polls or receives notifications of pending events (`SELECT ... FOR UPDATE SKIP LOCKED`), dispatches the job to BullMQ, and marks the event as `PUBLISHED`.

2. **Worker Idempotency & Leases**:
   - BullMQ jobs pass `{ taskId, runId, attemptNumber }`.
   - The worker attempts an atomic lease lock in PostgreSQL:
     ```sql
     UPDATE runs
     SET status = 'ALLOCATED', worker_id = :workerId, lease_expires_at = NOW() + INTERVAL '30 SECONDS'
     WHERE id = :runId AND status = 'PENDING';
     ```
   - If zero rows are updated, another worker already claimed the job or the run was cancelled; the worker immediately discards the duplicate message without side effects.
   - Heartbeat timers renew the lease every 10 seconds.
   - Stale-run recovery detects abandoned leases and triggers clean re-queueing or failure recording.

## Consequences

### Positive:

- Guaranteed at-least-once job delivery with zero lost work during network or Redis restarts.
- Workers never compete or execute duplicate runs for the same attempt.
- Clean audit trail of event dispatch in PostgreSQL.

### Negative:

- Adds a small polling delay (typically 200–500ms) or requires PostgreSQL `LISTEN/NOTIFY` to trigger immediate relay dispatch.
- Requires regular table compaction/pruning for processed outbox events.
