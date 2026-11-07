"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Terminal,
  Shield,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { RunEventPayload } from "../lib/api-client";

interface ExecutionConsoleProps {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  status: string;
  onInspectDiff?: () => void;
}

export function ExecutionConsole({
  workspaceId,
  taskId,
  taskTitle,
  status,
  onInspectDiff,
}: ExecutionConsoleProps) {
  const [events, setEvents] = useState<RunEventPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";
    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: "alice@agentforge.dev" },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join:task", { taskId, workspaceId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("run:event", (data: { event: RunEventPayload }) => {
      if (data?.event) {
        setEvents((prev) => [...prev, data.event]);
      }
    });

    // Provide default initial logs if waiting for events
    if (events.length === 0) {
      setEvents([
        {
          id: "ev-1",
          runId: "initial",
          sequenceNumber: 1,
          type: "STATUS_CHANGE",
          payload: {
            message: `Subscribed to live execution channel for: ${taskTitle}`,
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: "ev-2",
          runId: "initial",
          sequenceNumber: 2,
          type: "LOG",
          payload: {
            level: "INFO",
            message:
              "Isolated sandbox container initialized (Docker / MicroVM profile)",
          },
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    return () => {
      socket.emit("leave:task", { taskId });
      socket.disconnect();
    };
  }, [taskId, workspaceId, taskTitle]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl flex flex-col h-[520px] transition-all">
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-white truncate max-w-[280px]">
                {taskTitle}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
                title={
                  isConnected ? "Live WebSocket Connected" : "Connecting..."
                }
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Task ID: {taskId.slice(0, 13)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {status}
          </span>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded text-xs transition ${
              autoScroll
                ? "text-cyan-400 bg-cyan-500/10"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          >
            {autoScroll ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 text-slate-300 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {events.map((ev, index) => {
          const time = new Date(ev.createdAt).toLocaleTimeString();
          const message =
            ev.payload.message || ev.payload.line || JSON.stringify(ev.payload);

          return (
            <div
              key={ev.id || index}
              className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/40 p-1 rounded"
            >
              <span className="text-slate-600 text-[10px] shrink-0 select-none">
                [{time}]
              </span>
              <span className="text-slate-600 text-[10px] shrink-0 select-none w-6 text-right">
                #{ev.sequenceNumber}
              </span>

              {ev.type === "STATUS_CHANGE" && (
                <span className="text-amber-400 flex items-center gap-1 font-semibold">
                  <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                  {message}
                </span>
              )}

              {ev.type === "TOOL_CALL" && (
                <span className="text-cyan-400">
                  <span className="text-cyan-500 font-bold">TOOL &gt;</span>{" "}
                  {message}
                </span>
              )}

              {ev.type === "TEST_RESULT" && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                  {message}
                </span>
              )}

              {ev.type === "LOG" && (
                <span
                  className={
                    ev.payload.level === "ERROR"
                      ? "text-rose-400"
                      : "text-slate-300"
                  }
                >
                  {message}
                </span>
              )}

              {ev.type === "METRIC" && (
                <span className="text-indigo-400 text-[11px]">
                  📊 {message}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Console Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Hardened Sandbox
            (UID 1000)
          </span>
          <span className="text-[11px]">• Stream: {events.length} events</span>
        </div>

        {onInspectDiff && (
          <button
            onClick={onInspectDiff}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            Review & Diff
          </button>
        )}
      </div>
    </div>
  );
}
