"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToolActivity } from "@/components/agent/tool-activity";
import { useToolCalls } from "@/hooks/useSimulation";
import { useWebMCPStatus } from "@/lib/webmcp/register";
import { TOOL_DEFINITIONS } from "@/lib/webmcp/toolDefinitions";

export default function AgentPage() {
  const calls = useToolCalls();
  const { native, ready } = useWebMCPStatus();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Agent</h1>
        <p className="text-sm text-muted-foreground">
          Every capability CrisisDesk exposes to an AI agent, registered live via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">document.modelContext.registerTool</code>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">WebMCP Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={native ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"}>
              {!ready ? "Initializing" : native ? "Native WebMCP" : "Local Fallback"}
            </Badge>
            <span className="text-muted-foreground">
              {native
                ? "This browser implements document.modelContext natively (Chrome 149+, Edge 150+, or ChatGPT Desktop). A native agent could discover and call these tools directly, with no CrisisDesk-specific glue."
                : "This browser does not implement WebMCP yet, so CrisisDesk is using a same-shaped local polyfill (lib/webmcp/polyfill.ts) so the demo still works end to end — never presented as native."}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Registered Tools ({TOOL_DEFINITIONS.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {TOOL_DEFINITIONS.map((tool) => (
            <div key={tool.name} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{tool.name}</span>
                {tool.annotations?.readOnlyHint === false && (
                  <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
                    state-changing
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Tool Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ToolActivity calls={calls} />
        </CardContent>
      </Card>
    </div>
  );
}
