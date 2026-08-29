import type {
  DeploymentRecord,
  LogEntry,
  MetricPoint,
  ServiceState,
  SimulationSnapshot,
  IncidentState,
} from "./types";

const MIN = 60_000;

function isoMinutesAgo(nowMs: number, minutesAgo: number): string {
  return new Date(nowMs - minutesAgo * MIN).toISOString();
}

function buildSeries(
  nowMs: number,
  totalMinutes: number,
  stepMinutes: number,
  fn: (minutesAgo: number) => Omit<MetricPoint, "timestamp">,
): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (let m = totalMinutes; m >= 0; m -= stepMinutes) {
    points.push({ timestamp: isoMinutesAgo(nowMs, m), ...fn(m) });
  }
  return points;
}

function jitter(base: number, spread: number): number {
  return Math.round((base + (Math.random() - 0.5) * spread) * 10) / 10;
}

const SERVICE_DEFS: Omit<ServiceState, "health" | "version">[] = [
  {
    name: "frontend",
    displayName: "Frontend",
    uptimePct: 99.98,
    description: "Customer-facing web application.",
    dependsOn: ["auth-service", "checkout-api", "search-service", "notification-api"],
  },
  {
    name: "auth-service",
    displayName: "Auth Service",
    uptimePct: 99.99,
    description: "Handles session and identity verification.",
    dependsOn: [],
  },
  {
    name: "checkout-api",
    displayName: "Checkout API",
    uptimePct: 99.9,
    description: "Coordinates cart, pricing, and order placement.",
    dependsOn: ["auth-service", "payment-api"],
  },
  {
    name: "payment-api",
    displayName: "Payment API",
    uptimePct: 99.95,
    description: "Processes payment authorization and capture.",
    dependsOn: ["payment-provider"],
  },
  {
    name: "payment-provider",
    displayName: "Payment Provider",
    uptimePct: 99.99,
    description: "Third-party external payment processor.",
    dependsOn: [],
  },
  {
    name: "search-service",
    displayName: "Search Service",
    uptimePct: 99.9,
    description: "Product search and indexing pipeline.",
    dependsOn: [],
  },
  {
    name: "notification-api",
    displayName: "Notification API",
    uptimePct: 99.9,
    description: "Sends transactional email and push notifications.",
    dependsOn: [],
  },
];

export function createInitialSnapshot(nowMs: number = Date.now()): SimulationSnapshot {
  const services: Record<string, ServiceState> = {};
  for (const def of SERVICE_DEFS) {
    services[def.name] = { ...def, health: "HEALTHY", version: "1.0.0" };
  }
  services["payment-api"].version = "2.8.1";
  services["payment-api"].health = "DEGRADED";
  services["checkout-api"].version = "4.2.0";
  services["checkout-api"].health = "DEGRADED";
  services["auth-service"].version = "3.1.2";
  services["search-service"].version = "1.9.0";
  services["search-service"].health = "DEGRADED";
  services["notification-api"].version = "2.3.5";
  services["notification-api"].health = "DEGRADED";
  services["payment-provider"].version = "n/a";
  services["frontend"].version = "9.4.1";

  const deployments: Record<string, DeploymentRecord[]> = {
    "payment-api": [
      {
        id: "dep-payment-2.8.1",
        service: "payment-api",
        version: "2.8.1",
        previousVersion: "2.8.0",
        deployedAt: isoMinutesAgo(nowMs, 17),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
      {
        id: "dep-payment-2.8.0",
        service: "payment-api",
        version: "2.8.0",
        previousVersion: "2.7.4",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 3),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
      {
        id: "dep-payment-2.7.4",
        service: "payment-api",
        version: "2.7.4",
        previousVersion: "2.7.3",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 9),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
    ],
    "checkout-api": [
      {
        id: "dep-checkout-4.2.0",
        service: "checkout-api",
        version: "4.2.0",
        previousVersion: "4.1.8",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 5),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
    ],
    "search-service": [
      {
        id: "dep-search-1.9.0",
        service: "search-service",
        version: "1.9.0",
        previousVersion: "1.8.6",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 12),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
    ],
    "notification-api": [
      {
        id: "dep-notification-2.3.5",
        service: "notification-api",
        version: "2.3.5",
        previousVersion: "2.3.4",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 7),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
    ],
    "auth-service": [
      {
        id: "dep-auth-3.1.2",
        service: "auth-service",
        version: "3.1.2",
        previousVersion: "3.1.1",
        deployedAt: isoMinutesAgo(nowMs, 60 * 24 * 20),
        deployedBy: "ci-pipeline",
        status: "SUCCESS",
      },
    ],
  };

  const logs: Record<string, LogEntry[]> = {
    "payment-api": [
      ...Array.from({ length: 3 }).map((_, i) => ({
        id: `log-pay-pre-${i}`,
        timestamp: isoMinutesAgo(nowMs, 20 - i * 2),
        service: "payment-api",
        severity: "INFO" as const,
        message: "Request processed successfully",
      })),
      {
        id: "log-pay-1",
        timestamp: isoMinutesAgo(nowMs, 13),
        service: "payment-api",
        severity: "INFO",
        message: "Deployment v2.8.1 rolled out, service restarted",
      },
      {
        id: "log-pay-2",
        timestamp: isoMinutesAgo(nowMs, 11),
        service: "payment-api",
        severity: "INFO",
        message: "Request received",
      },
      {
        id: "log-pay-3",
        timestamp: isoMinutesAgo(nowMs, 11),
        service: "payment-api",
        severity: "INFO",
        message: "Payment initiated",
      },
      {
        id: "log-pay-4",
        timestamp: isoMinutesAgo(nowMs, 10.8),
        service: "payment-api",
        severity: "ERROR",
        message: "PaymentProviderTimeout: upstream did not respond within 3000ms",
      },
      {
        id: "log-pay-5",
        timestamp: isoMinutesAgo(nowMs, 10.6),
        service: "payment-api",
        severity: "WARN",
        message: "Retry attempt 1/3",
      },
      {
        id: "log-pay-6",
        timestamp: isoMinutesAgo(nowMs, 10.4),
        service: "payment-api",
        severity: "ERROR",
        message: "PaymentProviderTimeout: upstream did not respond within 3000ms",
      },
      {
        id: "log-pay-7",
        timestamp: isoMinutesAgo(nowMs, 9),
        service: "payment-api",
        severity: "ERROR",
        message: "PaymentProviderTimeout: connection pool exhausted waiting on provider",
      },
      {
        id: "log-pay-8",
        timestamp: isoMinutesAgo(nowMs, 6),
        service: "payment-api",
        severity: "ERROR",
        message: "PaymentProviderTimeout: upstream did not respond within 3000ms",
      },
      {
        id: "log-pay-9",
        timestamp: isoMinutesAgo(nowMs, 2),
        service: "payment-api",
        severity: "ERROR",
        message: "PaymentProviderTimeout: upstream did not respond within 3000ms",
      },
    ],
    "checkout-api": [
      {
        id: "log-chk-1",
        timestamp: isoMinutesAgo(nowMs, 10),
        service: "checkout-api",
        severity: "ERROR",
        message: "Downstream call to payment-api failed: 504 Gateway Timeout",
      },
      {
        id: "log-chk-2",
        timestamp: isoMinutesAgo(nowMs, 5),
        service: "checkout-api",
        severity: "ERROR",
        message: "Order placement failed: payment authorization did not complete",
      },
      {
        id: "log-chk-3",
        timestamp: isoMinutesAgo(nowMs, 1),
        service: "checkout-api",
        severity: "WARN",
        message: "Elevated latency on POST /orders (p95 2.1s)",
      },
    ],
    "auth-service": [
      {
        id: "log-auth-1",
        timestamp: isoMinutesAgo(nowMs, 5),
        service: "auth-service",
        severity: "INFO",
        message: "Session validated",
      },
    ],
    "search-service": [
      {
        id: "log-search-1",
        timestamp: isoMinutesAgo(nowMs, 25),
        service: "search-service",
        severity: "WARN",
        message: "Indexing queue depth exceeds 5000 items",
      },
      {
        id: "log-search-2",
        timestamp: isoMinutesAgo(nowMs, 18),
        service: "search-service",
        severity: "WARN",
        message: "Indexing queue depth exceeds 12000 items, consumer lag increasing",
      },
      {
        id: "log-search-3",
        timestamp: isoMinutesAgo(nowMs, 10),
        service: "search-service",
        severity: "ERROR",
        message: "Index freshness SLA breached: last successful commit 14m ago",
      },
      {
        id: "log-search-4",
        timestamp: isoMinutesAgo(nowMs, 3),
        service: "search-service",
        severity: "WARN",
        message: "Consumer group rebalancing, partial indexing throughput",
      },
    ],
    "notification-api": [
      {
        id: "log-notif-1",
        timestamp: isoMinutesAgo(nowMs, 40),
        service: "notification-api",
        severity: "INFO",
        message: "Worker pool healthy, memory 41%",
      },
      {
        id: "log-notif-2",
        timestamp: isoMinutesAgo(nowMs, 22),
        service: "notification-api",
        severity: "WARN",
        message: "Memory usage climbing: 68% (baseline 42%)",
      },
      {
        id: "log-notif-3",
        timestamp: isoMinutesAgo(nowMs, 9),
        service: "notification-api",
        severity: "ERROR",
        message: "OutOfMemoryError in template-render worker, pod restarted",
      },
      {
        id: "log-notif-4",
        timestamp: isoMinutesAgo(nowMs, 4),
        service: "notification-api",
        severity: "ERROR",
        message: "OutOfMemoryError in template-render worker, pod restarted",
      },
      {
        id: "log-notif-5",
        timestamp: isoMinutesAgo(nowMs, 1),
        service: "notification-api",
        severity: "WARN",
        message: "Pod restart count: 4 in last 30 minutes",
      },
    ],
  };

  const metrics: Record<string, MetricPoint[]> = {
    "payment-api": buildSeries(nowMs, 30, 1, (m) => {
      const post = m <= 13;
      return post
        ? {
            errorRatePct: jitter(18.7, 2.5),
            latencyMs: jitter(2400, 300),
            requestsPerMin: Math.round(jitter(740, 60)),
            cpuPct: jitter(38, 6),
            memoryPct: jitter(52, 5),
          }
        : {
            errorRatePct: jitter(0.6, 0.5),
            latencyMs: jitter(210, 40),
            requestsPerMin: Math.round(jitter(900, 60)),
            cpuPct: jitter(34, 6),
            memoryPct: jitter(48, 5),
          };
    }),
    "checkout-api": buildSeries(nowMs, 30, 1, (m) => {
      const post = m <= 12;
      return post
        ? {
            errorRatePct: jitter(14.2, 2),
            latencyMs: jitter(2100, 250),
            requestsPerMin: Math.round(jitter(650, 50)),
            cpuPct: jitter(40, 5),
            memoryPct: jitter(50, 5),
          }
        : {
            errorRatePct: jitter(0.3, 0.3),
            latencyMs: jitter(180, 30),
            requestsPerMin: Math.round(jitter(820, 50)),
            cpuPct: jitter(32, 5),
            memoryPct: jitter(46, 5),
          };
    }),
    "auth-service": buildSeries(nowMs, 30, 2, () => ({
      errorRatePct: jitter(0.1, 0.1),
      latencyMs: jitter(60, 15),
      requestsPerMin: Math.round(jitter(1400, 80)),
      cpuPct: jitter(22, 4),
      memoryPct: jitter(38, 4),
    })),
    "search-service": buildSeries(nowMs, 30, 1, (m) => {
      const factor = Math.max(0, (30 - m) / 30);
      return {
        errorRatePct: Math.round((0.5 + factor * 3) * 10) / 10,
        latencyMs: Math.round(300 + factor * 550),
        requestsPerMin: Math.round(jitter(410, 40)),
        cpuPct: Math.round(45 + factor * 25),
        memoryPct: jitter(50, 5),
      };
    }),
    "notification-api": buildSeries(nowMs, 40, 2, (m) => {
      const factor = Math.max(0, (40 - m) / 40);
      return {
        errorRatePct: Math.round(factor * 4 * 10) / 10,
        latencyMs: Math.round(120 + factor * 180),
        requestsPerMin: Math.round(jitter(300, 30)),
        cpuPct: jitter(30, 6),
        memoryPct: Math.min(94, Math.round(40 + factor * 54)),
      };
    }),
    "payment-provider": buildSeries(nowMs, 30, 2, () => ({
      errorRatePct: jitter(0.2, 0.2),
      latencyMs: jitter(90, 20),
      requestsPerMin: Math.round(jitter(700, 60)),
      cpuPct: jitter(25, 5),
      memoryPct: jitter(40, 5),
    })),
    frontend: buildSeries(nowMs, 30, 2, () => ({
      errorRatePct: jitter(0.4, 0.3),
      latencyMs: jitter(140, 30),
      requestsPerMin: Math.round(jitter(2200, 150)),
      cpuPct: jitter(28, 5),
      memoryPct: jitter(44, 5),
    })),
  };

  const incidents: Record<string, IncidentState> = {
    "INC-1042": {
      id: "INC-1042",
      title: "Payment API Degradation",
      service: "payment-api",
      affectedServices: ["payment-api", "checkout-api"],
      severity: "CRITICAL",
      status: "ACTIVE",
      detectedAt: isoMinutesAgo(nowMs, 6),
      resolvedAt: null,
      description:
        "Elevated error rate and latency on payment-api following a deployment. Checkout is failing to complete orders.",
      timeline: [
        { id: "t1", timestamp: isoMinutesAgo(nowMs, 17), label: "Deployment started", detail: "payment-api build #4821 queued" },
        { id: "t2", timestamp: isoMinutesAgo(nowMs, 13), label: "payment-api v2.8.1 deployed" },
        { id: "t3", timestamp: isoMinutesAgo(nowMs, 11), label: "Error rate increased", detail: "0.6% -> 12%" },
        { id: "t4", timestamp: isoMinutesAgo(nowMs, 10.8), label: "PaymentProviderTimeout detected" },
        { id: "t5", timestamp: isoMinutesAgo(nowMs, 7), label: "Alert triggered", detail: "error_rate > 10% for 5m" },
        { id: "t6", timestamp: isoMinutesAgo(nowMs, 6), label: "Incident created", detail: "INC-1042 opened" },
      ],
      evidence: [],
      remediationPlan: null,
      rootCause: null,
    },
    "INC-1041": {
      id: "INC-1041",
      title: "Database Connection Saturation",
      service: "checkout-api",
      affectedServices: ["checkout-api"],
      severity: "HIGH",
      status: "ACTIVE",
      detectedAt: isoMinutesAgo(nowMs, 15),
      resolvedAt: null,
      description:
        "checkout-api connection pool to the order database is near its configured limit, causing intermittent timeouts. No recent deployment implicated.",
      timeline: [
        { id: "t1", timestamp: isoMinutesAgo(nowMs, 22), label: "DB connection pool utilization crossed 80%" },
        { id: "t2", timestamp: isoMinutesAgo(nowMs, 18), label: "First connection timeout logged" },
        { id: "t3", timestamp: isoMinutesAgo(nowMs, 15), label: "Alert triggered", detail: "pool_utilization > 90% for 5m" },
        { id: "t4", timestamp: isoMinutesAgo(nowMs, 15), label: "Incident created", detail: "INC-1041 opened" },
      ],
      evidence: [],
      remediationPlan: null,
      rootCause: null,
    },
    "INC-1039": {
      id: "INC-1039",
      title: "Search Indexing Delay",
      service: "search-service",
      affectedServices: ["search-service"],
      severity: "MEDIUM",
      status: "ACTIVE",
      detectedAt: isoMinutesAgo(nowMs, 10),
      resolvedAt: null,
      description:
        "The search indexing pipeline is backlogged, degrading result freshness. Query availability is unaffected.",
      timeline: [
        { id: "t1", timestamp: isoMinutesAgo(nowMs, 25), label: "Indexing queue depth exceeds 5,000 items" },
        { id: "t2", timestamp: isoMinutesAgo(nowMs, 18), label: "Consumer lag increasing" },
        { id: "t3", timestamp: isoMinutesAgo(nowMs, 10), label: "Index freshness SLA breached" },
        { id: "t4", timestamp: isoMinutesAgo(nowMs, 10), label: "Incident created", detail: "INC-1039 opened" },
      ],
      evidence: [],
      remediationPlan: null,
      rootCause: null,
    },
    "INC-1037": {
      id: "INC-1037",
      title: "Notification API Memory Leak",
      service: "notification-api",
      affectedServices: ["notification-api"],
      severity: "HIGH",
      status: "ACTIVE",
      detectedAt: isoMinutesAgo(nowMs, 9),
      resolvedAt: null,
      description:
        "notification-api memory usage is climbing steadily, triggering repeated OOM restarts of the template-render worker pool.",
      timeline: [
        { id: "t1", timestamp: isoMinutesAgo(nowMs, 40), label: "Baseline memory usage: 41%" },
        { id: "t2", timestamp: isoMinutesAgo(nowMs, 22), label: "Memory usage climbing", detail: "68% and rising" },
        { id: "t3", timestamp: isoMinutesAgo(nowMs, 9), label: "First OOM restart" },
        { id: "t4", timestamp: isoMinutesAgo(nowMs, 9), label: "Incident created", detail: "INC-1037 opened" },
      ],
      evidence: [],
      remediationPlan: null,
      rootCause: null,
    },
  };

  return { services, incidents, deployments, logs, metrics };
}
