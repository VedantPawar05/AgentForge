"use client";

import React, { useState } from "react";
import { TaskItem } from "../lib/api-client";
import {
  Play,
  Eye,
  GitPullRequest,
  CheckCircle2,
  Clock,
  Plus,
  AlertCircle,
} from "lucide-react";

interface KanbanBoardProps {
  tasks: TaskItem[];
  selectedTaskId: string | null;
  onSelectTask: (task: TaskItem) => void;
  onTriggerRun: (taskId: string) => void;
  onOpenDiff: (task: TaskItem) => void;
  onCreateTaskClick: () => void;
}

const COLUMNS = [
  {
    id: "QUEUED",
    label: "Queued / Ready",
    color: "border-slate-700 bg-slate-900/30",
  },
  {
    id: "RUNNING",
    label: "Agent Executing",
    color: "border-indigo-800 bg-indigo-950/20",
  },
  {
    id: "AWAITING_REVIEW",
    label: "Awaiting Review",
    color: "border-amber-800 bg-amber-950/20",
  },
  {
    id: "APPROVED",
    label: "Approved (Ready to Merge)",
    color: "border-emerald-800 bg-emerald-950/20",
  },
  {
    id: "MERGED",
    label: "Merged to Main",
    color: "border-purple-800 bg-purple-950/20",
  },
];

export function KanbanBoard({
  tasks,
  selectedTaskId,
  onSelectTask,
  onTriggerRun,
  onOpenDiff,
  onCreateTaskClick,
}: KanbanBoardProps) {
  const getTasksForColumn = (colId: string) => {
    if (colId === "RUNNING") {
      return tasks.filter(
        (t) =>
          t.status === "RUNNING" ||
          t.status === "PROVISIONING" ||
          t.status === "TESTING",
      );
    }
    return tasks.filter((t) => t.status === colId);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "HIGH":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "MEDIUM":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      default:
        return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  return (
    <div className="space-y-4">
      {/* Board Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Active Workflows
          </h2>
          <p className="text-xs text-slate-400">
            Real-time multi-tenant execution queue • Continuous sandbox
            verification
          </p>
        </div>

        <button
          onClick={onCreateTaskClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Assign Task
        </button>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = getTasksForColumn(col.id);

          return (
            <div
              key={col.id}
              className={`rounded-2xl border p-3 flex flex-col min-h-[460px] ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
                <span className="font-semibold text-xs text-slate-300">
                  {col.label}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                  {colTasks.length}
                </span>
              </div>

              {/* Task Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colTasks.map((t) => {
                  const isSelected = t.id === selectedTaskId;

                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all shadow-sm ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-950/40 shadow-indigo-500/10"
                          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getPriorityBadge(
                            t.priority,
                          )}`}
                        >
                          {t.priority}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          v{t.version}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2 mb-2">
                        {t.title}
                      </h4>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 mt-2">
                        <span className="font-mono truncate max-w-[100px]">
                          {t.targetBranch}
                        </span>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.status === "QUEUED" && (
                            <button
                              onClick={() => onTriggerRun(t.id)}
                              className="p-1 rounded hover:bg-indigo-600/20 text-indigo-400 transition"
                              title="Trigger Agent Execution"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(t.status === "AWAITING_REVIEW" ||
                            t.status === "APPROVED") && (
                            <button
                              onClick={() => onOpenDiff(t)}
                              className="p-1 rounded hover:bg-cyan-600/20 text-cyan-400 transition"
                              title="Review Unified Diff & Tests"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {t.status === "MERGED" && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="h-24 flex items-center justify-center border border-dashed border-slate-800/80 rounded-xl text-[11px] text-slate-600 font-mono">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
