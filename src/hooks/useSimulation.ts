"use client";

import { useSyncExternalStore } from "react";
import { simulationStore } from "@/lib/data/store";
import type { SimulationSnapshot, ToolCallRecord } from "@/lib/data/types";

const nullSnapshot = () => null;
const emptyToolCalls: ToolCallRecord[] = [];
const getEmptyToolCalls = () => emptyToolCalls;

/**
 * Returns null during SSR and the first client render (before hydration
 * completes), then the live simulation snapshot afterward. The simulation is
 * inherently a browser-side concept (WebMCP tools execute in the browser), so
 * we never try to render its data during SSR — callers should show a loading
 * skeleton while this is null.
 */
export function useSimulationSnapshot(): SimulationSnapshot | null {
  return useSyncExternalStore(simulationStore.subscribe, simulationStore.getSnapshot, nullSnapshot);
}

export function useToolCalls(): ToolCallRecord[] {
  return useSyncExternalStore(simulationStore.subscribe, simulationStore.getToolCalls, getEmptyToolCalls);
}
