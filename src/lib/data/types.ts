export type ServiceHealth = "HEALTHY" | "DEGRADED" | "DOWN";

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type IncidentStatus = "ACTIVE" | "MITIGATING" | "RESOLVED";

export type LogSeverity = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface ServiceState {
  name: string;
  displayName: string;
  health: ServiceHealth;
  version: string;
  uptimePct: number;
  description: string;
  dependsOn: string[];
}

export interface DeploymentRecord {
  id: string;
  service: string;
  version: string;
  previousVersion: string;
  deployedAt: string;
  deployedBy: string;
  status: "SUCCESS" | "ROLLED_BACK";
}

export interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  severity: LogSeverity;
  message: string;
}

export interface MetricPoint {
  timestamp: string;
  errorRatePct: number;
  latencyMs: number;
  requestsPerMin: number;
  cpuPct: number;
  memoryPct: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  label: string;
  detail?: string;
}

export interface RemediationStep {
  id: string;
  action: string;
  target: string;
  fromVersion?: string;
  toVersion?: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}

export interface RemediationPlan {
  incidentId: string;
  createdAt: string;
  steps: RemediationStep[];
  summary: string;
}

export interface EvidenceEntry {
  id: string;
  signal: string;
  source: string;
  addedAt: string;
}

export interface IncidentState {
  id: string;
  title: string;
  service: string;
  affectedServices: string[];
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: string;
  resolvedAt: string | null;
  description: string;
  timeline: TimelineEvent[];
  evidence: EvidenceEntry[];
  remediationPlan: RemediationPlan | null;
  rootCause: {
    hypothesis: string;
    confidence: number;
    reasoningSummary: string[];
  } | null;
}

export interface SimulationSnapshot {
  services: Record<string, ServiceState>;
  incidents: Record<string, IncidentState>;
  deployments: Record<string, DeploymentRecord[]>;
  logs: Record<string, LogEntry[]>;
  metrics: Record<string, MetricPoint[]>;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: "SUCCESS" | "ERROR";
  startedAt: string;
  durationMs: number;
}

export interface StructuredError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface StructuredSuccess<T> {
  success: true;
  data: T;
}

export type ToolResult<T> = StructuredSuccess<T> | StructuredError;
