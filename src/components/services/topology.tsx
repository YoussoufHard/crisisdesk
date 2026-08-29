import { ArrowDown } from "lucide-react";
import { HealthBadge } from "@/components/status/badges";
import { cn } from "@/lib/utils";
import type { ServiceState } from "@/lib/data/types";

function Node({ service }: { service: ServiceState }) {
  return (
    <div
      className={cn(
        "flex w-40 flex-col items-center gap-1 rounded-lg border bg-card px-3 py-2.5 text-center",
        service.health !== "HEALTHY" ? "border-amber-500/40" : "border-border",
      )}
    >
      <span className="font-mono text-xs font-medium">{service.name}</span>
      <HealthBadge health={service.health} />
    </div>
  );
}

const ROWS: string[][] = [["frontend"], ["auth-service", "checkout-api", "search-service", "notification-api"], ["payment-api"], ["payment-provider"]];

export function ServiceTopology({ services }: { services: Record<string, ServiceState> }) {
  return (
    <div className="flex flex-col items-center gap-2 overflow-x-auto py-2">
      {ROWS.map((row, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-3">
            {row.map((name) => services[name] && <Node key={name} service={services[name]} />)}
          </div>
          {i < ROWS.length - 1 && <ArrowDown className="size-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}
