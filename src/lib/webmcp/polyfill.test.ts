import { describe, expect, it, vi } from "vitest";
import { getPolyfillModelContext } from "./polyfill";
import type { RegisterableTool } from "./types";

const echoTool: RegisterableTool = {
  name: "echo",
  description: "Echoes the input back.",
  inputSchema: { type: "object", properties: { value: { type: "string" } }, required: ["value"] },
  annotations: { readOnlyHint: true },
  async execute(input) {
    return { content: [{ type: "text", text: JSON.stringify({ echoed: input.value }) }] };
  },
};

describe("WebMCP polyfill contract", () => {
  it("registers a tool and makes it discoverable via getTools", async () => {
    const ctx = getPolyfillModelContext();
    const controller = new AbortController();
    await ctx.registerTool(echoTool, { signal: controller.signal });

    const tools = ctx.getTools();
    expect(tools.some((t) => t.name === "echo")).toBe(true);
    controller.abort();
  });

  it("executeTool dispatches to the registered execute function", async () => {
    const ctx = getPolyfillModelContext();
    const controller = new AbortController();
    await ctx.registerTool(echoTool, { signal: controller.signal });

    const [tool] = ctx.getTools().filter((t) => t.name === "echo");
    const result = await ctx.executeTool(tool, JSON.stringify({ value: "hello" }));
    expect(JSON.parse(result.content[0].text)).toEqual({ echoed: "hello" });
    controller.abort();
  });

  it("unregisters a tool when its AbortSignal fires", async () => {
    const ctx = getPolyfillModelContext();
    const controller = new AbortController();
    await ctx.registerTool(echoTool, { signal: controller.signal });
    controller.abort();

    expect(ctx.getTools().some((t) => t.name === "echo")).toBe(false);
  });

  it("returns an error result for an unregistered tool", async () => {
    const ctx = getPolyfillModelContext();
    const result = await ctx.executeTool({ name: "nope", description: "", inputSchema: { type: "object" } }, "{}");
    expect(result.isError).toBe(true);
  });

  it("fires toolchange listeners on register", async () => {
    const ctx = getPolyfillModelContext();
    const listener = vi.fn();
    ctx.addEventListener("toolchange", listener);

    const controller = new AbortController();
    await ctx.registerTool(echoTool, { signal: controller.signal });

    expect(listener).toHaveBeenCalled();
    ctx.removeEventListener("toolchange", listener);
    controller.abort();
  });
});
