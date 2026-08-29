"use client";

import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge, IncidentStatusBadge } from "@/components/status/badges";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { useSimulationSnapshot } from "@/hooks/useSimulation";
import { formatRelativeTime } from "@/lib/format";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function IncidentsPage() {
  const snapshot = useSimulationSnapshot();
  if (!snapshot) return <PageSkeleton />;

  const incidents = Object.values(snapshot.incidents).sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Incidents</h1>
        <p className="text-sm text-muted-foreground">All simulated incidents, active and resolved.</p>
      </div>

      <div className="space-y-2">
        {incidents.map((incident) => {
          const metric = snapshot.metrics[incident.service]?.at(-1);
          return (
            <Link key={incident.id} href={`/incidents/${incident.id}`}>
              <Card className="transition-colors hover:border-foreground/20">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-1">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                    </div>
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {incident.service} · detected {formatRelativeTime(incident.detectedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {metric && (
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="font-mono text-sm text-foreground">{metric.errorRatePct.toFixed(1)}%</div>
                        error rate
                      </div>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
