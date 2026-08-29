import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SeverityBadge } from "@/components/status/badges";
import { formatRelativeTime } from "@/lib/format";
import type { IncidentState, MetricPoint } from "@/lib/data/types";

export function IncidentSummaryCard({ incident, latestMetric }: { incident: IncidentState; latestMetric?: MetricPoint }) {
  return (
    <Link href={`/incidents/${incident.id}`}>
      <Card className="transition-colors hover:border-foreground/20">
        <CardContent className="flex items-center justify-between gap-4 py-1">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
              <SeverityBadge severity={incident.severity} />
            </div>
            <div className="truncate font-medium">{incident.title}</div>
            <div className="text-xs text-muted-foreground">Detected {formatRelativeTime(incident.detectedAt)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {latestMetric && (
              <div className="text-right text-xs text-muted-foreground">
                <div className="font-mono text-sm text-foreground">{latestMetric.errorRatePct.toFixed(1)}%</div>
                error rate
              </div>
            )}
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
