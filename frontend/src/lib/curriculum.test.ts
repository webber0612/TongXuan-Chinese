// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { buildCurriculumPath, progressLabel } from "./curriculum";
import { CurriculumPage } from "../pages/CurriculumPage";
import { officialCoursePath } from "../data/officialCoursePath";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("long-term curriculum read model", () => {
  it("builds an explicit child-scoped as-of request", () => {
    expect(buildCurriculumPath(7, "2026-01-04T00:00:00Z")).toBe("/api/children/7/curriculum?as_of=2026-01-04T00%3A00%3A00Z");
  });

  it("keeps progression labels independent from skill mastery", () => {
    expect(progressLabel("COMPLETED")).toBe("Completed");
    expect(progressLabel("IN_PROGRESS")).toBe("In progress");
    expect(progressLabel("NOT_STARTED")).toBe("Not started");
  });

  it("renders hierarchy, provenance, as-of state, child switching, refresh, and GET-only access", async () => {
    const payload = {
      as_of: "2026-01-04 00:00:00",
      progress: { total: 1, completed: 1, in_progress: 0, not_started: 0 },
      levels: [{ id: "level-1", title: "Level One", units: [{ id: "unit-1", title: "Unit One", items: [{ id: "item-1", content: "學", progress: { status: "COMPLETED" }, source_name: "Family Curriculum Draft", license_name: "PRIVATE_OK" }] }] }],
    };
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = url.includes("/api/children") && !url.includes("/curriculum") ? [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] : payload;
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(CurriculumPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("Level One");
    expect(document.body.textContent).toContain("Unit One");
    expect(document.body.textContent).toContain("Family Curriculum Draft");
    expect(document.body.textContent).toContain("PRIVATE_OK");
    expect(document.body.textContent).toContain("2026-01-04 00:00:00");
    const child = document.querySelector('[aria-label="Curriculum child"]') as HTMLSelectElement;
    child.value = "2";
    await act(async () => { child.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); await Promise.resolve(); });
    const refresh = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Refresh"))!;
    await act(async () => { refresh.click(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("/api/children/2/curriculum"))).toBe(true);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });

  it("records handbook-backed objectives for every lesson in the validated slice", () => {
    const lessons = officialCoursePath.stages.flatMap((stage) => stage.lessons);
    expect(lessons).toHaveLength(27);
    expect(lessons.every((lesson) => Boolean(lesson.officialObjectiveSummary?.length && lesson.objectiveSourceUrl?.includes("#page=")))).toBe(true);
    expect(officialCoursePath.stages[2].lessons.map((lesson) => lesson.number)).toEqual([1, 2, 3]);
    expect(officialCoursePath.stages.map((stage) => stage.id)).toEqual(["starter", "basic", "book-1"]);
    expect(officialCoursePath.outOfScopeBooks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("shows an empty learner state instead of leaving the progress panel loading", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(CurriculumPage)); await Promise.resolve(); await Promise.resolve(); });
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toContain("No learners yet");
    expect(document.querySelector('[aria-label="Curriculum child"]')).toHaveProperty("disabled", true);
    expect(document.body.textContent).not.toContain("Getting things ready");
    root.unmount();
    vi.unstubAllGlobals();
  });
});
