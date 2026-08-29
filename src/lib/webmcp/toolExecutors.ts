import { approvalBroker } from "./approval";
import * as repo from "@/lib/data/repository";
import { simulationStore } from "@/lib/data/store";
import type { RemediationPlan, RemediationStep } from "@/lib/data/types";
import type { ToolExecuteResult, ToolExecutor } from "./types";

function textResult(data: unknown, isError = false): ToolExecuteResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }], isError };
}

/** Wraps a repository `ToolResult` and mirrors its `success` flag onto `isError`. */
function fromToolResult(result: { success: boolean }): ToolExecuteResult {
  return textResult(result, !result.success);
}

function badRequest(message: string): ToolExecuteResult {
  return textResult({ success: false, error: { code: "INVALID_INPUT", message } }, true);
}

function wrapLogged(name: string, run: ToolExecutor): ToolExecutor {
  return async (input, signal) => {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    let result: ToolExecuteResult;
    try {
      result = await run(input, signal);
    } catch (e) {
      result = textResult(
        { success: false, error: { code: "TOOL_EXECUTION_ERROR", message: e instanceof Error ? e.message : String(e) } },
        true,
      );
    }
    const durationMs = Math.round(performance.now() - start);
    let parsedOutput: unknown = result.content[0]?.text;
    try {
      parsedOutput = JSON.parse(result.content[0]?.text ?? "null");
    } catch {
      // keep raw text
    }
    simulationStore.recordToolCall({
      id: `${name}-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      toolName: name,
      input,
      output: parsedOutput,
      status: result.isError ? "ERROR" : "SUCCESS",
      startedAt,
      durationMs,
    });
    return result;
  };
}

const getIncident: ToolExecutor = async (input) => {
  const incidentId = input.incident_id;
  if (typeof incidentId !== "string") return badRequest("incident_id is required and must be a string.");
  return fromToolResult(repo.getIncident(incidentId));
};

const getServiceStatus: ToolExecutor = async (input) => {
  const service = input.service;
  if (typeof service !== "string") return badRequest("service is required and must be a string.");
  return fromToolResult(repo.getService(service));
};

const getMetrics: ToolExecutor = async (input) => {
  const service = input.service;
  if (typeof service !== "string") return badRequest("service is required and must be a string.");
  const timeRange = repo.parseTimeRange(typeof input.time_range === "string" ? input.time_range : undefined);
  return fromToolResult(repo.getMetrics(service, timeRange));
};

const getLogs: ToolExecutor = async (input) => {
  const service = input.service;
  if (typeof service !== "string") return badRequest("service is required and must be a string.");
  const severity = typeof input.severity === "string" ? (input.severity as "DEBUG" | "INFO" | "WARN" | "ERROR") : undefined;
  const limit = typeof input.limit === "number" ? input.limit : undefined;
  return fromToolResult(repo.getLogs(service, { severity, limit }));
};

const getRecentDeployments: ToolExecutor = async (input) => {
  const service = input.service;
  if (typeof service !== "string") return badRequest("service is required and must be a string.");
  const limit = typeof input.limit === "number" ? input.limit : 10;
  return fromToolResult(repo.getDeployments(service, limit));
};

const getDependencies: ToolExecutor = async (input) => {
  const service = input.service;
  if (typeof service !== "string") return badRequest("service is required and must be a string.");
  return fromToolResult(repo.getDependencies(service));
};

const correlateEvidence: ToolExecutor = async (input) => {
  const incidentId = input.incident_id;
  const signals = input.signals;
  if (typeof incidentId !== "string") return badRequest("incident_id is required and must be a string.");
  if (!Array.isArray(signals) || signals.length === 0) return badRequest("signals must be a non-empty array.");
  const normalized = signals.map((s) => ({
    signal: String((s as Record<string, unknown>).signal ?? ""),
    source: String((s as Record<string, unknown>).source ?? ""),
  }));
  return fromToolResult(repo.addEvidence(incidentId, normalized));
};

const createRootCauseHypothesis: ToolExecutor = async (input) => {
  const incidentId = input.incident_id;
  const hypothesis = input.hypothesis;
  const confidence = input.confidence;
  const reasoningSummary = input.reasoning_summary;
  if (typeof incidentId !== "string") return badRequest("incident_id is required and must be a string.");
  if (typeof hypothesis !== "string") return badRequest("hypothesis is required and must be a string.");
  if (typeof confidence !== "number") return badRequest("confidence is required and must be a number between 0 and 1.");
  if (!Array.isArray(reasoningSummary)) return badRequest("reasoning_summary must be an array of strings.");
  return fromToolResult(
    repo.setRootCause(incidentId, hypothesis, Math.max(0, Math.min(1, confidence)), reasoningSummary.map(String)),
  );
};

const createRemediationPlan: ToolExecutor = async (input) => {
  const incidentId = input.incident_id;
  const summary = input.summary;
  const steps = input.steps;
  if (typeof incidentId !== "string") return badRequest("incident_id is required and must be a string.");
  if (typeof summary !== "string") return badRequest("summary is required and must be a string.");
  if (!Array.isArray(steps) || steps.length === 0) return badRequest("steps must be a non-empty array.");

  const normalizedSteps: RemediationStep[] = steps.map((s, i) => {
    const step = s as Record<string, unknown>;
    return {
      id: `${incidentId}-step-${i + 1}`,
      action: String(step.action ?? ""),
      target: String(step.target ?? ""),
      fromVersion: typeof step.from_version === "string" ? step.from_version : undefined,
      toVersion: typeof step.to_version === "string" ? step.to_version : undefined,
      risk: (["LOW", "MEDIUM", "HIGH"].includes(String(step.risk)) ? step.risk : "MEDIUM") as RemediationStep["risk"],
      description: String(step.description ?? ""),
    };
  });

  const plan: RemediationPlan = {
    incidentId,
    createdAt: new Date().toISOString(),
    steps: normalizedSteps,
    summary,
  };

  return fromToolResult(repo.setRemediationPlan(incidentId, plan));
};

const executeRemediation: ToolExecutor = async (input) => {
  const incidentId = input.incident_id;
  const stepId = input.step_id;
  if (typeof incidentId !== "string") return badRequest("incident_id is required and must be a string.");
  if (typeof stepId !== "string") return badRequest("step_id is required and must be a string.");

  const incidentResult = repo.getIncident(incidentId);
  if (!incidentResult.success) return textResult(incidentResult, true);

  const plan = incidentResult.data.remediationPlan;
  const step = plan?.steps.find((s) => s.id === stepId);
  if (!step) {
    return textResult(
      { success: false, error: { code: "STEP_NOT_FOUND", message: `Step ${stepId} was not found on the remediation plan for ${incidentId}.` } },
      true,
    );
  }

  const approved = await approvalBroker.request({
    incidentId,
    action: step.action,
    target: step.target,
    fromVersion: step.fromVersion,
    toVersion: step.toVersion,
    risk: step.risk,
    reason: step.description,
  });

  if (!approved) {
    return textResult({ success: true, data: { approved: false, message: "Human declined the proposed action. No changes were made." } });
  }

  if (step.action === "rollback_service" && step.toVersion) {
    return fromToolResult(repo.applyRollbackRemediation(incidentId, step.target, step.toVersion));
  }

  if (!step.target) {
    return textResult(
      { success: false, error: { code: "UNSUPPORTED_ACTION", message: `Action "${step.action}" has no target service.` } },
      true,
    );
  }

  return fromToolResult(repo.applyGenericRemediation(incidentId, step.target, step.action, step.description));
};

export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  get_incident: wrapLogged("get_incident", getIncident),
  get_service_status: wrapLogged("get_service_status", getServiceStatus),
  get_metrics: wrapLogged("get_metrics", getMetrics),
  get_logs: wrapLogged("get_logs", getLogs),
  get_recent_deployments: wrapLogged("get_recent_deployments", getRecentDeployments),
  get_dependencies: wrapLogged("get_dependencies", getDependencies),
  correlate_evidence: wrapLogged("correlate_evidence", correlateEvidence),
  create_root_cause_hypothesis: wrapLogged("create_root_cause_hypothesis", createRootCauseHypothesis),
  create_remediation_plan: wrapLogged("create_remediation_plan", createRemediationPlan),
  execute_remediation: wrapLogged("execute_remediation", executeRemediation),
};
