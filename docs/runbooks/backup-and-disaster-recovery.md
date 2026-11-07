# AgentForge — Backup & Point-in-Time Recovery (PITR) Runbook

This runbook establishes disaster recovery architectures, recovery objectives, automated backup routines, and verification steps for AgentForge production environments.

---

## 1. Objectives & SLA Targets

| Metric                             | Target                               | Rationale                                                                                                      |
| ---------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **RPO (Recovery Point Objective)** | **< 5 minutes**                      | Continuous PostgreSQL WAL archiving ensures near-zero loss of task states, user memberships, and audit trails. |
| **RTO (Recovery Time Objective)**  | **< 30 minutes**                     | Automated standby restore procedures and infrastructure-as-code allow rapid redeployment.                      |
| **Retention Policy**               | **30 days daily, 12 months monthly** | Regulatory compliance, security audit longevity, and tenant rollback protection.                               |

---

## 2. Component Architectures & Persistence Strategy

### 2.1 PostgreSQL 16 (Primary Relational State)

- **Engine**: PostgreSQL with Row-Level Security (RLS) and Prisma ORM.
- **Physical Backups**: Daily `pg_basebackup` with compressed tar archives uploaded to encrypted, object-locked cloud storage (AWS S3 Glacier Instant Retrieval / GCP Cloud Storage).
- **WAL Archiving**: Continuous Write-Ahead Log (WAL) archiving via `pgBackRest` or `wal-g` shipping 16MB segments within 60 seconds of generation.
- **Logical Exports**: Daily schema and workspace data dumps via `pg_dump --format=custom` for tenant-scoped extraction.

```ini
# postgresql.conf snippet
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=agentforge-prod archive-push %p'
archive_timeout = 300
max_wal_senders = 5
```

### 2.2 Redis 7 (Queue & Rate Limit State)

- **Engine**: Redis with BullMQ and Token Bucket Rate Limiting.
- **Persistence Config**: Dual persistence enabled — Snapshot (RDB) every 900s if >= 1 key changed, plus Append-Only File (AOF) with `appendfsync everysec`.
- **Durability**: Because PostgreSQL outbox stores canonical job intents, Redis serves as an active queue engine. Queue recovery synchronizes un-dispatched jobs from `outbox_events` table upon boot.

```conf
# redis.conf snippet
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite yes
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### 2.3 Object Storage / MinIO / S3 (Artifacts & Diffs)

- **Stored Data**: Task diffs, execution logs, review snapshots, and sandbox build bundles.
- **Versioning**: Object Versioning enabled on `agentforge-artifacts` bucket.
- **Replication**: Cross-Region Replication (CRR) to secondary recovery region with KMS encryption.
- **Lifecycle**: 90 days hot tier $\to$ transition to Infrequent Access (IA) $\to$ expire after 365 days.

---

## 3. Step-by-Step Restoration Procedures

### 3.1 Point-in-Time Recovery (PITR) for PostgreSQL

1. **Halt traffic and isolate cluster**:

   ```bash
   # Route API traffic to maintenance page
   kubectl scale deployment agentforge-api --replicas=0
   kubectl scale deployment agentforge-worker --replicas=0
   ```

2. **Identify target restore timestamp**:
   Target timestamp must be prior to corruption/incident (ISO 8601 UTC format: `2026-10-29 04:15:00 UTC`).

3. **Execute restore using pgBackRest**:

   ```bash
   # Stop postgres service on recovery node
   systemctl stop postgresql

   # Restore base backup and replay WAL to specific timestamp
   sudo -u postgres pgbackrest \
     --stanza=agentforge-prod \
     --delta \
     --type=time \
     --target="2026-10-29 04:15:00" \
     --target-action=promote \
     restore

   # Start postgres
   systemctl start postgresql
   ```

4. **Verify database consistency & Prisma schema**:

   ```bash
   npm run -w @agentforge/db prisma:generate
   node -e "const { prisma } = require('@agentforge/db'); prisma.workspace.count().then(c => console.log('Workspaces:', c));"
   ```

5. **Resume application pods**:
   ```bash
   kubectl scale deployment agentforge-api --replicas=3
   kubectl scale deployment agentforge-worker --replicas=5
   ```

---

### 3.2 Tenant-Scoped Rollback

If a single workspace was corrupted or requested historical restoration:

```bash
# 1. Extract tenant slice from daily custom format dump
pg_restore --data-only --table=workspaces --table=projects --table=tasks \
  agentforge_backup_20261029.dump > tenant_slice.sql

# 2. Filter by workspace_id
grep "workspace-uuid-here" tenant_slice.sql > restore_tenant.sql

# 3. Apply within transactional boundary
psql -d agentforge -f restore_tenant.sql
```

---

## 4. Disaster Recovery Drill Schedule

- **Monthly**: Automated backup restoration drill executed in dedicated staging environment. Validates checksums and schema integrity.
- **Quarterly**: Simulated primary database failover with point-in-time recovery to test RTO < 30 mins and RPO < 5 mins.
- **Annual**: Cross-region disaster recovery failover drill.
