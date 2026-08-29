import { FunctionCallingConfigMode, GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { TOOL_DEFINITIONS } from "@/lib/webmcp/toolDefinitions";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { AgentContent, AgentStepResponse } from "./types";

const DEFAULT_MODEL = "gemini-3.6-flash";

function toFunctionDeclarations(): FunctionDeclaration[] {
  return TOOL_DEFINITIONS.map((def) => ({
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

const RATE_LIMIT_RETRY_DELAYS_MS = [3000, 6000];

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("RESOURCE_EXHAUSTED") || message.includes('"code":429') || message.includes("rate limit");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAgentStep(history: AgentContent[]): Promise<AgentStepResponse> {
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
          tools: [{ functionDeclarations: toFunctionDeclarations() }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
      break;
    } catch (error) {
      if (isRateLimitError(error) && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
        await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
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
