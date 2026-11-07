"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  AgentForgeApiClient,
  apiClient,
  TaskItem,
  WorkspaceItem,
  RunItem,
  RunEventPayload,
} from "./api-client";

// ─── Auth Token ──────────────────────────────────────────────────
const AUTH_TOKEN_KEY = "agentforge_token";

export function useAuth() {
  const [token, setTokenState] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(AUTH_TOKEN_KEY)
        : null;
    if (stored) {
      setTokenState(stored);
      apiClient.setToken(stored);
    }
    setIsReady(true);
  }, []);

  const setToken = useCallback((t: string) => {
    setTokenState(t);
    apiClient.setToken(t);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_TOKEN_KEY, t);
    }
  }, []);

  const logout = useCallback(() => {
    setTokenState("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }, []);

  return { token, setToken, logout, isReady };
}

// ─── Generic async fetcher ───────────────────────────────────────
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}

// ─── Workspaces ──────────────────────────────────────────────────
export function useWorkspaces() {
  return useAsyncData(async () => {
    const res = await apiClient.getWorkspaces();
    return res.workspaces.map((w) => ({ ...w.workspace, role: w.role }));
  }, []);
}

// ─── Tasks ───────────────────────────────────────────────────────
export function useTasks(workspaceId: string | null) {
  const result = useAsyncData(async () => {
    if (!workspaceId) return [];
    const res = await apiClient.getTasks(workspaceId);
    return res.tasks;
  }, [workspaceId]);

  const createTask = useCallback(
    async (data: {
      projectId: string;
      title: string;
      description?: string;
      priority?: string;
      targetBranch?: string;
    }) => {
      if (!workspaceId) throw new Error("No workspace selected");
      const res = await apiClient.createTask(workspaceId, data);
      result.refetch();
      return res.task;
    },
    [workspaceId, result.refetch],
  );

  const triggerRun = useCallback(
    async (taskId: string) => {
      if (!workspaceId) throw new Error("No workspace selected");
      const res = await apiClient.triggerRun(workspaceId, taskId);
      result.refetch();
      return res.run;
    },
    [workspaceId, result.refetch],
  );

  return { ...result, createTask, triggerRun };
}

// ─── Runs ────────────────────────────────────────────────────────
export function useRuns(workspaceId: string | null, taskId: string | null) {
  return useAsyncData(async () => {
    if (!workspaceId || !taskId) return [];
    const res = await apiClient.getRunEvents(workspaceId, taskId, "");
    return res.events;
  }, [workspaceId, taskId]);
}

// ─── WebSocket ───────────────────────────────────────────────────
export function useTaskSocket(
  workspaceId: string | null,
  taskId: string | null,
  token: string,
) {
  const [events, setEvents] = useState<RunEventPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!workspaceId || !taskId || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: `Bearer ${token}` },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join:task", { taskId, workspaceId }, (res: any) => {
        if (!res?.success) {
          console.error("[WS] Failed to join task room:", res?.error);
        }
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("run:event", (data: { event: RunEventPayload }) => {
      if (data?.event) {
        setEvents((prev) => {
          // Prevent duplicates by sequence number
          if (
            prev.some(
              (e) =>
                e.sequenceNumber === data.event.sequenceNumber &&
                e.runId === data.event.runId,
            )
          ) {
            return prev;
          }
          return [...prev, data.event];
        });
      }
    });

    return () => {
      socket.emit("leave:task", { taskId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [workspaceId, taskId, token]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, isConnected, clearEvents };
}

// ─── Review Actions ──────────────────────────────────────────────
export function useReviewActions(workspaceId: string | null) {
  const [loading, setLoading] = useState(false);

  const submitReview = useCallback(
    async (
      taskId: string,
      status: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
      reviewNotes?: string,
    ) => {
      if (!workspaceId) throw new Error("No workspace selected");
      setLoading(true);
      try {
        return await apiClient.submitReview(workspaceId, taskId, {
          status,
          reviewNotes,
        });
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  const mergeTask = useCallback(
    async (taskId: string) => {
      if (!workspaceId) throw new Error("No workspace selected");
      setLoading(true);
      try {
        return await apiClient.mergeTask(workspaceId, taskId);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  return { submitReview, mergeTask, loading };
}

// ─── Notification System ─────────────────────────────────────────
type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const push = useCallback(
    (message: string, type: NotificationType = "info") => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setNotifications((prev) => [
        ...prev,
        { id, message, type, timestamp: Date.now() },
      ]);

      // Auto-dismiss after 5s
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, push, dismiss };
}
