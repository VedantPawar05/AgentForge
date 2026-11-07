"use client";

import React from "react";
import {
  Activity,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Play,
  Clock,
  XCircle,
  GitMerge,
  RefreshCw,
  Shield,
  Eye,
} from "lucide-react";
import { TaskItem } from "../lib/api-client";

interface ActivityFeedProps {
  tasks: TaskItem[];
  onSelectTask?: (task: TaskItem) => void;
}

interface ActivityEntry {
  id: string;
  task: TaskItem;
  message: string;
  type: "success" | "info" | "warning" | "error" | "merge";
  icon: React.ReactNode;
  timestamp: string;
}

function buildActivityLog(tasks: TaskItem[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const task of tasks) {
    const ts = task.createdAt;

    switch (task.status) {
      case "QUEUED":
        entries.push({
          id: `${task.id}-queued`,
          task,
          message: `Task "${task.title}" added to execution queue`,
          type: "info",
          icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
          timestamp: ts,
        });
        break;
      case "RUNNING":
      case "PROVISIONING":
      case "TESTING":
        entries.push({
          id: `${task.id}-running`,
          task,
          message: `Agent executing: "${task.title}" — sandbox provisioned`,
          type: "info",
          icon: <Play className="w-3.5 h-3.5 text-indigo-400" />,
          timestamp: ts,
        });
        break;
      case "AWAITING_REVIEW":
        entries.push({
          id: `${task.id}-review`,
          task,
          message: `Execution complete: "${task.title}" — diff ready for human review`,
          type: "warning",
          icon: <Eye className="w-3.5 h-3.5 text-amber-400" />,
          timestamp: ts,
        });
        break;
      case "APPROVED":
        entries.push({
          id: `${task.id}-approved`,
          task,
          message: `Approved: "${task.title}" — ready for merge into ${task.targetBranch}`,
          type: "success",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          timestamp: ts,
        });
        break;
      case "MERGED":
        entries.push({
          id: `${task.id}-merged`,
          task,
          message: `Merged: "${task.title}" → ${task.targetBranch}`,
          type: "merge",
          icon: <GitMerge className="w-3.5 h-3.5 text-purple-400" />,
          timestamp: ts,
        });
        break;
      case "FAILED":
        entries.push({
          id: `${task.id}-failed`,
          task,
          message: `Failed: "${task.title}" — execution error encountered`,
          type: "error",
          icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
          timestamp: ts,
        });
        break;
      case "CHANGES_REQUESTED":
        entries.push({
          id: `${task.id}-changes`,
          task,
          message: `Changes requested: "${task.title}" — returned to backlog`,
          type: "warning",
          icon: <RefreshCw className="w-3.5 h-3.5 text-amber-400" />,
          timestamp: ts,
        });
        break;
    }
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

const TYPE_STYLES = {
  success: "border-emerald-500/20 bg-emerald-500/5",
  info: "border-slate-700/60 bg-slate-900/30",
  warning: "border-amber-500/20 bg-amber-500/5",
  error: "border-rose-500/20 bg-rose-500/5",
  merge: "border-purple-500/20 bg-purple-500/5",
};

export function ActivityFeed({ tasks, onSelectTask }: ActivityFeedProps) {
  const entries = buildActivityLog(tasks);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Execution Activity Feed
            </h3>
            <p className="text-[10px] text-slate-500">
              Real-time task lifecycle events
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-bold">
          {entries.length} events
        </span>
      </div>

      {/* Feed List */}
      <div className="max-h-[600px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 font-mono">
            No execution activity yet. Create a task to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onSelectTask?.(entry.task)}
                className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all hover:bg-slate-800/30 ${TYPE_STYLES[entry.type]}`}
              >
                <div className="mt-0.5 shrink-0">{entry.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                    {entry.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      v{entry.task.version}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
