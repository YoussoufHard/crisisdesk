"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/components/status/badges";
import { IncidentSummaryCard } from "@/components/dashboard/incident-summary-card";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { useSimulationSnapshot } from "@/hooks/useSimulation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const snapshot = useSimulationSnapshot();
  if (!snapshot) return <PageSkeleton />;

  const incidents = Object.values(snapshot.incidents).sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
  const activeIncidents = incidents.filter((i) => i.status !== "RESOLVED");
  const services = Object.values(snapshot.services);
  const degradedServices = services.filter((s) => s.health !== "HEALTHY");
  const criticalCount = activeIncidents.filter((i) => i.severity === "CRITICAL").length;

  const systemOperational = activeIncidents.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3">
        {systemOperational ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : (
          <AlertTriangle className="size-5 text-red-500" />
        )}
        <div>
          <div className="font-medium">{systemOperational ? "System Operational" : "Active Incidents In Progress"}</div>
          <div className="text-xs text-muted-foreground">
            {activeIncidents.length} active incident{activeIncidents.length === 1 ? "" : "s"} · {degradedServices.length} service
            {degradedServices.length === 1 ? "" : "s"} degraded
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{activeIncidents.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Severity</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-400">{criticalCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Services Degraded</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-amber-400">{degradedServices.length}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground">Active Incidents</h2>
          {activeIncidents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No active incidents. All systems operational.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {activeIncidents.map((incident) => (
                <IncidentSummaryCard
                  key={incident.id}
                  incident={incident}
                  latestMetric={snapshot.metrics[incident.service]?.at(-1)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Service Health</h2>
          <Card>
            <CardContent className="divide-y divide-border py-0">
              {services.map((service) => (
                <div key={service.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-mono text-xs">{service.name}</span>
                  <HealthBadge health={service.health} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
