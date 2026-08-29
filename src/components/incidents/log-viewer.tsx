"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/format";
import type { LogEntry, LogSeverity } from "@/lib/data/types";

const SEVERITIES: LogSeverity[] = ["ERROR", "WARN", "INFO", "DEBUG"];

const SEVERITY_STYLES: Record<LogSeverity, string> = {
  ERROR: "text-red-400",
  WARN: "text-amber-400",
  INFO: "text-muted-foreground",
  DEBUG: "text-muted-foreground/60",
};

export function LogViewer({ logs }: { logs: LogEntry[] }) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<LogSeverity | null>(null);

  const filtered = useMemo(() => {
    return logs
      .filter((l) => (severityFilter ? l.severity === severityFilter : true))
      .filter((l) => (query ? l.message.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [logs, query, severityFilter]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search logs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
        <div className="flex gap-1">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                severityFilter === sev
                  ? "border-foreground/30 bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/40",
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="h-64 rounded-md border border-border bg-muted/20">
        <div className="p-2 font-mono text-xs leading-relaxed">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No log entries match.</div>
          ) : (
            filtered.map((log) => (
              <div key={log.id} className="flex gap-2 px-1 py-0.5">
                <span className="shrink-0 text-muted-foreground/70">{formatClockTime(log.timestamp)}</span>
                <span className={cn("w-12 shrink-0 font-semibold", SEVERITY_STYLES[log.severity])}>{log.severity}</span>
                <span className="text-foreground/90">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
