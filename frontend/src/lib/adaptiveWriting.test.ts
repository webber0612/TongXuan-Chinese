import { describe, expect, it } from "vitest";
import {
  EMPTY_WRITING_PROGRESS,
  getWritingPlan,
  recordIndependentWritingFailure,
  recordWritingSuccess,
  writingProgressKey,
} from "./adaptiveWriting";

describe("adaptive handwriting plan", () => {
  it("moves from guided work to reduced hints and then independent writing", () => {
    let state = { ...EMPTY_WRITING_PROGRESS };
    expect(getWritingPlan(state)).toEqual({ phase: "guided", remaining: 2 });
    state = recordWritingSuccess(state, "guided");
    expect(getWritingPlan(state)).toEqual({ phase: "guided", remaining: 1 });
    state = recordWritingSuccess(state, "guided");
    expect(getWritingPlan(state)).toEqual({ phase: "reduced_hint", remaining: 1 });
    state = recordWritingSuccess(state, "reduced_hint");
    expect(getWritingPlan(state)).toEqual({ phase: "independent", remaining: 1 });
  });

  it("keeps independent retries on the failing character and lets mastered learners skip guided stages", () => {
    let learnerA = { ...EMPTY_WRITING_PROGRESS, guidedSuccesses: 2, reducedHintSuccesses: 1 };
    learnerA = recordIndependentWritingFailure(learnerA);
    expect(getWritingPlan(learnerA)).toEqual({ phase: "independent", remaining: 2 });
    learnerA = recordWritingSuccess(learnerA, "independent");
    expect(getWritingPlan(learnerA)).toEqual({ phase: "independent", remaining: 1 });

    const learnerB = { ...EMPTY_WRITING_PROGRESS, guidedSuccesses: 2, reducedHintSuccesses: 1, independentSuccesses: 1, mastered: true };
    expect(getWritingPlan(learnerB)).toEqual({ phase: "independent", remaining: 1 });
    expect(getWritingPlan(learnerB, true)).toEqual({ phase: "independent", remaining: 0 });
    expect(getWritingPlan(recordIndependentWritingFailure(learnerB))).toEqual({ phase: "independent", remaining: 1 });
    expect(writingProgressKey("learner-a", "馬", "trad")).not.toBe(writingProgressKey("learner-b", "馬", "trad"));
    expect(writingProgressKey("learner-a", "馬", "trad")).not.toBe(writingProgressKey("learner-a", "马", "hans"));
  });
});
