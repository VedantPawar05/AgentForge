export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricLabels {
  [key: string]: string | number;
}

function serializeLabels(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, val]) =>
        `${key}="${String(val).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
  return `{${pairs.join(",")}}`;
}

export class Counter {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
  ) {}

  public inc(labels?: MetricLabels, value = 1): void {
    if (value < 0) {
      throw new Error(
        `Counter cannot be incremented by negative value: ${value}`,
      );
    }
    const key = serializeLabels(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  public get(labels?: MetricLabels): number {
    return this.values.get(serializeLabels(labels)) ?? 0;
  }

  public reset(): void {
    this.values.clear();
  }

  public format(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [labels, val] of this.values.entries()) {
        lines.push(`${this.name}${labels} ${val}`);
      }
    }
    return lines.join("\n");
  }
}

export class Gauge {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
  ) {}

  public set(value: number, labels?: MetricLabels): void {
    const key = serializeLabels(labels);
    this.values.set(key, value);
  }

  public inc(labels?: MetricLabels, value = 1): void {
    const key = serializeLabels(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }

  public dec(labels?: MetricLabels, value = 1): void {
    const key = serializeLabels(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }

  public get(labels?: MetricLabels): number {
    return this.values.get(serializeLabels(labels)) ?? 0;
  }

  public reset(): void {
    this.values.clear();
  }

  public format(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [labels, val] of this.values.entries()) {
        lines.push(`${this.name}${labels} ${val}`);
      }
    }
    return lines.join("\n");
  }
}

export class Histogram {
  private buckets: number[];
  private counts = new Map<string, Map<number, number>>();
  private sums = new Map<string, number>();
  private totalCounts = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  public observe(value: number, labels?: MetricLabels): void {
    const key = serializeLabels(labels);

    if (!this.counts.has(key)) {
      this.counts.set(key, new Map());
      this.sums.set(key, 0);
      this.totalCounts.set(key, 0);
    }

    const bucketMap = this.counts.get(key)!;
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.totalCounts.set(key, (this.totalCounts.get(key) ?? 0) + 1);

    for (const b of this.buckets) {
      if (value <= b) {
        bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
      }
    }
  }

  public reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totalCounts.clear();
  }

  public format(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    if (this.totalCounts.size === 0) {
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines.join("\n");
    }

    for (const [key] of this.totalCounts.entries()) {
      const bucketMap = this.counts.get(key)!;
      const sum = this.sums.get(key) ?? 0;
      const count = this.totalCounts.get(key) ?? 0;

      // Clean label base
      const labelPrefix = key.length > 2 ? key.slice(1, -1) + "," : "";

      for (const b of this.buckets) {
        const count = bucketMap.get(b) ?? 0;
        lines.push(`${this.name}_bucket{${labelPrefix}le="${b}"} ${count}`);
      }
      lines.push(`${this.name}_bucket{${labelPrefix}le="+Inf"} ${count}`);
      lines.push(
        `${this.name}_sum{${key.length > 2 ? key.slice(1, -1) : ""}} ${sum}`,
      );
      lines.push(
        `${this.name}_count{${key.length > 2 ? key.slice(1, -1) : ""}} ${count}`,
      );
    }

    return lines.join("\n");
  }
}

export class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();

  public createCounter(name: string, help: string): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter(name, help);
      this.counters.set(name, counter);
    }
    return counter;
  }

  public createGauge(name: string, help: string): Gauge {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge(name, help);
      this.gauges.set(name, gauge);
    }
    return gauge;
  }

  public createHistogram(
    name: string,
    help: string,
    buckets?: number[],
  ): Histogram {
    let hist = this.histograms.get(name);
    if (!hist) {
      hist = new Histogram(name, help, buckets);
      this.histograms.set(name, hist);
    }
    return hist;
  }

  public resetAll(): void {
    this.counters.forEach((c) => c.reset());
    this.gauges.forEach((g) => g.reset());
    this.histograms.forEach((h) => h.reset());
  }

  public exportPrometheus(): string {
    const blocks: string[] = [];

    // System metrics
    const uptime = Math.floor(process.uptime());
    const mem = process.memoryUsage();

    blocks.push(
      `# HELP process_uptime_seconds Process uptime in seconds\n# TYPE process_uptime_seconds gauge\nprocess_uptime_seconds ${uptime}`,
    );
    blocks.push(
      `# HELP process_resident_memory_bytes Resident memory size in bytes\n# TYPE process_resident_memory_bytes gauge\nprocess_resident_memory_bytes ${mem.rss}`,
    );
    blocks.push(
      `# HELP process_heap_used_bytes Heap used in bytes\n# TYPE process_heap_used_bytes gauge\nprocess_heap_used_bytes ${mem.heapUsed}`,
    );

    for (const c of this.counters.values()) {
      blocks.push(c.format());
    }
    for (const g of this.gauges.values()) {
      blocks.push(g.format());
    }
    for (const h of this.histograms.values()) {
      blocks.push(h.format());
    }

    return blocks.join("\n\n") + "\n";
  }
}

export const metrics = new MetricsRegistry();

// Pre-registered standard metrics
export const httpRequestsTotal = metrics.createCounter(
  "http_requests_total",
  "Total count of incoming HTTP requests partitioned by method, path, and status code",
);

export const httpRequestDurationSeconds = metrics.createHistogram(
  "http_request_duration_seconds",
  "Duration of HTTP requests in seconds partitioned by method and path",
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
);

export const activeRunsGauge = metrics.createGauge(
  "agentforge_active_runs_total",
  "Number of agent runs currently executing in sandboxes",
);

export const queueJobsTotal = metrics.createCounter(
  "agentforge_queue_jobs_total",
  "Total worker execution jobs processed by terminal outcome",
);

export const jobDurationSeconds = metrics.createHistogram(
  "agentforge_job_duration_seconds",
  "Duration of agent execution jobs in seconds from pickup to completion or failure",
  [1, 5, 15, 30, 60, 120, 300, 600],
);

export const rateLimitExceededTotal = metrics.createCounter(
  "agentforge_rate_limit_exceeded_total",
  "Total rate limit rejections partitioned by workspace or IP scope",
);

export const workerLeaseRenewalsTotal = metrics.createCounter(
  "agentforge_worker_lease_renewals_total",
  "Total worker lease renewals performed during execution heartbeats",
);
