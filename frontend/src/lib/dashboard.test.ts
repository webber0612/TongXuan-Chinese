// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DASHBOARD_SKILLS, buildDashboardPath, buildLearningFlowReportPath, dashboardRange, dashboardWindowLabel } from "./dashboard";
import { DashboardPage } from "../pages/DashboardPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("parent dashboard read model UI contract", () => {
  it("builds an explicit child-scoped time-window request", () => {
    expect(buildDashboardPath(7, "30d", undefined, "2026-01-30T00:00:00Z")).toBe("/api/dashboard?child_id=7&window=30d&to_at=2026-01-30T00%3A00%3A00Z");
    expect(buildLearningFlowReportPath(7, "2026-01-23T00:00:00.000Z", "2026-01-30T00:00:00.000Z")).toBe("/api/children/7/learning-sessions/report?from_at=2026-01-23T00%3A00%3A00.000Z&to_at=2026-01-30T00%3A00%3A00.000Z");
    expect(dashboardRange("7d", new Date("2026-01-30T00:00:00.000Z"))).toEqual({ fromAt: "2026-01-23T00:00:00.000Z", toAt: "2026-01-30T00:00:00.000Z" });
  });

  it("keeps every skill dimension separate", () => {
    expect(DASHBOARD_SKILLS).toHaveLength(9);
    expect(dashboardWindowLabel("all")).toBe("All time");
  });

  it("renders the real page and keeps child/window switching and refresh GET-only", async () => {
    const summary = { attempts: 1, correct: 1, independent_correct: 1, incorrect: 0, assisted: 0, last_practiced: "2026-01-01 00:00:00", distinct_practiced_items: 1, trend: [] };
    const payload = {
      window: { name: "7d", from: "2025-12-25 00:00:00", to: "2026-01-01 00:00:00" },
      activity: { attempts: { attempts: 1, correct: 1, independent_correct: 1, incorrect: 0, assisted: 0 }, review_count: 1, adaptive: { as_of: "2026-01-01 00:00:00", items: [] } },
      skills: Object.fromEntries(DASHBOARD_SKILLS.map((skill) => [skill, { ...summary, ...(skill === "reading_aloud" ? { completed: 0, aborted: 0 } : {}) }])),
      school_queue: { active: 1, completed: 0, due: 0, items: [{ id: "school-1", source: "Worksheet", due_date: null, private_content: true, provenance_status: "PRIVATE_OK" }] },
      weekly_tests: { recent: null, history: [], pending: [] },
      points_rewards: { balance: 0, ledger: [], redemptions: [] },
      reading_aloud: { attempts: 0, completed: 0, aborted: 0, items: [] },
      ocr: { candidates: 1, confirmed: 0, items: [{ id: "ocr-1", source_label: "Worksheet", locale: "zh-TW", script: "TRADITIONAL", review_status: "CANDIDATE", commercial_ready: 0 }] },
    };
    const flowReport = {
      childId: 1, from: "2025-12-25 00:00:00", to: "2026-01-01 00:00:00",
      sessions: [{ sessionId: "flow-1", lessonId: "starter-l01", status: "IN_PROGRESS", durationSeconds: 120, taskCount: 4, deferredCount: 1, masteryStatus: "READY_FOR_CHECK", rewardPoints: 0 }],
      taskCounts: { RECOGNITION: 2 }, weakDomains: { recognition: 1 }, deferredTasks: { FATIGUE: 1 },
      masteryChanges: [{ sessionId: "flow-1", status: "READY_FOR_CHECK" }], reviewDueCounts: { recognition: 2 },
      privacy: { rawAudioStored: false, learnerAnswersStored: false, identifyingTelemetry: false },
    };
    const calls: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", credentials: init?.credentials });
      const value = url.includes("/learning-sessions/report") ? flowReport : url.endsWith("/api/children") ? [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] : payload;
      return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(DashboardPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("School Queue");
    expect(document.body.textContent).toContain("Weekly Practice · activity points");
    expect(document.body.textContent).toContain("Points & Rewards");
    expect(document.body.textContent).toContain("Reading Aloud");
    expect(document.body.textContent).toContain("OCR Imports");
    expect(document.body.textContent).toContain("Adaptive Learning");
    expect(document.body.textContent).toContain("Learning progress");
    expect(document.body.textContent).toContain("Starter L01");
    expect(document.body.textContent).toContain("Ready For Check");
    const child = document.querySelector('[aria-label="Dashboard child"]') as HTMLSelectElement;
    child.value = "2";
    await act(async () => { child.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
    const windowSelect = document.querySelector('[aria-label="Dashboard time window"]') as HTMLSelectElement;
    windowSelect.value = "30d";
    await act(async () => { windowSelect.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
    const refresh = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Refresh report")!;
    await act(async () => { refresh.click(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("child_id=2") && call.url.includes("window=30d"))).toBe(true);
    const flowRequest = calls.find((call) => call.url.includes("/api/children/2/learning-sessions/report") && call.url.includes("from_at=") && call.url.includes("to_at="));
    expect(flowRequest?.credentials).toBe("include");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("keeps existing activity visible when the authoritative flow report is empty", async () => {
    const activity = { activity: { attempts: { attempts: 0, correct: 0, independent_correct: 0, incorrect: 0, assisted: 0 }, review_count: 0, adaptive: { as_of: "2026-01-01", items: [] } }, school_queue: { active: 0, completed: 0, due: 0, items: [] }, weekly_tests: { history: [] }, points_rewards: { balance: 0, ledger: [] }, reading_aloud: { attempts: 0, completed: 0, aborted: 0, items: [] }, ocr: { candidates: 0, confirmed: 0, items: [] }, skills: Object.fromEntries(DASHBOARD_SKILLS.map((skill) => [skill, { attempts: 0, independent_correct: 0, incorrect: 0, assisted: 0, distinct_practiced_items: 0, last_practiced: null }])), window: { to: "2026-01-01" } };
    const emptyFlow = { childId: 1, from: "", to: "2026-01-01", sessions: [], taskCounts: {}, weakDomains: {}, deferredTasks: {}, masteryChanges: [], reviewDueCounts: {}, privacy: { rawAudioStored: false, learnerAnswersStored: false, identifyingTelemetry: false } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const value = url.includes("/learning-sessions/report") ? emptyFlow : url.endsWith("/api/children") ? [{ id: 1, name: "Alice" }] : activity;
      return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(DashboardPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("No learning sessions in this period.");
    expect(document.body.textContent).toContain("School Queue");
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("shows a retryable flow-report error without hiding the existing activity view", async () => {
    const activity = { activity: { attempts: { attempts: 0, correct: 0, independent_correct: 0, incorrect: 0, assisted: 0 }, review_count: 0, adaptive: { as_of: "2026-01-01", items: [] } }, school_queue: { active: 0, completed: 0, due: 0, items: [] }, weekly_tests: { history: [] }, points_rewards: { balance: 0, ledger: [] }, reading_aloud: { attempts: 0, completed: 0, aborted: 0, items: [] }, ocr: { candidates: 0, confirmed: 0, items: [] }, skills: Object.fromEntries(DASHBOARD_SKILLS.map((skill) => [skill, { attempts: 0, independent_correct: 0, incorrect: 0, assisted: 0, distinct_practiced_items: 0, last_practiced: null }])), window: { to: "2026-01-01" } };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/report")) return new Response(JSON.stringify({ detail: "child_access_denied" }), { status: 403, headers: { "Content-Type": "application/json" } });
      const value = url.endsWith("/api/children") ? [{ id: 1, name: "Alice" }] : activity;
      return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(DashboardPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("child_access_denied");
    expect(document.body.textContent).toContain("School Queue");
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent === "Retry learning progress")).toBe(true);
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });
});
