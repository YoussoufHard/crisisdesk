import { NextResponse } from "next/server";
import { runAgentStep } from "@/lib/ai/gemini";
import type { AgentContent } from "@/lib/ai/types";

export async function POST(request: Request) {
  let body: { history?: AgentContent[]; toolNames?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_INPUT", message: "history must be a non-empty array." } },
      { status: 400 },
    );
  }

  const toolNames = Array.isArray(body.toolNames) && body.toolNames.every((n) => typeof n === "string")
    ? body.toolNames
    : undefined;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AI_PROVIDER_UNAVAILABLE",
          message: "GEMINI_API_KEY is not configured. Set it in your environment to enable the AI agent.",
        },
      },
      { status: 503 },
    );
  }

  try {
    const step = await runAgentStep(body.history, toolNames);
    return NextResponse.json({ success: true, data: step });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AI_PROVIDER_ERROR",
          message: error instanceof Error ? error.message : "The AI provider request failed.",
        },
      },
      { status: 502 },
    );
  }
}
