import { getPolyfillModelContext } from "./polyfill";
import type { ModelContextLike } from "./types";

export interface ResolvedModelContext {
  context: ModelContextLike;
  native: boolean;
}

/**
 * Resolves the active WebMCP implementation: the real browser-native
 * `document.modelContext` when present (Chrome 149+ origin trial, Edge 150+,
 * ChatGPT Desktop), otherwise the local polyfill. Never silently pretend the
 * fallback is native — always surface `native` in the UI.
 */
export function getModelContext(): ResolvedModelContext {
  if (typeof document !== "undefined" && "modelContext" in document && document.modelContext) {
    return { context: document.modelContext, native: true };
  }
  return { context: getPolyfillModelContext(), native: false };
}

export function isWebMCPNativelySupported(): boolean {
  return typeof document !== "undefined" && "modelContext" in document && !!document.modelContext;
}
