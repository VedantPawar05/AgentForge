import re

with open("apps/web/src/app/dashboard/page.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add WAVEFORM_SERIES and buildSmoothSpline
SERIES_DEF = '''
// Precise Telemetry Waveform Data Series per Range
interface WaveformPoint {
  x: number;
  y: number;
  val: number;
  label: string;
}

const WAVEFORM_SERIES = {
  "7D": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    desktop: [96, 114, 138, 128, 156, 88, 76],
    workers: [52, 68, 86, 78, 98, 54, 44],
    maxVal: 200,
  },
  "30D": {
    labels: ["Oct 10", "Oct 14", "Oct 18", "Oct 22", "Oct 26", "Oct 30", "Nov 3", "Nov 7"],
    desktop: [105, 122, 134, 152, 144, 168, 178, 194],
    workers: [62, 76, 84, 98, 90, 112, 122, 136],
    maxVal: 220,
  },
  "90D": {
    labels: ["Aug W1", "Aug W3", "Sep W1", "Sep W3", "Oct W1", "Oct W3", "Nov W1"],
    desktop: [84, 108, 132, 158, 184, 218, 252],
    workers: [48, 66, 82, 102, 118, 146, 176],
    maxVal: 300,
  },
};

function buildSmoothSpline(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
'''

if "const WAVEFORM_SERIES" not in code:
    code = code.replace("const TELEMETRY_RANGES = {", SERIES_DEF + "\nconst TELEMETRY_RANGES = {", 1)

# 2. Update waveformHover state in DashboardPage
OLD_STATE = '''  const [telemetryRange, setTelemetryRange] = useState<"7D" | "30D" | "90D">("30D");
  const [waveformHover, setWaveformHover] = useState<{
    x: number;
    hour: string;
    desktopVal: number;
    workerVal: number;
  } | null>(null);'''

NEW_STATE = '''  const [telemetryRange, setTelemetryRange] = useState<"7D" | "30D" | "90D">("30D");
  const [waveformHover, setWaveformHover] = useState<{
    x: number;
    desktopY: number;
    workerY: number;
    label: string;
    desktopVal: number;
    workerVal: number;
  } | null>(null);

  const currentWaveform = useMemo(() => {
    const data = WAVEFORM_SERIES[telemetryRange];
    const plotLeft = 45;
    const plotRight = 615;
    const plotTop = 20;
    const plotBottom = 165;
    const width = plotRight - plotLeft;
    const height = plotBottom - plotTop;

    const pointsDesktop: WaveformPoint[] = data.desktop.map((val, i) => {
      const x = plotLeft + (i / (data.desktop.length - 1)) * width;
      const y = plotBottom - (val / data.maxVal) * height;
      return { x, y, val, label: data.labels[i] };
    });

    const pointsWorkers: WaveformPoint[] = data.workers.map((val, i) => {
      const x = plotLeft + (i / (data.workers.length - 1)) * width;
      const y = plotBottom - (val / data.maxVal) * height;
      return { x, y, val, label: data.labels[i] };
    });

    const desktopLinePath = buildSmoothSpline(pointsDesktop);
    const workersLinePath = buildSmoothSpline(pointsWorkers);

    const desktopAreaPath = `${desktopLinePath} L ${pointsDesktop[pointsDesktop.length - 1].x.toFixed(1)} ${plotBottom} L ${pointsDesktop[0].x.toFixed(1)} ${plotBottom} Z`;
    const workersAreaPath = `${workersLinePath} L ${pointsWorkers[pointsWorkers.length - 1].x.toFixed(1)} ${plotBottom} L ${pointsWorkers[0].x.toFixed(1)} ${plotBottom} Z`;

    const yTicks = [
      { val: data.maxVal, y: plotTop },
      { val: Math.round(data.maxVal * 0.75), y: plotTop + height * 0.25 },
      { val: Math.round(data.maxVal * 0.5), y: plotTop + height * 0.5 },
      { val: Math.round(data.maxVal * 0.25), y: plotTop + height * 0.75 },
      { val: 0, y: plotBottom },
    ];

    return {
      data,
      pointsDesktop,
      pointsWorkers,
      desktopLinePath,
      workersLinePath,
      desktopAreaPath,
      workersAreaPath,
      plotLeft,
      plotRight,
      plotBottom,
      yTicks,
    };
  }, [telemetryRange]);'''

if OLD_STATE in code:
    code = code.replace(OLD_STATE, NEW_STATE, 1)

# 3. Replace the Waveform card markup
OLD_CARD_START = '                {/* SVG Telemetry Chart Card with Interactive Hover */}'
OLD_CARD_END = '                {/* Live Squad Widget Card */}'

idx1 = code.find(OLD_CARD_START)
idx2 = code.find(OLD_CARD_END)

if idx1 != -1 and idx2 != -1:
    NEW_CARD = '''                {/* SVG Telemetry Chart Card with Interactive Hover */}
                <div className="card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600 }}>Activity Waveform</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                          <span style={{ color: "var(--text)" }}>Desktop Sessions</span>
                          <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#10b981", marginLeft: "2px" }}>
                            {waveformHover ? waveformHover.desktopVal : currentWaveform.data.desktop[currentWaveform.data.desktop.length - 1]}
                          </b>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#06b6d4", boxShadow: "0 0 6px #06b6d4" }} />
                          <span style={{ color: "var(--text)" }}>Worker Agents</span>
                          <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#06b6d4", marginLeft: "2px" }}>
                            {waveformHover ? waveformHover.workerVal : currentWaveform.data.workers[currentWaveform.data.workers.length - 1]}
                          </b>
                        </span>
                      </div>
                    </div>

                    <span className="pill" style={{ fontSize: "10.5px", background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "#12392d" }}>
                      ● Live Concurrency
                    </span>
                  </div>

                  {/* SVG Waveform Chart with scrub handler */}
                  <div
                    style={{ position: "relative", height: "230px", width: "100%", cursor: "crosshair", userSelect: "none" }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                      const pct = relX / rect.width;
                      
                      const idx = Math.min(
                        currentWaveform.pointsDesktop.length - 1,
                        Math.max(0, Math.round(pct * (currentWaveform.pointsDesktop.length - 1)))
                      );
                      const ptDesk = currentWaveform.pointsDesktop[idx];
                      const ptWork = currentWaveform.pointsWorkers[idx];

                      setWaveformHover({
                        x: ptDesk.x,
                        desktopY: ptDesk.y,
                        workerY: ptWork.y,
                        label: ptDesk.label,
                        desktopVal: ptDesk.val,
                        workerVal: ptWork.val,
                      });
                    }}
                    onMouseLeave={() => setWaveformHover(null)}
                  >
                    <svg viewBox="0 0 640 215" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                      <defs>
                        <linearGradient id="desktopGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="workersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.20" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Y-Axis Horizontal Grid Lines & Ticks */}
                      {currentWaveform.yTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1={currentWaveform.plotLeft}
                            y1={tick.y}
                            x2={currentWaveform.plotRight}
                            y2={tick.y}
                            stroke="#1a1a22"
                            strokeWidth="1"
                            strokeDasharray={i === currentWaveform.yTicks.length - 1 ? "none" : "3 3"}
                          />
                          <text
                            x={currentWaveform.plotLeft - 8}
                            y={tick.y + 3}
                            fill="#555562"
                            fontSize="9.5"
                            fontFamily="var(--font-mono, monospace)"
                            textAnchor="end"
                          >
                            {tick.val}
                          </text>
                        </g>
                      ))}

                      {/* Worker Agents Gradient Area & Line */}
                      <path d={currentWaveform.workersAreaPath} fill="url(#workersGrad)" />
                      <path
                        d={currentWaveform.workersLinePath}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Desktop Sessions Gradient Area & Line */}
                      <path d={currentWaveform.desktopAreaPath} fill="url(#desktopGrad)" />
                      <path
                        d={currentWaveform.desktopLinePath}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* X-Axis Ticks & Labels */}
                      {currentWaveform.pointsDesktop.map((pt, i) => (
                        <g key={i}>
                          <line x1={pt.x} y1={currentWaveform.plotBottom} x2={pt.x} y2={currentWaveform.plotBottom + 4} stroke="#2e2e38" strokeWidth="1" />
                          <text
                            x={pt.x}
                            y={currentWaveform.plotBottom + 18}
                            fill="#727280"
                            fontSize="10"
                            fontFamily="var(--font-mono, monospace)"
                            textAnchor="middle"
                          >
                            {pt.label}
                          </text>
                        </g>
                      ))}

                      {/* Small Dots on Curve Points */}
                      {currentWaveform.pointsDesktop.map((pt, i) => (
                        <circle key={`dp-${i}`} cx={pt.x} cy={pt.y} r="3" fill="#0b0b0d" stroke="#10b981" strokeWidth="2" />
                      ))}
                      {currentWaveform.pointsWorkers.map((pt, i) => (
                        <circle key={`wp-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#0b0b0d" stroke="#06b6d4" strokeWidth="1.8" />
                      ))}

                      {/* Dynamic Crosshair & Exact-Snap Dots on Hover */}
                      {waveformHover ? (
                        <>
                          <line
                            x1={waveformHover.x}
                            y1={15}
                            x2={waveformHover.x}
                            y2={currentWaveform.plotBottom}
                            stroke="#555566"
                            strokeDasharray="3 3"
                            strokeWidth="1.5"
                          />
                          {/* Desktop Snap Dot */}
                          <circle cx={waveformHover.x} cy={waveformHover.desktopY} r="7" fill="rgba(16,185,129,0.25)" />
                          <circle cx={waveformHover.x} cy={waveformHover.desktopY} r="4.5" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />

                          {/* Workers Snap Dot */}
                          <circle cx={waveformHover.x} cy={waveformHover.workerY} r="6" fill="rgba(6,182,212,0.25)" />
                          <circle cx={waveformHover.x} cy={waveformHover.workerY} r="4" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
                        </>
                      ) : (
                        (() => {
                          const lastDesk = currentWaveform.pointsDesktop[currentWaveform.pointsDesktop.length - 1];
                          const lastWork = currentWaveform.pointsWorkers[currentWaveform.pointsWorkers.length - 1];
                          return (
                            <>
                              <line
                                x1={lastDesk.x}
                                y1={15}
                                x2={lastDesk.x}
                                y2={currentWaveform.plotBottom}
                                stroke="#2e2e38"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <circle cx={lastDesk.x} cy={lastDesk.y} r="5" fill="#10b981" stroke="#0b0b0d" strokeWidth="2" />
                              <circle cx={lastWork.x} cy={lastWork.y} r="4.5" fill="#06b6d4" stroke="#0b0b0d" strokeWidth="2" />
                            </>
                          );
                        })()
                      )}
                    </svg>

                    {/* Tooltip HUD */}
                    <div
                      style={{
                        position: "absolute",
                        left: waveformHover
                          ? `${Math.min(76, Math.max(6, (waveformHover.x / 640) * 100))}%`
                          : "72%",
                        top: "8px",
                        background: "#16161d",
                        border: "1px solid #2d2d38",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "11px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        pointerEvents: "none",
                        transition: "left 0.08s ease-out",
                        zIndex: 10,
                      }}
                    >
                      <span style={{ color: "#9a9aa6", fontWeight: 600 }}>
                        {waveformHover ? waveformHover.label : currentWaveform.data.labels[currentWaveform.data.labels.length - 1]}
                      </span>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                          Desktop:
                        </span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#fff" }}>
                          {waveformHover ? waveformHover.desktopVal : currentWaveform.data.desktop[currentWaveform.data.desktop.length - 1]} active
                        </b>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
                        <span style={{ color: "#06b6d4", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#06b6d4" }} />
                          Workers:
                        </span>
                        <b style={{ fontFamily: "var(--font-mono, monospace)", color: "#fff" }}>
                          {waveformHover ? waveformHover.workerVal : currentWaveform.data.workers[currentWaveform.data.workers.length - 1]} queued
                        </b>
                      </div>
                    </div>
                  </div>
                </div>

'''
    code = code[:idx1] + NEW_CARD + code[idx2:]

with open("apps/web/src/app/dashboard/page.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("Graph patched successfully!")

