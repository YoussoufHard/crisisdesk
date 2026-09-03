import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFallbackAnalysis } from "./fallbackAnalysis";
import { TOOL_EXECUTORS } from "@/lib/webmcp/toolExecutors";
import { resetSimulation, getIncident } from "@/lib/data/repository";

function parse(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

const INCIDENT_IDS = ["INC-1042", "INC-1041", "INC-1039", "INC-1037"];

beforeEach(() => {
  resetSimulation();
});

describe("fallback analyses are complete and pass real tool validation", () => {
  for (const incidentId of INCIDENT_IDS) {
    it(`${incidentId} has a well-formed fallback that the real tool executors accept`, async () => {
      const analysis = getFallbackAnalysis(incidentId);
      expect(analysis).not.toBeNull();
      if (!analysis) return;

      expect(analysis.evidence.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
      expect(analysis.reasoningSummary.length).toBeGreaterThan(0);
      expect(analysis.steps.length).toBeGreaterThan(0);

      const evidenceResult = await TOOL_EXECUTORS.correlate_evidence({
        incident_id: incidentId,
        signals: analysis.evidence,
      });
      expect(evidenceResult.isError).toBeFalsy();
      expect(parse(evidenceResult).success).toBe(true);

      const rootCauseResult = await TOOL_EXECUTORS.create_root_cause_hypothesis({
        incident_id: incidentId,
        hypothesis: analysis.hypothesis,
        confidence: analysis.confidence,
        reasoning_summary: analysis.reasoningSummary,
      });
      expect(rootCauseResult.isError).toBeFalsy();
      expect(parse(rootCauseResult).success).toBe(true);

      const planResult = await TOOL_EXECUTORS.create_remediation_plan({
        incident_id: incidentId,
        summary: analysis.planSummary,
        steps: analysis.steps.map((s) => ({
          action: s.action,
          target: s.target,
          from_version: s.fromVersion,
          to_version: s.toVersion,
          risk: s.risk,
          description: s.description,
        })),
      });
      expect(planResult.isError).toBeFalsy();
      const plan = parse(planResult);
      expect(plan.success).toBe(true);
      const firstStepId = plan.data.steps[0].id;

      // Every step must target a real, known service so execute_remediation can act on it.
      const servicesModule = await import("@/lib/data/repository");
      for (const step of analysis.steps) {
        expect(servicesModule.getService(step.target).success).toBe(true);
      }
      const { approvalBroker } = await import("@/lib/webmcp/approval");
      const executionPromise = TOOL_EXECUTORS.execute_remediation({ incident_id: incidentId, step_id: firstStepId });
      await vi.waitFor(() => expect(approvalBroker.getCurrent()).not.toBeNull());
      approvalBroker.respond(true);
      const executionResult = await executionPromise;
      expect(executionResult.isError).toBeFalsy();
      const execution = parse(executionResult);
      expect(execution.success).toBe(true);

      const incident = getIncident(incidentId);
      expect(incident.success && incident.data.status).toBe("RESOLVED");
    });
  }
});
