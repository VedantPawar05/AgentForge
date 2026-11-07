import React from "react";

// SVG icon paths matching the design system
const ICON_PATHS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  tasks:
    '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2 2.1-2.2M3.5 12l1.2 1.2 2.1-2.2M3.5 18l1.2 1.2 2.1-2.2"/>',
  board:
    '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  agents:
    '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4.5M9 13v.5M15 13v.5M9.5 16.5h5"/>',
  squads:
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 14c2.8 0 5 1.6 5 4.5"/>',
  review:
    '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-8 3-11.5 7.5"/>',
  approvals:
    '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  projects:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  usage: '<path d="M5 20v-6M12 20V5M19 20v-9"/>',
  logs: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15L6 17ZM10 21h4"/>',
  play: '<path d="M7 5v14l12-7L7 5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  retry: '<path d="M4 12a8 8 0 1 1 2.5 5.8M4 19v-5h5"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  git: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.3 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5.1 5.1 0 0 0 19.9 1S18.7.7 16 2.5a13.4 13.4 0 0 0-7 0C6.3.7 5.1 1 5.1 1A5.1 5.1 0 0 0 5 4.8a5.4 5.4 0 0 0-1.5 3.8c0 5.4 3.3 6.6 6.4 7A3.4 3.4 0 0 0 9 18.1V22"/>',
};

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export function Icon({ name, className = "", size = 18 }: IconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={`ico ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

// Status chip color mapping
const STATUS_COLORS: Record<string, string> = {
  Running: "run",
  Testing: "test",
  "Needs Input": "in",
  "Awaiting Review": "rev",
  Completed: "ok",
  Failed: "bad",
  Queued: "x",
  Backlog: "x",
  Cancelled: "x",
  Idle: "x",
  Paused: "test",
  Waiting: "in",
  Connected: "run",
  Syncing: "test",
  Local: "rev",
  Error: "bad",
  Pending: "in",
  Approved: "run",
  Denied: "bad",
  Live: "run",
};

export function StatusChip({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "x";
  return (
    <span className={`chip c-${cls}`}>
      <i />
      {status}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  return <span className={`chip p-${priority.toLowerCase()}`}>{priority}</span>;
}

export function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={`bar ${className}`}>
      <b style={{ width: `${value}%` }} />
    </div>
  );
}

export function Button({
  children,
  variant = "default",
  size = "default",
  icon,
  onClick,
  className = "",
}: {
  children?: React.ReactNode;
  variant?: "default" | "primary" | "white" | "danger" | "icon";
  size?: "default" | "sm";
  icon?: string;
  onClick?: () => void;
  className?: string;
}) {
  const variantCls =
    variant === "primary"
      ? "pri"
      : variant === "white"
        ? "wt"
        : variant === "danger"
          ? "dng"
          : variant === "icon"
            ? "ic"
            : "";
  const sizeCls = size === "sm" ? "sm-btn" : "";
  return (
    <button
      className={`btn ${variantCls} ${sizeCls} ${className}`}
      onClick={onClick}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Section({
  number,
  title,
  right,
}: {
  number: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sec">
      <span className="label">
        {number} / {title}
      </span>
      <span className="rule" />
      {right}
    </div>
  );
}

export function Breadcrumbs({
  items,
  onNavigate,
}: {
  items: string[];
  onNavigate?: (view: string) => void;
}) {
  return (
    <div className="crumbs">
      {items.map((item, i) =>
        i < items.length - 1 ? (
          <React.Fragment key={i}>
            <a
              onClick={() => onNavigate?.("dashboard")}
              style={{ cursor: "pointer" }}
            >
              {item}
            </a>
            <span>/</span>
          </React.Fragment>
        ) : (
          <span key={i} style={{ color: "var(--fg)" }}>
            {item}
          </span>
        ),
      )}
    </div>
  );
}

export function PageHeader({
  breadcrumbs,
  title,
  right,
  onNavigate,
}: {
  breadcrumbs: string[];
  title: string;
  right?: React.ReactNode;
  onNavigate?: (view: string) => void;
}) {
  return (
    <>
      <Breadcrumbs items={breadcrumbs} onNavigate={onNavigate} />
      <header className="ph">
        <h1 className="h-xl" dangerouslySetInnerHTML={{ __html: title }} />
        <div className="ph-r">{right}</div>
      </header>
    </>
  );
}

export function Select({ label, value }: { label: string; value: string }) {
  return (
    <div className="fld">
      <span className="label">{label}</span>
      <div className="sel">
        <span>{value}</span>
        <Icon name="chev" />
      </div>
    </div>
  );
}

export function Input({
  label,
  value,
  placeholder,
  className = "",
}: {
  label: string;
  value?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`fld ${className}`}>
      <span className="label">{label}</span>
      <input
        className="in"
        defaultValue={value || ""}
        placeholder={placeholder || ""}
      />
    </div>
  );
}

export function Toggle({
  title,
  description,
  on,
}: {
  title: string;
  description?: string;
  on?: boolean;
}) {
  return (
    <div className="tog">
      <span>
        <b>{title}</b>
        {description && <span className="mut sm">{description}</span>}
      </span>
      <span className={`sw ${on ? "on" : ""}`} />
    </div>
  );
}

export function TabsBar({
  items,
  active = 0,
}: {
  items: string[];
  active?: number;
}) {
  return (
    <div className="tabs-bar">
      {items.map((item, i) => (
        <span key={i} className={i === active ? "on" : ""}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function DataRows({
  cols,
  headers,
  children,
}: {
  cols: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rows">
      <div
        className="row head label"
        style={{ "--cols": cols } as React.CSSProperties}
      >
        {headers.map((h, i) => (
          <span key={i} className={i > 2 ? "hide-sm" : ""}>
            {h}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

export function DataRow({
  cols,
  children,
}: {
  cols: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row" style={{ "--cols": cols } as React.CSSProperties}>
      {children}
    </div>
  );
}

export function TwoLine({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="st">
      <b>{primary}</b>
      <span className="mut sm">{secondary}</span>
    </div>
  );
}

export function ActionButtons({ actions }: { actions: string[] }) {
  return (
    <div className="acts">
      {actions.map((action) => (
        <button key={action} className="btn ic" aria-label={action}>
          <Icon name={action} />
        </button>
      ))}
    </div>
  );
}
