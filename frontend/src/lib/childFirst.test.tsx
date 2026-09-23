// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { addChildProfile, defaultProfiles, loadProfiles, saveProfiles, selectProfile } from "./profiles";
import { PARENT_GATE_NOTE, validateParentPassword } from "./parentGate";
import { ChildHomePage } from "../pages/ChildHomePage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("child-first shell contracts", () => {
  it("keeps two child profiles and a parent profile, with local add-user persistence", () => {
    expect(defaultProfiles.filter((profile) => profile.role === "child")).toHaveLength(2);
    expect(defaultProfiles.find((profile) => profile.role === "parent")?.name).toBe("家長管理者");
    const profiles = addChildProfile(defaultProfiles, " 小安 ");
    expect(profiles.at(-1)?.name).toBe("小安");
    expect(selectProfile(profiles, "parent").role).toBe("parent");
    const storage = { value: "", setItem: (_key: string, value: string) => { storage.value = value; }, getItem: () => storage.value };
    saveProfiles(profiles, storage);
    expect(loadProfiles(storage).at(-1)?.name).toBe("小安");
  });

  it("makes the parent gate explicit and keeps backend redemption as the only mutation", async () => {
    expect(validateParentPassword("wrong")).toBe(false);
    expect(validateParentPassword("家長")).toBe(true);
    expect(PARENT_GATE_NOTE).toContain("後端");
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = url.includes("daily-queue") ? [{ id: "q1", character: "學", source: "CURRICULUM", priority: 1 }] : url.includes("/api/points") && !url.includes("redeem") ? { balance: 20, rewards: [{ id: "r1", name: "選一個故事", cost: 10 }] } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(ChildHomePage, { child: { id: 1, name: "Alice" }, childName: "Alice", onOpenPractice: vi.fn() })); await Promise.resolve(); await Promise.resolve(); });
    const redeem = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("兌換")) as HTMLButtonElement;
    await act(async () => { redeem.click(); });
    expect(document.querySelector("#parent-password")).toBeTruthy();
    expect(document.querySelector('[aria-label="關閉家長確認視窗"]')).toBeTruthy();
    const password = document.querySelector("#parent-password") as HTMLInputElement;
    const setInputValue = (value: string) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(password, value); password.dispatchEvent(new Event("input", { bubbles: true })); };
    await act(async () => { setInputValue("wrong"); });
    const confirm = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "確認兌換") as HTMLButtonElement;
    await act(async () => { confirm.click(); });
    expect(document.body.textContent).toContain("請輸入家長密語");
    await act(async () => { setInputValue("家長"); });
    await act(async () => { confirm.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("/api/points/redeem/r1") && call.method === "POST")).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });

  it("exposes touch-sized primary labels and accessible status text on the child home", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("daily-queue") ? [{ id: "q1", character: "學", source: "CURRICULUM", priority: 1 }] : { balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(ChildHomePage, { child: { id: 1, name: "Alice" }, childName: "Alice", onOpenPractice: vi.fn() })); await Promise.resolve(); await Promise.resolve(); });
    expect(document.querySelector("#child-home-title")?.textContent).toContain("Alice");
    expect(document.querySelector("button.button-large")?.textContent).toContain("開始練習");
    expect(document.querySelector("#daily-focus-title")?.textContent).toContain("今天先做這一件事");
    root.unmount();
    vi.unstubAllGlobals();
  });
});
