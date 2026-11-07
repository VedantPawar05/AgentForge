# AgentForge REST API & Real-Time Protocol Specification

## 1. Global Conventions

- **Base URL**: `/v1`
- **Content Type**: `application/json; charset=utf-8`
- **Authentication**: `Authorization: Bearer <JWT>` header on all protected endpoints.
- **Tenant Context**: All workspace-specific operations are scoped under `/v1/workspaces/:workspaceId/*`. The authorization middleware validates that the authenticated user holds an active membership within `:workspaceId`.
- **Standard Error Format**:
  ```json
  {
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Task 3fa85f64-5717-4562-b3fc-2c963f66afa6 not found in workspace",
      "details": {},
      "requestId": "req_01HPX8Y7R8Q92A1W"
    }
  }
  ```
- **Standard Pagination Query Params**:
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 20, max: 100)
- **Standard Paginated Response**:
  ```json
  {
    "data": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 42,
      "totalPages": 3
    }
  }
  ```

---

## 2. API Endpoints

### 2.1 Authentication & User Synchronization

| Method | Endpoint        | Description                                            | Required Role      |
| ------ | --------------- | ------------------------------------------------------ | ------------------ |
| `POST` | `/v1/auth/sync` | Syncs external auth user (Clerk) with local DB         | Authenticated User |
| `GET`  | `/v1/auth/me`   | Returns current user profile and workspace memberships | Authenticated User |

### 2.2 Workspace Management

| Method   | Endpoint                      | Description                                       | Required Role      |
| -------- | ----------------------------- | ------------------------------------------------- | ------------------ |
| `GET`    | `/v1/workspaces`              | Lists all workspaces the current user belongs to  | Authenticated User |
| `POST`   | `/v1/workspaces`              | Creates a new workspace and assigns user as OWNER | Authenticated User |
| `GET`    | `/v1/workspaces/:workspaceId` | Retrieves workspace details and settings          | Member             |
| `PATCH`  | `/v1/workspaces/:workspaceId` | Updates workspace metadata and quotas             | ADMIN, OWNER       |
| `DELETE` | `/v1/workspaces/:workspaceId` | Deletes workspace and schedules data purge        | OWNER              |

### 2.3 Memberships & Invitations

| Method   | Endpoint                                                | Description                                 | Required Role      |
| -------- | ------------------------------------------------------- | ------------------------------------------- | ------------------ |
| `GET`    | `/v1/workspaces/:workspaceId/members`                   | Lists workspace members and roles           | Member             |
| `PATCH`  | `/v1/workspaces/:workspaceId/members/:memberId`         | Updates a member's role                     | ADMIN, OWNER       |
| `DELETE` | `/v1/workspaces/:workspaceId/members/:memberId`         | Removes member from workspace               | ADMIN, OWNER       |
| `GET`    | `/v1/workspaces/:workspaceId/invitations`               | Lists pending workspace invitations         | ADMIN, OWNER       |
| `POST`   | `/v1/workspaces/:workspaceId/invitations`               | Sends invitation email with role assignment | ADMIN, OWNER       |
| `POST`   | `/v1/invitations/accept`                                | Accepts an invitation via secure token      | Authenticated User |
| `DELETE` | `/v1/workspaces/:workspaceId/invitations/:invitationId` | Revokes pending invitation                  | ADMIN, OWNER       |

### 2.4 GitHub App Integrations

| Method | Endpoint                                                | Description                                  | Required Role   |
| ------ | ------------------------------------------------------- | -------------------------------------------- | --------------- |
| `GET`  | `/v1/integrations/github/install-url`                   | Generates GitHub App installation URL        | ADMIN, OWNER    |
| `POST` | `/v1/integrations/github/webhook`                       | Receives GitHub App webhooks (HMAC verified) | Public / GitHub |
| `GET`  | `/v1/workspaces/:workspaceId/integrations/github/repos` | Lists available GitHub repositories          | DEVELOPER+      |

### 2.5 Projects

| Method   | Endpoint                                          | Description                                    | Required Role |
| -------- | ------------------------------------------------- | ---------------------------------------------- | ------------- |
| `GET`    | `/v1/workspaces/:workspaceId/projects`            | Lists projects within workspace                | Member        |
| `POST`   | `/v1/workspaces/:workspaceId/projects`            | Creates project bound to a GitHub repo         | DEVELOPER+    |
| `GET`    | `/v1/workspaces/:workspaceId/projects/:projectId` | Retrieves project details and configuration    | Member        |
| `PATCH`  | `/v1/workspaces/:workspaceId/projects/:projectId` | Updates project build/test commands & settings | ADMIN, OWNER  |
| `DELETE` | `/v1/workspaces/:workspaceId/projects/:projectId` | Archives project                               | ADMIN, OWNER  |

### 2.6 Tasks

| Method   | Endpoint                                                | Description                                                                | Required Role |
| -------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | ------------- |
| `GET`    | `/v1/workspaces/:workspaceId/projects/:projectId/tasks` | Lists tasks with status, priority, and search filters                      | Member        |
| `POST`   | `/v1/workspaces/:workspaceId/projects/:projectId/tasks` | Creates a task and optionally queues it                                    | DEVELOPER+    |
| `GET`    | `/v1/workspaces/:workspaceId/tasks/:taskId`             | Retrieves task details, dependencies, and runs                             | Member        |
| `PATCH`  | `/v1/workspaces/:workspaceId/tasks/:taskId`             | Updates task title, description, priority (optimistic lock with `version`) | DEVELOPER+    |
| `DELETE` | `/v1/workspaces/:workspaceId/tasks/:taskId`             | Cancels or soft-deletes a task                                             | DEVELOPER+    |

### 2.7 Runs & Execution Orchestration

| Method | Endpoint                                                          | Description                                          | Required Role |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| `POST` | `/v1/workspaces/:workspaceId/tasks/:taskId/runs`                  | Enqueues a new execution attempt (BullMQ)            | DEVELOPER+    |
| `GET`  | `/v1/workspaces/:workspaceId/tasks/:taskId/runs`                  | Lists historical execution attempts                  | Member        |
| `GET`  | `/v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId`           | Gets specific run details, duration, token usage     | Member        |
| `POST` | `/v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/cancel`    | Forcibly cancels in-flight run                       | DEVELOPER+    |
| `GET`  | `/v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/events`    | Fetches historical run events with `sinceSeq` filter | Member        |
| `GET`  | `/v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/diff`      | Fetches unified diff generated by the run            | Member        |
| `GET`  | `/v1/workspaces/:workspaceId/tasks/:taskId/runs/:runId/artifacts` | Lists artifacts (logs, test reports)                 | Member        |

### 2.8 Review, Approvals & Merging

| Method | Endpoint                                              | Description                                                   | Required Role          |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| `POST` | `/v1/workspaces/:workspaceId/tasks/:taskId/approvals` | Submits approval decision (`APPROVED` or `CHANGES_REQUESTED`) | REVIEWER, ADMIN, OWNER |
| `POST` | `/v1/workspaces/:workspaceId/tasks/:taskId/merge`     | Triggers authorized merge of task branch to target branch     | ADMIN, OWNER           |

### 2.9 Audit Logs & Health

| Method | Endpoint                                 | Description                                                    | Required Role |
| ------ | ---------------------------------------- | -------------------------------------------------------------- | ------------- |
| `GET`  | `/v1/workspaces/:workspaceId/audit-logs` | Paginated audit trail of administrative & security actions     | ADMIN, OWNER  |
| `GET`  | `/v1/health`                             | Liveness probe: returns 200 OK                                 | Public        |
| `GET`  | `/v1/ready`                              | Readiness probe: checks PostgreSQL, Redis, Worker connectivity | Public        |

---

## 3. Real-Time WebSocket Protocol (Socket.io)

- **Namespace**: `/` or `/socket.io/v1`
- **Handshake Authentication**:
  ```javascript
  const socket = io("http://localhost:4000", {
    auth: { token: "Bearer <JWT>" },
  });
  ```
- **Client Subscription**:

  ```javascript
  // Subscribe to real-time events for a specific task
  socket.emit("subscribe:task", { workspaceId: "uuid", taskId: "uuid" });
  ```

  The server verifies workspace membership before adding the socket connection to room `task:<taskId>`.

- **Server-to-Client Event Payloads**:
  1. `run:event`: Streamed log or execution event.
     ```json
     {
       "runId": "uuid",
       "sequenceNumber": 104,
       "type": "LOG",
       "payload": {
         "stream": "stdout",
         "message": "Running test suite: vitest run..."
       },
       "timestamp": "2026-10-29T00:15:00.123Z"
     }
     ```
  2. `task:status_changed`: Real-time state transition.
     ```json
     {
       "taskId": "uuid",
       "previousStatus": "RUNNING",
       "newStatus": "TESTING",
       "timestamp": "2026-10-29T00:15:05.000Z"
     }
     ```
  3. `run:heartbeat`: Worker liveness broadcast.
     ```json
     {
       "runId": "uuid",
       "leaseExpiresAt": "2026-10-29T00:15:35.000Z"
     }
     ```
