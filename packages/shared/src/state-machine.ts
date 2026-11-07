import { TaskStatus, RunStatus, WorkspaceRole } from "./enums.js";
import { ConflictError, ForbiddenError } from "./errors.js";

/**
 * Valid transitions for logical Task states
 */
export const VALID_TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> =
  {
    [TaskStatus.QUEUED]: [TaskStatus.PROVISIONING, TaskStatus.CANCELLED],
    [TaskStatus.PROVISIONING]: [
      TaskStatus.RUNNING,
      TaskStatus.FAILED,
      TaskStatus.CANCELLED,
      TaskStatus.TIMED_OUT,
    ],
    [TaskStatus.RUNNING]: [
      TaskStatus.TESTING,
      TaskStatus.FAILED,
      TaskStatus.CANCELLED,
      TaskStatus.TIMED_OUT,
    ],
    [TaskStatus.TESTING]: [
      TaskStatus.AWAITING_REVIEW,
      TaskStatus.FAILED,
      TaskStatus.CANCELLED,
      TaskStatus.TIMED_OUT,
    ],
    [TaskStatus.AWAITING_REVIEW]: [
      TaskStatus.APPROVED,
      TaskStatus.CHANGES_REQUESTED,
      TaskStatus.CANCELLED,
    ],
    [TaskStatus.APPROVED]: [TaskStatus.MERGED, TaskStatus.CANCELLED],
    [TaskStatus.CHANGES_REQUESTED]: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
    [TaskStatus.MERGED]: [], // Terminal success
    [TaskStatus.FAILED]: [TaskStatus.QUEUED], // Can be re-queued/retried
    [TaskStatus.TIMED_OUT]: [TaskStatus.QUEUED], // Can be re-queued/retried
    [TaskStatus.CANCELLED]: [], // Terminal
  };

/**
 * Valid transitions for execution Run attempts
 */
export const VALID_RUN_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  [RunStatus.PENDING]: [RunStatus.ALLOCATED, RunStatus.CANCELLED],
  [RunStatus.ALLOCATED]: [
    RunStatus.RUNNING,
    RunStatus.FAILED,
    RunStatus.CANCELLED,
    RunStatus.TIMED_OUT,
  ],
  [RunStatus.RUNNING]: [
    RunStatus.COMPLETED,
    RunStatus.FAILED,
    RunStatus.CANCELLED,
    RunStatus.TIMED_OUT,
  ],
  [RunStatus.COMPLETED]: [], // Terminal
  [RunStatus.FAILED]: [], // Terminal
  [RunStatus.CANCELLED]: [], // Terminal
  [RunStatus.TIMED_OUT]: [], // Terminal
};

/**
 * Checks whether a logical task transition is valid
 */
export function isValidTaskTransition(
  current: TaskStatus,
  next: TaskStatus,
): boolean {
  const allowed = VALID_TASK_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export const canTransitionTask = isValidTaskTransition;

/**
 * Asserts that a logical task transition is valid, throwing ConflictError if invalid
 */
export function assertValidTaskTransition(
  current: TaskStatus,
  next: TaskStatus,
): void {
  if (!isValidTaskTransition(current, next)) {
    throw new ConflictError(
      `Invalid task transition from '${current}' to '${next}'. Allowed next states: [${(
        VALID_TASK_TRANSITIONS[current] ?? []
      ).join(", ")}]`,
      { current, next },
    );
  }
}

/**
 * Checks whether an execution run transition is valid
 */
export function isValidRunTransition(
  current: RunStatus,
  next: RunStatus,
): boolean {
  const allowed = VALID_RUN_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

/**
 * Asserts that an execution run transition is valid, throwing ConflictError if invalid
 */
export function assertValidRunTransition(
  current: RunStatus,
  next: RunStatus,
): void {
  if (!isValidRunTransition(current, next)) {
    throw new ConflictError(
      `Invalid run transition from '${current}' to '${next}'. Allowed next states: [${(
        VALID_RUN_TRANSITIONS[current] ?? []
      ).join(", ")}]`,
      { current, next },
    );
  }
}

/**
 * Verifies that a user's role grants permission to execute a specific task transition
 */
export function assertUserCanTransitionTask(
  role: WorkspaceRole,
  current: TaskStatus,
  next: TaskStatus,
): void {
  assertValidTaskTransition(current, next);

  // Cancellations: DEVELOPER, ADMIN, OWNER can cancel
  if (next === TaskStatus.CANCELLED) {
    if (role === WorkspaceRole.REVIEWER) {
      throw new ForbiddenError("Reviewers are not authorized to cancel tasks");
    }
    return;
  }

  // Approvals & Change Requests: REVIEWER, ADMIN, OWNER
  if (next === TaskStatus.APPROVED || next === TaskStatus.CHANGES_REQUESTED) {
    if (
      role !== WorkspaceRole.REVIEWER &&
      role !== WorkspaceRole.ADMIN &&
      role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenError(
        "Only Reviewers, Admins, or Owners may approve or request changes on tasks",
      );
    }
    return;
  }

  // Merging: ADMIN, OWNER only
  if (next === TaskStatus.MERGED) {
    if (role !== WorkspaceRole.ADMIN && role !== WorkspaceRole.OWNER) {
      throw new ForbiddenError(
        "Only Admins or Owners may merge approved code changes to protected branches",
      );
    }
    return;
  }

  // Automated worker transitions (PROVISIONING, RUNNING, TESTING, AWAITING_REVIEW, FAILED, TIMED_OUT)
  // Re-queuing by user: DEVELOPER, ADMIN, OWNER
  if (next === TaskStatus.QUEUED) {
    if (role === WorkspaceRole.REVIEWER) {
      throw new ForbiddenError(
        "Reviewers are not authorized to re-queue tasks",
      );
    }
    return;
  }
}
