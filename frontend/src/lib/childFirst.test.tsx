// @vitest-environment jsdom
import { describe,expect,it,vi } from "vitest";
import React,{ act } from "react";
import { createRoot } from "react-dom/client";
import { ACTIVE_PROFILE_STORAGE_KEY,PROFILE_STORAGE_KEY,addChildProfile,defaultProfiles,isValidBackendChildId,loadProfiles,reconcileProfiles,saveProfiles,selectProfile,selectedBackendChild } from "./profiles";
import { canonicalRedirectPath,isCanonicalHomePath,routeFromPath } from "../AppShell";
import { AppShell } from "../AppShell";
import { DISPLAY_LANGUAGE_KEY } from "./i18n";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function persistSelectedBackendChild(id: number, name: string) {
  localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, `child-${id}`);
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify([
    { key: `child-${id}`, name, role: "child", childId: id, color: "mint" },
    { key: "parent", name: "家長管理者", role: "parent", childId: null, color: "navy" },
  ]));
}

function noDueQueue(childId: number, lessonId = "book1-l01") {
  return {
    childId, asOf: "2026-09-25T08:00:00Z",
    placementStart: lessonId.startsWith("book1") ? "BOOK_1" : lessonId.startsWith("basic") ? "BASIC" : "STARTER",
    review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
    newLesson: { sourceQueue: "CURRICULUM", lessonId, title: "你好", domains: ["recognition"], status: "AVAILABLE", availableInLearningFlowV1: true },
    completedLesson: null, currentLessonComplete: false, nextLessonComingSoon: false,
    nextAccessibleLesson: null, activeSession: null, schoolQueueSeparate: true, targetMinutes: 18,
  };
}

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
    expect(routeFromPath("/kids")).toBe("redirect-home");
    expect(canonicalRedirectPath("/kids")).toBe("/TongXuan-Chinese/");
    expect(canonicalRedirectPath("/TongXuan-Chinese/kids")).toBe("/TongXuan-Chinese/");
    for (const retiredPath of ["/preview-kids", "/preview-2", "/preview-b", "/preview", "/preview-pixel", "/preview-reference", "/preview-directions", "/learning-desk", "/learning-calendar", "/lesson-player", "/player"]) {
      expect(routeFromPath(retiredPath)).toBe("legacy-tombstone");
    }
    expect(routeFromPath("/TongXuan-Chinese/preview-2")).toBe("legacy-tombstone");
    expect(routeFromPath("/TongXuan-Chinese/preview-kids")).toBe("legacy-tombstone");
    expect(routeFromPath("/learning-session")).toBe("legacy-tombstone");
    expect(routeFromPath("/TongXuan-Chinese/learning-session")).toBe("legacy-tombstone");
    expect(isCanonicalHomePath("/")).toBe(true);
    expect(isCanonicalHomePath("/TongXuan-Chinese/")).toBe(true);
    expect(isCanonicalHomePath("/preview-2")).toBe(false);
    expect(isCanonicalHomePath("/TongXuan-Chinese/preview-kids")).toBe(false);
    const duplicateNameProfiles = reconcileProfiles([{ id: 7, name: "樂樂" }, { id: 8, name: "樂樂" }]);
    expect(duplicateNameProfiles.filter((profile) => profile.role === "child").map((profile) => profile.childId)).toEqual([7, 8]);
    expect(selectedBackendChild(duplicateNameProfiles[0], [{ id: 7, name: "樂樂" }, { id: 8, name: "樂樂" }])?.id).toBe(7);
    expect(selectedBackendChild(duplicateNameProfiles[1], [{ id: 7, name: "樂樂" }, { id: 8, name: "樂樂" }])?.id).toBe(8);
    expect(selectedBackendChild({ ...duplicateNameProfiles[0], childId: null }, [{ id: 7, name: "樂樂" }])).toBeNull();
    expect(selectedBackendChild({ ...duplicateNameProfiles[0], childId: 0 }, [{ id: 7, name: "樂樂" }])).toBeNull();
    expect(isValidBackendChildId(7)).toBe(true);
    expect(isValidBackendChildId(0)).toBe(false);
    expect(isValidBackendChildId(-1)).toBe(false);
    expect(isValidBackendChildId("7")).toBe(false);
    expect(selectProfile(duplicateNameProfiles, "missing-profile")).toEqual(defaultProfiles[0]);
    expect(routeFromPath("/unknown")).toBe("legacy-tombstone");
  });

  it("renders a retired-route notice for a legacy URL and canonicalizes /kids through AppShell", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } })));
    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, "", "/preview-2");
    const root = createRoot(document.getElementById("root")!);

    await act(async () => {
      root.render(React.createElement(AppShell));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(document.querySelector("main.app-page h1")?.textContent).toBe("此舊路徑已停用");
    expect(document.querySelector(".design-preview")).toBeNull();
    expect(document.querySelector("main.weekly-main-hero")).toBeNull();
    await act(async () => { root.unmount(); });

    for (const retiredPath of ["/lesson-player", "/player"]) {
      document.body.innerHTML = '<div id="root"></div>';
      window.history.replaceState({}, "", retiredPath);
      const retiredRoot = createRoot(document.getElementById("root")!);
      await act(async () => {
        retiredRoot.render(React.createElement(AppShell));
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
      expect(document.querySelector("main.app-page h1")?.textContent).toBe("此舊路徑已停用");
      expect(document.querySelector('main[aria-label="課堂學習播放器"]')).toBeNull();
      expect(document.querySelector("main.weekly-main-hero")).toBeNull();
      await act(async () => { retiredRoot.unmount(); });
    }

    document.body.innerHTML = '<div id="root"></div>';
    window.history.replaceState({}, "", "/kids");
    const compatibilityRoot = createRoot(document.getElementById("root")!);
    await act(async () => {
      compatibilityRoot.render(React.createElement(AppShell));
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    expect(document.querySelector(".tx-home")).toBeTruthy();
    await act(async () => { compatibilityRoot.unmount(); });
    vi.unstubAllGlobals();
  });

  it("persists add-user through POST and reconciles profiles by backend id", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    window.history.replaceState({}, "", "/me");
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
    expect(window.location.pathname).toBe("/me");
    await act(async () => { (Array.from(document.querySelectorAll(".app-tab")).find((button) => button.textContent?.trim() === "我的") as HTMLButtonElement).click(); });
    await act(async () => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("新增孩子資料")) as HTMLButtonElement).click(); });
    const input = document.querySelector("#new-profile-name") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input, "Bob"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("建立")) as HTMLButtonElement).click(); await Promise.resolve(); await Promise.resolve(); });
    expect(calls.some((call) => call.url.endsWith("/api/children") && call.method === "POST")).toBe(true);
    expect(document.querySelector(".tx-home")).toBeTruthy();
    root.unmount();
    vi.unstubAllGlobals();
  });

});
