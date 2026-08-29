"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePendingApproval } from "@/hooks/useAgent";
import { approvalBroker } from "@/lib/webmcp/approval";

const RISK_STYLES: Record<string, string> = {
  LOW: "border-emerald-500/40 text-emerald-500",
  MEDIUM: "border-amber-500/40 text-amber-500",
  HIGH: "border-red-500/40 text-red-500",
};

export function ApprovalDialog() {
  const request = usePendingApproval();

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && approvalBroker.respond(false)}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {request && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-amber-500" />
                Action requires approval
              </DialogTitle>
              <DialogDescription>
                The agent is proposing a change to the simulated environment. Nothing has happened yet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Incident</span>
                <span className="font-mono">{request.incidentId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Action</span>
                <span className="font-medium">{request.action}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="font-mono">{request.target}</span>
              </div>
              {request.fromVersion && request.toVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">
                    {request.fromVersion} <span className="text-muted-foreground">to</span> {request.toVersion}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Risk</span>
                <Badge variant="outline" className={RISK_STYLES[request.risk]}>
                  {request.risk}
                </Badge>
              </div>
              <div className="pt-1 text-muted-foreground">{request.reason}</div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => approvalBroker.respond(false)}>
                Cancel
              </Button>
              <Button onClick={() => approvalBroker.respond(true)}>Approve</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
