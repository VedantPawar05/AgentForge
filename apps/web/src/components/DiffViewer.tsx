"use client";

import React from "react";
import {
  GitPullRequest,
  FileCode,
  CheckCircle2,
  AlertOctagon,
  GitMerge,
  X,
} from "lucide-react";

interface DiffViewerProps {
  diff: string;
  taskTitle: string;
  status: string;
  targetBranch?: string;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onMerge?: () => void;
  onClose?: () => void;
  isMerging?: boolean;
}

export function DiffViewer({
  diff,
  taskTitle,
  status,
  targetBranch = "main",
  onApprove,
  onRequestChanges,
  onMerge,
  onClose,
  isMerging = false,
}: DiffViewerProps) {
  const lines = diff.split("\n");
  const additions = lines.filter(
    (l) => l.startsWith("+") && !l.startsWith("+++"),
  ).length;
  const deletions = lines.filter(
    (l) => l.startsWith("-") && !l.startsWith("---"),
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">
                  {taskTitle}
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                Target Branch:{" "}
                <span className="text-indigo-400 font-semibold">
                  {targetBranch}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-semibold">
                  +{additions}
                </span>
                <span className="text-rose-400 font-semibold">
                  -{deletions}
                </span>
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Diff Content View */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950">
          <div className="rounded-lg border border-slate-800/80 overflow-hidden">
            {lines.map((line, idx) => {
              let bg = "bg-slate-950 text-slate-300";
              let indicator = " ";

              if (line.startsWith("diff --git") || line.startsWith("index ")) {
                bg =
                  "bg-slate-900 text-slate-400 font-bold border-b border-slate-800";
              } else if (line.startsWith("@@")) {
                bg =
                  "bg-indigo-950/40 text-cyan-400 font-bold border-y border-cyan-900/40";
              } else if (line.startsWith("+") && !line.startsWith("+++")) {
                bg =
                  "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500";
                indicator = "+";
              } else if (line.startsWith("-") && !line.startsWith("---")) {
                bg = "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500";
                indicator = "-";
              }

              return (
                <div
                  key={idx}
                  className={`flex items-start px-3 py-0.5 leading-5 hover:brightness-110 ${bg}`}
                >
                  <span className="w-8 text-[10px] text-slate-600 select-none text-right pr-2">
                    {idx + 1}
                  </span>
                  <span className="w-4 select-none font-bold text-center">
                    {indicator}
                  </span>
                  <pre className="flex-1 whitespace-pre-wrap break-all font-mono">
                    {line}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Merge Gate */}
        <div className="border-t border-slate-800 p-4 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Cryptographic audit trail active. All approvals recorded in
            immutable ledger.
          </div>

          <div className="flex items-center gap-3">
            {onRequestChanges && (
              <button
                onClick={onRequestChanges}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Request Changes
              </button>
            )}

            {onApprove && status !== "APPROVED" && status !== "MERGED" && (
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve Changes
              </button>
            )}

            {onMerge && status === "APPROVED" && (
              <button
                onClick={onMerge}
                disabled={isMerging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <GitMerge className="w-4 h-4" />
                {isMerging
                  ? "Merging to Base..."
                  : `Merge into ${targetBranch}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
