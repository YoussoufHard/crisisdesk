"use client";

import { createInitialSnapshot } from "./seed";
import type { SimulationSnapshot, ToolCallRecord } from "./types";

const STORAGE_KEY = "crisisdesk.simulation.v1";
const MAX_TOOL_CALLS = 200;

type Listener = () => void;

class SimulationStore {
  private snapshot: SimulationSnapshot | null = null;
  private toolCalls: ToolCallRecord[] = [];
  private listeners = new Set<Listener>();

  private ensureLoaded(): SimulationSnapshot {
    if (this.snapshot) return this.snapshot;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.snapshot = JSON.parse(raw) as SimulationSnapshot;
          return this.snapshot;
        }
      } catch {
        // fall through to fresh snapshot
      }
    }
    this.snapshot = createInitialSnapshot();
    this.persist();
    return this.snapshot;
  }

  private persist() {
    if (typeof window === "undefined" || !this.snapshot) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      // storage unavailable (private mode, quota) - state stays in-memory only
    }
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SimulationSnapshot => {
    return this.ensureLoaded();
  };

  mutate(fn: (draft: SimulationSnapshot) => void) {
    const current = this.ensureLoaded();
    const draft: SimulationSnapshot = structuredClone(current);
    fn(draft);
    this.snapshot = draft;
    this.persist();
    this.notify();
  }

  resetAll() {
    this.snapshot = createInitialSnapshot();
    this.toolCalls = [];
    this.persist();
    this.notify();
  }

  recordToolCall(record: ToolCallRecord) {
    this.toolCalls = [record, ...this.toolCalls].slice(0, MAX_TOOL_CALLS);
    this.notify();
  }

  getToolCalls = (): ToolCallRecord[] => this.toolCalls;
}

export const simulationStore = new SimulationStore();
