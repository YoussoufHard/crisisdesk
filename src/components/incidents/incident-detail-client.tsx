"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge, IncidentStatusBadge, HealthBadge } from "@/components/status/badges";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { MetricLineChart } from "@/components/charts/metric-line-chart";
import { LogViewer } from "./log-viewer";
import { Timeline } from "./timeline";
import { DeploymentList } from "./deployment-list";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useSimulationSnapshot } from "@/hooks/useSimulation";
import { formatRelativeTime } from "@/lib/format";

export function IncidentDetailClient({ incidentId }: { incidentId: string }) {
  const snapshot = useSimulationSnapshot();
  if (!snapshot) return <PageSkeleton />;

  const incident = snapshot.incidents[incidentId];
  if (!incident) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to incidents
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Incident {incidentId} was not found.</CardContent>
        </Card>
      </div>
    );
  }

  const service = snapshot.services[incident.service];
  const metrics = snapshot.metrics[incident.service] ?? [];
  const logs = incident.affectedServices.flatMap((s) => snapshot.logs[s] ?? []);
  const deployments = snapshot.deployments[incident.service] ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to incidents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card/40 p-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </div>
          <h1 className="text-lg font-semibold">{incident.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{incident.description}</p>
          <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
            <span>Detected {formatRelativeTime(incident.detectedAt)}</span>
            <span>·</span>
            <span>Affects {incident.affectedServices.join(", ")}</span>
          </div>
        </div>
        {service && (
          <div className="text-right text-xs text-muted-foreground">
            <div className="mb-1">{service.name}</div>
            <HealthBadge health={service.health} />
            <div className="mt-1 font-mono">v{service.version}</div>
          </div>
        )}
      </div>

      {incident.status === "RESOLVED" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="size-4" />
          Incident resolved {incident.resolvedAt && formatRelativeTime(incident.resolvedAt)}.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Metrics — {incident.service}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Error Rate</div>
                <MetricLineChart
                  data={metrics}
                  series={[{ key: "errorRatePct", label: "Error Rate", color: "var(--series-1)", unit: "%" }]}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Latency</div>
                <MetricLineChart
                  data={metrics}
                  series={[{ key: "latencyMs", label: "Latency", color: "var(--series-2)", unit: "ms" }]}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Requests / min</div>
                <MetricLineChart
                  data={metrics}
                  series={[{ key: "requestsPerMin", label: "Requests", color: "var(--series-3)" }]}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">CPU / Memory</div>
                <MetricLineChart
                  data={metrics}
                  series={[
                    { key: "cpuPct", label: "CPU", color: "var(--series-1)", unit: "%" },
                    { key: "memoryPct", label: "Memory", color: "var(--series-2)", unit: "%" },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <LogViewer logs={logs} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline events={incident.timeline} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Deployments</CardTitle>
              </CardHeader>
              <CardContent>
                <DeploymentList deployments={deployments} />
              </CardContent>
            </Card>
          </div>

          {incident.evidence.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {incident.evidence.map((e) => (
                  <div key={e.id} className="rounded-md bg-muted/30 px-3 py-2 text-xs">
                    <div>{e.signal}</div>
                    <div className="text-muted-foreground">source: {e.source}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <AgentPanel incident={incident} />
        </div>
      </div>
    </div>
  );
}
