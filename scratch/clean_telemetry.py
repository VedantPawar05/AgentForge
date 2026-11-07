# -*- coding: utf-8 -*-
with open(r"scratch/build_dashboard.py", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Remove ultra-low token cost from DeepSeek
text = text.replace(
    'Deep mathematical reasoning and code generation with ultra-low token cost.',
    'Deep mathematical reasoning and high-precision code generation.'
)

# 2. Replace TELEMETRY_RANGES
text = text.replace(
    'tokensUsed: "1.14M",\n    tokensDelta: "+2% vs prior",\n    apiSpend: "$9.10",\n    spendBudget: "45% of budget",',
    'sandboxesActive: 3,\n    sandboxesDelta: "+1 vs prior",\n    testPassRate: "99.2%",\n    testPassDelta: "+0.6 pts",'
)
text = text.replace(
    'tokensUsed: "4.82M",\n    tokensDelta: "+4% vs prior",\n    apiSpend: "$38.40",\n    spendBudget: "62% of budget",',
    'sandboxesActive: 3,\n    sandboxesDelta: "+1 vs prior",\n    testPassRate: "99.4%",\n    testPassDelta: "+1.8 pts",'
)
text = text.replace(
    'tokensUsed: "16.4M",\n    tokensDelta: "+9% vs prior",\n    apiSpend: "$124.80",\n    spendBudget: "78% of budget",',
    'sandboxesActive: 3,\n    sandboxesDelta: "+1 vs prior",\n    testPassRate: "98.9%",\n    testPassDelta: "+1.2 pts",'
)

# 3. Replace the 4 KPI cards in Dashboard
old_kpi = """              {/* 4 Bento KPI Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Tasks completed</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksCompleted}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Across all squads</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Tokens consumed</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].tokensUsed}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].tokensDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Input + output tokens</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>API spend</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].apiSpend}
                    </span>
                    <span style={{ fontSize: "12px", color: "#9a9aa6" }}>
                      {TELEMETRY_RANGES[telemetryRange].spendBudget}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Frontier models total</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Merge rate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeRate}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>First-pass sign-off</span>
                </div>
              </div>"""

new_kpi = """              {/* 4 Bento KPI Cards - Engineering Telemetry */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Tasks Completed</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksCompleted}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].tasksDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Across all squads</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Active Sandboxes</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].sandboxesActive}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].sandboxesDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Isolated Git worktrees</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Test Harness Pass Rate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].testPassRate}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].testPassDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Zero test regressions</span>
                </div>

                <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>Merge Rate</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 600, fontFamily: "var(--font-mono, monospace)" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeRate}
                    </span>
                    <span style={{ fontSize: "12px", color: "#34d399" }}>
                      {TELEMETRY_RANGES[telemetryRange].mergeDelta}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>First-pass human sign-off</span>
                </div>
              </div>"""

text = text.replace(old_kpi, new_kpi)

# 4. Remove Sessions vs Tokens button on Waveform
old_waveform_btn = """                    <div style={{ display: "inline-flex", background: "#17171d", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <button
                        onClick={() => setWaveformMetric("sessions")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: waveformMetric === "sessions" ? "#23232a" : "transparent",
                          color: waveformMetric === "sessions" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Sessions
                      </button>
                      <button
                        onClick={() => setWaveformMetric("tokens")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: waveformMetric === "tokens" ? "#23232a" : "transparent",
                          color: waveformMetric === "tokens" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Tokens
                      </button>
                    </div>"""

new_waveform_btn = """                    <span className="pill" style={{ fontSize: "10.5px", background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "#12392d" }}>
                      Live Concurrency
                    </span>"""

text = text.replace(old_waveform_btn, new_waveform_btn)

# 5. Remove Count vs Cost on Task categories
old_cat_btn = """                    <div style={{ display: "inline-flex", background: "#17171d", padding: "2px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <button
                        onClick={() => setCategoryMetric("count")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: categoryMetric === "count" ? "#23232a" : "transparent",
                          color: categoryMetric === "count" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Count
                      </button>
                      <button
                        onClick={() => setCategoryMetric("cost")}
                        style={{
                          padding: "3px 8px",
                          fontSize: "11px",
                          borderRadius: "6px",
                          background: categoryMetric === "cost" ? "#23232a" : "transparent",
                          color: categoryMetric === "cost" ? "#fff" : "#9a9aa6",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Cost
                      </button>
                    </div>"""

new_cat_btn = """                    <span className="pill" style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                      Distribution
                    </span>"""

text = text.replace(old_cat_btn, new_cat_btn)

# 6. Remove `$${(cat.pct * 0.83).toFixed(2)}` in Task categories
text = text.replace(
    '{categoryMetric === "count" ? `${cat.pct}%` : `$${(cat.pct * 0.83).toFixed(2)}`}',
    '{cat.pct}%'
)

# 7. Replace cost in recent runs
old_runs = """                    {[
                      { title: "Fix auth timeout on token refresh", branch: "fix/auth-timeout", status: "In review", cost: "$1.84", statusColor: "#ffb800" },
                      { title: "Add pagination to audit log API", branch: "feature/audit-pagination", status: "In review", cost: "$3.12", statusColor: "#ffb800" },
                      { title: "Dependency bump security scan", branch: "chore/sec-deps", status: "Completed", cost: "$0.42", statusColor: "#10b981" },
                      { title: "Rate-limit middleware for public routes", branch: "feature/rate-limit", status: "In review", cost: "$2.18", statusColor: "#ffb800" },
                    ].map((run, i) => ("""

new_runs = """                    {[
                      { title: "Fix auth timeout on token refresh", branch: "fix/auth-timeout", status: "In review", duration: "1m 42s", statusColor: "#ffb800" },
                      { title: "Add pagination to audit log API", branch: "feature/audit-pagination", status: "In review", duration: "2m 18s", statusColor: "#ffb800" },
                      { title: "Dependency bump security scan", branch: "chore/sec-deps", status: "Completed", duration: "45s", statusColor: "#10b981" },
                      { title: "Rate-limit middleware for public routes", branch: "feature/rate-limit", status: "In review", duration: "3m 05s", statusColor: "#ffb800" },
                    ].map((run, i) => ("""

text = text.replace(old_runs, new_runs)
text = text.replace('{run.cost}', '{run.duration}')

# 8. Remove Spending Cap in New Task modal
old_spending_input = """                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600 }}>Spending Cap ($ USD)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={newTaskBudget}
                    onChange={(e) => setNewTaskBudget(parseFloat(e.target.value) || 5.0)}
                    style={{
                      background: "#0c0c10",
                      border: "1px solid #23232c",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      color: "#fff",
                      outline: "none",
                    }}
                  />
                </div>"""

new_branch_input = """                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600 }}>Target Branch</label>
                  <input
                    type="text"
                    defaultValue="main"
                    placeholder="e.g. main or feature/branch"
                    style={{
                      background: "#0c0c10",
                      border: "1px solid #23232c",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13px",
                      color: "#fff",
                      outline: "none",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  />
                </div>"""

text = text.replace(old_spending_input, new_branch_input)
text = text.replace('Choose a model, a squad, and a spending cap', 'Choose a squad pipeline and target git branch')

# 9. Remove Deep Bento Telemetry section completely
old_deep_bento = """              {/* Toggle Deep Bento Telemetry View */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <button
                  className="btn"
                  onClick={() => setShowFullBento(!showFullBento)}
                  style={{ gap: "6px" }}
                >
                  <span>{showFullBento ? "Hide Full Bento Telemetry ▲" : "View Deep Bento Analytics & Seasonality ▼"}</span>
                </button>
              </div>

              {showFullBento && (
                <div style={{ marginTop: "10px" }}>
                  <AnalyticsBento
                    currency="$"
                    revenue={{
                      label: "Token Expenditure & Compute",
                      value: 9134,
                      delta: "2.5%",
                      note: <>Avg. per squad run <span className="text-foreground/80">$1.85</span></>,
                      caption: "Last 30 days",
                      series: bentoRevenue.map((value, i) => ({
                        value,
                        label: new Date(2026, 8, 22 + i).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                      })),
                    }}
                    sessions={{
                      label: "Worker Agent Sessions",
                      value: 48210,
                      delta: "12.4%",
                      note: "By hour, last 3 weeks",
                      desktop: bentoDesktop,
                      mobile: bentoMobile,
                    }}
                    categories={{
                      title: "Task Throughput by Capability",
                      groups: [
                        { id: "product", name: "Architect", color: "#7CFF5B", ink: "dark" },
                        { id: "eng", name: "Developer", color: "#8B3DFF", ink: "light" },
                        { id: "growth", name: "Tester", color: "#FFB800", ink: "dark" },
                        { id: "brand", name: "Security", color: "#FF5A1F", ink: "dark" },
                        { id: "ops", name: "Worktree", color: "#888" },
                      ],
                      periods: [
                        { label: "Weekly", total: 2197, delta: "19.6%", compare: "vs 1,340 last wk" },
                        { label: "Monthly", total: 8903, delta: "1.9%", compare: "vs 5,441 last mo" },
                        { label: "Yearly", total: 98134, delta: "22%", compare: "vs 76,330 last yr" },
                      ],
                      items: [
                        { name: "AST Parser", group: "product", values: [509, 2140, 25600] },
                        { name: "Code Gen", group: "eng", values: [412, 1880, 22900] },
                        { name: "Vitest Harness", group: "growth", values: [445, 1590, 18100] },
                        { name: "Secret Audit", group: "brand", values: [331, 1240, 13400] },
                        { name: "Worktree Lease", group: "ops", values: [380, 1120, 12300] },
                      ],
                    }}
                    seasonality={{
                      title: "Sprint Seasonality",
                      years: [
                        {
                          label: "2026",
                          values: [16120, 20540, 24440, 18460, 28080, 21580, 17160, 25740, 30160, 22880, 32240, 23660],
                          stats: [
                            { label: "Monthly avg", value: 8097, delta: "19.6%", note: "44,214 agent runs" },
                            { label: "Year total", value: 312134, delta: "2.5%", note: "301,002 commits" },
                          ],
                          rows: [{ label: "US East", value: "201,192" }, { label: "Europe", value: "192,054" }],
                        },
                      ],
                    }}
                    credit={false}
                  />
                </div>
              )}"""

text = text.replace(old_deep_bento, "")

with open(r"scratch/build_dashboard.py", "w", encoding="utf-8") as f:
    f.write(text)

print("scratch/build_dashboard.py cleaned successfully!")

