"use client";

import React from "react";
import { Icon } from "./ui";
import { IDX_ITEMS } from "@/lib/data";

interface SidebarNewProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export function SidebarNew({ currentView, onNavigate }: SidebarNewProps) {
  return (
    <aside className="side">
      {/* Top accent section */}
      <div className="pc-top">
        <span className="label">Workspace</span>
        <div className="mg">NW</div>
        <h2>Northwind Labs</h2>
      </div>

      {/* Body */}
      <div className="pc-body">
        <div className="fld">
          <span className="label">Project</span>
          <div className="sel">
            <span>agentforge/web</span>
            <Icon name="chev" />
          </div>
        </div>

        <div className="stat">
          <div>
            <b>03</b>
            <span className="label">Running</span>
          </div>
          <div>
            <b>12</b>
            <span className="label">Queued</span>
          </div>
          <div>
            <b>05</b>
            <span className="label">Approvals</span>
          </div>
        </div>

        <span className="pill-in">
          <span className="chip c-run" style={{ border: 0, padding: 0 }}>
            <i />
          </span>
          Desktop runner connected
        </span>

        <a
          className="btn pri"
          onClick={() => onNavigate("newtask")}
          style={{ cursor: "pointer" }}
        >
          <Icon name="plus" />
          New task
        </a>
      </div>

      {/* Navigation index */}
      <nav className="idx">
        {IDX_ITEMS.map((item, i) => (
          <a
            key={item.id}
            className={currentView === item.id ? "on" : ""}
            onClick={() => onNavigate(item.id)}
            style={{ cursor: "pointer" }}
          >
            <i>{String(i + 1).padStart(2, "0")}</i>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Footer */}
      <div className="pc-foot">
        <span className="av">AR</span>
        <div>
          <b>Alex Rivera</b>
          <br />
          <span className="label">Owner</span>
        </div>
      </div>
    </aside>
  );
}
