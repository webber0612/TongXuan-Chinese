import { describe, expect, it } from "vitest";
import {
  EMPTY_WRITING_PROGRESS,
  getWritingPlan,
  isWritingMastered,
  recordIndependentWritingFailure,
  recordWritingSuccess,
  writingProgressKey,
} from "./adaptiveWriting";

const READY_FOR_INDEPENDENT = { ...EMPTY_WRITING_PROGRESS, guidedSuccesses: 2, reducedHintSuccesses: 1 };

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

  it("masters a character after one clean independent attempt", () => {
    const state = recordWritingSuccess(READY_FOR_INDEPENDENT, "independent");
    expect(state.mastered).toBe(true);
    expect(getWritingPlan(state, true)).toEqual({ phase: "independent", remaining: 0 });
  });

  it("asks for exactly one more clean attempt no matter how many mistaken attempts came first", () => {
    let state = READY_FOR_INDEPENDENT;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      state = recordIndependentWritingFailure(state);
      expect(getWritingPlan(state)).toEqual({ phase: "independent", remaining: 1 });
    }
    state = recordWritingSuccess(state, "independent");
    expect(state.mastered).toBe(true);
    expect(state.independentFailures).toBe(5);
    expect(getWritingPlan(state, true).remaining).toBe(0);
  });

  it("drops mastery after a later mistake until the next clean attempt", () => {
    const mastered = recordWritingSuccess(READY_FOR_INDEPENDENT, "independent");
    const slipped = recordIndependentWritingFailure(mastered);
    expect(slipped.mastered).toBe(false);
    expect(isWritingMastered(slipped)).toBe(false);
    expect(getWritingPlan(slipped)).toEqual({ phase: "independent", remaining: 1 });
    expect(recordWritingSuccess(slipped, "independent").mastered).toBe(true);
  });

  it("keeps a review pass for mastered characters on a new visit", () => {
    const mastered = { ...READY_FOR_INDEPENDENT, independentSuccesses: 1, mastered: true };
    expect(getWritingPlan(mastered)).toEqual({ phase: "independent", remaining: 1 });
    expect(getWritingPlan(mastered, true)).toEqual({ phase: "independent", remaining: 0 });
  });

  it("scopes progress by learner and by script form", () => {
    expect(writingProgressKey("learner-a", "馬", "trad")).not.toBe(writingProgressKey("learner-b", "馬", "trad"));
    expect(writingProgressKey("learner-a", "馬", "trad")).not.toBe(writingProgressKey("learner-a", "马", "hans"));
  });
});
