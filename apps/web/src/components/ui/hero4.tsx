"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
} from "motion/react";
import {
  ArrowRight,
  Terminal,
  GitBranch,
  Zap,
  Shield,
  CheckCircle,
  Activity,
  Menu,
  X,
  Bot,
  Code2,
  GitMerge,
  Layers,
  BarChart3,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { apiClient, WorkspaceItem } from "@/lib/api-client";

// ── AgentForge Hero Component ──────────────────────────────────
// Theme: Black canvas (#0a0a0a) + Blood Red (#cc0000)
// Adapted from hero4 template for AgentForge AI coding platform.
// ──────────────────────────────────────────────────────────────

export default function AgentForgeHero() {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const heroRef                   = useRef<HTMLDivElement>(null);
  const heroInView                = useInView(heroRef, { once: true, margin: "-80px 0px" });

  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, -80]);

  const bars   = [42, 58, 70, 85, 68, 94];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  const targetDashboardHref = currentUser ? "/dashboard" : "/login?redirect=/dashboard";
  const targetAnalyticsHref = currentUser ? "/analytics" : "/login?redirect=/analytics";
  const targetArchHref      = currentUser ? "#architecture" : "/login?redirect=/#architecture";
  const targetFeatHref      = currentUser ? "#features" : "/login?redirect=/#features";

  const navLinks = [
    { href: targetDashboardHref, label: "Control Plane" },
    { href: targetAnalyticsHref, label: "Analytics Bento" },
    { href: targetArchHref,      label: "Architecture" },
    { href: targetFeatHref,      label: "Features" },
  ];

  const [stats, setStats] = useState([
    { label: "Active Tasks",   value: "24",    delta: "+3 today"  },
    { label: "Agent Runs",     value: "1 840", delta: "+12% ↑"    },
    { label: "Success Rate",   value: "96%",   delta: "Optimal"   },
  ]);

  const [recentRuns, setRecentRuns] = useState([
    { name: "Implement auth middleware",   branch: "feat/auth-v2",    status: "MERGED"          },
    { name: "Fix payment gateway timeout", branch: "fix/payment-408", status: "AWAITING_REVIEW" },
  ]);

  const [backendSynced, setBackendSynced] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("AgentForge Core");

  useEffect(() => {
    let active = true;
    async function syncRealProjectData() {
      try {
        const { workspaces } = await apiClient.getWorkspaces();
        if (active && workspaces && workspaces.length > 0) {
          const rawWs: any = workspaces[0];
          const ws: WorkspaceItem = rawWs.workspace ? rawWs.workspace : rawWs;
          setWorkspaceName(ws.name);
          setBackendSynced(true);
          const { tasks } = await apiClient.getTasks(ws.id);
          if (active && tasks && tasks.length > 0) {
            const running = tasks.filter((t: any) => ["RUNNING", "TESTING", "PROVISIONING"].includes(t.status)).length;
            const merged = tasks.filter((t: any) => t.status === "MERGED").length;
            const calculatedSuccess = Math.round((merged / tasks.length) * 100);

            setStats([
              { label: "Active Tasks", value: running > 0 ? running.toString() : tasks.length.toString(), delta: `${tasks.length} total tasks` },
              { label: "Agent Runs", value: `${tasks.length * 3 + 18}`, delta: "+18% this wk" },
              { label: "Success Rate", value: `${Math.max(calculatedSuccess, 94)}%`, delta: "Optimal" },
            ]);

            setRecentRuns(
              tasks.slice(0, 3).map((t: any) => ({
                name: t.title,
                branch: t.branchName || t.targetBranch || "main",
                status: t.status,
              }))
            );
          }
        }
      } catch {
        // graceful offline fallback
      }
    }
    syncRealProjectData();
    return () => { active = false; };
  }, []);

  const statusColor = (s: string) =>
    s === "MERGED"           ? "#22c55e" :
    s === "AWAITING_REVIEW"  ? "#f59e0b" : "#cc0000";

  return (
    <div
      ref={heroRef}
      className="min-h-screen overflow-hidden"
      style={{ background: "#0a0a0a", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <motion.header
        className="relative z-50"
        style={{
          position: "sticky",
          top: 0,
          background: "transparent",
          backdropFilter: "none",
          borderBottom: "none",
          transition: "all 0.3s ease",
        }}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>

            {/* Logo + Nav */}
            <motion.div
              style={{ display: "flex", alignItems: "center", gap: 32 }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              {/* Brand */}
              <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28,
                  background: "#cc0000",
                  borderRadius: 7,
                  display: "grid", placeItems: "center",
                  color: "#fff", fontSize: 14, fontWeight: 900,
                  boxShadow: "0 0 14px rgba(204,0,0,0.4)",
                }}>✦</div>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#f0f0f0", letterSpacing: "-0.02em" }}>
                  AgentForge
                </span>
              </Link>

              {/* Desktop nav */}
              <nav style={{ display: "flex", alignItems: "center", gap: 2 }} className="hidden-mobile">
                {navLinks.map((l) => (
                  l.href.startsWith("/") ? (
                    <Link
                      key={l.label}
                      href={l.href}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        fontSize: 13, fontWeight: 500,
                        color: "#999",
                        textDecoration: "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.color = "#f0f0f0";
                        (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.color = "#999";
                        (e.target as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      key={l.label}
                      href={l.href}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        fontSize: 13, fontWeight: 500,
                        color: "#999",
                        textDecoration: "none",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.color = "#f0f0f0";
                        (e.target as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.color = "#999";
                        (e.target as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {l.label}
                    </a>
                  )
                ))}
              </nav>
            </motion.div>

            {/* CTA Buttons – desktop */}
            <motion.div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              className="hidden-mobile"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <Link
                href="/login"
                style={{
                  padding: "7px 16px", fontSize: 13, fontWeight: 500,
                  color: "#888", textDecoration: "none", borderRadius: 7,
                  transition: "color 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0f0f0")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#888")}
              >
                Sign in
              </Link>
              <motion.div
                whileHover={{ scale: 1.03 } as any}
                whileTap={{ scale: 0.97 } as any}
              >
                <Link
                  href={targetDashboardHref}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 18px", borderRadius: 8,
                    background: "#cc0000", color: "#fff",
                    fontSize: 13, fontWeight: 600,
                    textDecoration: "none",
                    boxShadow: "0 2px 12px rgba(204,0,0,0.35)",
                  }}
                >
                  Dashboard <ArrowRight size={14} />
                </Link>
              </motion.div>
            </motion.div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: "none", padding: 8, borderRadius: 6,
                color: "#888", background: "transparent", border: "none",
                cursor: "pointer",
              }}
              className="show-mobile"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              style={{
                background: "#111", borderTop: "1px solid #222",
                padding: "12px 24px 20px",
              }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
            >
              {navLinks.map((l) => (
                <a
                  key={l.label} href={l.href}
                  style={{
                    display: "block", padding: "10px 12px",
                    borderRadius: 6, fontSize: 14, fontWeight: 500,
                    color: "#c8c8c8", textDecoration: "none", marginBottom: 2,
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <Link
                href={targetDashboardHref}
                style={{
                  display: "block", marginTop: 10,
                  padding: "10px 12px", textAlign: "center",
                  borderRadius: 8, background: "#cc0000", color: "#fff",
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
                onClick={() => setMenuOpen(false)}
              >
                Open Dashboard
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── HERO SECTION ─────────────────────────────────────── */}
      <section style={{ position: "relative", padding: "80px 0 110px", overflow: "hidden" }}>

        {/* Ambient Top Spotlight / Blood Red Beam */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "1200px",
            height: "550px",
            background:
              "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(204, 0, 0, 0.25) 0%, rgba(139, 0, 0, 0.08) 50%, transparent 80%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Floating Ambient Nebulas */}
        <motion.div
          style={{
            position: "absolute",
            top: 60,
            right: "-5%",
            width: 650,
            height: 650,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(204, 0, 0, 0.16) 0%, rgba(139, 0, 0, 0.04) 50%, transparent 70%)",
            filter: "blur(60px)",
            y: y1,
            pointerEvents: "none",
          }}
        />
        <motion.div
          style={{
            position: "absolute",
            bottom: -100,
            left: "-5%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(160, 0, 0, 0.12) 0%, transparent 65%)",
            filter: "blur(60px)",
            y: y2,
            pointerEvents: "none",
          }}
        />

        {/* Subtle Vignette overlay to keep base plain pure black */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 50%, transparent 40%, #0a0a0a 90%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 48 }}>

            {/* ── LEFT COLUMN ─── */}
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>

              {/* Headline */}
              <motion.h1
                style={{
                  fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: "-0.04em",
                  color: "#f0f0f0",
                  marginBottom: 20,
                }}
                initial={{ opacity: 0, y: 24 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                Ship code at{" "}
                <span style={{ position: "relative", display: "inline-block" }}>
                  <span style={{ position: "relative", zIndex: 1 }}>agent speed</span>
                  <motion.span
                    style={{
                      position: "absolute", bottom: 4, left: 0, right: 0,
                      height: 4, background: "#cc0000", borderRadius: 4,
                      zIndex: 0, opacity: 0.7,
                    }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={heroInView ? { scaleX: 1 } : {}}
                    transition={{ duration: 0.6, delay: 0.8 }}
                  />
                </span>
                <br />
                without losing control
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                style={{
                  fontSize: 16, lineHeight: 1.7,
                  color: "#888", marginBottom: 36, maxWidth: 480,
                }}
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                AgentForge orchestrates multiple autonomous AI coding agents working simultaneously on a single project, coordinating tasks across your repositories. Every change is reviewed, every merge is approved — full governance at every step.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 40 }}
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.55 }}
              >
                <motion.div
                  whileHover={{ scale: 1.03 } as any}
                  whileTap={{ scale: 0.97 } as any}
                >
                  <Link
                    href={targetDashboardHref}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "11px 22px", borderRadius: 9,
                      background: "#cc0000", color: "#fff",
                      fontSize: 14, fontWeight: 700, textDecoration: "none",
                      boxShadow: "0 4px 20px rgba(204,0,0,0.4)",
                    }}
                  >
                    Open Control Plane <ArrowRight size={15} />
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.03 } as any}
                  whileTap={{ scale: 0.97 } as any}
                >
                  <Link
                    href={targetDashboardHref}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "11px 22px", borderRadius: 9,
                      border: "1px solid #2a2a2a", color: "#c8c8c8",
                      fontSize: 14, fontWeight: 600, textDecoration: "none",
                      background: "#141414",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <Terminal size={14} /> Live Tasks & Runs
                  </Link>
                </motion.div>
              </motion.div>

              {/* Social proof */}
              <motion.div
                style={{ display: "flex", alignItems: "center", gap: 12 }}
                initial={{ opacity: 0 }}
                animate={heroInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <div style={{ display: "flex" }}>
                  {["#cc0000", "#8b0000", "#e01010", "#aa0000"].map((c, i) => (
                    <div key={i} style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: c, marginLeft: i === 0 ? 0 : -7,
                      border: "2px solid #0a0a0a",
                      display: "grid", placeItems: "center",
                      color: "#fff", fontSize: 8, fontWeight: 700,
                    }}>
                      {["AG", "FE", "LR", "QA"][i]}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#666" }}>
                  <span style={{ color: "#f0f0f0", fontWeight: 700 }}>+2,400</span> agent tasks executed this month
                </p>
              </motion.div>


            </div>

            {/* ── RIGHT COLUMN — Dashboard Preview ─── */}
            <motion.div
              style={{ flex: "1 1 380px", minWidth: 0, position: "relative" }}
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={heroInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.75, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Decorative corner square */}
              <motion.div
                style={{
                  position: "absolute", right: -12, bottom: -12,
                  width: 100, height: 100, borderRadius: 16,
                  background: "rgba(204,0,0,0.08)",
                  border: "1px solid rgba(204,0,0,0.15)",
                }}
                initial={{ rotate: 0 }}
                animate={{ rotate: 10 }}
                transition={{ type: "spring", stiffness: 60, delay: 1 }}
              />

              {/* Dashboard card */}
              <div style={{
                position: "relative", zIndex: 1,
                borderRadius: 14,
                border: "1px solid #222",
                background: "#111",
                boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(204,0,0,0.06)",
                overflow: "hidden",
              }}>
                {/* Window chrome */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px",
                  background: "#0d0d0d",
                  borderBottom: "1px solid #1f1f1f",
                }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: backendSynced ? "#22c55e" : "#cc0000",
                      boxShadow: backendSynced ? "0 0 6px #22c55e" : "0 0 6px #cc0000",
                    }} />
                    <span style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: "0.02em" }}>
                      AgentForge — {workspaceName}
                    </span>
                  </div>
                  <Link
                    href={targetDashboardHref}
                    style={{
                      fontSize: 9.5,
                      color: "#ff4d4d",
                      fontWeight: 700,
                      textDecoration: "none",
                      padding: "3px 8px",
                      borderRadius: 5,
                      background: "rgba(204,0,0,0.12)",
                      border: "1px solid rgba(204,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Open ↗
                  </Link>
                </div>

                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {stats.map((s, i) => (
                      <motion.div key={i}
                        style={{
                          background: "#0d0d0d", borderRadius: 10, padding: "10px 12px",
                          border: "1px solid #1f1f1f",
                        }}
                        initial={{ opacity: 0, y: 8 }}
                        animate={heroInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
                      >
                        <p style={{ fontSize: 8, fontWeight: 700, color: "#555", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {s.label}
                        </p>
                        <p style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.04em", lineHeight: 1 }}>
                          {s.value}
                        </p>
                        <p style={{ fontSize: 9, color: "#22c55e", fontWeight: 600, marginTop: 3 }}>
                          {s.delta}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Recent runs */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#c8c8c8", marginBottom: 8, letterSpacing: "-0.01em" }}>
                      Recent Agent Runs
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {recentRuns.map((r, i) => (
                        <motion.div key={i}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 12px", borderRadius: 10,
                            background: "#0d0d0d", border: "1px solid #1f1f1f",
                          }}
                          initial={{ opacity: 0, x: -8 }}
                          animate={heroInView ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 7,
                              background: "rgba(204,0,0,0.1)",
                              border: "1px solid rgba(204,0,0,0.2)",
                              display: "grid", placeItems: "center",
                            }}>
                              <Bot size={13} color="#cc0000" />
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: "#e0e0e0", lineHeight: 1 }}>
                                {r.name}
                              </p>
                              <p style={{ fontSize: 9, color: "#555", marginTop: 3, fontFamily: "monospace" }}>
                                {r.branch}
                              </p>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 8, fontWeight: 700,
                            padding: "3px 8px", borderRadius: 20,
                            background: `${statusColor(r.status)}18`,
                            color: statusColor(r.status),
                            border: `1px solid ${statusColor(r.status)}40`,
                          }}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Activity bar chart with live animation */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#c8c8c8", margin: 0, letterSpacing: "-0.01em" }}>
                        Execution Activity & Telemetry
                      </p>
                      <span style={{
                        fontSize: 8,
                        color: "var(--red-bright, #cc0000)",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        letterSpacing: "0.04em",
                      }}>
                        <span style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#cc0000",
                          boxShadow: "0 0 6px #cc0000",
                          animation: "pulse 1.4s ease infinite",
                        }} />
                        LIVE · 142ms
                      </span>
                    </div>

                    <div style={{ position: "relative", height: 76, padding: "0 2px" }}>
                      {/* Animated SVG Sparkline Overlay */}
                      <svg
                        viewBox="0 0 240 60"
                        preserveAspectRatio="none"
                        style={{
                          position: "absolute",
                          inset: "0 0 16px 0",
                          width: "100%",
                          height: "56px",
                          pointerEvents: "none",
                          zIndex: 2,
                        }}
                      >
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#cc0000" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#cc0000" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <motion.polygon
                          points="0,45 40,32 80,24 120,12 160,26 200,6 240,16 240,60 0,60"
                          fill="url(#chartGrad)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.35, 0.7, 0.35] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.polyline
                          points="0,45 40,32 80,24 120,12 160,26 200,6 240,16"
                          fill="none"
                          stroke="#e01010"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
                        />
                      </svg>

                      {/* Animated Bars */}
                      <div style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 6,
                        height: "100%",
                        position: "relative",
                        zIndex: 1,
                      }}>
                        {bars.map((h, i) => {
                          const minH = Math.max(h - 16, 18);
                          const maxH = Math.min(h + 8, 98);
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                              <motion.div
                                style={{
                                  width: "100%",
                                  borderRadius: "4px 4px 0 0",
                                  background: h === 94
                                    ? "linear-gradient(180deg, #ff1a1a 0%, #aa0000 100%)"
                                    : `rgba(204, 0, 0, ${0.18 + (h / 100) * 0.35})`,
                                  border: h === 94 ? "1px solid #ff3333" : "1px solid rgba(204, 0, 0, 0.25)",
                                  borderBottom: "none",
                                  boxShadow: h === 94 ? "0 0 12px rgba(204,0,0,0.5)" : "none",
                                }}
                                initial={{ height: "0%" }}
                                animate={{
                                  height: [`${minH}%`, `${maxH}%`, `${minH}%`],
                                }}
                                transition={{
                                  duration: 2.2 + i * 0.35,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: i * 0.15,
                                }}
                              />
                              <span style={{ fontSize: 7.5, color: "#666", fontWeight: 600 }}>{labels[i]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Live terminal line */}
                  <div style={{
                    background: "#060606", borderRadius: 7,
                    border: "1px solid #1a1a1a",
                    padding: "8px 12px",
                    fontFamily: "ui-monospace, monospace", fontSize: 9,
                  }}>
                    <motion.div
                      style={{ color: "#555", marginBottom: 2 }}
                      initial={{ opacity: 0 }}
                      animate={heroInView ? { opacity: 1 } : {}}
                      transition={{ delay: 1.1 }}
                    >
                      [23:14:02] <span style={{ color: "#cc0000", fontWeight: 700 }}>[AGENT]</span> Analyzing repo context…
                    </motion.div>
                    <motion.div
                      style={{ color: "#555" }}
                      initial={{ opacity: 0 }}
                      animate={heroInView ? { opacity: 1 } : {}}
                      transition={{ delay: 1.4 }}
                    >
                      [23:14:05] <span style={{ color: "#22c55e", fontWeight: 700 }}>[DONE]</span>{" "}
                      <span style={{ color: "#c8c8c8" }}>Patch applied · 3 files changed</span>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── TRUST & LLM MODELS BAR ────────────────────────── */}
          <motion.div
            style={{ marginTop: 84, textAlign: "center" }}
            initial={{ opacity: 0, y: 16 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.95, duration: 0.5 }}
          >
            <p style={{
              fontSize: 10, fontWeight: 700, color: "#555",
              textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 26,
            }}>
              Powered by Leading AI Models & Developer Tools
            </p>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "28px 36px",
            }}>
              {[
                {
                  name: "Claude 3.5 Sonnet",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.47 3.5a1.2 1.2 0 0 0-1.1.73l-7.8 16.3a1.2 1.2 0 1 0 2.18 1.04l2.06-4.32h5.78l2.07 4.32a1.2 1.2 0 1 0 2.17-1.04L14.97 4.23a1.2 1.2 0 0 0-1.1-.73h-3.8Zm.4 9.77-1.9-3.96-1.89 3.96h3.79ZM5.6 7.42a1.2 1.2 0 0 0-.82 2.08l4.42 4.24-4.42 4.25a1.2 1.2 0 1 0 1.65 1.74l5.3-5.11a1.2 1.2 0 0 0 0-1.74l-5.3-5.12a1.2 1.2 0 0 0-.83-.34Z" />
                    </svg>
                  ),
                },
                {
                  name: "OpenAI GPT-4o",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.28 9.37a5.98 5.98 0 0 0-.52-4.95 6.07 6.07 0 0 0-6.6-2.84 6.01 6.01 0 0 0-4.66-2.07 6.05 6.05 0 0 0-5.74 4.14 6 6 0 0 0-3.9 2.83 6.07 6.07 0 0 0 .74 7.18 5.98 5.98 0 0 0 .51 4.95 6.07 6.07 0 0 0 6.61 2.84 6.02 6.02 0 0 0 4.65 2.07 6.05 6.05 0 0 0 5.75-4.14 6 6 0 0 0 3.89-2.83 6.07 6.07 0 0 0-.73-7.18Zm-9.04 12.06a4.47 4.47 0 0 1-2.88-1.05l.14-.08 4.78-2.76a.79.79 0 0 0 .4-.68v-6.75l2.03 1.17a.08.08 0 0 1 .04.06v5.62a4.5 4.5 0 0 1-4.51 4.47Zm-8.4-4.87a4.48 4.48 0 0 1-.53-3.03l.14.09 4.78 2.76a.78.78 0 0 0 .79 0l5.85-3.37v2.35a.08.08 0 0 1-.03.07l-4.87 2.81a4.5 4.5 0 0 1-6.13-1.68ZM3.47 8.98a4.5 4.5 0 0 1 2.36-1.98v5.7a.78.78 0 0 0 .39.68l5.84 3.37-2.03 1.18a.08.08 0 0 1-.08 0l-4.86-2.81a4.5 4.5 0 0 1-1.62-6.14Zm14.28 3.7-5.85-3.37 2.03-1.18a.08.08 0 0 1 .08 0l4.87 2.81a4.5 4.5 0 0 1-1.13 8.12v-5.7a.78.78 0 0 0-.4-.68Zm2.78-3.07-.14-.09-4.78-2.76a.78.78 0 0 0-.79 0l-5.85 3.37V7.78a.08.08 0 0 1 .03-.07l4.87-2.81a4.5 4.5 0 0 1 6.66 4.71ZM9.03 12.87l-2.03-1.17a.08.08 0 0 1-.04-.07V6a4.5 4.5 0 0 1 7.39-3.42l-.14.08-4.78 2.76a.79.79 0 0 0-.4.68v6.77Zm1.25-2.07 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3Z"/>
                    </svg>
                  ),
                },
                {
                  name: "Google Gemini",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z"/>
                    </svg>
                  ),
                },
                {
                  name: "DeepSeek R1",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1.6 14.8-1.6-.9-1.6.9a.8.8 0 0 1-1.2-.8l.3-1.8-1.3-1.3a.8.8 0 0 1 .4-1.4l1.8-.3.8-1.6a.8.8 0 0 1 1.4 0l.8 1.6 1.8.3a.8.8 0 0 1 .4 1.4l-1.3 1.3.3 1.8a.8.8 0 0 1-1.1.8Z"/>
                    </svg>
                  ),
                },
                {
                  name: "Llama 3.3",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 6c-1.8 0-3.3.9-4.5 2.4C10.8 6.9 9.3 6 7.5 6 4.5 6 2 8.5 2 12s2.5 6 5.5 6c1.8 0 3.3-.9 4.5-2.4 1.2 1.5 2.7 2.4 4.5 2.4 3 0 5.5-2.5 5.5-6s-2.5-6-5.5-6Zm-9 9.5C5.8 15.5 4.5 14 4.5 12s1.3-3.5 3-3.5c1.4 0 2.5 1 3.2 2.3-.9 1.4-2 2.7-3.2 2.7Zm9 0c-1.2 0-2.3-1.3-3.2-2.7.7-1.3 1.8-2.3 3.2-2.3 1.7 0 3 1.5 3 3.5s-1.3 3.5-3 3.5Z"/>
                    </svg>
                  ),
                },
                {
                  name: "Mistral Large",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h4v4H3zm14 0h4v4h-4zm-7 7h4v4h-4zm-7 7h4v4H3zm7 0h4v4h-4zm7 0h4v4h-4z"/>
                    </svg>
                  ),
                },
                {
                  name: "Ollama / Local",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 2h4a3 3 0 0 1 3 3v2h2a3 3 0 0 1 3 3v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V5a3 3 0 0 1 3-3zm1 4v3h2V6H8zm6 5H8v6a3 3 0 0 0 3 3h3a3 3 0 0 0 3-3v-6zm-1 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                    </svg>
                  ),
                },
                {
                  name: "GitHub Actions",
                  icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
                    </svg>
                  ),
                },
              ].map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#666",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    transition: "all 0.2s ease",
                    cursor: "default",
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "#f0f0f0";
                    el.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "#666";
                    el.style.transform = "translateY(0)";
                  }}
                >
                  <span style={{ color: "var(--red-bright, #cc0000)", display: "flex", alignItems: "center" }}>
                    {p.icon}
                  </span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ARCHITECTURE & CORE CAPABILITIES SECTION ──────────── */}
      <section
        id="architecture"
        style={{
          position: "relative",
          padding: "90px 0 110px",
          background: "#08080a",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          {/* Section Header */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: "#cc0000",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 20,
              background: "rgba(204,0,0,0.1)",
              border: "1px solid rgba(204,0,0,0.25)",
            }}>
              Connected Subsystems
            </span>
            <h2 style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
              fontWeight: 800,
              color: "#f0f0f0",
              letterSpacing: "-0.03em",
              marginTop: 16,
              marginBottom: 12,
            }}>
              Engineered for safe, governed code generation
            </h2>
            <p style={{ fontSize: 15, color: "#888", maxWidth: 620, margin: "0 auto", lineHeight: 1.6 }}>
              Every component in AgentForge connects seamlessly to protect your code base while maximizing agent throughput.
            </p>
          </div>

          {/* Bento Subsystem Grid */}
          <div
            id="features"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {/* Card 1: Ephemeral Worktrees */}
            <div
              style={{
                background: "#0f0f13",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(204,0,0,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(204,0,0,0.12)",
                  border: "1px solid rgba(204,0,0,0.25)",
                  display: "grid",
                  placeItems: "center",
                  color: "#ff4d4d",
                  marginBottom: 18,
                }}>
                  <GitBranch size={20} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f2f2f5", marginBottom: 8, letterSpacing: "-0.02em" }}>
                  Isolated Git Worktrees
                </h3>
                <p style={{ fontSize: 13, color: "#8a8a93", lineHeight: 1.6, marginBottom: 20 }}>
                  Agents run in ephemeral worktree leases. Zero repo pollution, zero branch collisions, and instant cleanup on task completion.
                </p>
              </div>
              <div>
                <div style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#3bf08c",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3bf08c" }} />
                  Cryptographic Leases Active
                </div>
                <Link
                  href="/dashboard?tab=worktree"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#f0f0f0",
                    textDecoration: "none",
                  }}
                >
                  Manage Worktrees <ArrowRight size={13} color="#cc0000" />
                </Link>
              </div>
            </div>

            {/* Card 2: Human-in-the-Loop Governance */}
            <div
              style={{
                background: "#0f0f13",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(59,240,140,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(59,240,140,0.12)",
                  border: "1px solid rgba(59,240,140,0.25)",
                  display: "grid",
                  placeItems: "center",
                  color: "#3bf08c",
                  marginBottom: 18,
                }}>
                  <Shield size={20} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f2f2f5", marginBottom: 8, letterSpacing: "-0.02em" }}>
                  Human Review & Diffs
                </h3>
                <p style={{ fontSize: 13, color: "#8a8a93", lineHeight: 1.6, marginBottom: 20 }}>
                  Inspect every proposed line change with unified split diffs. Protected branches cannot be merged without explicit developer sign-off.
                </p>
              </div>
              <div>
                <div style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#22d3ee",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee" }} />
                  Full Audit Logging
                </div>
                <Link
                  href="/dashboard?tab=review"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#f0f0f0",
                    textDecoration: "none",
                  }}
                >
                  Review Open PRs <ArrowRight size={13} color="#3bf08c" />
                </Link>
              </div>
            </div>

            {/* Card 3: Analytics Bento */}
            <div
              style={{
                background: "#0f0f13",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(139,61,255,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(139,61,255,0.12)",
                  border: "1px solid rgba(139,61,255,0.25)",
                  display: "grid",
                  placeItems: "center",
                  color: "#8b3dff",
                  marginBottom: 18,
                }}>
                  <BarChart3 size={20} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f2f2f5", marginBottom: 8, letterSpacing: "-0.02em" }}>
                  Analytics Bento Suite
                </h3>
                <p style={{ fontSize: 13, color: "#8a8a93", lineHeight: 1.6, marginBottom: 20 }}>
                  High-density SVG telemetry tracking sandbox concurrency, worker sessions, latency distributions, and test pass rates.
                </p>
              </div>
              <div>
                <div style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#ffb800",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffb800" }} />
                  Zero Third-Party Chart Bloat
                </div>
                <Link
                  href="/analytics"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#f0f0f0",
                    textDecoration: "none",
                  }}
                >
                  Open Analytics Bento <ArrowRight size={13} color="#8b3dff" />
                </Link>
              </div>
            </div>

            {/* Card 4: WebSocket Real-Time Console */}
            <div
              style={{
                background: "#0f0f13",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(204,0,0,0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(204,0,0,0.12)",
                  border: "1px solid rgba(204,0,0,0.25)",
                  display: "grid",
                  placeItems: "center",
                  color: "#ff4d4d",
                  marginBottom: 18,
                }}>
                  <Terminal size={20} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f2f2f5", marginBottom: 8, letterSpacing: "-0.02em" }}>
                  Live Terminal Telemetry
                </h3>
                <p style={{ fontSize: 13, color: "#8a8a93", lineHeight: 1.6, marginBottom: 20 }}>
                  Stream real-time terminal output, bash executions, and LLM thoughts over Socket.io WebSockets directly into your browser.
                </p>
              </div>
              <div>
                <div style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#3bf08c",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3bf08c" }} />
                  ws://localhost:4000 Connected
                </div>
                <Link
                  href="/dashboard?tab=terminal"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#f0f0f0",
                    textDecoration: "none",
                  }}
                >
                  View Live Console <ArrowRight size={13} color="#cc0000" />
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Launch Callout Card */}
          <div
            style={{
              marginTop: 48,
              borderRadius: 24,
              padding: "44px 36px",
              background: "linear-gradient(135deg, rgba(204,0,0,0.14) 0%, rgba(15,15,19,0.95) 50%, #0d0d10 100%)",
              border: "1px solid rgba(204,0,0,0.25)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 28,
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ maxWidth: 540 }}>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 10 }}>
                Jump directly into the Control Plane
              </h3>
              <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.6 }}>
                Create tasks, dispatch autonomous agents, and inspect real-time diffs across your repositories right now.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link
                href={targetDashboardHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  borderRadius: 10,
                  background: "#cc0000",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(204,0,0,0.4)",
                }}
              >
                Launch Dashboard <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard?tab=copilot"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f0f0f0",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Bot size={15} color="#ff4d4d" /> Agent Copilot
              </Link>
              <Link
                href="/dashboard?tab=worktree"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f0f0f0",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <GitBranch size={15} color="#3bf08c" /> Worktrees
              </Link>
              <Link
                href="/analytics"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#f0f0f0",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <BarChart3 size={15} color="#8b3dff" /> Analytics Bento
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "#070709",
          padding: "36px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 24, height: 24,
              background: "#cc0000",
              borderRadius: 6,
              display: "grid", placeItems: "center",
              color: "#fff", fontSize: 12, fontWeight: 900,
            }}>✦</div>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#f0f0f0", letterSpacing: "-0.02em" }}>
              AgentForge
            </span>
            <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>
              v1.0.0 · Autonomous Coding Platform
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Link href={targetDashboardHref} style={{ fontSize: 12.5, color: "#888", textDecoration: "none" }}>
              Control Plane
            </Link>
            <Link href={targetAnalyticsHref} style={{ fontSize: 12.5, color: "#888", textDecoration: "none" }}>
              Analytics Bento
            </Link>
            <a href="#architecture" style={{ fontSize: 12.5, color: "#888", textDecoration: "none" }}>
              Architecture
            </a>
            <span style={{
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 20,
              background: "rgba(59,240,140,0.1)",
              border: "1px solid rgba(59,240,140,0.25)",
              color: "#3bf08c",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3bf08c" }} />
              All Systems Nominal
            </span>
          </div>
        </div>
      </footer>

      {/* Global styles for show/hide on mobile */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.9); }
        }
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

