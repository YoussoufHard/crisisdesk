export interface ApprovalRequest {
  id: string;
  incidentId: string;
  action: string;
  target: string;
  fromVersion?: string;
  toVersion?: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

type ApprovalListener = (request: ApprovalRequest | null) => void;

/**
 * Bridges `execute_remediation`'s `execute()` (which must block mid-flight on
 * a real human decision, see docs/webmcp-research.md §5) with the approval
 * modal component. `request()` resolves only when `respond()` is called from
 * the UI after the human clicks Approve/Cancel.
 */
class ApprovalBroker {
  private current: ApprovalRequest | null = null;
  private pendingResolve: ((approved: boolean) => void) | null = null;
  private listeners = new Set<ApprovalListener>();

  subscribe(listener: ApprovalListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) l(this.current);
  }

  request(details: Omit<ApprovalRequest, "id">): Promise<boolean> {
    const request: ApprovalRequest = { id: `approval-${Date.now()}`, ...details };
    this.current = request;
    this.notify();
    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  respond(approved: boolean) {
    this.pendingResolve?.(approved);
    this.pendingResolve = null;
    this.current = null;
    this.notify();
  }

  getCurrent(): ApprovalRequest | null {
    return this.current;
  }
}

export const approvalBroker = new ApprovalBroker();
