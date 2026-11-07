dash_path = r"apps/web/src/app/dashboard/page.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    content = f.read()

# Let's find start and end of Right Panes
start_marker = "{/* Right: Side-by-Side Live Code Panes */}"
end_marker = "{/* Bottom Dock: Agent Log / Problems / Output */}"

start_pos = content.find(start_marker)
end_pos = content.find(end_marker)

assert start_pos != -1 and end_pos != -1, f"Markers not found! start={start_pos}, end={end_pos}"

panes_clean_jsx = """{/* Right: Side-by-Side Live Code Panes */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      splitPanesLayout === 1
                        ? "1fr"
                        : splitPanesLayout === 2
                        ? "repeat(2, minmax(0, 1fr))"
                        : splitPanesLayout === 3
                        ? "repeat(3, minmax(0, 1fr))"
                        : "repeat(4, minmax(240px, 1fr))",
                    gap: "12px",
                    overflowX: splitPanesLayout === 4 ? "auto" : "visible",
                  }}
                >
                  {/* Pane 1: Developer editing session.ts / refresh.ts */}
                  <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <span
                          className="pill"
                          onClick={() => setSplitTab1("session.ts")}
                          style={{
                            background: splitTab1 === "session.ts" ? "#23232a" : "transparent",
                            color: splitTab1 === "session.ts" ? "#fff" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          session.ts <span style={{ color: "#ffb800", marginLeft: "4px" }}>M</span>
                        </span>
                        <span
                          className="pill"
                          onClick={() => setSplitTab1("refresh.ts")}
                          style={{
                            background: splitTab1 === "refresh.ts" ? "#23232a" : "transparent",
                            color: splitTab1 === "refresh.ts" ? "#fff" : "var(--muted)",
                            cursor: "pointer",
                          }}
                        >
                          refresh.ts
                        </span>
                      </div>
                      <span className="pill" style={{ color: "#34d399", borderColor: "#14523f", background: "rgba(16,185,129,0.08)" }}>
                        ● Developer (Writing)
                      </span>
                    </div>

                    {/* Code Lines with Syntax Coloring */}
                    <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                      {splitTab1 === "session.ts" ? (
                        <>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>38</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; REFRESH_URL, REFRESH_TIMEOUT_MS &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./config&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>39</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; SessionError &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./errors&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>40</span></div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>41</span> <span style={{ color: "#22d3ee" }}>export async function</span> <span style={{ color: "#ffb800" }}>refreshSession</span>(token: <span style={{ color: "#06b6d4" }}>string</span>) &#123;</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>42</span>   <span style={{ color: "#54545d" }}>// abort the request if the server stalls</span></div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>43</span>   <span style={{ color: "#22d3ee" }}>const</span> ctrl = <span style={{ color: "#ffb800" }}>new AbortController</span>();</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>44</span>   <span style={{ color: "#22d3ee" }}>const</span> tid = <span style={{ color: "#ffb800" }}>setTimeout</span>(() =&gt; ctrl.abort(), REFRESH_TIMEOUT_MS);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>45</span>   <span style={{ color: "#8b3dff" }}>try</span> &#123;</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>46</span>     <span style={{ color: "#22d3ee" }}>const</span> res = <span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>fetch</span>(REFRESH_URL, &#123; method: <span style={{ color: "#10b981" }}>&quot;POST&quot;</span>, signal: ctrl.signal &#125;);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>47</span>     <span style={{ color: "#8b3dff" }}>if</span> (!res.ok) <span style={{ color: "#8b3dff" }}>throw new</span> SessionError(<span style={{ color: "#10b981" }}>&quot;refresh_failed&quot;</span>);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>48</span>     <span style={{ color: "#8b3dff" }}>return await</span> res.json();</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>49</span>   &#125; <span style={{ color: "#8b3dff" }}>finally</span> &#123; <span style={{ color: "#ffb800" }}>clearTimeout</span>(tid); &#125;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>50</span> &#125;</div>
                        </>
                      ) : (
                        <>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; Router &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;express&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; refreshSession &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;../auth/session&quot;</span>;</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#22d3ee" }}>export const</span> refreshRouter = <span style={{ color: "#ffb800" }}>Router</span>();</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span></div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span> refreshRouter.<span style={{ color: "#ffb800" }}>post</span>(<span style={{ color: "#10b981" }}>&quot;/refresh&quot;</span>, <span style={{ color: "#22d3ee" }}>async</span> (req, res) =&gt; &#123;</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span>   <span style={{ color: "#22d3ee" }}>const</span> token = req.headers.authorization?.<span style={{ color: "#ffb800" }}>replace</span>(<span style={{ color: "#10b981" }}>&quot;Bearer &quot;</span>, <span style={{ color: "#10b981" }}>&quot;&quot;</span>);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>   <span style={{ color: "#8b3dff" }}>if</span> (!token) <span style={{ color: "#8b3dff" }}>return</span> res.<span style={{ color: "#ffb800" }}>status</span>(401).json(&#123; error: <span style={{ color: "#10b981" }}>&quot;missing_token&quot;</span> &#125;);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span>   <span style={{ color: "#22d3ee" }}>const</span> result = <span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>refreshSession</span>(token);</div>
                          <div style={{ background: "rgba(16,185,129,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  res.<span style={{ color: "#ffb800" }}>json</span>(result);</div>
                          <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span> &#125;</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pane 2: Tester writing session.test.ts + Live Vitest Trigger */}
                  {splitPanesLayout >= 2 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            session.test.ts <span style={{ color: "#34d399", marginLeft: "4px" }}>A</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isVitestRunning}
                            onClick={handleRunVitestInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px" }}
                          >
                            {isVitestRunning ? "Testing..." : "▶ Run Vitest in Worktree"}
                          </button>
                          <span className="pill" style={{ color: "#fbbf24", borderColor: "#3a3020", background: "rgba(251,191,36,0.08)" }}>
                            ● Tester
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Vitest Suite */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; describe, it, expect, vi &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;vitest&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; refreshSession &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./session&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#ffb800" }}>describe</span>(<span style={{ color: "#10b981" }}>&quot;refreshSession&quot;</span>, () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   <span style={{ color: "#ffb800" }}>it</span>(<span style={{ color: "#10b981" }}>&quot;aborts when server stalls past timeout&quot;</span>, <span style={{ color: "#22d3ee" }}>async</span> () =&gt; &#123;</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>     vi.<span style={{ color: "#ffb800" }}>useFakeTimers</span>();</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#22d3ee" }}>const</span> p = <span style={{ color: "#ffb800" }}>refreshSession</span>(<span style={{ color: "#10b981" }}>&quot;stale-tok&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>     vi.<span style={{ color: "#ffb800" }}>advanceTimersByTime</span>(5000);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#8b3dff" }}>await</span> <span style={{ color: "#ffb800" }}>expect</span>(p).<span style={{ color: "#ffb800" }}>rejects</span>.toThrow(<span style={{ color: "#10b981" }}>&quot;refresh_failed&quot;</span>);</div>
                        <div style={{ background: "rgba(251,191,36,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  &#125;);</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span> &#125;</div>
                      </div>
                    </div>
                  )}

                  {/* Pane 3: Security Auditor (auth.security.ts) */}
                  {splitPanesLayout >= 3 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            auth.security.ts <span style={{ color: "#ef4444", marginLeft: "4px" }}>A</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isAuditRunning}
                            onClick={handleRunAuditInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px", background: "#ef4444", borderColor: "#dc2626" }}
                          >
                            {isAuditRunning ? "Auditing..." : "🛡️ Run AST Audit"}
                          </button>
                          <span className="pill" style={{ color: "#ef4444", borderColor: "#551b1b", background: "rgba(239,68,68,0.08)" }}>
                            ● Security (Auditing)
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Security Auditor */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto", overflowX: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; SecurityContext, sanitizeToken &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;@agentforge/security&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span> <span style={{ color: "#8b3dff" }}>import</span> &#123; TokenPayload &#125; <span style={{ color: "#8b3dff" }}>from</span> <span style={{ color: "#10b981" }}>&quot;./session.types&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span> <span style={{ color: "#22d3ee" }}>export function</span> <span style={{ color: "#ffb800" }}>auditSessionSecurity</span>(token: <span style={{ color: "#06b6d4" }}>string</span>): <span style={{ color: "#06b6d4" }}>SecurityContext</span> &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   <span style={{ color: "#22d3ee" }}>const</span> sanitized = <span style={{ color: "#ffb800" }}>sanitizeToken</span>(token);</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>   <span style={{ color: "#8b3dff" }}>if</span> (!sanitized.isSigned) &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span>     <span style={{ color: "#8b3dff" }}>throw new</span> <span style={{ color: "#ef4444" }}>SecurityException</span>(<span style={{ color: "#10b981" }}>&quot;UNTRUSTED_ISSUER_HEADER&quot;</span>);</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span>   &#125;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span>   <span style={{ color: "#8b3dff" }}>return</span> &#123;</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>    taintCheck: <span style={{ color: "#10b981" }}>&quot;PASSED&quot;</span>,</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span>    cryptographicProof: <span style={{ color: "#10b981" }}>&quot;ed25519-valid&quot;</span>,</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>12</span>    verifiedAt: <span style={{ color: "#ffb800" }}>Date.now</span>(),</div>
                        <div style={{ background: "rgba(239,68,68,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>13</span>  &#125;;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>14</span> &#125;</div>
                      </div>
                    </div>
                  )}

                  {/* Pane 4: Architect Agent (session.types.ts) */}
                  {splitPanesLayout >= 4 && (
                    <div style={{ background: "var(--panel)", borderRadius: "var(--radius-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ padding: "10px 16px", background: "#0e0e12", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <span className="pill" style={{ background: "#23232a", color: "#fff" }}>
                            session.types.ts <span style={{ color: "#38bdf8", marginLeft: "4px" }}>C</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            className="btn primary"
                            disabled={isSchemaVerifying}
                            onClick={handleVerifySchemaInSplit}
                            style={{ padding: "3px 10px", fontSize: "11px", background: "#0284c7", borderColor: "#0369a1" }}
                          >
                            {isSchemaVerifying ? "Verifying..." : "📐 Verify Schema"}
                          </button>
                          <span className="pill" style={{ color: "#38bdf8", borderColor: "#0c4a6e", background: "rgba(56,189,248,0.08)" }}>
                            ● Architect (Spec Verified)
                          </span>
                        </div>
                      </div>

                      {/* Code Lines for Architect Agent */}
                      <div style={{ flex: 1, padding: "14px 18px", background: "#08080a", fontFamily: "var(--font-mono, monospace)", fontSize: "12px", lineHeight: "1.7", overflowY: "auto", overflowX: "auto" }}>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>1</span> <span style={{ color: "#8b3dff" }}>export interface</span> <span style={{ color: "#38bdf8" }}>SessionRefreshContract</span> &#123;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>2</span>   sessionId: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>3</span>   expiresInSeconds: <span style={{ color: "#ffb800" }}>number</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>4</span>   refreshToken: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>5</span>   fingerprint: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>6</span>   scope: <span style={{ color: "#10b981" }}>&quot;read:code&quot;</span> | <span style={{ color: "#10b981" }}>&quot;write:code&quot;</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>7</span> &#125;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>8</span></div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>9</span> <span style={{ color: "#8b3dff" }}>export interface</span> <span style={{ color: "#38bdf8" }}>SecurityContext</span> &#123;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>10</span>  verifiedAt: <span style={{ color: "#ffb800" }}>number</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>11</span>  taintCheck: <span style={{ color: "#10b981" }}>&quot;PASSED&quot;</span> | <span style={{ color: "#ef4444" }}>&quot;FAILED&quot;</span>;</div>
                        <div style={{ background: "rgba(56,189,248,0.08)" }}><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>12</span>  cryptographicProof: <span style={{ color: "#06b6d4" }}>string</span>;</div>
                        <div><span style={{ color: "#54545d", width: "24px", display: "inline-block" }}>13</span> &#125;</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              """

new_content = content[:start_pos] + panes_clean_jsx + content[end_pos:]

with open(dash_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Clean replace written!")

