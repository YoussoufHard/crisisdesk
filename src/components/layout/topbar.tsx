"use client";

import { useState } from "react";
import { RotateCcw, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebMCPStatus } from "@/lib/webmcp/register";
import { resetSimulation } from "@/lib/data/repository";

export function Topbar() {
  const { native, ready } = useWebMCPStatus();
  const [resetting, setResetting] = useState(false);

  function handleReset() {
    setResetting(true);
    resetSimulation();
    window.setTimeout(() => setResetting(false), 400);
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="text-sm text-muted-foreground">Agent-native incident response</div>
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Badge
              variant="outline"
              className={
                ready
                  ? native
                    ? "border-emerald-500/40 text-emerald-500 gap-1.5"
                    : "border-amber-500/40 text-amber-500 gap-1.5"
                  : "gap-1.5 text-muted-foreground"
              }
            >
              <Radio className="size-3" />
              {!ready ? "WebMCP: initializing" : native ? "WebMCP: Native" : "WebMCP: Local Fallback"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs">
            {native
              ? "document.modelContext is available natively in this browser. Tools are registered and executed through the real WebMCP API."
              : "This browser does not expose document.modelContext (requires Chrome 149+ origin trial, Edge 150+, or ChatGPT Desktop). CrisisDesk is using a same-shaped local polyfill so the demo still works — this is clearly not native WebMCP."}
          </TooltipContent>
        </Tooltip>
        <Button size="sm" variant="outline" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="size-3.5" />
          Reset Simulation
        </Button>
      </div>
    </header>
  );
}
