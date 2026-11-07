"use client";

import * as React from "react";
import Link from "next/link";
import { AnalyticsBento } from "@/components/ui/analytics-bento";

/* Geist + Geist Mono for the demo */
function useFonts() {
  React.useEffect(() => {
    const id = "geist-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);
}

const bell = (x: number, m: number, s: number) => Math.exp(-(((x - m) / s) ** 2) / 2);
const hours = Array.from({ length: 25 }, (_, h) => h);
const desktop = [0, 1, 2].map((w) => hours.map((h) => Math.round(2400 * (1 - w * 0.16) * (bell(h, 13 - w * 0.6, 3.4) * 0.92 + bell(h, 20, 2.2) * 0.18))));
const mobile = [0, 1, 2].map((w) => hours.map((h) => Math.round(2600 * (1 - w * 0.18) * (bell(h, 20.5 - w * 0.4, 3) * 0.95 + bell(h, 8, 1.8) * 0.2))));

const revenue = [7420, 7510, 7460, 7380, 7490, 7640, 7720, 7680, 7590, 7560, 7630, 7780, 7900, 7960, 7910, 7850, 7880, 8010, 8140, 8230, 8190, 8120, 8260, 8430, 8560, 8620, 8700, 8890, 9020, 9134];

export default function AnalyticsBentoDemo() {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("agentforge_github_user");
    }
    return false;
  });

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agentforge_github_user");
      if (!saved) {
        window.location.href = "/login?redirect=/analytics";
      } else {
        setIsAuthenticated(true);
      }
    }
  }, []);

  useFonts();

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08080a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "Inter, -apple-system, sans-serif",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            background: "#cc0000",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: "18px",
            boxShadow: "0 0 24px rgba(204,0,0,0.6)",
          }}
        >
          ✦
        </div>
        <div style={{ fontSize: "13px", color: "#888", letterSpacing: "0.02em" }}>
          Verifying security credentials &amp; telemetry access...
        </div>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen w-full bg-background px-4 py-8 sm:px-6 sm:py-10"
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in oklab, var(--color-foreground, #fff) 7%, transparent) 0 1px, transparent 1.4px)",
        backgroundSize: "20px 13px",
        backgroundPosition: "-6px -1px",
      }}
    >
      {/* ── BENTO TOPBAR NAVIGATION ── */}
      <div className="mx-auto max-w-[1240px] mb-8 flex items-center justify-between border-b border-white/[0.07] pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-foreground hover:opacity-90 transition-opacity no-underline">
          <span className="w-7 h-7 rounded-lg bg-[#cc0000] text-white flex items-center justify-center text-xs font-black shadow-[0_0_12px_rgba(204,0,0,0.5)]">✦</span>
          <span className="font-semibold text-sm tracking-tight text-white">AgentForge</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/70">
            Analytics Bento
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] no-underline"
          >
            ← Back to Landing
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-white bg-[#cc0000] hover:bg-[#b00000] transition-colors px-3.5 py-1.5 rounded-lg shadow-[0_2px_10px_rgba(204,0,0,0.3)] no-underline flex items-center gap-1.5"
          >
            Control Plane ↗
          </Link>
        </div>
      </div>
      <AnalyticsBento
        className="mx-auto max-w-[1240px]"
        revenue={{
          label: "Revenue",
          value: 9134,
          delta: "2.5%",
          note: <>Avg. order <span className="text-foreground/80">$185</span></>,
          caption: "Last 30 days",
          series: revenue.map((value, i) => ({ value, label: new Date(2026, 8, 22 + i).toLocaleDateString("en-US", { month: "short", day: "numeric" }) })),
        }}
        sessions={{ label: "Sessions", value: 48210, delta: "12.4%", note: "By hour, last 3 weeks", desktop, mobile }}
        categories={{
          title: "Sales by category",
          groups: [
            { id: "product", name: "Product", color: "#7CFF5B", ink: "dark" },
            { id: "eng", name: "Engineering", color: "#8B3DFF", ink: "light" },
            { id: "growth", name: "Growth", color: "#FFB800", ink: "dark" },
            { id: "brand", name: "Brand", color: "#FF5A1F", ink: "dark" },
            { id: "ops", name: "Ops", color: "color-mix(in oklab, var(--color-muted-foreground, #888) 45%, var(--color-muted, #222))" },
          ],
          periods: [
            { label: "Weekly", total: 2197, delta: "19.6%", compare: "vs $1,340 last week" },
            { label: "Monthly", total: 8903, delta: "1.9%", compare: "vs $5,441 last month" },
            { label: "Yearly", total: 98134, delta: "22%", compare: "vs $76,330 last year" },
          ],
          items: [
            { name: "Design", group: "product", values: [509, 2140, 25600] },
            { name: "Research", group: "product", values: [353, 1460, 17800] },
            { name: "Frontend", group: "eng", values: [412, 1880, 22900] },
            { name: "DevOps", group: "eng", values: [551, 2010, 24100] },
            { name: "Testing", group: "eng", values: [532, 1720, 19400] },
            { name: "Backend", group: "eng", values: [498, 2230, 26800] },
            { name: "SMM", group: "growth", values: [445, 1590, 18100] },
            { name: "SEO", group: "growth", values: [290, 1310, 16900] },
            { name: "Content", group: "brand", values: [331, 1240, 13400] },
            { name: "Support", group: "ops", values: [380, 1120, 12300] },
            { name: "Legal", group: "ops", values: [118, 520, 6100] },
          ],
          table: {
            columns: ["City", "Weekly", "Monthly", "Yearly"],
            rows: [
              { label: "New York", values: ["$20,030", "$50,331", "$270,120"] },
              { label: "London", values: ["$18,782", "$40,795", "$210,650"] },
              { label: "Tokyo", values: ["$14,221", "$30,123", "$200,080"] },
            ],
          },
        }}
        seasonality={{
          title: "Seasonality",
          years: [
            {
              label: "2026",
              values: [16120, 20540, 24440, 18460, 28080, 21580, 17160, 25740, 30160, 22880, 32240, 23660],
              stats: [
                { label: "Monthly avg", value: 8097, delta: "19.6%", note: "44,214 orders" },
                { label: "Year total", value: 312134, delta: "2.5%", note: "301,002 orders" },
              ],
              rows: [{ label: "New York", value: "201,192" }, { label: "London", value: "192,054" }, { label: "Tokyo", value: "161,300" }],
            },
            {
              label: "2025",
              values: [13260, 16640, 18720, 22360, 20020, 15860, 14560, 19240, 23920, 26260, 23140, 19760],
              stats: [
                { label: "Monthly avg", value: 6772, delta: "8.1%", note: "38,920 orders" },
                { label: "Year total", value: 304521, delta: "4.4%", note: "287,410 orders" },
              ],
              rows: [{ label: "New York", value: "188,340" }, { label: "London", value: "171,215" }, { label: "Tokyo", value: "150,870" }],
            },
          ],
        }}
      />
    </div>
  );
}

