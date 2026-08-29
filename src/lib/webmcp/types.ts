/**
 * Shapes mirror the WebMCP spec (document.modelContext) as documented at
 * https://developer.chrome.com/docs/ai/webmcp/imperative-api and
 * https://github.com/webmachinelearning/webmcp — see docs/webmcp-research.md.
 */

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema & { description?: string }>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: string[];
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ToolContentText {
  type: "text";
  text: string;
}

export interface ToolExecuteResult {
  content: ToolContentText[];
  isError?: boolean;
}

/** Name/description/schema only — safe to share with a server-side LLM call. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
}

/** The runnable half — client-only, touches the simulation/data layer. */
export type ToolExecutor = (
  input: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<ToolExecuteResult>;

export interface RegisterableTool extends ToolDefinition {
  execute: ToolExecutor;
}

export interface RegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
}

export interface GetToolsOptions {
  fromOrigins?: string[];
}

export interface ModelContextLike {
  registerTool(tool: RegisterableTool, options?: RegisterToolOptions): Promise<void>;
  getTools(options?: GetToolsOptions): Promise<DiscoveredTool[]> | DiscoveredTool[];
  executeTool(
    tool: DiscoveredTool,
    inputJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<ToolExecuteResult>;
  addEventListener(type: "toolchange", listener: () => void): void;
  removeEventListener(type: "toolchange", listener: () => void): void;
}

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
}
