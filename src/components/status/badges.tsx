import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IncidentSeverity, IncidentStatus, ServiceHealth } from "@/lib/data/types";

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-400",
  HIGH: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  MEDIUM: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  LOW: "border-sky-500/40 bg-sky-500/10 text-sky-400",
};

export function SeverityBadge({ severity, className }: { severity: IncidentSeverity; className?: string }) {
  return (
    <Badge variant="outline" className={cn(SEVERITY_STYLES[severity], "font-medium", className)}>
      {severity}
    </Badge>
  );
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  ACTIVE: "border-red-500/40 bg-red-500/10 text-red-400",
  MITIGATING: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  RESOLVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

export function IncidentStatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {status}
    </Badge>
  );
}

const HEALTH_STYLES: Record<ServiceHealth, string> = {
  HEALTHY: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  DOWN: "bg-red-500",
};

export function HealthDot({ health }: { health: ServiceHealth }) {
  return (
    <span className="relative flex size-2">
      {health !== "HEALTHY" && (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", HEALTH_STYLES[health])} />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", HEALTH_STYLES[health])} />
    </span>
  );
}

const HEALTH_TEXT_STYLES: Record<ServiceHealth, string> = {
  HEALTHY: "text-emerald-400",
  DEGRADED: "text-amber-400",
  DOWN: "text-red-400",
};

export function HealthBadge({ health }: { health: ServiceHealth }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", HEALTH_TEXT_STYLES[health])}>
      <HealthDot health={health} />
      {health}
    </span>
  );
}
