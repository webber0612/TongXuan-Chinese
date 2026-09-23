// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { buildCommercializationPath } from "./commercialization";
import { CommercializationPage } from "../pages/CommercializationPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("developer/admin commercialization boundary", () => {
  it("keeps readiness on an admin-only endpoint", () => {
    expect(buildCommercializationPath("commercial")).toBe("/api/admin/commercialization/readiness?build_target=commercial");
  });

  it("renders readiness counts and keeps the admin audit read-only", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return new Response(JSON.stringify({ status: "WARNING", warnings: 3, commercial_blockers: 0, readiness: { dependencies: 10, commercial_ready: 2 }, resources: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(CommercializationPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("Commercialization Readiness");
    expect(document.body.textContent).toContain("10");
    const target = document.querySelector('[aria-label="Commercial build target"]') as HTMLSelectElement;
    target.value = "commercial";
    await act(async () => { target.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("build_target=commercial"))).toBe(true);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });
});
