import { describe, expect, it } from "vitest";
import { buildAdaptiveRequest, explainAdaptiveReasons } from "./adaptive";

describe("adaptive plan UI contract", () => {
  it("builds an explicit as-of request with manual preference", () => {
    expect(buildAdaptiveRequest("2026-01-01T00:00:00Z", 5, true, "SCHOOL_QUEUE")).toEqual({ as_of: "2026-01-01T00:00:00Z", limit: 5, adaptive: true, preference: "SCHOOL_QUEUE" });
  });

  it("renders auditable reasons without hiding components", () => {
    expect(explainAdaptiveReasons(["overdue", "recent incorrect"])).toBe("overdue、recent incorrect");
  });
});
