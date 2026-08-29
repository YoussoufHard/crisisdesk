import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import type { DeploymentRecord } from "@/lib/data/types";

export function DeploymentList({ deployments }: { deployments: DeploymentRecord[] }) {
  if (deployments.length === 0) {
    return <div className="text-xs text-muted-foreground">No deployment history.</div>;
  }
  return (
    <div className="space-y-1.5">
      {deployments.map((d) => (
        <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <div>
            <span className="font-mono">
              {d.previousVersion} <span className="text-muted-foreground">→</span> {d.version}
            </span>
            <div className="text-xs text-muted-foreground">
              {formatRelativeTime(d.deployedAt)} · {d.deployedBy}
            </div>
          </div>
          <Badge variant="outline" className={d.status === "ROLLED_BACK" ? "border-amber-500/40 text-amber-500" : ""}>
            {d.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
