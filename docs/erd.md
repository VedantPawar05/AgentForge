# AgentForge Entity Relationship Diagram & Database Schema

## 1. Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    users ||--o{ memberships : "has"
    users ||--o{ audit_logs : "acts as actor"
    users ||--o{ tasks : "creates"
    users ||--o{ approvals : "reviews"

    workspaces ||--o{ memberships : "contains"
    workspaces ||--o{ invitations : "issues"
    workspaces ||--o{ repository_installations : "connects"
    workspaces ||--o{ projects : "manages"
    workspaces ||--o{ tasks : "owns"
    workspaces ||--o{ runs : "owns"
    workspaces ||--o{ artifacts : "owns"
    workspaces ||--o{ audit_logs : "records"
    workspaces ||--o{ usage_records : "tracks"
    workspaces ||--|| workspace_settings : "configures"

    projects ||--o{ tasks : "groups"
    repository_installations ||--o{ projects : "binds to"

    tasks ||--o{ task_dependencies : "depends on"
    tasks ||--o{ runs : "attempts"
    tasks ||--o{ approvals : "requires"

    runs ||--o{ run_events : "streams"
    runs ||--o{ artifacts : "produces"
    runs ||--o{ usage_records : "consumes"

    users {
        uuid id PK
        string external_id UK "Clerk / Auth Provider ID"
        string email UK
        string full_name
        string avatar_url
        timestamp created_at
        timestamp updated_at
    }

    workspaces {
        uuid id PK
        string name
        string slug UK
        uuid owner_id FK
        timestamp created_at
        timestamp updated_at
    }

    memberships {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        enum role "OWNER, ADMIN, DEVELOPER, REVIEWER"
        timestamp created_at
        timestamp updated_at
    }

    invitations {
        uuid id PK
        uuid workspace_id FK
        string email
        enum role
        string token UK
        uuid invited_by_id FK
        enum status "PENDING, ACCEPTED, REVOKED, EXPIRED"
        timestamp expires_at
        timestamp created_at
    }

    workspace_settings {
        uuid id PK
        uuid workspace_id FK,UK
        int max_concurrency
        int max_execution_seconds
        int monthly_budget_cents
        jsonb allowed_repos
        timestamp updated_at
    }

    repository_installations {
        uuid id PK
        uuid workspace_id FK
        enum provider "GITHUB"
        string installation_id UK
        string account_login
        string account_type
        jsonb permissions
        timestamp created_at
        timestamp updated_at
    }

    projects {
        uuid id PK
        uuid workspace_id FK
        uuid repository_installation_id FK
        string name
        string repo_owner
        string repo_name
        string default_branch
        string test_command
        string build_command
        timestamp created_at
        timestamp updated_at
    }

    tasks {
        uuid id PK
        uuid workspace_id FK
        uuid project_id FK
        uuid created_by_id FK
        string title
        text description
        enum priority "LOW, MEDIUM, HIGH, CRITICAL"
        enum status "QUEUED, PROVISIONING, RUNNING, TESTING, AWAITING_REVIEW, APPROVED, MERGED, FAILED, CANCELLED, TIMED_OUT, CHANGES_REQUESTED"
        string branch_name
        string target_branch
        int version "Optimistic Locking"
        timestamp created_at
        timestamp updated_at
    }

    task_dependencies {
        uuid id PK
        uuid task_id FK
        uuid depends_on_task_id FK
        timestamp created_at
    }

    runs {
        uuid id PK
        uuid task_id FK
        uuid workspace_id FK
        int attempt_number
        enum status "PENDING, ALLOCATED, RUNNING, COMPLETED, FAILED, CANCELLED, TIMED_OUT"
        string worker_id
        timestamp lease_expires_at
        timestamp started_at
        timestamp completed_at
        int duration_ms
        int exit_code
        string error_message
        int prompt_tokens
        int completion_tokens
        int cost_cents
        timestamp created_at
    }

    run_events {
        uuid id PK
        uuid run_id FK
        bigint sequence_number
        enum type "LOG, STATUS_CHANGE, TOOL_CALL, TEST_RESULT, METRIC"
        jsonb payload
        timestamp created_at
    }

    artifacts {
        uuid id PK
        uuid run_id FK
        uuid workspace_id FK
        enum type "DIFF, LOG_ARCHIVE, TEST_REPORT, AST_GRAPH"
        string storage_path
        bigint file_size_bytes
        string checksum_sha256
        timestamp created_at
    }

    approvals {
        uuid id PK
        uuid task_id FK
        uuid run_id FK
        uuid workspace_id FK
        uuid reviewer_id FK
        enum status "APPROVED, REJECTED, CHANGES_REQUESTED"
        text review_notes
        string merge_commit_sha
        timestamp reviewed_at
    }

    audit_logs {
        uuid id PK
        uuid workspace_id FK
        uuid actor_id FK
        string action
        string target_type
        uuid target_id
        string ip_address
        string user_agent
        jsonb metadata
        timestamp created_at
    }

    outbox_events {
        uuid id PK
        string event_type
        string aggregate_type
        uuid aggregate_id
        jsonb payload
        enum status "PENDING, PUBLISHED, FAILED"
        int retry_count
        timestamp scheduled_for
        timestamp created_at
        timestamp published_at
    }

    usage_records {
        uuid id PK
        uuid workspace_id FK
        uuid project_id FK
        uuid run_id FK
        string metric_type "DURATION_SECONDS, TOKENS, SANDBOX_CPU_HOURS"
        int quantity
        int cost_micros
        timestamp created_at
    }
```

---

## 2. Table Specifications & Constraints

### 2.1 Identifiers Strategy

All primary keys use UUIDs (UUIDv7 or UUIDv4). UUIDs prevent enumeration attacks (IDOR) and avoid auto-increment collisions across distributed nodes.

### 2.2 Core Constraints & Indexes

#### `workspaces`

- `slug` is UNIQUE.
- Index on `owner_id`.

#### `memberships`

- Unique constraint: `UNIQUE (workspace_id, user_id)`. Ensures a user cannot hold multiple roles simultaneously within the same workspace.
- Index: `INDEX idx_memberships_user (user_id)` for listing workspaces for a user.
- Index: `INDEX idx_memberships_workspace (workspace_id)` for member lookups.

#### `tasks`

- Compound Index: `INDEX idx_tasks_tenant_project (workspace_id, project_id, status)`. Optimizes Kanban board and project task queries.
- Compound Index: `INDEX idx_tasks_tenant_created (workspace_id, created_at DESC)`. Optimizes paginated task feeds.
- Optimistic Concurrency Control: `version INT NOT NULL DEFAULT 1`. Every mutation increments `version`. If the client submits a stale version, the transaction aborts with a concurrency conflict.

#### `task_dependencies`

- Unique constraint: `UNIQUE (task_id, depends_on_task_id)`.
- Check constraint: `CHECK (task_id <> depends_on_task_id)`. Prevents self-dependency.
- Cycle validation: Enforced at the application service layer via Tarjan's / Depth-First-Search cycle detection before committing.

#### `runs`

- Unique constraint: `UNIQUE (task_id, attempt_number)`. Ensures attempt numbers are strictly sequential and non-duplicative per task.
- Compound Index: `INDEX idx_runs_lease (status, lease_expires_at)`. Crucial for high-performance stale-run reaper queries.
- Compound Index: `INDEX idx_runs_tenant_task (workspace_id, task_id, attempt_number DESC)`.

#### `run_events`

- Unique constraint: `UNIQUE (run_id, sequence_number)`. Guarantees strict monotonicity and eliminates duplicate event processing.
- Index: `INDEX idx_run_events_seq (run_id, sequence_number ASC)`. Accelerates client log streaming and reconnection backfills.

#### `artifacts`

- Index: `INDEX idx_artifacts_run (run_id, type)`.

#### `outbox_events`

- Index: `INDEX idx_outbox_pending (status, scheduled_for, created_at) WHERE status = 'PENDING'`. Partial index ensuring the outbox poller only scans uncommitted/pending messages with zero table-scan overhead.

#### `audit_logs`

- Index: `INDEX idx_audit_tenant_time (workspace_id, created_at DESC)`. Fast audit trail queries.

---

## 3. Row-Level Security (RLS) Defense-in-Depth

In addition to API application-layer authorization checks, PostgreSQL Row-Level Security policies are applied as a defense-in-depth safeguard against SQL injection or buggy queries:

```sql
-- Enable RLS on tenant-owned tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Transaction-scoped workspace variable policy:
CREATE POLICY tenant_isolation_policy ON tasks
    FOR ALL
    USING (workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid);
```

During each API request or worker job execution, the database session sets `SET LOCAL app.current_workspace_id = '<workspace_id>'` inside the transaction boundary.
