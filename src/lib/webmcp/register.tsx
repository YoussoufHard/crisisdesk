"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getModelContext } from "./client";
import { TOOL_DEFINITIONS } from "./toolDefinitions";
import { TOOL_EXECUTORS } from "./toolExecutors";

interface WebMCPContextValue {
  native: boolean;
  ready: boolean;
}

const WebMCPContext = createContext<WebMCPContextValue>({ native: false, ready: false });

export function useWebMCPStatus() {
  return useContext(WebMCPContext);
}

/**
 * Registers every CrisisDesk tool with `document.modelContext.registerTool`
 * (native when the browser supports it, the local polyfill otherwise — see
 * lib/webmcp/client.ts). Mounted once near the app root so tools are
 * discoverable for the lifetime of the session; unregisters cleanly on
 * unmount via AbortController, per the spec's documented pattern.
 */
export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WebMCPContextValue>({ native: false, ready: false });

  useEffect(() => {
    const controller = new AbortController();
    const { context, native } = getModelContext();

    (async () => {
      for (const def of TOOL_DEFINITIONS) {
        const executor = TOOL_EXECUTORS[def.name];
        if (!executor) continue;
        await context.registerTool(
          { ...def, execute: executor },
          { signal: controller.signal },
        );
      }
      setStatus({ native, ready: true });
    })();

    return () => controller.abort();
  }, []);

  return <WebMCPContext.Provider value={status}>{children}</WebMCPContext.Provider>;
}
