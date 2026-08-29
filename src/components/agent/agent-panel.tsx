"use client";

import { Bot, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ToolActivity } from "./tool-activity";
import { useAgentSession, usePendingApproval } from "@/hooks/useAgent";
import { useToolCalls, useSimulationSnapshot } from "@/hooks/useSimulation";
import { runInvestigation } from "@/lib/ai/orchestrator";
import type { IncidentState } from "@/lib/data/types";

const RISK_STYLES: Record<string, string> = {
  LOW: "border-emerald-500/40 text-emerald-500",
  MEDIUM: "border-amber-500/40 text-amber-500",
  HIGH: "border-red-500/40 text-red-500",
};

export function AgentPanel({ incident }: { incident: IncidentState }) {
  const session = useAgentSession();
  const allCalls = useToolCalls();
  const pendingApproval = usePendingApproval();
  const snapshot = useSimulationSnapshot();

  const isThisIncident = session.incidentId === incident.id;
  const running = isThisIncident && session.status === "running";
  const calls = isThisIncident && session.startedAt ? allCalls.filter((c) => c.startedAt >= session.startedAt!) : [];

  const liveIncident = snapshot?.incidents[incident.id] ?? incident;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="size-4" />
          CrisisDesk Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!running ? (
          <Button
            className="w-full"
            disabled={liveIncident.status === "RESOLVED"}
            onClick={() => runInvestigation(incident.id)}
          >
            {liveIncident.status === "RESOLVED" ? "Incident Resolved" : "Investigate with Agent"}
          </Button>
        ) : (
          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Investigating {incident.id}
              {pendingApproval && <span className="text-amber-500">· awaiting your approval</span>}
            </div>
            <Progress value={Math.min(95, (session.iterations / 10) * 100)} className="h-1" />
          </div>
        )}

        {isThisIncident && session.status === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {session.errorMessage}
          </div>
        )}

        {isThisIncident && (calls.length > 0 || running) && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Agent Activity</h3>
            <ToolActivity calls={calls} pendingLabel={running && !pendingApproval ? "Working…" : undefined} />
          </div>
        )}

        {liveIncident.rootCause && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Root Cause Hypothesis</h3>
              <Badge variant="outline">{Math.round(liveIncident.rootCause.confidence * 100)}% confidence</Badge>
            </div>
            <p className="text-sm font-medium">{liveIncident.rootCause.hypothesis}</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {liveIncident.rootCause.reasoningSummary.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          </div>
        )}

        {liveIncident.remediationPlan && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <h3 className="text-xs font-medium text-muted-foreground">Remediation Plan</h3>
            <p className="text-sm">{liveIncident.remediationPlan.summary}</p>
            <div className="space-y-1.5">
              {liveIncident.remediationPlan.steps.map((step) => (
                <div key={step.id} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5 text-xs">
                  <span className="font-mono">
                    {step.action}({step.target})
                  </span>
                  <Badge variant="outline" className={RISK_STYLES[step.risk]}>
                    {step.risk}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {isThisIncident && session.status === "done" && session.finalText && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <h3 className="text-xs font-medium text-muted-foreground">Assessment</h3>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">{session.finalText}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
