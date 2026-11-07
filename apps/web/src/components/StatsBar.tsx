"use client";

import React from "react";
import {
  Shield,
  Cpu,
  GitBranch,
  CheckCircle2,
  Activity,
  Timer,
  Zap,
  TrendingUp,
} from "lucide-react";
import { TaskItem } from "../lib/api-client";

interface StatsBarProps {
  tasks: TaskItem[];
}

export function StatsBar({ tasks }: StatsBarProps) {
  const running = tasks.filter(
    (t) =>
      t.status === "RUNNING" ||
      t.status === "PROVISIONING" ||
      t.status === "TESTING",
  ).length;
  const merged = tasks.filter((t) => t.status === "MERGED").length;
  const awaitingReview = tasks.filter(
    (t) => t.status === "AWAITING_REVIEW",
  ).length;
  const queued = tasks.filter((t) => t.status === "QUEUED").length;
  const failed = tasks.filter(
    (t) => t.status === "FAILED" || t.status === "TIMED_OUT",
  ).length;
  const total = tasks.length;
  const successRate =
    total > 0 ? Math.round((merged / Math.max(merged + failed, 1)) * 100) : 100;

  const cards = [
    {
      label: "Active Workers",
      value: `${running} Active`,
      sub: "Heartbeat 10s",
      icon: Cpu,
      iconColor: "text-cyan-400",
      borderHover: "hover:border-cyan-700/40",
      glow: running > 0 ? "shadow-cyan-500/5" : "",
    },
    {
      label: "Pending Queue",
      value: `${queued} Queued`,
      sub: `${awaitingReview} Awaiting Review`,
      icon: Timer,
      iconColor: "text-amber-400",
      borderHover: "hover:border-amber-700/40",
      glow: "",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      sub: `${merged} merged · ${failed} failed`,
      icon: TrendingUp,
      iconColor: successRate >= 80 ? "text-emerald-400" : "text-rose-400",
      borderHover: "hover:border-emerald-700/40",
      glow: "",
    },
    {
      label: "Total Workflows",
      value: `${total} Tasks`,
      sub: `${merged} shipped to production`,
      icon: Activity,
      iconColor: "text-indigo-400",
      borderHover: "hover:border-indigo-700/40",
      glow: "",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`group relative p-4 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm transition-all duration-300 ${card.borderHover} ${card.glow} hover:bg-slate-900/50`}
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative">
              <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                {card.label}
              </div>
              <div className="text-xl font-bold text-white tracking-tight">
                {card.value}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">{card.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
