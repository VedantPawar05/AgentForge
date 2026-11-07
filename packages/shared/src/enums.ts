/**
 * AgentForge Domain Enums
 */

export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  DEVELOPER: "DEVELOPER",
  REVIEWER: "REVIEWER",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const TaskPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskStatus = {
  QUEUED: "QUEUED",
  PROVISIONING: "PROVISIONING",
  RUNNING: "RUNNING",
  TESTING: "TESTING",
  AWAITING_REVIEW: "AWAITING_REVIEW",
  APPROVED: "APPROVED",
  MERGED: "MERGED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMED_OUT: "TIMED_OUT",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const RunStatus = {
  PENDING: "PENDING",
  ALLOCATED: "ALLOCATED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMED_OUT: "TIMED_OUT",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RunEventType = {
  LOG: "LOG",
  STATUS_CHANGE: "STATUS_CHANGE",
  TOOL_CALL: "TOOL_CALL",
  TEST_RESULT: "TEST_RESULT",
  METRIC: "METRIC",
} as const;
export type RunEventType = (typeof RunEventType)[keyof typeof RunEventType];

export const ArtifactType = {
  DIFF: "DIFF",
  LOG_ARCHIVE: "LOG_ARCHIVE",
  TEST_REPORT: "TEST_REPORT",
  AST_GRAPH: "AST_GRAPH",
} as const;
export type ArtifactType = (typeof ArtifactType)[keyof typeof ArtifactType];

export const ApprovalStatus = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;
export type ApprovalStatus =
  (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const OutboxStatus = {
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
} as const;
export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];
