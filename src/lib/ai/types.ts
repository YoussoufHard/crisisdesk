/** Minimal Gemini-compatible content shapes, kept dependency-free so client
 * bundles never pull in the server-only @google/genai SDK. */

export interface AgentFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentPart {
  text?: string;
  functionCall?: AgentFunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface AgentContent {
  role: "user" | "model";
  parts: AgentPart[];
}

export interface AgentStepResponse {
  modelContent: AgentContent;
  text: string | null;
  functionCalls: AgentFunctionCall[];
}
