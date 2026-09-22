import { describe, expect, it } from "vitest";
import { nextQueueItem, scoreAnswers } from "./learning";

describe("Sprint A learning helpers", () => {
  it("keeps school queue priority deterministic", () => {
    expect(nextQueueItem([{ source: "CURRICULUM" as const, priority: 0 }, { source: "SCHOOL_QUEUE" as const, priority: 5 }])?.source).toBe("SCHOOL_QUEUE");
  });
  it("scores a reproducible blueprint", () => {
    expect(scoreAnswers([{ id: "a", character: "學" }], { a: "學" })).toEqual({ correctness: { a: true }, score: 1, total: 1 });
  });
});
