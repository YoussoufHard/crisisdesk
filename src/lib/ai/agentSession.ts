"use client";

export type AgentStatus = "idle" | "running" | "done" | "error";

export interface AgentSessionState {
  status: AgentStatus;
  incidentId: string | null;
  finalText: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  iterations: number;
}

const initialState: AgentSessionState = {
  status: "idle",
  incidentId: null,
  finalText: null,
  errorMessage: null,
  startedAt: null,
  iterations: 0,
};

type Listener = () => void;

class AgentSessionStore {
  private state: AgentSessionState = { ...initialState };
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AgentSessionState => this.state;

  private set(partial: Partial<AgentSessionState>) {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l();
  }

  start(incidentId: string) {
    this.set({
      status: "running",
      incidentId,
      finalText: null,
      errorMessage: null,
      startedAt: new Date().toISOString(),
      iterations: 0,
    });
  }

  incrementIteration() {
    this.set({ iterations: this.state.iterations + 1 });
  }

  setFinal(text: string) {
    this.set({ status: "done", finalText: text });
  }

  setError(message: string) {
    this.set({ status: "error", errorMessage: message });
  }

  reset() {
    this.set({ ...initialState });
  }
}

export const agentSession = new AgentSessionStore();
