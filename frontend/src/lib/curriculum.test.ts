import { describe, expect, it } from "vitest";
import { buildCurriculumPath, progressLabel } from "./curriculum";

describe("long-term curriculum read model", () => {
  it("builds an explicit child-scoped as-of request", () => {
    expect(buildCurriculumPath(7, "2026-01-04T00:00:00Z")).toBe("/api/children/7/curriculum?as_of=2026-01-04T00%3A00%3A00Z");
  });

  it("keeps progression labels independent from skill mastery", () => {
    expect(progressLabel("COMPLETED")).toBe("Completed");
    expect(progressLabel("IN_PROGRESS")).toBe("In progress");
    expect(progressLabel("NOT_STARTED")).toBe("Not started");
  });
});
