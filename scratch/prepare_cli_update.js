const fs = require('fs');

let page = fs.readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');

// 1. Add SQUAD_AGENTS constant and studioTargetAgent state
const squadAgentsDef = `
// ── Agent Squad Models & Roles Definition ─────────────────────────
export interface SquadAgentConfig {
  id: string;
  name: string;
  handle: string;
  model: string;
  provider: string;
  ctx: string;
  role: string;
  status: string;
  badge: string;
  color: string;
}

const SQUAD_AGENTS: Record<string, SquadAgentConfig> = {
  SQUAD: {
    id: "SQUAD",
    name: "Full Squad Pipeline",
    handle: "@squad",
    model: "Multi-Model Pipeline",
    provider: "Claude + Gemini + DeepSeek + GPT-4o",
    ctx: "Orchestrated",
    role: "Sequential execution (Architect → Dev → Test → Sec)",
    status: "Orchestrated",
    badge: "Squad",
    color: "#10b981",
  },
  DEVELOPER: {
    id: "DEVELOPER",
    name: "Developer",
    handle: "@developer",
    model: "Gemini 2.0 Flash",
    provider: "Google",
    ctx: "1M Context",
    role: "Code Generation & Worktree Patching",
    status: "Running · 1:58",
    badge: "Gemini 2.0",
    color: "#34d399",
  },
  ARCHITECT: {
    id: "ARCHITECT",
    name: "Architect",
    handle: "@architect",
    model: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    ctx: "200k Context",
    role: "System Decomposition & AST Interfaces",
    status: "Done · 0:42",
    badge: "Claude 3.7",
    color: "#7CFF5B",
  },
  TESTER: {
    id: "TESTER",
    name: "Tester",
    handle: "@tester",
    model: "DeepSeek R1",
    provider: "DeepSeek",
    ctx: "64k Reasoning",
    role: "Vitest Assertions & Regression Tests",
    status: "Queued",
    badge: "DeepSeek R1",
    color: "#FFB800",
  },
  SECURITY: {
    id: "SECURITY",
    name: "Security Auditor",
    handle: "@security",
    model: "GPT-4o",
    provider: "OpenAI",
    ctx: "128k Context",
    role: "AST Taint Analysis & Secret Detection",
    status: "Queued",
    badge: "GPT-4o",
    color: "#FF5A1F",
  },
};
`;

// Insert SQUAD_AGENTS right before DashboardPage
page = page.replace('export default function DashboardPage() {', squadAgentsDef + '\nexport default function DashboardPage() {');

// Add studioTargetAgent state right after studioPrompt state
page = page.replace(
  'const [studioPrompt, setStudioPrompt] = useState<string>("");',
  `const [studioPrompt, setStudioPrompt] = useState<string>("");
  const [studioTargetAgent, setStudioTargetAgent] = useState<"SQUAD" | "DEVELOPER" | "ARCHITECT" | "TESTER" | "SECURITY">("SQUAD");`
);

// 2. Replace handleExecuteStudioPrompt definition
const oldExecRegex = /const handleExecuteStudioPrompt = \(customPrompt\?: string\) => {[\s\S]*?};[\s\r\n]*\/\/ ── Provider API Key Management/;

const newExecCode = `const handleExecuteStudioPrompt = (customPrompt?: string, forcedTarget?: string) => {
    const prompt = customPrompt || studioPrompt.trim();
    if (!prompt) return;

    const target = forcedTarget || studioTargetAgent;
    setIsStudioExecuting(true);

    const time = new Date().toLocaleTimeString();

    if (target === "DEVELOPER") {
      setActiveSquadStep("DEVELOPER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: \`$ agentforge dispatch --target @developer --model gemini-2.0-flash "\${prompt}"\` },
        { id: Math.random().toString(), time, type: "DEVELOPER", message: \`[Developer @ Gemini 2.0] Analyzing worktree wt-9f18a24c and AST targets...\` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: \`[Developer @ Gemini 2.0] Patch generated and applied to src/auth/session.ts (+18, -6).\` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        setActionSuccessMsg(\`Developer (Gemini 2.0) finished patch for "\${prompt.slice(0, 30)}..."!\`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }, 1400);
    } else if (target === "ARCHITECT") {
      setActiveSquadStep("ARCHITECT");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: \`$ agentforge dispatch --target @architect --model claude-3-7-sonnet "\${prompt}"\` },
        { id: Math.random().toString(), time, type: "ARCHITECT", message: \`[Architect @ Claude 3.7] Decomposing system architecture and generating contract in types.ts...\` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "ARCHITECT", message: \`[Architect @ Claude 3.7] Interface specification drafted. Zero breaking changes.\` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        setActionSuccessMsg(\`Architect (Claude 3.7) completed architectural specification!\`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }, 1400);
    } else if (target === "TESTER") {
      setActiveSquadStep("TESTER");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: \`$ agentforge dispatch --target @tester --model deepseek-r1 "\${prompt}"\` },
        { id: Math.random().toString(), time, type: "TESTER", message: \`[Tester @ DeepSeek R1] Formulating Vitest test matrix for timeout & boundary conditions...\` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: \`[Tester @ DeepSeek R1] 14/14 tests passing (281ms). Zero regression failures.\` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        setActionSuccessMsg(\`Tester (DeepSeek R1) completed test harness verification!\`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }, 1400);
    } else if (target === "SECURITY") {
      setActiveSquadStep("SECURITY");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: \`$ agentforge dispatch --target @security --model gpt-4o "\${prompt}"\` },
        { id: Math.random().toString(), time, type: "SECURITY", message: \`[Security @ GPT-4o] Performing AST taint analysis & secret scan in worktree sandbox...\` },
      ]);
      setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "SECURITY", message: \`[Security @ GPT-4o] Static audit passed. Zero API keys leaked. Authorization intact.\` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        setActionSuccessMsg(\`Security (GPT-4o) completed security gate audit!\`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }, 1400);
    } else {
      // Full Squad Pipeline
      setActiveSquadStep("ARCHITECT");
      setTerminalLogs((prev) => [
        ...prev,
        { id: Math.random().toString(), time, type: "PROMPT", message: \`$ agentforge run --squad full-stack "\${prompt}"\` },
        { id: Math.random().toString(), time, type: "ARCHITECT", message: \`[Architect @ Claude 3.7] Reading codebase AST and generating interface contract...\` },
      ]);

      setTimeout(() => {
        setActiveSquadStep("DEVELOPER");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: \`[Developer @ Gemini 2.0] git worktree add .agentforge/wt-9f18a2 -b fix/auth-timeout\` },
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "DEVELOPER", message: \`[Developer @ Gemini 2.0] Implemented AbortController guard in src/auth/session.ts\` },
        ]);
      }, 800);

      setTimeout(() => {
        setActiveSquadStep("TESTER");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: \`[Tester @ DeepSeek R1] Running test harness: vitest run src/auth/session.test.ts\` },
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "TESTER", message: \`[Tester @ DeepSeek R1] 14/14 tests passing. Zero regressions in worktree sandbox.\` },
        ]);
      }, 1600);

      setTimeout(() => {
        setActiveSquadStep("SECURITY");
        setTerminalLogs((prev) => [
          ...prev,
          { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type: "SECURITY", message: \`[Security @ GPT-4o] Static analysis passed. Zero token leaks. Ready for review.\` },
        ]);
        setIsStudioExecuting(false);
        setActiveSquadStep("IDLE");
        setActionSuccessMsg("Agent Squad successfully drafted and verified the patch across all 4 models!");
        setTimeout(() => setActionSuccessMsg(null), 3500);
      }, 2400);
    }

    if (!customPrompt) setStudioPrompt("");
  };

  // ── Provider API Key Management`;

page = page.replace(oldExecRegex, newExecCode);

// 3. Now replace the CLI Studio view (activeTab === "studio")
const oldStudioRegex = /{\/\* ═════════════════════════════════════════════════════════ \*\/[\s\S]*?{\/\* SCREEN 1: AGENT CLI STUDIO & LIVE SQUAD RUNNER[\s\S]*?{\/\* ═════════════════════════════════════════════════════════ \*\/[\s\S]*?{\/\* SCREEN 2: DASHBOARD/;

const newStudioView = `{\/* ═════════════════════════════════════════════════════════ *\/}
          {\/* SCREEN 1: AGENT CLI STUDIO & LIVE SQUAD RUNNER           *\/}
          {\/* ═════════════════════════════════════════════════════════ *\/}
          {activeTab === "studio" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Top Row: System Header & Active Worktree Status */}
              <div
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                    Agent CLI Studio · Command & Orchestration Deck
                  </h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
                    Route commands to specialized agent roles backed by frontier foundation models
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                    <span style={{ fontSize: "11.5px", fontFamily: "var(--font-mono, monospace)", color: "#10b981" }}>
                      wt-9f18a24c · fix/auth-timeout
                    </span>
                  </div>
                  <button className="btn" onClick={() => setActiveTab("split")} style={{ fontSize: "11.5px" }}>
                    Split View ↗
                  </button>
                </div>
              </div>

              {/* ── AGENT ROSTER & MODEL ASSIGNMENT MANIFEST ────────── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Active Squad Roster · Click to target specific agent
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Target: <b style={{ color: SQUAD_AGENTS[studioTargetAgent].color }}>{SQUAD_AGENTS[studioTargetAgent].name}</b> ({SQUAD_AGENTS[studioTargetAgent].model})
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                  {[
                    SQUAD_AGENTS.SQUAD,
                    SQUAD_AGENTS.ARCHITECT,
                    SQUAD_AGENTS.DEVELOPER,
                    SQUAD_AGENTS.TESTER,
                    SQUAD_AGENTS.SECURITY,
                  ].map((ag) => {
                    const isTarget = studioTargetAgent === ag.id;
                    return (
                      <div
                        key={ag.id}
                        onClick={() => setStudioTargetAgent(ag.id as any)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "12px",
                          background: isTarget ? "rgba(255,255,255,0.08)" : "#0e0e12",
                          border: isTarget ? \`1.5px solid \${ag.color}\` : "1px solid #23232a",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          transition: "all 0.15s ease",
                          boxShadow: isTarget ? \`0 0 14px -4px \${ag.color}44\` : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ag.color }} />
                            <span style={{ fontSize: "13px", fontWeight: 700, color: isTarget ? "#fff" : "var(--text)" }}>
                              {ag.name}
                            </span>
                          </div>
                          <span
                            className="pill"
                            style={{
                              fontSize: "9.5px",
                              borderColor: isTarget ? \`\${ag.color}55\` : "var(--border)",
                              color: isTarget ? ag.color : "var(--muted)",
                              background: isTarget ? \`\${ag.color}15\` : "transparent",
                            }}
                          >
                            {ag.badge}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          <span style={{ fontFamily: "var(--font-mono, monospace)", color: isTarget ? ag.color : "var(--text-2)" }}>
                            {ag.model}
                          </span>
                          <span style={{ fontSize: "10px", opacity: 0.8 }}>{ag.ctx}</span>
                        </div>

                        <span style={{ fontSize: "10.5px", color: "var(--muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginTop: "2px" }}>
                          {ag.role}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── COMMAND DECK & PROMPT WORKSPACE (SYSTEM DESIGN) ── */}
              <div
                style={{
                  background: "#08080a",
                  border: "1px solid #1f1f26",
                  borderRadius: "var(--radius-card)",
                  overflow: "hidden",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Command Deck Header: Routing Target & Directive Flags */}
                <div
                  style={{
                    background: "#0e0e12",
                    padding: "12px 18px",
                    borderBottom: "1px solid #1a1a20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Routing:
                    </span>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "8px",
                        background: \`\${SQUAD_AGENTS[studioTargetAgent].color}22\`,
                        border: \`1px solid \${SQUAD_AGENTS[studioTargetAgent].color}55\`,
                        color: SQUAD_AGENTS[studioTargetAgent].color,
                        fontSize: "12px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {SQUAD_AGENTS[studioTargetAgent].handle || SQUAD_AGENTS[studioTargetAgent].name} &rarr; {SQUAD_AGENTS[studioTargetAgent].model}
                    </span>
                  </div>

                  {/* Directive Chips (Quick Command Modifiers) */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { label: "--branch fix/auth-timeout", val: " --branch fix/auth-timeout" },
                      { label: "--strict-types", val: " --strict-types" },
                      { label: "--vitest-coverage", val: " --vitest-coverage" },
                    ].map((flag) => (
                      <button
                        key={flag.label}
                        type="button"
                        onClick={() => setStudioPrompt((prev) => prev + flag.val)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#14141a",
                          border: "1px solid #282832",
                          color: "var(--muted)",
                          fontSize: "10.5px",
                          fontFamily: "var(--font-mono, monospace)",
                          cursor: "pointer",
                        }}
                      >
                        + {flag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multiline Prompt Workspace Area */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ position: "relative" }}>
                    <textarea
                      rows={3}
                      value={studioPrompt}
                      onChange={(e) => setStudioPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleExecuteStudioPrompt();
                        }
                      }}
                      placeholder={\`Specify detailed engineering instructions for \${SQUAD_AGENTS[studioTargetAgent].name} (\${SQUAD_AGENTS[studioTargetAgent].model})...\\ne.g. In src/auth/session.ts, wrap token refresh in an AbortController with a 5000ms timeout guard and write matching vitest assertions in session.test.ts\`}
                      style={{
                        width: "100%",
                        background: "#0d0d12",
                        border: "1px solid #282834",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        color: "var(--text)",
                        fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                        fontSize: "12.5px",
                        lineHeight: "1.6",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Actions & Preset Shortcuts Bar */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    {/* Quick Presets */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Quick commands:</span>
                      {[
                        { label: "⚡ Fix Auth Timeout", target: "DEVELOPER", prompt: "Fix auth timeout on token refresh in src/auth/session.ts" },
                        { label: "🧪 Run All Tests", target: "TESTER", prompt: "Run vitest test harness across all packages with coverage" },
                        { label: "🛡️ Security Audit", target: "SECURITY", prompt: "Audit packages for token leaks, AST taint, and secret exposures" },
                        { label: "📐 System Spec", target: "ARCHITECT", prompt: "Decompose payment webhook architecture and draft interface contract" },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          className="btn"
                          style={{ padding: "3px 10px", fontSize: "11px", borderRadius: "14px" }}
                          onClick={() => {
                            setStudioTargetAgent(chip.target as any);
                            setStudioPrompt(chip.prompt);
                            handleExecuteStudioPrompt(chip.prompt, chip.target);
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    {/* Dispatch Button & Clear */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10.5px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        ⌘+Enter to dispatch
                      </span>
                      {studioPrompt && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setStudioPrompt("")}
                          style={{ fontSize: "11px", padding: "6px 10px" }}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn primary"
                        disabled={isStudioExecuting}
                        onClick={() => handleExecuteStudioPrompt()}
                        style={{ minWidth: "150px", padding: "8px 16px", fontWeight: 700 }}
                      >
                        {isStudioExecuting
                          ? "Executing..."
                          : \`Dispatch to \${SQUAD_AGENTS[studioTargetAgent].handle || "Squad"} →\`}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── STREAMING TERMINAL LOGS WINDOW ─────────────────── */}
                <div style={{ borderTop: "1px solid #1a1a20", background: "#060608" }}>
                  <div
                    style={{
                      background: "#0c0c10",
                      padding: "8px 16px",
                      borderBottom: "1px solid #181820",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ff5f56" }} />
                      <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ffbd2e" }} />
                      <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#27c93f" }} />
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        agentforge-daemon · live event bus & tool calls
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        className="btn"
                        style={{ padding: "2px 8px", fontSize: "10px" }}
                        onClick={() => setTerminalLogs([])}
                      >
                        Clear Terminal
                      </button>
                      <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                        {terminalLogs.length} events
                      </span>
                    </div>
                  </div>

                  {/* Terminal Log Lines */}
                  <div
                    style={{
                      height: "320px",
                      overflowY: "auto",
                      padding: "16px",
                      fontFamily: "var(--font-mono, 'Geist Mono', monospace)",
                      fontSize: "12px",
                      lineHeight: "1.7",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {terminalLogs.map((log) => {
                      let color = "#ededf0";
                      let badgeBg = "rgba(255,255,255,0.08)";
                      if (log.type === "ARCHITECT") {
                        color = "#7CFF5B";
                        badgeBg = "rgba(124,255,91,0.15)";
                      } else if (log.type === "DEVELOPER") {
                        color = "#8B3DFF";
                        badgeBg = "rgba(139,61,255,0.15)";
                      } else if (log.type === "TESTER") {
                        color = "#FFB800";
                        badgeBg = "rgba(255,184,0,0.15)";
                      } else if (log.type === "SECURITY") {
                        color = "#FF5A1F";
                        badgeBg = "rgba(255,90,31,0.15)";
                      } else if (log.type === "PROMPT") {
                        color = "#22d3ee";
                        badgeBg = "rgba(34,211,238,0.15)";
                      } else if (log.type === "SUCCESS") {
                        color = "#10b981";
                        badgeBg = "rgba(16,185,129,0.15)";
                      }

                      return (
                        <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <span style={{ color: "#54545d", minWidth: "65px", userSelect: "none" }}>{log.time}</span>
                          <span
                            style={{
                              background: badgeBg,
                              color,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 700,
                              minWidth: "75px",
                              textAlign: "center",
                            }}
                          >
                            {log.type}
                          </span>
                          <span style={{ color, wordBreak: "break-all" }}>{log.message}</span>
                        </div>
                      );
                    })}
                    {isStudioExecuting && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: SQUAD_AGENTS[studioTargetAgent].color, marginTop: "4px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SQUAD_AGENTS[studioTargetAgent].color, boxShadow: \`0 0 6px \${SQUAD_AGENTS[studioTargetAgent].color}\` }} />
                        <span style={{ fontStyle: "italic" }}>
                          Executing: {SQUAD_AGENTS[studioTargetAgent].name} ({SQUAD_AGENTS[studioTargetAgent].model}) in worktree wt-9f18a24c...
                        </span>
                      </div>
                    )}
                    <div ref={termEndRef} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* SCREEN 2: DASHBOARD`;

page = page.replace(oldStudioRegex, newStudioView);

fs.writeFileSync('apps/web/src/app/dashboard/page.tsx', page, 'utf8');
console.log('Successfully upgraded CLI Studio with Systems Design Command Deck & Agent Roster!');
`;

fs.writeFileSync('scratch/update_cli_studio.js', page, 'utf8');

