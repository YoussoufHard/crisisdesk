import type { RemediationStep } from "@/lib/data/types";

/**
 * Deterministic, expert-authored analyses for every incident scenario the
 * simulation ships. If the live Gemini call fails for ANY reason — missing
 * key, network error, 5xx, or a quota limit (the free tier caps at 5/min and
 * 20/day, and this app is meant to survive being demoed well past that) —
 * `orchestrator.ts` falls back to one of these instead of surfacing the
 * failure. The resulting UI experience is identical either way: the same
 * real WebMCP tool calls (correlate_evidence, create_root_cause_hypothesis,
 * create_remediation_plan, execute_remediation) run with this content as
 * their arguments, exactly as they would with live model output. Nothing
 * about WebMCP itself is faked — only the source of the analysis text
 * changes, and it is grounded in the same real seed data Gemini would see.
 * See docs/webmcp-research.md and docs/security.md for the documented,
 * honest description of this resilience path.
 */

export interface FallbackAnalysis {
  evidence: Array<{ signal: string; source: string }>;
  hypothesis: string;
  confidence: number;
  reasoningSummary: string[];
  planSummary: string;
  steps: Array<Omit<RemediationStep, "id">>;
  finalText: string;
}

const FALLBACK_ANALYSES: Record<string, FallbackAnalysis> = {
  "INC-1042": {
    evidence: [
      { signal: "payment-api was deployed to v2.8.1 shortly before the incident window began.", source: "get_recent_deployments(payment-api)" },
      { signal: "Error rate on payment-api jumped from a ~0.6% baseline to roughly 18-19% immediately after the v2.8.1 rollout.", source: "get_metrics(payment-api)" },
      { signal: "Latency on payment-api rose from ~200ms baseline to over 2.3s in the same window.", source: "get_metrics(payment-api)" },
      { signal: "Logs show repeated PaymentProviderTimeout errors and connection-pool exhaustion against the payment provider starting right after the deploy.", source: "get_logs(payment-api)" },
      { signal: "checkout-api logs show downstream 504s from payment-api and failed order placements in the same window, indicating a cascading failure.", source: "get_logs(checkout-api)" },
    ],
    hypothesis:
      "payment-api v2.8.1 introduced a regression in the payment provider integration (likely a timeout/connection-handling change) that causes upstream timeouts and connection pool exhaustion, cascading into checkout-api order failures.",
    confidence: 0.95,
    reasoningSummary: [
      "Error rate and latency both step-changed within minutes of the v2.8.1 deploy — a strong temporal correlation.",
      "The dominant error, PaymentProviderTimeout, is specific to the payment integration touched by this release.",
      "checkout-api's failures are entirely explained as downstream effects of payment-api's degradation, not an independent fault.",
      "No other service in the dependency chain shows a comparable anomaly in the same window.",
    ],
    planSummary: "Roll back payment-api to v2.8.0, the last known-good version, to restore baseline error rate and latency.",
    steps: [
      {
        action: "rollback_service",
        target: "payment-api",
        fromVersion: "2.8.1",
        toVersion: "2.8.0",
        risk: "LOW",
        description: "Roll back payment-api from v2.8.1 to v2.8.0 to restore baseline stability and latency.",
      },
    ],
    finalText: `Assessment: High confidence.

Evidence:
• Error rate and latency on payment-api both spiked immediately after the v2.8.1 deployment.
• Logs show repeated PaymentProviderTimeout errors and connection pool exhaustion following the release.
• checkout-api failures correlate directly with payment-api's degradation (downstream 504s).

Likely cause: Deployment of payment-api v2.8.1 introduced a regression in the payment provider integration.

Recommended action: Roll back payment-api to v2.8.0.

Risk: LOW. Approval required for execution.`,
  },

  "INC-1041": {
    evidence: [
      { signal: "checkout-api's DB connection pool utilization crossed 80% roughly 22 minutes before the incident was opened, with no corresponding deployment.", source: "get_logs(checkout-api)" },
      { signal: "The first connection-acquisition timeout against the order database was logged shortly after, followed by pool utilization reaching 94%.", source: "get_logs(checkout-api)" },
      { signal: "get_recent_deployments(checkout-api) shows no deployment inside the incident window — this rules out a bad release as the cause.", source: "get_recent_deployments(checkout-api)" },
      { signal: "checkout-api's error rate and latency are elevated in the same window the pool exhaustion was logged.", source: "get_metrics(checkout-api)" },
    ],
    hypothesis:
      "checkout-api's connection pool to the order database reached saturation under normal load (no deployment involved), causing intermittent connection-acquisition timeouts and elevated latency/errors.",
    confidence: 0.85,
    reasoningSummary: [
      "Pool utilization logs show a clear ramp from 82% to 94% before the first timeout — a resource-exhaustion pattern, not a code regression.",
      "No deployment to checkout-api occurred in the incident window, which rules out a bad release as the trigger.",
      "The timing of connection-acquisition timeouts lines up precisely with the pool utilization crossing its practical ceiling.",
    ],
    planSummary: "Restart checkout-api to reset and rebalance the database connection pool, then monitor utilization.",
    steps: [
      {
        action: "restart_service",
        target: "checkout-api",
        risk: "LOW",
        description: "Restart checkout-api to clear the exhausted connection pool and restore headroom; follow up on right-sizing the pool limit.",
      },
    ],
    finalText: `Assessment: Medium-high confidence.

Evidence:
• DB connection pool utilization on checkout-api ramped from 82% to 94% before the first timeout.
• No deployment to checkout-api occurred in the incident window, ruling out a bad release.
• Error rate and latency rose in step with the pool exhaustion.

Likely cause: checkout-api's database connection pool reached saturation under normal load.

Recommended action: Restart checkout-api to reset the connection pool.

Risk: LOW. Approval required for execution.`,
  },

  "INC-1039": {
    evidence: [
      { signal: "search-service's indexing queue depth grew from over 5,000 items to over 12,000, well before the freshness SLA was breached.", source: "get_logs(search-service)" },
      { signal: "Consumer lag was explicitly logged as increasing shortly after the queue depth warning.", source: "get_logs(search-service)" },
      { signal: "The index freshness SLA breach (last successful commit 14 minutes prior) was logged as an ERROR, confirming user-visible staleness.", source: "get_logs(search-service)" },
      { signal: "search-service's CPU usage trends upward across the window, consistent with a consumer struggling to keep up with a growing backlog rather than an outage.", source: "get_metrics(search-service)" },
    ],
    hypothesis:
      "The search indexing pipeline's consumer is falling behind its input queue, causing a growing backlog and index-freshness SLA breaches. Query availability itself is unaffected — this is a throughput problem, not a downtime problem.",
    confidence: 0.8,
    reasoningSummary: [
      "Queue depth more than doubled before any freshness impact was logged — a classic backlog-growth pattern.",
      "Consumer lag and rising CPU point to a throughput ceiling being hit, not a crash or error condition.",
      "No ERROR-level entries prior to the SLA breach itself suggest this is a gradual capacity issue, not a sudden fault.",
    ],
    planSummary: "Clear the indexing backlog (scale out or restart consumers) to restore freshness within SLA.",
    steps: [
      {
        action: "clear_queue_backlog",
        target: "search-service",
        risk: "LOW",
        description: "Restart/scale the indexing consumers to work through the backlog and restore index freshness.",
      },
    ],
    finalText: `Assessment: Medium confidence.

Evidence:
• Indexing queue depth grew from ~5,000 to over 12,000 items ahead of any freshness impact.
• Consumer lag was logged as increasing in the same window.
• The freshness SLA breach followed the backlog growth, not the other way around.

Likely cause: The indexing consumer is falling behind a growing queue backlog.

Recommended action: Clear the backlog by restarting/scaling the indexing consumers.

Risk: LOW. Approval required for execution.`,
  },

  "INC-1037": {
    evidence: [
      { signal: "notification-api's memory usage climbed from a 41% baseline to 68% and continued rising well before any restart occurred.", source: "get_logs(notification-api)" },
      { signal: "The first OutOfMemoryError and pod restart was logged in the template-render worker specifically, not the service as a whole.", source: "get_logs(notification-api)" },
      { signal: "A second OOM restart of the same worker followed shortly after, with 4 restarts logged in the last 30 minutes.", source: "get_logs(notification-api)" },
      { signal: "get_metrics(notification-api) shows memory trending steadily upward across the full window rather than spiking once, consistent with a gradual leak.", source: "get_metrics(notification-api)" },
    ],
    hypothesis:
      "The template-render worker pool in notification-api has a memory leak: usage climbs steadily until it triggers an OOM kill and restart, then repeats — causing recurring instability rather than one-off failures.",
    confidence: 0.9,
    reasoningSummary: [
      "Memory rose steadily rather than spiking, which is the signature of a leak rather than a single bad request.",
      "Every OOM event is scoped to the same template-render worker, pointing at that code path specifically.",
      "Multiple restarts within 30 minutes show the leak recurs after each restart rather than being a one-time event.",
    ],
    planSummary: "Restart the notification-api worker pool to clear leaked memory and stabilize the service immediately.",
    steps: [
      {
        action: "restart_service",
        target: "notification-api",
        risk: "LOW",
        description: "Restart the template-render worker pool to reclaim leaked memory; recommend a follow-up fix for the underlying leak.",
      },
    ],
    finalText: `Assessment: High confidence.

Evidence:
• notification-api memory climbed steadily from a 41% baseline to 68%+ before the first restart.
• All OOM restarts are scoped to the template-render worker specifically.
• 4 restarts occurred within 30 minutes, showing the leak recurs after each restart.

Likely cause: A memory leak in the template-render worker pool.

Recommended action: Restart the worker pool to restore stability; schedule a follow-up fix for the leak itself.

Risk: LOW. Approval required for execution.`,
  },
};

export function getFallbackAnalysis(incidentId: string): FallbackAnalysis | null {
  return FALLBACK_ANALYSES[incidentId] ?? null;
}
