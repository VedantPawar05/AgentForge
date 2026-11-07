# AgentForge — Zero-Downtime Database Migration Runbook

This runbook establishes strict procedures for executing database schema changes on multi-tenant production PostgreSQL instances without downtime, lock contention, or degraded user experiences.

---

## 1. Principles of Non-Blocking Schema Evolution

1. **Never Rename Columns or Tables Directly**: Always use the **Expand/Contract** pattern.
2. **Never Add Non-Null Columns Without Defaults**: PostgreSQL 11+ supports fast `ADD COLUMN ... DEFAULT ... NOT NULL`, but adding large defaults without care can block queries if transactions take long exclusive table locks (`ACCESS EXCLUSIVE`).
3. **Always Add Indexes Concurrently**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_tasks_workspace_status ON tasks(workspace_id, status);
   ```
4. **Enforce Short Lock Timeouts**:
   ```sql
   SET lock_timeout = '2s';
   SET statement_timeout = '30s';
   ```

---

## 2. Four-Phase Expand/Contract Workflow

```
[ Phase 1: Expand ]      --> Add new column / table (nullable or default)
                             Deploy code that DUAL-WRITES to both schemas.

[ Phase 2: Backfill ]    --> Asynchronous background worker fills historical data
                             in batches of 500 rows with 50ms pause.

[ Phase 3: Switch Reads] --> Deploy application reading exclusively from new schema.
                             Old column is no longer referenced.

[ Phase 4: Contract ]    --> Mark old column as deprecated in schema.
                             Execute subsequent migration dropping old column.
```

---

## 3. Deployment Safety Pipeline

Before running database migrations in staging or production:

1. **CI Schema Safety Check**:
   Runs Prisma migration diff against production baseline to reject:
   - `DROP COLUMN` without previous phase deprecation.
   - Non-concurrent index creation on large tables.
   - Long-lived table locks.
2. **Pre-Deployment Kubernetes Hook**:
   `migration-job.yaml` runs `npm run prisma:migrate` _before_ the new API/Worker deployment rolling update begins. Because the migration is backwards-compatible, existing pods remain 100% operational.
3. **Automated Rollback Hook**:
   If migration pre-check or transaction fails, the Helm release halts before modifying running containers.

---

## 4. Emergency Migration Rollback

If a migration fails or causes deadlocks:

1. Terminate blocking migration query:
   ```sql
   SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE query LIKE '%ALTER TABLE%' AND state = 'active';
   ```
2. Rollback schema to previous baseline:
   ```bash
   npx prisma migrate resolve --rolled-back "20261029_failed_migration"
   ```
3. Resume application traffic and investigate root cause in staging replica.
