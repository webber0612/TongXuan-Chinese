// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { addChildProfile, defaultProfiles, loadProfiles, reconcileProfiles, saveProfiles, selectProfile } from "./profiles";
import { PARENT_GATE_NOTE, isPasswordEntered } from "./parentGate";
import { ChildHomePage } from "../pages/ChildHomePage";
import { routeFromPath } from "../AppShell";
import { AppShell } from "../AppShell";
import { DISPLAY_LANGUAGE_KEY } from "./i18n";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("child-first shell contracts", () => {
  it("keeps two child profiles and a parent profile, with local add-user persistence", () => {
    expect(defaultProfiles.filter((profile) => profile.role === "child")).toHaveLength(2);
    expect(defaultProfiles.find((profile) => profile.role === "parent")?.name).toBe("家長管理者");
    const profiles = addChildProfile(defaultProfiles, " 小安 ");
    expect(profiles.at(-1)?.name).toBe("小安");
    expect(selectProfile(profiles, "parent").role).toBe("parent");
    const reconciled = reconcileProfiles([{ id: 42, name: "後端小安" }], profiles);
    expect(reconciled.map((profile) => profile.key)).toEqual(["child-42", "parent"]);
    expect(reconciled[0].name).toBe("後端小安");
    expect(reconciled).not.toContainEqual(expect.objectContaining({ key: "child-a" }));
    const storage = { value: "", setItem: (_key: string, value: string) => { storage.value = value; }, getItem: () => storage.value };
    saveProfiles(profiles, storage);
    expect(loadProfiles(storage).at(-1)?.name).toBe("小安");
  });

  it("updates routes from browser history without relying on a full reload", () => {
    expect(routeFromPath("/parent-dashboard")).toBe("parent");
    expect(routeFromPath("/practice")).toBe("practice");
    expect(routeFromPath("/")).toBe("home");
    for (const productionAlias of ["/preview-2", "/preview-b", "/preview-kids", "/kids"]) {
      expect(routeFromPath(productionAlias)).toBe("home");
    }
    for (const previewPath of ["/preview", "/preview-pixel", "/preview-reference", "/preview-directions", "/learning-desk", "/learning-calendar"]) {
      expect(routeFromPath(previewPath)).toBe("archived-preview");
    }
    expect(routeFromPath("/TongXuan-Chinese/preview-2")).toBe("home");
    expect(routeFromPath("/TongXuan-Chinese/preview-kids")).toBe("home");
    expect(routeFromPath("/unknown")).toBe("home");
  });

  it("persists add-user through POST and reconciles profiles by backend id", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    window.history.replaceState({}, "", "/curriculum");
    let childrenReads = 0;
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.endsWith("/api/children") && method === "POST") return new Response(JSON.stringify({ id: 2, name: "Bob" }), { status: 200 });
      if (url.endsWith("/api/children")) { childrenReads += 1; return new Response(JSON.stringify(childrenReads > 1 ? [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] : [{ id: 1, name: "Alice" }]), { status: 200 }); }
      if (url.includes("/api/children/1/curriculum")) return new Response(JSON.stringify({ as_of: "2026-09-25", progress: { total: 0, completed: 0, in_progress: 0, not_started: 0 }, levels: [] }), { status: 200 });
      if (url.includes("daily-queue")) return new Response("[]", { status: 200 });
      return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200 });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    expect(document.querySelector(".neo-curriculum")).toBeTruthy();
    await act(async () => { (document.querySelector(".profile-trigger") as HTMLButtonElement).click(); });
    await act(async () => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("新增學習者")) as HTMLButtonElement).click(); });
    const input = document.querySelector("#new-profile-name") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input, "Bob"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("建立")) as HTMLButtonElement).click(); await Promise.resolve(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.endsWith("/api/children") && call.method === "POST")).toBe(true);
    expect(document.querySelector(".child-portal-source-note")).toBeTruthy();
    root.unmount();
    vi.unstubAllGlobals();
  });

  it("makes the parent gate explicit and keeps backend redemption as the only mutation", async () => {
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    expect(isPasswordEntered("")).toBe(false);
    expect(isPasswordEntered("entered")).toBe(true);
    expect(PARENT_GATE_NOTE).toContain("後端");
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      const body = url.includes("daily-queue") ? [{ id: "q1", character: "學", source: "CURRICULUM", priority: 1 }] : url.includes("/api/points") && !url.includes("redeem") ? { balance: 20, rewards: [{ id: "r1", name: "選一個故事", cost: 10 }] } : {};
      const status = url.includes("/api/points/redeem") && String(init?.body).includes("wrong") ? 403 : 200;
      return new Response(JSON.stringify(status === 200 ? body : { detail: "invalid_parent_password" }), { status, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(ChildHomePage, { child: { id: 1, name: "Alice" }, childName: "Alice", onOpenPractice: vi.fn() })); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const redeem = document.querySelector('button[aria-label="兌換選擇的獎勵"]') as HTMLButtonElement;
    await act(async () => { redeem.click(); });
    expect(document.querySelector("#parent-password")).toBeTruthy();
    expect(document.querySelector('[aria-label="關閉家長確認視窗"]')).toBeTruthy();
    const password = document.querySelector("#parent-password") as HTMLInputElement;
    const setInputValue = (value: string) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(password, value); password.dispatchEvent(new Event("input", { bubbles: true })); };
    const confirm = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "確認兌換") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await act(async () => { setInputValue("wrong"); });
    await act(async () => { confirm.click(); await Promise.resolve(); });
    expect(document.body.textContent).toContain("invalid_parent_password");
    await act(async () => { setInputValue("test-parent-password"); });
    await act(async () => { confirm.click(); await Promise.resolve(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.includes("/api/points/redeem/r1") && call.method === "POST")).toBe(true);
    root.unmount();
    vi.unstubAllGlobals();
  });

  it("exposes touch-sized primary labels and accessible status text on the child home", async () => {
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("daily-queue") ? [{ id: "q1", character: "學", source: "CURRICULUM", priority: 1 }] : { balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(ChildHomePage, { child: { id: 1, name: "Alice" }, childName: "Alice", onOpenPractice: vi.fn() })); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(document.querySelector("#child-home-title")?.textContent).toContain("Alice");
    expect(document.querySelector("button.button-large")?.textContent).toContain("開始練習");
    expect(document.querySelector("#daily-focus-title")?.textContent).toContain("接著來認識");
    root.unmount();
    vi.unstubAllGlobals();
  });
});
