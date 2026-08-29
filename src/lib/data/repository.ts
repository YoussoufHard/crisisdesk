import { simulationStore } from "./store";
import type {
  DeploymentRecord,
  EvidenceEntry,
  IncidentState,
  LogEntry,
  LogSeverity,
  MetricPoint,
  RemediationPlan,
  ServiceState,
  ToolResult,
} from "./types";

function ok<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

function err<T>(code: string, message: string): ToolResult<T> {
  return { success: false, error: { code, message } };
}

export function getIncident(incidentId: string): ToolResult<IncidentState> {
  const incident = simulationStore.getSnapshot().incidents[incidentId];
  if (!incident) {
    return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);
  }
  return ok(incident);
}

export function listIncidents(): IncidentState[] {
  return Object.values(simulationStore.getSnapshot().incidents).sort((a, b) =>
    a.detectedAt < b.detectedAt ? 1 : -1,
  );
}

export function getService(serviceName: string): ToolResult<ServiceState> {
  const service = simulationStore.getSnapshot().services[serviceName];
  if (!service) {
    return err("SERVICE_NOT_FOUND", `Service ${serviceName} was not found.`);
  }
  return ok(service);
}

export function listServices(): ServiceState[] {
  return Object.values(simulationStore.getSnapshot().services);
}

export function getDeployments(serviceName: string, limit = 10): ToolResult<DeploymentRecord[]> {
  const snapshot = simulationStore.getSnapshot();
  if (!snapshot.services[serviceName]) {
    return err("SERVICE_NOT_FOUND", `Service ${serviceName} was not found.`);
  }
  const records = snapshot.deployments[serviceName] ?? [];
  return ok(records.slice(0, limit));
}

export function getLogs(
  serviceName: string,
  options?: { severity?: LogSeverity; limit?: number },
): ToolResult<LogEntry[]> {
  const snapshot = simulationStore.getSnapshot();
  if (!snapshot.services[serviceName]) {
    return err("SERVICE_NOT_FOUND", `Service ${serviceName} was not found.`);
  }
  let records = snapshot.logs[serviceName] ?? [];
  if (options?.severity) {
    records = records.filter((l) => l.severity === options.severity);
  }
  records = [...records].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return ok(records.slice(0, options?.limit ?? 50));
}

export function getMetrics(
  serviceName: string,
  timeRangeMinutes = 30,
): ToolResult<MetricPoint[]> {
  const snapshot = simulationStore.getSnapshot();
  if (!snapshot.services[serviceName]) {
    return err("SERVICE_NOT_FOUND", `Service ${serviceName} was not found.`);
  }
  const all = snapshot.metrics[serviceName] ?? [];
  const cutoff = Date.now() - timeRangeMinutes * 60_000;
  const filtered = all.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
  return ok(filtered.length > 0 ? filtered : all);
}

export interface DependencyGraph {
  service: string;
  dependsOn: string[];
  dependedOnBy: string[];
}

export function getDependencies(serviceName: string): ToolResult<DependencyGraph> {
  const snapshot = simulationStore.getSnapshot();
  const service = snapshot.services[serviceName];
  if (!service) {
    return err("SERVICE_NOT_FOUND", `Service ${serviceName} was not found.`);
  }
  const dependedOnBy = Object.values(snapshot.services)
    .filter((s) => s.dependsOn.includes(serviceName))
    .map((s) => s.name);
  return ok({ service: serviceName, dependsOn: service.dependsOn, dependedOnBy });
}

export function parseTimeRange(timeRange: string | undefined): number {
  if (!timeRange) return 30;
  const match = /^(\d+)(m|h)$/.exec(timeRange.trim());
  if (!match) return 30;
  const value = Number(match[1]);
  return match[2] === "h" ? value * 60 : value;
}

export function addEvidence(
  incidentId: string,
  entries: Array<{ signal: string; source: string }>,
): ToolResult<EvidenceEntry[]> {
  const exists = simulationStore.getSnapshot().incidents[incidentId];
  if (!exists) return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);

  const created: EvidenceEntry[] = entries.map((e, i) => ({
    id: `${incidentId}-ev-${Date.now()}-${i}`,
    signal: e.signal,
    source: e.source,
    addedAt: new Date().toISOString(),
  }));

  simulationStore.mutate((draft) => {
    draft.incidents[incidentId].evidence.push(...created);
  });

  return ok(created);
}

export function setRootCause(
  incidentId: string,
  hypothesis: string,
  confidence: number,
  reasoningSummary: string[],
): ToolResult<IncidentState["rootCause"]> {
  const exists = simulationStore.getSnapshot().incidents[incidentId];
  if (!exists) return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);

  const rootCause = { hypothesis, confidence, reasoningSummary };
  simulationStore.mutate((draft) => {
    draft.incidents[incidentId].rootCause = rootCause;
    draft.incidents[incidentId].status = "MITIGATING";
  });
  return ok(rootCause);
}

export function setRemediationPlan(
  incidentId: string,
  plan: RemediationPlan,
): ToolResult<RemediationPlan> {
  const exists = simulationStore.getSnapshot().incidents[incidentId];
  if (!exists) return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);

  simulationStore.mutate((draft) => {
    draft.incidents[incidentId].remediationPlan = plan;
  });
  return ok(plan);
}

export interface RemediationOutcome {
  incidentId: string;
  service: string;
  fromVersion: string;
  toVersion: string;
  before: { errorRatePct: number; latencyMs: number };
  after: { errorRatePct: number; latencyMs: number };
}

export function applyRollbackRemediation(
  incidentId: string,
  service: string,
  toVersion: string,
): ToolResult<RemediationOutcome> {
  const snapshot = simulationStore.getSnapshot();
  const incident = snapshot.incidents[incidentId];
  const svc = snapshot.services[service];
  if (!incident) return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);
  if (!svc) return err("SERVICE_NOT_FOUND", `Service ${service} was not found.`);

  const latestMetrics = snapshot.metrics[service]?.[snapshot.metrics[service].length - 1];
  const before = {
    errorRatePct: latestMetrics?.errorRatePct ?? 0,
    latencyMs: latestMetrics?.latencyMs ?? 0,
  };
  const fromVersion = svc.version;
  const now = Date.now();

  simulationStore.mutate((draft) => {
    draft.services[service].version = toVersion;
    draft.services[service].health = "HEALTHY";

    for (const affected of draft.incidents[incidentId].affectedServices) {
      if (draft.services[affected]) draft.services[affected].health = "HEALTHY";
      const recoveredPoint = {
        timestamp: new Date(now).toISOString(),
        errorRatePct: affected === service ? 0.8 : 0.3,
        latencyMs: affected === service ? 320 : 180,
        requestsPerMin: draft.metrics[affected]?.at(-1)?.requestsPerMin ?? 900,
        cpuPct: 30,
        memoryPct: 45,
      };
      draft.metrics[affected] = [...(draft.metrics[affected] ?? []), recoveredPoint];
      draft.logs[affected] = [
        {
          id: `${affected}-recovery-${now}`,
          timestamp: new Date(now).toISOString(),
          service: affected,
          severity: "INFO",
          message:
            affected === service
              ? `Rollback to ${toVersion} complete, health check passed`
              : "Downstream recovery detected, error rate normalizing",
        },
        ...(draft.logs[affected] ?? []),
      ];
    }

    draft.deployments[service] = [
      {
        id: `dep-${service}-rollback-${now}`,
        service,
        version: toVersion,
        previousVersion: fromVersion,
        deployedAt: new Date(now).toISOString(),
        deployedBy: "crisisdesk-agent",
        status: "ROLLED_BACK",
      },
      ...(draft.deployments[service] ?? []),
    ];

    draft.incidents[incidentId].status = "RESOLVED";
    draft.incidents[incidentId].resolvedAt = new Date(now).toISOString();
    draft.incidents[incidentId].timeline.push(
      { id: `resolve-${now}`, timestamp: new Date(now).toISOString(), label: "Rollback executed", detail: `${service} ${fromVersion} -> ${toVersion}` },
      { id: `resolve-${now + 1}`, timestamp: new Date(now + 1000).toISOString(), label: "Incident resolved" },
    );
  });

  return ok({
    incidentId,
    service,
    fromVersion,
    toVersion,
    before,
    after: { errorRatePct: 0.8, latencyMs: 320 },
  });
}

export interface GenericRemediationOutcome {
  incidentId: string;
  service: string;
  action: string;
  before: { errorRatePct: number; memoryPct: number };
  after: { errorRatePct: number; memoryPct: number };
}

/**
 * Resolves an incident whose fix isn't a version rollback (e.g. restarting a
 * leaking worker pool, draining a connection pool, clearing a queue backlog).
 * Still fully simulated: it only ever mutates in-browser state.
 */
export function applyGenericRemediation(
  incidentId: string,
  service: string,
  action: string,
  description: string,
): ToolResult<GenericRemediationOutcome> {
  const snapshot = simulationStore.getSnapshot();
  const incident = snapshot.incidents[incidentId];
  const svc = snapshot.services[service];
  if (!incident) return err("INCIDENT_NOT_FOUND", `Incident ${incidentId} was not found.`);
  if (!svc) return err("SERVICE_NOT_FOUND", `Service ${service} was not found.`);

  const latestMetrics = snapshot.metrics[service]?.at(-1);
  const before = {
    errorRatePct: latestMetrics?.errorRatePct ?? 0,
    memoryPct: latestMetrics?.memoryPct ?? 0,
  };
  const now = Date.now();

  simulationStore.mutate((draft) => {
    for (const affected of draft.incidents[incidentId].affectedServices) {
      if (draft.services[affected]) draft.services[affected].health = "HEALTHY";
      const recoveredPoint = {
        timestamp: new Date(now).toISOString(),
        errorRatePct: 0.3,
        latencyMs: draft.metrics[affected]?.at(-1)?.latencyMs ?? 200,
        requestsPerMin: draft.metrics[affected]?.at(-1)?.requestsPerMin ?? 900,
        cpuPct: 28,
        memoryPct: 42,
      };
      draft.metrics[affected] = [...(draft.metrics[affected] ?? []), recoveredPoint];
      draft.logs[affected] = [
        {
          id: `${affected}-recovery-${now}`,
          timestamp: new Date(now).toISOString(),
          service: affected,
          severity: "INFO",
          message: affected === service ? `${action} complete: ${description}` : "Downstream recovery detected",
        },
        ...(draft.logs[affected] ?? []),
      ];
    }

    draft.incidents[incidentId].status = "RESOLVED";
    draft.incidents[incidentId].resolvedAt = new Date(now).toISOString();
    draft.incidents[incidentId].timeline.push(
      { id: `resolve-${now}`, timestamp: new Date(now).toISOString(), label: `${action} executed`, detail: description },
      { id: `resolve-${now + 1}`, timestamp: new Date(now + 1000).toISOString(), label: "Incident resolved" },
    );
  });

  return ok({
    incidentId,
    service,
    action,
    before,
    after: { errorRatePct: 0.3, memoryPct: 42 },
  });
}

export function resetSimulation() {
  simulationStore.resetAll();
}
