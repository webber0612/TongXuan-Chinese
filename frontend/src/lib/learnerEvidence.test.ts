import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLearnerEvidenceSummary,
  getOrthographicProfile,
  getTargetEvidence,
  savePlacementProfileV2,
} from "./learnerEvidence";

describe("learner evidence API contract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps Traditional and Simplified orthographic facts separately typed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      childId: 3,
      profileVersion: 1,
      isMasteryJudgment: false,
      items: [{
        target: { id: "target-a", kind: "ORTHOGRAPHIC_FORM", conceptId: "concept-a", script: "TRADITIONAL", displayForm: "醫", handwritingExpectation: "EXPOSURE_ONLY" },
        traditional: { recognition: { state: "OBSERVED" }, reading: { state: "NOT_ASSESSED" }, input: { state: "NOT_ASSESSED" }, handwriting: { state: "NOT_ASSESSED" } },
        simplified: { recognition: { state: "NOT_ASSESSED" }, reading: { state: "NOT_ASSESSED" }, input: { state: "NOT_ASSESSED" }, handwriting: { state: "NOT_ASSESSED" } },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = await getOrthographicProfile(3);
    expect(profile.items[0].traditional.recognition.state).toBe("OBSERVED");
    expect(profile.items[0].simplified.recognition.state).toBe("NOT_ASSESSED");
    expect(fetchMock).toHaveBeenCalledWith("/api/children/3/learner-evidence/orthographic-profile", expect.objectContaining({ credentials: "include" }));
  });

  it("exposes NOT_ASSESSED and outcome facts without a mastery claim", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      childId: 3, modelVersion: 1, isMasteryJudgment: false,
      dimensions: [{ dimension: "HEAR", script: "SCRIPT_INDEPENDENT", state: "NOT_ASSESSED", targetCount: 1, evidenceCount: 1, independentCorrectCount: 0, assistedCount: 0, incorrectCount: 0, partialCount: 0, notAssessedCount: 1 }],
      eventFacts: { totalEvidenceCount: 1, activeRecallObservationCount: 0, delayedCorrectRetrievalCount: 0, delayedIndependentCorrectRetrievalCount: 0, incorrectOrPartialCount: 0 },
    }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({
      childId: 3,
      target: { id: "hospital-example", kind: "LEXICAL_CONCEPT", conceptId: "hospital-example", script: "SCRIPT_INDEPENDENT", displayForm: null, handwritingExpectation: null },
      profile: [],
      events: [{ id: "event", dimension: "RECALL", script: "SCRIPT_INDEPENDENT", outcome: "CORRECT", assistance: "INDEPENDENT", score: null, scorer: "fixture", scorerVersion: "v1", cueType: "IMAGE", answerExposed: false, inputMethod: "VOICE", retrievalTiming: "DELAYED", priorExposureAt: "2026-09-01T00:00:00Z", reviewDueAt: null, source: { type: "fixture", ref: "attempt", taskId: null, sessionId: null, lessonId: null }, occurredAt: "2026-09-08T00:00:00Z", evidenceSchemaVersion: 1 }],
      isMasteryJudgment: false,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = await getLearnerEvidenceSummary(3);
    const target = await getTargetEvidence(3, "lexical concept/醫院");
    expect(summary.dimensions[0].state).toBe("NOT_ASSESSED");
    expect(target.events[0].retrievalTiming).toBe("DELAYED");
    expect(target.isMasteryJudgment).toBe(false);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/children/3/learner-evidence/targets/lexical%20concept%2F%E9%86%AB%E9%99%A2");
  });

  it("keeps profile editing versioned and rejects invalid child IDs before fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(() => getLearnerEvidenceSummary(0)).toThrow("invalid_child_id");
    await savePlacementProfileV2(3, { traditional_recognition: "STARTER" }, "PARENT_OBSERVATION");
    expect(fetchMock).toHaveBeenCalledWith("/api/children/3/placement-profile/v2", expect.objectContaining({ method: "PUT" }));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("learner-evidence"), expect.objectContaining({ method: "POST" }));
  });
});
