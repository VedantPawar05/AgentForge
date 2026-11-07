"use client";

import React, { useState } from "react";
import {
  Layers,
  LayoutDashboard,
  ListTodo,
  Users,
  GitBranch,
  Activity,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  Sparkles,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface SidebarProps {
  workspaceName: string | null;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_SECTIONS = [
  {
    label: "Command Center",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "tasks", label: "Active Workflows", icon: ListTodo },
      { id: "activity", label: "Execution Feed", icon: Activity },
    ],
  },
  {
    label: "Repository",
    items: [{ id: "branches", label: "Branches & Diffs", icon: GitBranch }],
  },
  {
    label: "Administration",
    items: [
      { id: "members", label: "Team Members", icon: Users },
      { id: "settings", label: "Workspace Settings", icon: Settings },
      { id: "audit", label: "Audit Trail", icon: Shield },
    ],
  },
];

export function Sidebar({
  workspaceName,
  activeView,
  onNavigate,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(NAV_SECTIONS.map((s) => s.label)),
  );

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside
      className={`flex flex-col border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800/60">
        <div
          className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-sm shadow-lg shadow-cyan-500/20 shrink-0">
            AF
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-bold text-sm text-white tracking-tight">
                AgentForge
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                v1.0 Enterprise
              </div>
            </div>
          )}
        </div>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      {!collapsed && workspaceName && (
        <div className="px-3 py-3 border-b border-slate-800/40">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/60 cursor-pointer hover:border-slate-700 transition group">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {workspaceName}
              </div>
              <div className="text-[10px] text-slate-500">Active workspace</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 transition" />
          </div>
        </div>
      )}

      {/* Expand button when collapsed */}
      {collapsed && onToggleCollapse && (
        <div className="px-3 py-3 border-b border-slate-800/40 flex justify-center">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <button
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider hover:text-slate-400 transition"
              >
                <span>{section.label}</span>
                {expandedSections.has(section.label) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            )}

            {(collapsed || expandedSections.has(section.label)) && (
              <div className="space-y-0.5 mt-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 ${
                        collapsed ? "justify-center p-3" : "px-3 py-2.5"
                      } ${
                        isActive
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm shadow-indigo-500/5"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-400" : ""}`}
                      />
                      {!collapsed && (
                        <span className="text-xs font-medium">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800/60 px-3 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                Developer
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Authenticated
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
              U
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
