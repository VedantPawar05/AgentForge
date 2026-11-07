# AgentForge — Rollback & Incident Response Runbook

This document defines standard operating procedures for triaging incidents, rolling back faulty deployments, and executing disaster recovery mitigation for the AgentForge production cluster.

---

## 1. Severity Classification Matrix

| Severity  | Definition                                                                                           | Response SLA          | Escalation                                   |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------- |
| **SEV-1** | Total system outage, data corruption, cross-tenant data leak, or sandbox escape.                     | Immediate (< 15 mins) | Engineering Lead, On-Call Ops, Security Team |
| **SEV-2** | Degraded functionality: worker queue stalled, high API 5xx rate (> 2%), real-time event disconnects. | < 30 mins             | On-Call Engineer, Backend Lead               |
| **SEV-3** | Minor localized bug, frontend visual glitch, non-critical telemetry delay.                           | < 4 hours             | Product Engineering Sprint                   |

---

## 2. Immediate Rollback Procedures

### 2.1 Kubernetes / Helm Cluster Rollback (< 2 minutes)

If a newly deployed release exhibits errors, high latency, or regression during Canary or Rolling Update:

1. **Check release history**:

   ```bash
   helm history agentforge --namespace production
   ```

2. **Rollback to previous stable revision**:

   ```bash
   # Rolls back application containers, configmaps, and ingress rules
   helm rollback agentforge <PREVIOUS_REVISION_NUMBER> --namespace production --wait --timeout 5m
   ```

3. **Verify running pods**:

   ```bash
   kubectl get pods -n production -l app.kubernetes.io/name=agentforge
   ```

4. **Run post-rollback smoke verification**:
   ```bash
   TARGET_URL=https://api.agentforge.dev npm run test:smoke
   ```

---

### 2.2 Database Migration Rollback

If a database migration caused lock contention or application incompatibility:

1. **Identify failed migration**:

   ```bash
   npm run prisma:migrate:status --workspace=@agentforge/db
   ```

2. **Resolve or mark rolled back in Prisma migration table**:

   ```bash
   npx prisma migrate resolve --rolled-back "<MIGRATION_NAME>"
   ```

3. **Apply downward corrective patch**:
   Apply an explicit forward-fixing migration script (preferred over historical destructive reverts) to restore previous schema invariants without table locks.

---

### 2.3 Traffic Shedding & Circuit Breaking

Under extreme API load or downstream LLM provider outages:

1. **Enable rate limit throttle**:
   Temporarily lower token bucket burst capacities via configmap without restarting pods.
2. **Pause worker queue pickup**:
   ```bash
   # Scale workers to 0 while queues drain safely
   kubectl scale deployment agentforge-worker --replicas=0 -n production
   ```
3. **Queue preservation**:
   Redis BullMQ and PostgreSQL Outbox retain all queued jobs. No customer task requests are dropped.

---

## 3. Incident Post-Mortem & RCA Checklist

Every SEV-1 and SEV-2 incident requires a formal blameless Post-Mortem within 48 hours:

- [ ] Timeline of events (Detection, Triage, Rollback, Resolution).
- [ ] Root cause analysis (5 Whys).
- [ ] Impact metrics (affected tenants, tasks failed, downtime minutes).
- [ ] Action items with assignees (preventative tests, monitoring alarms, architectural guards).
