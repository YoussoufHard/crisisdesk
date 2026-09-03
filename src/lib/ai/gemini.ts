import { FunctionCallingConfigMode, GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { TOOL_DEFINITIONS } from "@/lib/webmcp/toolDefinitions";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { AgentContent, AgentStepResponse } from "./types";

const DEFAULT_MODEL = "gemini-3.6-flash";

function toFunctionDeclarations(toolNames?: string[]): FunctionDeclaration[] {
  const defs = toolNames ? TOOL_DEFINITIONS.filter((d) => toolNames.includes(d.name)) : TOOL_DEFINITIONS;
  return defs.map((def) => ({
    name: def.name,
    description: def.description,
    parametersJsonSchema: def.inputSchema,
  }));
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const MAX_RATE_LIMIT_RETRIES = 5;
const FALLBACK_RETRY_DELAYS_MS = [4000, 8000, 15000, 20000, 20000];
const MAX_RETRY_DELAY_MS = 25000;

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("RESOURCE_EXHAUSTED") || message.includes('"code":429') || message.includes("rate limit");
}

/**
 * A per-day quota (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) won't
 * reset within any reasonable retry window, even though the API's own
 * `retryDelay` hint on that error is a short, generic backoff value (not an
 * actual reset time). Retrying it is pure wasted time — fail fast instead
 * with a message that says what's actually going on.
 */
function isDailyQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("PerDay");
}

/** The API tells us exactly how long to wait (e.g. `"retryDelay":"5.8s"`) — prefer that over guessing. */
function parseRetryDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!match) return null;
  return Math.min(Math.ceil(parseFloat(match[1]) * 1000) + 500, MAX_RETRY_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAgentStep(history: AgentContent[], toolNames?: string[]): Promise<AgentStepResponse> {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let response;
  let attempt = 0;
  for (;;) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: history as unknown as Content[],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: toFunctionDeclarations(toolNames) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
      break;
    } catch (error) {
      if (isRateLimitError(error) && isDailyQuotaError(error)) {
        throw new Error(
          "The Gemini free-tier daily quota for this model has been used up. It resets on Google's schedule (typically ~24h) — try again later, or use an API key with a higher quota.",
        );
      }
      if (isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES) {
        const delay = parseRetryDelayMs(error) ?? FALLBACK_RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;
        await sleep(delay);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  const candidateContent = (response.candidates?.[0]?.content ?? { role: "model", parts: [] }) as AgentContent;
  const functionCalls = (response.functionCalls ?? []).map((fc) => ({
    name: fc.name ?? "",
    args: (fc.args ?? {}) as Record<string, unknown>,
  }));

  return {
    modelContent: candidateContent,
    text: response.text ?? null,
    functionCalls,
  };
}
