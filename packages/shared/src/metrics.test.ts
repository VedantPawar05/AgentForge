import { describe, it, expect, beforeEach } from "vitest";
import { MetricsRegistry, Counter, Gauge, Histogram } from "./metrics.js";

describe("Phase 11: Prometheus Metrics Registry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
  });

  it("increments counters with labels and enforces non-negative increments", () => {
    const counter = registry.createCounter(
      "api_requests_total",
      "Total HTTP requests",
    );

    counter.inc({ method: "GET", status: 200 });
    counter.inc({ method: "GET", status: 200 }, 4);
    counter.inc({ method: "POST", status: 201 }, 1);

    expect(counter.get({ method: "GET", status: 200 })).toBe(5);
    expect(counter.get({ method: "POST", status: 201 })).toBe(1);
    expect(counter.get({ method: "DELETE", status: 404 })).toBe(0);

    expect(() => counter.inc({ method: "GET" }, -1)).toThrow(/negative/);
  });

  it("sets and updates gauges with labels", () => {
    const gauge = registry.createGauge(
      "active_workers",
      "Number of active workers",
    );

    gauge.set(10, { queue: "priority" });
    gauge.inc({ queue: "priority" }, 2);
    gauge.dec({ queue: "priority" }, 3);

    expect(gauge.get({ queue: "priority" })).toBe(9);
  });

  it("records histogram observations and calculates cumulative bucket counts and sum", () => {
    const hist = registry.createHistogram(
      "request_latency_seconds",
      "Request latency in seconds",
      [0.1, 0.5, 1.0],
    );

    hist.observe(0.05, { route: "/tasks" });
    hist.observe(0.3, { route: "/tasks" });
    hist.observe(0.8, { route: "/tasks" });
    hist.observe(2.5, { route: "/tasks" });

    const formatted = hist.format();

    expect(formatted).toContain(
      'request_latency_seconds_bucket{route="/tasks",le="0.1"} 1',
    );
    expect(formatted).toContain(
      'request_latency_seconds_bucket{route="/tasks",le="0.5"} 2',
    );
    expect(formatted).toContain(
      'request_latency_seconds_bucket{route="/tasks",le="1"} 3',
    );
    expect(formatted).toContain(
      'request_latency_seconds_bucket{route="/tasks",le="+Inf"} 4',
    );
    expect(formatted).toContain(
      'request_latency_seconds_sum{route="/tasks"} 3.65',
    );
    expect(formatted).toContain(
      'request_latency_seconds_count{route="/tasks"} 4',
    );
  });

  it("exports comprehensive Prometheus text payload including process metrics", () => {
    const c = registry.createCounter("jobs_processed_total", "Jobs processed");
    c.inc({ status: "success" }, 42);

    const g = registry.createGauge("memory_pool_bytes", "Pool memory");
    g.set(1048576);

    const output = registry.exportPrometheus();

    expect(output).toContain("# HELP process_uptime_seconds");
    expect(output).toContain("# TYPE process_uptime_seconds gauge");
    expect(output).toContain("# HELP process_resident_memory_bytes");
    expect(output).toContain("# HELP jobs_processed_total Jobs processed");
    expect(output).toContain("# TYPE jobs_processed_total counter");
    expect(output).toContain('jobs_processed_total{status="success"} 42');
    expect(output).toContain("memory_pool_bytes 1048576");
  });
});
