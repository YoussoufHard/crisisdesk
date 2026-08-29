"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { useWebMCPStatus } from "@/lib/webmcp/register";
import { resetSimulation } from "@/lib/data/repository";

export function SettingsClient({ hasGeminiKey }: { hasGeminiKey: boolean }) {
  const { native, ready } = useWebMCPStatus();
  const [justReset, setJustReset] = useState(false);

  function handleReset() {
    resetSimulation();
    setJustReset(true);
    window.setTimeout(() => setJustReset(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Environment status and demo controls.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Gemini API key</span>
            {hasGeminiKey ? (
              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-500">
                <CheckCircle2 className="size-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-red-500/40 text-red-500">
                <XCircle className="size-3" /> Missing
              </Badge>
            )}
          </div>
          {!hasGeminiKey && (
            <Alert>
              <AlertTitle className="text-xs">GEMINI_API_KEY not set</AlertTitle>
              <AlertDescription className="text-xs">
                Set <code>GEMINI_API_KEY</code> in your environment (see .env.example) to enable the AI agent. Every other part
                of the app — data, WebMCP tools, simulation — works without it.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between">
            <span>WebMCP</span>
            <Badge variant="outline" className={native ? "border-emerald-500/40 text-emerald-500" : "border-amber-500/40 text-amber-500"}>
              {!ready ? "Initializing" : native ? "Native" : "Local Fallback"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demo Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Restores every incident, service, and metric to its initial state. Use this between demo runs.
          </p>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="size-3.5" />
            {justReset ? "Simulation reset" : "Reset Simulation"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>CrisisDesk is a simulated incident-response environment built for the WebMCP Challenge.</p>
          <p>No real infrastructure is ever touched — every action operates on local, in-browser simulation state.</p>
        </CardContent>
      </Card>
    </div>
  );
}
