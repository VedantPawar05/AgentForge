import { describe, it, expect } from "vitest";
import {
  TaskStatus,
  RunStatus,
  WorkspaceRole,
  isValidTaskTransition,
  assertValidTaskTransition,
  assertUserCanTransitionTask,
  isValidRunTransition,
  assertValidRunTransition,
  ConflictError,
  ForbiddenError,
} from "./index.js";

describe("Task State Machine", () => {
  it("allows valid progressive transitions", () => {
    expect(
      isValidTaskTransition(TaskStatus.QUEUED, TaskStatus.PROVISIONING),
    ).toBe(true);
    expect(
      isValidTaskTransition(TaskStatus.PROVISIONING, TaskStatus.RUNNING),
    ).toBe(true);
    expect(isValidTaskTransition(TaskStatus.RUNNING, TaskStatus.TESTING)).toBe(
      true,
    );
    expect(
      isValidTaskTransition(TaskStatus.TESTING, TaskStatus.AWAITING_REVIEW),
    ).toBe(true);
    expect(
      isValidTaskTransition(TaskStatus.AWAITING_REVIEW, TaskStatus.APPROVED),
    ).toBe(true);
    expect(isValidTaskTransition(TaskStatus.APPROVED, TaskStatus.MERGED)).toBe(
      true,
    );
  });

  it("rejects invalid transitions", () => {
    expect(isValidTaskTransition(TaskStatus.QUEUED, TaskStatus.MERGED)).toBe(
      false,
    );
    expect(isValidTaskTransition(TaskStatus.MERGED, TaskStatus.RUNNING)).toBe(
      false,
    );
    expect(
      isValidTaskTransition(TaskStatus.AWAITING_REVIEW, TaskStatus.MERGED),
    ).toBe(false);
  });

  it("throws ConflictError on invalid transition assertions", () => {
    expect(() =>
      assertValidTaskTransition(TaskStatus.QUEUED, TaskStatus.MERGED),
    ).toThrow(ConflictError);
  });

  it("enforces RBAC for approvals", () => {
    // Reviewers can approve
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.REVIEWER,
        TaskStatus.AWAITING_REVIEW,
        TaskStatus.APPROVED,
      ),
    ).not.toThrow();

    // Admins can approve
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.ADMIN,
        TaskStatus.AWAITING_REVIEW,
        TaskStatus.APPROVED,
      ),
    ).not.toThrow();

    // Developers CANNOT approve
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.DEVELOPER,
        TaskStatus.AWAITING_REVIEW,
        TaskStatus.APPROVED,
      ),
    ).toThrow(ForbiddenError);
  });

  it("enforces RBAC for merging to protected branches", () => {
    // Admins can merge
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.ADMIN,
        TaskStatus.APPROVED,
        TaskStatus.MERGED,
      ),
    ).not.toThrow();

    // Owners can merge
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.OWNER,
        TaskStatus.APPROVED,
        TaskStatus.MERGED,
      ),
    ).not.toThrow();

    // Developers cannot merge
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.DEVELOPER,
        TaskStatus.APPROVED,
        TaskStatus.MERGED,
      ),
    ).toThrow(ForbiddenError);

    // Reviewers cannot merge
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.REVIEWER,
        TaskStatus.APPROVED,
        TaskStatus.MERGED,
      ),
    ).toThrow(ForbiddenError);
  });

  it("enforces cancellation rights", () => {
    // Developers, Admins, Owners can cancel
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.DEVELOPER,
        TaskStatus.RUNNING,
        TaskStatus.CANCELLED,
      ),
    ).not.toThrow();

    // Reviewers cannot cancel
    expect(() =>
      assertUserCanTransitionTask(
        WorkspaceRole.REVIEWER,
        TaskStatus.RUNNING,
        TaskStatus.CANCELLED,
      ),
    ).toThrow(ForbiddenError);
  });
});

describe("Run State Machine", () => {
  it("allows valid run attempt transitions", () => {
    expect(isValidRunTransition(RunStatus.PENDING, RunStatus.ALLOCATED)).toBe(
      true,
    );
    expect(isValidRunTransition(RunStatus.ALLOCATED, RunStatus.RUNNING)).toBe(
      true,
    );
    expect(isValidRunTransition(RunStatus.RUNNING, RunStatus.COMPLETED)).toBe(
      true,
    );
  });

  it("rejects transitions out of terminal run states", () => {
    expect(isValidRunTransition(RunStatus.COMPLETED, RunStatus.RUNNING)).toBe(
      false,
    );
    expect(isValidRunTransition(RunStatus.FAILED, RunStatus.RUNNING)).toBe(
      false,
    );
    expect(() =>
      assertValidRunTransition(RunStatus.FAILED, RunStatus.PENDING),
    ).toThrow(ConflictError);
  });
});
