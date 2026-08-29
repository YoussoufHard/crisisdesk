import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOOL_EXECUTORS } from "./toolExecutors";
import { approvalBroker } from "./approval";
import { resetSimulation } from "@/lib/data/repository";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  resetSimulation();
});

describe("read tools", () => {
  it("get_incident returns structured data for a valid incident", async () => {
    const result = await TOOL_EXECUTORS.get_incident({ incident_id: "INC-1042" });
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("INC-1042");
    expect(result.isError).toBeFalsy();
  });

  it("get_incident returns a structured error for missing input", async () => {
    const result = await TOOL_EXECUTORS.get_incident({});
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("INVALID_INPUT");
  });

  it("get_service_status errors cleanly for an unknown service", async () => {
    const result = await TOOL_EXECUTORS.get_service_status({ service: "ghost-service" });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("get_logs respects severity and limit", async () => {
    const result = await TOOL_EXECUTORS.get_logs({ service: "payment-api", severity: "ERROR", limit: 3 });
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(3);
  });
});

describe("investigation write tools", () => {
  it("correlate_evidence records signals", async () => {
    const result = await TOOL_EXECUTORS.correlate_evidence({
      incident_id: "INC-1042",
      signals: [{ signal: "error rate spike", source: "get_metrics" }],
    });
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("create_root_cause_hypothesis clamps confidence into [0,1]", async () => {
    const result = await TOOL_EXECUTORS.create_root_cause_hypothesis({
      incident_id: "INC-1042",
      hypothesis: "Bad deploy",
      confidence: 1.5,
      reasoning_summary: ["a", "b"],
    });
    const body = parse(result);
    expect(body.data.confidence).toBe(1);
  });

  it("create_remediation_plan stores structured steps", async () => {
    const result = await TOOL_EXECUTORS.create_remediation_plan({
      incident_id: "INC-1042",
      summary: "Roll back the bad deploy",
      steps: [{ action: "rollback_service", target: "payment-api", to_version: "2.8.0", risk: "MEDIUM", description: "rollback" }],
    });
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data.steps[0].id).toBe("INC-1042-step-1");
  });
});

describe("execute_remediation (human-in-the-loop)", () => {
  async function createPlan() {
    await TOOL_EXECUTORS.create_remediation_plan({
      incident_id: "INC-1042",
      summary: "Roll back the bad deploy",
      steps: [{ action: "rollback_service", target: "payment-api", to_version: "2.8.0", risk: "MEDIUM", description: "rollback" }],
    });
  }

  it("blocks on human approval and applies the rollback when approved", async () => {
    await createPlan();

    const execution = TOOL_EXECUTORS.execute_remediation({ incident_id: "INC-1042", step_id: "INC-1042-step-1" });

    await vi.waitFor(() => expect(approvalBroker.getCurrent()).not.toBeNull());
    expect(approvalBroker.getCurrent()?.risk).toBe("MEDIUM");
    approvalBroker.respond(true);

    const result = await execution;
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data.toVersion).toBe("2.8.0");
  });

  it("makes no changes when the human declines", async () => {
    await createPlan();

    const execution = TOOL_EXECUTORS.execute_remediation({ incident_id: "INC-1042", step_id: "INC-1042-step-1" });
    await vi.waitFor(() => expect(approvalBroker.getCurrent()).not.toBeNull());
    approvalBroker.respond(false);

    const result = await execution;
    const body = parse(result);
    expect(body.data.approved).toBe(false);

    const { getService } = await import("@/lib/data/repository");
    const service = getService("payment-api");
    expect(service.success && service.data.version).toBe("2.8.1");
  });

  it("errors for a step_id that does not exist on the plan", async () => {
    await createPlan();
    const result = await TOOL_EXECUTORS.execute_remediation({ incident_id: "INC-1042", step_id: "bogus" });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe("STEP_NOT_FOUND");
  });

  it("resolves a non-rollback action generically (e.g. a memory leak restart)", async () => {
    await TOOL_EXECUTORS.create_remediation_plan({
      incident_id: "INC-1037",
      summary: "Restart the leaking worker pool",
      steps: [{ action: "restart_service", target: "notification-api", risk: "LOW", description: "restart worker pool" }],
    });

    const execution = TOOL_EXECUTORS.execute_remediation({ incident_id: "INC-1037", step_id: "INC-1037-step-1" });
    await vi.waitFor(() => expect(approvalBroker.getCurrent()).not.toBeNull());
    approvalBroker.respond(true);

    const result = await execution;
    const body = parse(result);
    expect(body.success).toBe(true);
    expect(body.data.action).toBe("restart_service");

    const { getIncident } = await import("@/lib/data/repository");
    const incident = getIncident("INC-1037");
    expect(incident.success && incident.data.status).toBe("RESOLVED");
  });
});
