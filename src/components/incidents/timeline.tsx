import { formatClockTime } from "@/lib/format";
import type { TimelineEvent } from "@/lib/data/types";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  return (
    <ol className="space-y-0">
      {sorted.map((event, i) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i !== sorted.length - 1 && (
            <span className="absolute left-[7px] top-3 h-full w-px bg-border" aria-hidden />
          )}
          <span className="relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
          <div className="min-w-0 pb-0.5">
            <div className="text-xs text-muted-foreground">{formatClockTime(event.timestamp)}</div>
            <div className="text-sm font-medium">{event.label}</div>
            {event.detail && <div className="text-xs text-muted-foreground">{event.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
