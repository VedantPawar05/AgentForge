"use client";

import React from "react";
import { Icon } from "./ui";
import { NAV_ITEMS } from "@/lib/data";

interface DockProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Dock({ currentView, onNavigate }: DockProps) {
  // Map task/newtask to tasks for active state
  const activeId =
    currentView === "task" || currentView === "newtask" ? "tasks" : currentView;

  return (
    <nav className="dock" aria-label="Primary">
      <div className="dk-scroll">
        <a
          className="dk brand"
          onClick={() => onNavigate("dashboard")}
          aria-label="AgentForge"
          style={{ cursor: "pointer" }}
        >
          AF
        </a>
        {NAV_ITEMS.map((nav) => (
          <a
            key={nav.id}
            className={`dk${activeId === nav.id ? " on" : ""}`}
            onClick={() => onNavigate(nav.id)}
            aria-label={nav.label}
            title={nav.label}
            style={{ cursor: "pointer" }}
          >
            <Icon name={nav.id} />
            <span>{nav.label}</span>
          </a>
        ))}
      </div>
      <div className="dk-r">
        <button className="dk" aria-label="Search">
          <Icon name="search" />
        </button>
        <a
          className="dk acc"
          onClick={() => onNavigate("newtask")}
          aria-label="New task"
          style={{ cursor: "pointer" }}
        >
          <Icon name="plus" />
        </a>
        <a
          className="dk"
          onClick={() => onNavigate("inbox")}
          aria-label="Notifications"
          style={{ cursor: "pointer" }}
        >
          <Icon name="bell" />
          <em className="badge">4</em>
        </a>
        <a
          className="dk av"
          onClick={() => onNavigate("prefs")}
          aria-label="Profile"
          style={{
            cursor: "pointer",
            padding: 0,
            justifyContent: "center",
            width: 40,
            font: "700 11px var(--f-m)",
          }}
        >
          AR
        </a>
      </div>
    </nav>
  );
}
