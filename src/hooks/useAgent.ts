"use client";

import { useSyncExternalStore } from "react";
import { agentSession, type AgentSessionState } from "@/lib/ai/agentSession";
import { approvalBroker, type ApprovalRequest } from "@/lib/webmcp/approval";

export function useAgentSession(): AgentSessionState {
  return useSyncExternalStore(agentSession.subscribe, agentSession.getSnapshot, agentSession.getSnapshot);
}

export function usePendingApproval(): ApprovalRequest | null {
  return useSyncExternalStore(
    (cb) => approvalBroker.subscribe(() => cb()),
    () => approvalBroker.getCurrent(),
    () => null,
  );
}
