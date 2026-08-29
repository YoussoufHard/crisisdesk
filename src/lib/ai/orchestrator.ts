"use client";

import { getModelContext } from "@/lib/webmcp/client";
import { agentSession } from "./agentSession";
import type { AgentContent, AgentStepResponse } from "./types";

const MAX_ITERATIONS = 14;

/**
 * Drives the Gemini <-> WebMCP tool-calling loop entirely from the browser.
 * Gemini (via /api/agent, server-side) only ever decides WHICH tool to call
 * and with WHAT arguments; the actual call is dispatched through
 * `document.modelContext.executeTool` — the same path a native WebMCP agent
 * (Chrome 149+, ChatGPT desktop) would use. See docs/webmcp-research.md §4.
 */
export async function runInvestigation(incidentId: string): Promise<void> {
  agentSession.start(incidentId);
  const { context } = getModelContext();

  let history: AgentContent[] = [
    {
      role: "user",
      parts: [
        {
          text: `Investigate ${incidentId}. Gather the evidence you need, correlate it, form a root cause hypothesis, propose a remediation plan, and if you find a clear, safe fix, propose executing it.`,
        },
      ],
    },
  ];

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      agentSession.incrementIteration();

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      const json = await res.json();

      if (!json.success) {
        agentSession.setError(json.error?.message ?? "The agent request failed.");
        return;
      }

      const step = json.data as AgentStepResponse;
      history = [...history, step.modelContent];

      if (step.functionCalls.length === 0) {
        agentSession.setFinal(step.text ?? "No response was produced.");
        return;
      }

      const discovered = await context.getTools();
      const responseParts: AgentContent["parts"] = [];

      for (const call of step.functionCalls) {
        const tool = discovered.find((t) => t.name === call.name);
        if (!tool) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { success: false, error: { code: "TOOL_NOT_FOUND", message: `Tool ${call.name} is not registered.` } },
            },
          });
          continue;
        }

        const result = await context.executeTool(tool, JSON.stringify(call.args));
        let parsed: unknown;
        try {
          parsed = JSON.parse(result.content[0]?.text ?? "null");
        } catch {
          parsed = { raw: result.content[0]?.text };
        }
        responseParts.push({
          functionResponse: { name: call.name, response: parsed as Record<string, unknown> },
        });
      }

      history = [...history, { role: "user", parts: responseParts }];
    }

    agentSession.setError("Investigation exceeded the maximum number of steps.");
  } catch (error) {
    agentSession.setError(error instanceof Error ? error.message : "Unexpected agent error.");
  }
}
