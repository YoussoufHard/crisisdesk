import type {
  DiscoveredTool,
  GetToolsOptions,
  ModelContextLike,
  RegisterToolOptions,
  RegisterableTool,
  ToolExecuteResult,
} from "./types";

/**
 * A same-shaped local stand-in for `document.modelContext`, used only when the
 * browser does not implement WebMCP natively (see docs/webmcp-research.md, §4).
 * It is never presented to the user as "real WebMCP" — callers must check
 * `isNativeWebMCP()` and label the UI accordingly.
 */
class WebMCPPolyfill implements ModelContextLike {
  private tools = new Map<string, RegisterableTool>();
  private listeners = new Set<() => void>();

  private emitChange() {
    for (const l of this.listeners) l();
  }

  async registerTool(tool: RegisterableTool, options?: RegisterToolOptions): Promise<void> {
    this.tools.set(tool.name, tool);
    this.emitChange();
    options?.signal?.addEventListener("abort", () => {
      this.tools.delete(tool.name);
      this.emitChange();
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- part of the ModelContextLike contract
  getTools(options?: GetToolsOptions): DiscoveredTool[] {
    return [...this.tools.values()]
      .map(({ name, description, inputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        annotations,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async executeTool(
    tool: DiscoveredTool,
    inputJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<ToolExecuteResult> {
    const registered = this.tools.get(tool.name);
    if (!registered) {
      return {
        isError: true,
        content: [{ type: "text", text: `Tool "${tool.name}" is not registered.` }],
      };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = inputJson ? JSON.parse(inputJson) : {};
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid JSON input." }],
      };
    }
    return registered.execute(parsed, options?.signal);
  }

  addEventListener(_type: "toolchange", listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "toolchange", listener: () => void): void {
    this.listeners.delete(listener);
  }
}

let polyfillSingleton: WebMCPPolyfill | null = null;

export function getPolyfillModelContext(): WebMCPPolyfill {
  if (!polyfillSingleton) polyfillSingleton = new WebMCPPolyfill();
  return polyfillSingleton;
}
