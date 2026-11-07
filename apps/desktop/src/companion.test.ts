import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DesktopCompanionController } from "./main.js";

describe("Phase 8: Desktop Companion & Dynamic Island", () => {
  let controller: DesktopCompanionController;

  beforeEach(() => {
    controller = new DesktopCompanionController({
      apiBaseUrl: "http://localhost:4000",
      workspaceId: "ws-desktop-01",
      userToken: "test-user-jwt",
      alwaysOnTop: true,
      enableNotifications: true,
    });
  });

  afterEach(() => {
    controller.stop();
    vi.restoreAllMocks();
  });

  it("configures floating always-on-top window bounds and toggles expand/collapse", () => {
    // Default collapsed dynamic island pill mode
    const collapsed = controller.getWindowBounds();
    expect(collapsed.mode).toBe("island");
    expect(collapsed.width).toBe(320);
    expect(collapsed.height).toBe(52);
    expect(collapsed.alwaysOnTop).toBe(true);

    // Expand
    const isNowExpanded = controller.toggleExpand();
    expect(isNowExpanded).toBe(true);

    const expanded = controller.getWindowBounds();
    expect(expanded.mode).toBe("expanded");
    expect(expanded.width).toBe(420);
    expect(expanded.height).toBe(540);

    // Collapse back
    controller.toggleExpand();
    expect(controller.getWindowBounds().mode).toBe("island");
  });

  it("hiding the panel keeps background executions running independently", () => {
    controller.show();
    expect(controller.isVisible).toBe(true);

    controller.hide();
    expect(controller.isVisible).toBe(false);
    // Controller continues to be active without killing background tasks
    expect(controller.tasks).toBeDefined();
  });

  it("connects to control plane, synchronizes task states and flags pending approvals", async () => {
    const mockTasks = [
      {
        id: "task-1",
        title: "Add rate limiting",
        status: "RUNNING",
        priority: "HIGH",
      },
      {
        id: "task-2",
        title: "Update schema",
        status: "AWAITING_REVIEW",
        priority: "MEDIUM",
      },
      {
        id: "task-3",
        title: "Fix broken build",
        status: "FAILED",
        priority: "URGENT",
      },
      {
        id: "task-4",
        title: "Setup auth",
        status: "COMPLETED",
        priority: "LOW",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: mockTasks }),
    } as Response);

    await controller.syncTasks();

    expect(controller.isConnected).toBe(true);
    expect(controller.tasks.length).toBe(4);
    expect(controller.tasks.find((t) => t.id === "task-1")?.status).toBe(
      "RUNNING",
    );
    expect(controller.tasks.find((t) => t.id === "task-3")?.status).toBe(
      "FAILED",
    );

    // Awaiting review task creates pending permission request
    expect(controller.pendingPermissions.length).toBe(1);
    expect(controller.pendingPermissions[0].taskId).toBe("task-2");
    expect(controller.pendingPermissions[0].action).toBe("MERGE");
  });

  it("dispatches authenticated review decisions (approve / reject) from desktop", async () => {
    controller.pendingPermissions = [
      {
        id: "perm-1",
        taskId: "task-99",
        title: "PR Review",
        action: "MERGE",
        details: "Approve",
      },
    ];

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/approvals")) {
          return {
            ok: true,
            json: async () => ({ success: true }),
          } as Response;
        }
        return { ok: true, json: async () => ({ tasks: [] }) } as Response;
      });

    const approved = await controller.reviewPermission("perm-1", "APPROVED");
    expect(approved).toBe(true);
    expect(controller.pendingPermissions.length).toBe(0);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-99/approvals"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-user-jwt",
        }),
      }),
    );
  });

  it("handles pause, resume, and cancel task controls", async () => {
    controller.tasks = [
      {
        id: "task-ctl-1",
        title: "Compute embeddings",
        status: "RUNNING",
        progressPercent: 40,
        priority: "MEDIUM",
      },
    ];

    // Pause
    const paused = await controller.controlTask("task-ctl-1", "pause");
    expect(paused).toBe(true);
    expect(controller.tasks[0].status).toBe("PAUSED");

    // Resume
    const resumed = await controller.controlTask("task-ctl-1", "resume");
    expect(resumed).toBe(true);
    expect(controller.tasks[0].status).toBe("RUNNING");

    // Cancel
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const cancelled = await controller.controlTask("task-ctl-1", "cancel");
    expect(cancelled).toBe(true);
  });

  it("emits desktop system notifications on task completions", () => {
    controller.sendNotification(
      "Execution Finished",
      "Task AF-42 passed all tests",
    );
    expect(controller.emittedNotifications.length).toBe(1);
    expect(controller.emittedNotifications[0].title).toBe("Execution Finished");
    expect(controller.emittedNotifications[0].body).toContain("AF-42");
  });
});
