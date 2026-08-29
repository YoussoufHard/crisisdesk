"use client";

import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatDuration, formatClockTime } from "@/lib/format";
import type { ToolCallRecord } from "@/lib/data/types";

export function ToolActivity({ calls, pendingLabel }: { calls: ToolCallRecord[]; pendingLabel?: string }) {
  if (calls.length === 0 && !pendingLabel) {
    return <div className="text-xs text-muted-foreground">No tool calls yet.</div>;
  }

  return (
    <div className="space-y-1.5">
      {pendingLabel && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">{pendingLabel}</span>
        </div>
      )}
      <Accordion className="space-y-1.5">
        {calls.map((call) => (
          <AccordionItem key={call.id} value={call.id} className="rounded-md border border-border px-2.5">
            <AccordionTrigger className="py-2 text-xs hover:no-underline">
              <span className="flex flex-1 items-center gap-2 pr-2 text-left">
                {call.status === "SUCCESS" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="size-3.5 shrink-0 text-red-500" />
                )}
                <span className="font-mono">{call.toolName}()</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{formatDuration(call.durationMs)}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-3 text-xs">
              <div className="text-muted-foreground">{formatClockTime(call.startedAt)}</div>
              <div>
                <div className="mb-1 font-medium text-muted-foreground">Input</div>
                <pre className="overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px]">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-1 font-medium text-muted-foreground">Output</div>
                <pre className="overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px]">
                  {JSON.stringify(call.output, null, 2)}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
