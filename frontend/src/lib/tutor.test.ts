// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { buildTutorPath, tutorModeLabel } from "./tutor";
import { TutorPage } from "../pages/TutorPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("optional AI Tutor boundary", () => {
  it("keeps the child-scoped response endpoint explicit", () => {
    expect(buildTutorPath(7)).toBe("/api/children/7/tutor/respond");
  });

  it("exposes only the allowed instructional modes", () => {
    expect(tutorModeLabel("sentence-hint")).toBe("Sentence hint");
    expect(tutorModeLabel("reading-guide")).toBe("Reading guide");
  });

  it("renders the minimal panel and keeps the interaction child-scoped", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
      const body = url.endsWith("/api/children") ? [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] : { mode: "explain", response: "Grounded explanation", source: { source_name: "Family Curriculum", license_name: "PRIVATE_OK", provenance_status: "PRIVATE_OK" }, safety: { mutates_mastery: false } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(TutorPage)); await Promise.resolve(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("Grounded Tutor");
    const child = document.querySelector('[aria-label="Tutor child"]') as HTMLSelectElement;
    child.value = "2";
    await act(async () => { child.dispatchEvent(new Event("change", { bubbles: true })); });
    const source = document.querySelector('[aria-label="Tutor curriculum item"]') as HTMLInputElement;
    const prompt = document.querySelector('[aria-label="Tutor prompt"]') as HTMLInputElement;
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setInput.call(source, "item-2");
    source.dispatchEvent(new Event("input", { bubbles: true }));
    setInput.call(prompt, "Explain this");
    prompt.dispatchEvent(new Event("input", { bubbles: true }));
    await act(async () => { document.querySelector("button")!.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("/api/children/2/tutor/respond") && call.method === "POST" && call.body?.includes('"source_id":"item-2"'))).toBe(true);
    expect(calls.filter((call) => call.url.includes("/api/children/2/tutor/respond")).every((call) => call.body?.includes('"source_type":"CURRICULUM_ITEM"'))).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });
});
