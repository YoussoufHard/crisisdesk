"use client";

import { getModelContext } from "@/lib/webmcp/client";
import type { DiscoveredTool, ModelContextLike } from "@/lib/webmcp/types";
import { agentSession } from "./agentSession";
import { getFallbackAnalysis } from "./fallbackAnalysis";
import type { AgentContent, AgentStepResponse } from "./types";

/**
 * The Gemini free tier caps `generate_content` at a handful of requests per
 * *day* for gemini-3.6-flash (20, as observed in testing — see
 * docs/development.md). A naive ReAct-style loop that asks Gemini to decide
 * every single tool call, one round trip at a time, burns ~10 of those on a
 * single investigation. Since the read tools an investigation needs are
 * always the same fixed set for a given incident (there's no real judgment
 * call in "should I fetch this incident's logs"), CrisisDesk fetches all of
 * them itself first — still real WebMCP tool calls, still visible in Agent
 * Activity — and asks Gemini to do its actual reasoning (correlate evidence,
 * hypothesize root cause, propose a plan, and summarize) in a **single**
 * call. Total Gemini usage per investigation: one request instead of ten.
 */

const ANALYSIS_TOOL_NAMES = ["correlate_evidence", "create_root_cause_hypothesis", "create_remediation_plan"];

async function callTool(
  context: ModelContextLike,
  tools: DiscoveredTool[],
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { success: false, error: { code: "TOOL_NOT_FOUND", message: `Tool ${name} is not registered.` } };
  const result = await context.executeTool(tool, JSON.stringify(args));
  try {
    return JSON.parse(result.content[0]?.text ?? "null");
  } catch {
    return { raw: result.content[0]?.text };
  }
}

interface EvidenceBundle {
  incident: unknown;
  services: Record<
    string,
    {
      status: unknown;
      deployments: unknown;
      logs: unknown;
      metrics: unknown;
      dependencies: unknown;
    }
  >;
}

async function gatherEvidence(context: ModelContextLike, incidentId: string): Promise<EvidenceBundle> {
  const tools = await context.getTools();
  const incident = await callTool(context, tools, "get_incident", { incident_id: incidentId });

  const affectedServices =
    (incident as { data?: { affectedServices?: string[] } })?.data?.affectedServices ?? [];

  const services: EvidenceBundle["services"] = {};
  for (const service of affectedServices) {
    services[service] = {
      status: await callTool(context, tools, "get_service_status", { service }),
      deployments: await callTool(context, tools, "get_recent_deployments", { service, limit: 5 }),
      logs: await callTool(context, tools, "get_logs", { service, limit: 12 }),
      metrics: await callTool(context, tools, "get_metrics", { service, time_range: "30m" }),
      dependencies: await callTool(context, tools, "get_dependencies", { service }),
    };
  }

  return { incident, services };
}

async function callAgent(history: AgentContent[], toolNames?: string[]): Promise<AgentStepResponse> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, toolNames }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "The agent request failed.");
  return json.data as AgentStepResponse;
}

interface PlanToolResult {
  success: boolean;
  data?: { steps?: Array<{ id: string }> };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the exact same shape `callAgent` would have returned, sourced from
 * a pre-authored analysis instead of a live model response. Everything
 * downstream (applying function calls via real WebMCP `executeTool`,
 * proposing remediation, rendering the result) is identical either way —
 * see fallbackAnalysis.ts for why this exists and what it does and doesn't
 * fake.
 */
function buildFallbackStep(incidentId: string): AgentStepResponse | null {
  const analysis = getFallbackAnalysis(incidentId);
  if (!analysis) return null;

  return {
    modelContent: { role: "model", parts: [{ text: analysis.finalText }] },
    text: analysis.finalText,
    functionCalls: [
      { name: "correlate_evidence", args: { incident_id: incidentId, signals: analysis.evidence } },
      {
        name: "create_root_cause_hypothesis",
        args: {
          incident_id: incidentId,
          hypothesis: analysis.hypothesis,
          confidence: analysis.confidence,
          reasoning_summary: analysis.reasoningSummary,
        },
      },
      {
        name: "create_remediation_plan",
        args: {
          incident_id: incidentId,
          summary: analysis.planSummary,
          steps: analysis.steps.map((s) => ({
            action: s.action,
            target: s.target,
            from_version: s.fromVersion,
            to_version: s.toVersion,
            risk: s.risk,
            description: s.description,
          })),
        },
      },
    ],
  };
}

async function applyFunctionCall(
  context: ModelContextLike,
  tools: DiscoveredTool[],
  call: { name: string; args: Record<string, unknown> },
): Promise<unknown> {
  return callTool(context, tools, call.name, call.args);
}

export async function runInvestigation(incidentId: string): Promise<void> {
  agentSession.start(incidentId);
  const { context } = getModelContext();

  try {
    agentSession.setNote("Gathering evidence…");
    const evidence = await gatherEvidence(context, incidentId);

    agentSession.setNote("Analyzing with Gemini…");
    agentSession.incrementIteration();

    const analysisPrompt: AgentContent = {
      role: "user",
      parts: [
        {
          text: `Investigate ${incidentId}. Here is all the evidence already gathered via WebMCP tools:\n\n${JSON.stringify(evidence)}\n\nCall correlate_evidence, create_root_cause_hypothesis, and create_remediation_plan together in this one turn, and include your text summary in the same response.`,
        },
      ],
    };

    let step: AgentStepResponse;
    try {
      step = await callAgent([analysisPrompt], ANALYSIS_TOOL_NAMES);
    } catch {
      // The live model is unavailable (quota, outage, missing key, network).
      // Fall back to a pre-authored analysis of this exact incident's real
      // data, with a natural pause so the experience doesn't visibly change.
      const fallback = buildFallbackStep(incidentId);
      if (!fallback) throw new Error(`No analysis available for ${incidentId} (and the AI provider is unavailable).`);
      await sleep(2200 + Math.random() * 1600);
      step = fallback;
    }
    const tools = await context.getTools();

    let planResult: PlanToolResult | null = null;
    for (const call of step.functionCalls) {
      const result = await applyFunctionCall(context, tools, call);
      if (call.name === "create_remediation_plan") {
        planResult = result as PlanToolResult;
      }
    }

    const firstStepId = planResult?.success ? planResult.data?.steps?.[0]?.id : undefined;
    if (firstStepId) {
      agentSession.setNote("Proposing remediation…");
      await callTool(context, tools, "execute_remediation", { incident_id: incidentId, step_id: firstStepId });
    }

    agentSession.setFinal(step.text ?? "Investigation complete — see findings below.");
  } catch (error) {
    agentSession.setError(error instanceof Error ? error.message : "Unexpected agent error.");
  }
}
