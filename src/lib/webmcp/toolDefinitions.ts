import type { ToolDefinition } from "./types";

/**
 * Name + description + inputSchema for every CrisisDesk WebMCP tool. This file
 * has no `execute` implementations, so it is safe to import from server code
 * (e.g. to build Gemini function-calling declarations) as well as the client
 * registration path in `register.tsx`. `annotations.readOnlyHint` marks
 * investigation tools; `execute_remediation` is the only one that is not
 * read-only and requires human approval (see approval.ts).
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_incident",
    description: "Retrieve structured details for an incident by its ID, including status, severity, timeline, and affected services.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier, e.g. INC-1042" },
      },
      required: ["incident_id"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_service_status",
    description: "Get the current health, version, uptime, and dependencies of a service.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. payment-api" },
      },
      required: ["service"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_metrics",
    description: "Get error rate, latency, request volume, CPU, and memory metrics for a service over a recent time window.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. payment-api" },
        time_range: { type: "string", description: "Lookback window, e.g. '30m' or '2h'. Defaults to 30m." },
      },
      required: ["service"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_logs",
    description: "Get recent structured log entries for a service, optionally filtered by severity.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. payment-api" },
        severity: { type: "string", enum: ["DEBUG", "INFO", "WARN", "ERROR"], description: "Filter to a single severity level." },
        limit: { type: "number", description: "Maximum number of entries to return. Defaults to 50." },
      },
      required: ["service"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_recent_deployments",
    description: "Get the recent deployment history for a service, most recent first.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. payment-api" },
        limit: { type: "number", description: "Maximum number of deployments to return. Defaults to 10." },
      },
      required: ["service"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_dependencies",
    description: "Get the upstream services a service depends on, and the downstream services that depend on it.",
    inputSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, e.g. payment-api" },
      },
      required: ["service"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "correlate_evidence",
    description: "Record one or more correlated signals as evidence on an incident, after reviewing logs, metrics, and deployments. Call this once you have identified concrete signals worth attaching to the investigation record.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier, e.g. INC-1042" },
        signals: {
          type: "array",
          description: "Concrete, evidence-backed observations (not speculation).",
          items: {
            type: "object",
            properties: {
              signal: { type: "string", description: "The observation, e.g. 'Error rate rose from 0.6% to 18.7% within 2 minutes of deployment'." },
              source: { type: "string", description: "Where this came from, e.g. 'get_metrics(payment-api)' or 'get_logs(payment-api)'." },
            },
            required: ["signal", "source"],
          },
        },
      },
      required: ["incident_id", "signals"],
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: "create_root_cause_hypothesis",
    description: "Record the agent's root cause hypothesis for an incident, with a confidence score and a concise, decision-relevant reasoning summary. Do not include hidden chain-of-thought — only the evidence-backed summary.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier, e.g. INC-1042" },
        hypothesis: { type: "string", description: "One-sentence root cause statement." },
        confidence: { type: "number", description: "Confidence from 0 to 1." },
        reasoning_summary: {
          type: "array",
          description: "Short bullet points of the evidence supporting this hypothesis.",
          items: { type: "string" },
        },
      },
      required: ["incident_id", "hypothesis", "confidence", "reasoning_summary"],
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: "create_remediation_plan",
    description: "Propose a structured remediation plan for an incident. This only records a proposal — it does not change any system state.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier, e.g. INC-1042" },
        summary: { type: "string", description: "One-sentence summary of the plan." },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                description:
                  "A short snake_case action name, e.g. rollback_service (requires to_version), restart_service, drain_connection_pool, or clear_queue_backlog.",
              },
              target: { type: "string", description: "Service the action targets." },
              from_version: { type: "string" },
              to_version: { type: "string" },
              risk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
              description: { type: "string" },
            },
            required: ["action", "target", "risk", "description"],
          },
        },
      },
      required: ["incident_id", "summary", "steps"],
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: "execute_remediation",
    description: "Execute a previously proposed remediation step against the simulated environment. HIGH IMPACT: this always pauses for explicit human approval in the UI before anything runs, and it never touches real infrastructure — only the CrisisDesk simulation.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string", description: "Incident identifier, e.g. INC-1042" },
        step_id: { type: "string", description: "The step ID from the remediation plan to execute." },
      },
      required: ["incident_id", "step_id"],
    },
    annotations: { readOnlyHint: false },
  },
];

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}
