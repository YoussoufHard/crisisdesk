"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthBadge } from "@/components/status/badges";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ServiceTopology } from "@/components/services/topology";
import { useSimulationSnapshot } from "@/hooks/useSimulation";

export default function ServicesPage() {
  const snapshot = useSimulationSnapshot();
  if (!snapshot) return <PageSkeleton />;

  const services = Object.values(snapshot.services);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">Topology and health of every service in the simulation.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dependency Topology</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceTopology services={snapshot.services} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Services</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border py-0">
          {services.map((service) => (
            <div key={service.name} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-mono text-sm">{service.name}</div>
                <div className="text-xs text-muted-foreground">{service.description}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>v{service.version}</span>
                <span>{service.uptimePct}% uptime</span>
                <HealthBadge health={service.health} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
