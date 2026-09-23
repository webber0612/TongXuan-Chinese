import { describe, expect, it } from "vitest";
import { DASHBOARD_SKILLS, buildDashboardPath, dashboardWindowLabel } from "./dashboard";

describe("parent dashboard read model UI contract", () => {
  it("builds an explicit child-scoped time-window request", () => {
    expect(buildDashboardPath(7, "30d", undefined, "2026-01-30T00:00:00Z")).toBe("/api/dashboard?child_id=7&window=30d&to_at=2026-01-30T00%3A00%3A00Z");
  });

  it("keeps every skill dimension separate", () => {
    expect(DASHBOARD_SKILLS).toHaveLength(9);
    expect(dashboardWindowLabel("all")).toBe("All time");
  });
});
