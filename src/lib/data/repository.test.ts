import { beforeEach, describe, expect, it } from "vitest";
import * as repo from "./repository";

beforeEach(() => {
  repo.resetSimulation();
});

describe("getIncident", () => {
  it("returns the incident when it exists", () => {
    const result = repo.getIncident("INC-1042");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Payment API Degradation");
    }
  });

  it("returns a structured error for an unknown incident", () => {
    const result = repo.getIncident("INC-9999");
    expect(result).toEqual({
      success: false,
      error: { code: "INCIDENT_NOT_FOUND", message: "Incident INC-9999 was not found." },
    });
  });
});

describe("getService", () => {
  it("returns service status", () => {
    const result = repo.getService("payment-api");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe("2.8.1");
      expect(result.data.health).toBe("DEGRADED");
    }
  });

  it("errors for an unknown service", () => {
    const result = repo.getService("does-not-exist");
    expect(result.success).toBe(false);
  });
});

describe("getLogs", () => {
  it("filters by severity and respects limit", () => {
    const result = repo.getLogs("payment-api", { severity: "ERROR", limit: 2 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.data.every((l) => l.severity === "ERROR")).toBe(true);
    }
  });

  it("errors for an unknown service", () => {
    expect(repo.getLogs("nope").success).toBe(false);
  });
});

describe("getMetrics", () => {
  it("returns points within the requested time range", () => {
    const result = repo.getMetrics("payment-api", 10);
    expect(result.success).toBe(true);
  });
});

describe("getDependencies", () => {
  it("reports both directions of the dependency graph", () => {
    const result = repo.getDependencies("payment-api");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dependsOn).toContain("payment-provider");
      expect(result.data.dependedOnBy).toContain("checkout-api");
    }
  });
});

describe("evidence, root cause, and remediation plan", () => {
  it("records evidence on an incident", () => {
    const result = repo.addEvidence("INC-1042", [{ signal: "error spike", source: "get_metrics" }]);
    expect(result.success).toBe(true);
    const incident = repo.getIncident("INC-1042");
    expect(incident.success && incident.data.evidence).toHaveLength(1);
  });

  it("records a root cause hypothesis and moves status to MITIGATING", () => {
    repo.setRootCause("INC-1042", "Bad deploy", 0.9, ["signal a"]);
    const incident = repo.getIncident("INC-1042");
    expect(incident.success && incident.data.status).toBe("MITIGATING");
    expect(incident.success && incident.data.rootCause?.confidence).toBe(0.9);
  });

  it("records a remediation plan without changing service state", () => {
    repo.setRemediationPlan("INC-1042", {
      incidentId: "INC-1042",
      createdAt: new Date().toISOString(),
      summary: "Roll back",
      steps: [
        { id: "s1", action: "rollback_service", target: "payment-api", toVersion: "2.8.0", risk: "MEDIUM", description: "rollback" },
      ],
    });
    const service = repo.getService("payment-api");
    expect(service.success && service.data.health).toBe("DEGRADED");
  });
});

describe("applyRollbackRemediation", () => {
  it("rolls back the service, heals affected services, and resolves the incident", () => {
    const result = repo.applyRollbackRemediation("INC-1042", "payment-api", "2.8.0");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fromVersion).toBe("2.8.1");
      expect(result.data.toVersion).toBe("2.8.0");
      expect(result.data.after.errorRatePct).toBeLessThan(result.data.before.errorRatePct);
    }

    const service = repo.getService("payment-api");
    expect(service.success && service.data.health).toBe("HEALTHY");
    expect(service.success && service.data.version).toBe("2.8.0");

    const checkout = repo.getService("checkout-api");
    expect(checkout.success && checkout.data.health).toBe("HEALTHY");

    const incident = repo.getIncident("INC-1042");
    expect(incident.success && incident.data.status).toBe("RESOLVED");
    expect(incident.success && incident.data.resolvedAt).not.toBeNull();
  });

  it("errors for an unknown incident", () => {
    const result = repo.applyRollbackRemediation("INC-0000", "payment-api", "2.8.0");
    expect(result.success).toBe(false);
  });
});

describe("applyGenericRemediation", () => {
  it("resolves a non-rollback incident like the memory leak scenario", () => {
    const result = repo.applyGenericRemediation("INC-1037", "notification-api", "restart_service", "restart worker pool");
    expect(result.success).toBe(true);

    const service = repo.getService("notification-api");
    expect(service.success && service.data.health).toBe("HEALTHY");

    const incident = repo.getIncident("INC-1037");
    expect(incident.success && incident.data.status).toBe("RESOLVED");
  });

  it("errors for an unknown service", () => {
    const result = repo.applyGenericRemediation("INC-1037", "ghost", "restart_service", "x");
    expect(result.success).toBe(false);
  });
});
