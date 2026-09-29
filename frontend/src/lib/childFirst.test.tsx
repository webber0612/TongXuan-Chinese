// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ACTIVE_PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY, addChildProfile, defaultProfiles, isValidBackendChildId, loadProfiles, reconcileProfiles, saveProfiles, selectProfile, selectedBackendChild } from "./profiles";
import { PARENT_GATE_NOTE, isPasswordEntered } from "./parentGate";
import { ChildHomePage } from "../pages/ChildHomePage";
import { canonicalRedirectPath, isCanonicalHomePath, routeFromPath } from "../AppShell";
import { AppShell } from "../AppShell";
import { DISPLAY_LANGUAGE_KEY } from "./i18n";
import { authoritativeSessionFixture, plannerTasksForLesson } from "./testFixtures/learningFlow";

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
    expect(routeFromPath("/learning-session")).toBe("learning-session");
    expect(routeFromPath("/TongXuan-Chinese/learning-session")).toBe("learning-session");
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
    expect(document.querySelector("main.weekly-main-hero")).toBeTruthy();
    await act(async () => { compatibilityRoot.unmount(); });
    vi.unstubAllGlobals();
  });

  it("switches between duplicate-name backend profiles by exact ID and launches LEARN for only the selected child", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(11, "Twin");
    window.history.replaceState({}, "", "/practice");
    const requestUrls: string[] = [];
    const queue = (childId: number) => ({
      childId, asOf: "2026-09-25T08:00:00Z", placementStart: "STARTER",
      review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
      newLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l01", title: "你好", domains: ["recognition"], status: "AVAILABLE", availableInLearningFlowV1: true },
      completedLesson: null, currentLessonComplete: false, nextLessonComingSoon: false,
      nextAccessibleLesson: null, activeSession: null, schoolQueueSeparate: true, targetMinutes: 18,
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 11, name: "Twin" }, { id: 22, name: "Twin" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/22/learning-daily-queue")) return new Response(JSON.stringify(queue(22)), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 35)); });
    // Use the existing profile selector while it is visible, then return to Home.
    await act(async () => { (document.querySelector(".profile-trigger") as HTMLButtonElement).click(); });
    const options = Array.from(document.querySelectorAll(".profile-option")) as HTMLButtonElement[];
    expect(options).toHaveLength(3);
    expect(options[0].getAttribute("aria-checked")).toBe("true");
    await act(async () => { options[1].click(); await new Promise((resolve) => setTimeout(resolve, 40)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    expect(requestUrls).toContain("/api/children/22/learning-daily-queue");
    expect(requestUrls).not.toContain("/api/children/11/learning-daily-queue");

    await act(async () => { (document.querySelector(".header-learner-interactive-btn") as HTMLButtonElement).click(); });
    const localPrototype = Array.from(document.querySelectorAll(".learner-select-tile"))
      .find((tile) => tile.querySelector(".learner-tile-name")?.textContent === "萌萌") as HTMLElement;
    expect(localPrototype).toBeTruthy();
    await act(async () => { localPrototype.click(); });
    expect(document.querySelector(".learner-name-large")?.textContent).toContain("萌萌");
    expect(requestUrls.filter((url) => url.includes("/learning-daily-queue"))).toEqual(["/api/children/22/learning-daily-queue"]);

    await import("../pages/LessonPlayerPage");
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector('main[aria-label="課堂學習播放器"]')).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(requestUrls.some((url) => url.includes("/api/children/22/learning-sessions"))).toBe(true);
    expect(requestUrls.some((url) => url.includes("/api/children/11/learning-sessions"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("launches unlocked starter-l02 from canonical Home into the exact Lesson Player task plan", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(31, "L2 Learner");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: any }> = [];
    const session = authoritativeSessionFixture("starter-l02", "home-l2-session", {}, {}, false, false, 31);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requestLog.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 31, name: "L2 Learner" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/31/learning-daily-queue")) return new Response(JSON.stringify({
        childId: 31, asOf: "2026-09-25T08:00:00Z", placementStart: "STARTER",
        review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
        newLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l02", title: "我七歲", domains: ["listening", "vocabulary", "phonetics", "speaking"], status: "AVAILABLE", availableInLearningFlowV1: true },
        completedLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l01", title: "你好", domains: ["listening", "recognition", "speaking", "writing"], status: "MASTERED" },
        currentLessonComplete: false, nextLessonComingSoon: false, nextAccessibleLesson: null, activeSession: null,
        schoolQueueSeparate: true, targetMinutes: 18,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/31/learning-sessions/current")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/31/learning-sessions") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const cta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(cta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { cta.click(); await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector("main.lesson-player-container")).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector(".player-lesson-title")?.textContent).toBe("我七歲");
    expect(document.querySelector('.lesson-step-card[data-step-key="context"]')).toBeTruthy();
    const startRequest = requestLog.find((entry) => entry.url.endsWith("/api/children/31/learning-sessions") && entry.method === "POST");
    expect(startRequest?.body).toMatchObject({ lesson_id: "starter-l02" });
    expect(session.tasks.map((task) => task.id)).toContain("home-l2-session:vocabulary");
    expect(requestLog.some((entry) => entry.url.includes("/api/children/1/learning-sessions"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("launches the unlocked starter-l03 queue item at canonical /learning-session with exact child and planner tasks", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(33, "L3 Learner");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: any }> = [];
    const session = authoritativeSessionFixture("starter-l03", "home-l3-session", {}, {}, false, false, 33);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requestLog.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 33, name: "L3 Learner" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/33/learning-daily-queue")) return new Response(JSON.stringify({
        childId: 33, asOf: "2026-09-25T08:00:00Z", placementStart: "STARTER",
        review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
        newLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l03", title: "爸爸媽媽", domains: ["listening", "vocabulary", "phonetics", "speaking"], status: "AVAILABLE", availableInLearningFlowV1: true },
        completedLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l02", title: "我七歲", domains: ["listening", "vocabulary", "phonetics", "speaking"], status: "MASTERED" },
        currentLessonComplete: false, nextLessonComingSoon: false, nextAccessibleLesson: null, activeSession: null,
        schoolQueueSeparate: true, targetMinutes: 18,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/33/learning-sessions/current")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/33/learning-sessions") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const cta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(cta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { cta.click(); await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector("main.lesson-player-container")).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector(".player-lesson-title")?.textContent).toBe("爸爸媽媽");
    expect(document.querySelector('.lesson-step-card[data-step-key="context"]')).toBeTruthy();
    const startRequest = requestLog.find((entry) => entry.url.endsWith("/api/children/33/learning-sessions") && entry.method === "POST");
    expect(startRequest?.body).toMatchObject({ lesson_id: "starter-l03" });
    expect(session.tasks.map((task) => task.id)).toEqual(session.tasks.map((task) => `home-l3-session:${task.key}`));
    expect(session.tasks.find((task) => task.key === "vocabulary")?.itemId).toBe("lf_33_starter-l03_vocabulary");
    expect(requestLog.some((entry) => entry.url.includes("/api/children/1/learning-sessions"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("launches unlocked starter-l04 from canonical Home into the exact original-authored Lesson Player plan", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(44, "L4 Learner");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: any }> = [];
    const session = authoritativeSessionFixture("starter-l04", "home-l4-session", {}, {}, false, false, 44);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requestLog.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 44, name: "L4 Learner" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/44/learning-daily-queue")) return new Response(JSON.stringify({
        childId: 44, asOf: "2026-09-25T08:00:00Z", placementStart: "STARTER",
        review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
        newLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l04", title: "小狗", domains: ["listening", "speaking", "phonetics", "recognition"], status: "AVAILABLE", availableInLearningFlowV1: true },
        completedLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l03", title: "爸爸媽媽", domains: ["listening", "speaking", "phonetics", "vocabulary"], status: "MASTERED" },
        currentLessonComplete: false, nextLessonComingSoon: false, nextAccessibleLesson: null, activeSession: null,
        schoolQueueSeparate: true, targetMinutes: 18,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/44/learning-sessions/current")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/44/learning-sessions") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const cta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(cta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { cta.click(); await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector("main.lesson-player-container")).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector(".player-lesson-title")?.textContent).toBe("小狗");
    expect(document.querySelector('.lesson-step-card[data-step-key="context"]')).toBeTruthy();
    const contextText = document.querySelector('.lesson-step-card[data-step-key="context"]')?.textContent ?? "";
    expect(contextText).toContain("說說自己有的動物");
    expect(contextText).not.toContain("介紹自己的家人");
    expect(contextText).not.toContain("greeting");
    const startRequest = requestLog.find((entry) => entry.url.endsWith("/api/children/44/learning-sessions") && entry.method === "POST");
    expect(startRequest?.body).toMatchObject({ lesson_id: "starter-l04" });
    expect(session.tasks.map((task) => task.id)).toEqual(session.tasks.map((task) => `home-l4-session:${task.key}`));
    expect(session.tasks.find((task) => task.key === "sentence-pattern")?.taskData.choices).toEqual([
      { id: "has-dog", label: "我有一隻小狗。" }, { id: "dog-has-me", label: "小狗有一隻我。" },
    ]);
    expect(session.tasks.some((task) => task.key === "vocabulary" || task.taskType === "VOCABULARY")).toBe(false);
    expect(requestLog.some((entry) => entry.url.includes("/api/children/1/learning-sessions"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("launches unlocked starter-l05 from canonical Home with the exact child and original-authored plan", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(55, "L5 Learner");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: any }> = [];
    const session = authoritativeSessionFixture("starter-l05", "home-l5-session", {}, {}, false, false, 55);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requestLog.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 55, name: "L5 Learner" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/55/learning-daily-queue")) return new Response(JSON.stringify({
        childId: 55, asOf: "2026-09-25T08:00:00Z", placementStart: "STARTER",
        review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
        newLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l05", title: "我的妹妹", domains: ["listening", "speaking", "phonetics", "vocabulary"], status: "AVAILABLE", availableInLearningFlowV1: true },
        completedLesson: { sourceQueue: "CURRICULUM", lessonId: "starter-l04", title: "小狗", domains: ["listening", "speaking", "phonetics", "recognition"], status: "MASTERED" },
        currentLessonComplete: false, nextLessonComingSoon: false, nextAccessibleLesson: null, activeSession: null,
        schoolQueueSeparate: true, targetMinutes: 18,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/55/learning-sessions/current")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/55/learning-sessions") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const cta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(cta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { cta.click(); await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector("main.lesson-player-container")).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector(".player-lesson-title")?.textContent).toBe("我的妹妹");
    expect(document.querySelector('.lesson-step-card[data-step-key="context"]')?.textContent).toContain("情境：介紹妹妹");
    expect(document.querySelector('.lesson-step-card[data-step-key="characters"]')).toBeNull();
    const startRequest = requestLog.find((entry) => entry.url.endsWith("/api/children/55/learning-sessions") && entry.method === "POST");
    expect(startRequest?.body).toMatchObject({ lesson_id: "starter-l05" });
    expect(session.tasks.map((task) => task.id)).toEqual(session.tasks.map((task) => `home-l5-session:${task.key}`));
    expect(session.tasks.find((task) => task.key === "vocabulary")?.itemId).toBe("lf_55_starter-l05_vocabulary");
    expect(requestLog.some((entry) => entry.url.includes("/api/children/1/learning-sessions"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("keeps the normal canonical Home CTA in LEARN and does not retarget the existing starter lesson", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(32, "Starter Learner");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: any }> = [];
    const session = authoritativeSessionFixture("starter-l01", "home-l1-session", {}, {}, false, false, 32);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requestLog.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 32, name: "Starter Learner" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/32/learning-daily-queue")) return new Response(JSON.stringify(noDueQueue(32, "starter-l01")), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/32/learning-sessions/current")) return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/32/learning-sessions") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    await import("../pages/LessonPlayerPage");
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 60)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector(".player-lesson-title")?.textContent).toBe("你好");
    expect(requestLog.find((entry) => entry.url.endsWith("/api/children/32/learning-sessions") && entry.method === "POST")?.body).toMatchObject({ lesson_id: "starter-l01" });
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it.each([
    ["unresolved selected key", "child-999", [{ key: "child-999", name: "樂樂", role: "child", childId: 999, color: "mint" }]],
    ["invalid selected ID", "child-0", [{ key: "child-0", name: "樂樂", role: "child", childId: 0, color: "mint" }]],
  ])("keeps Home fail-closed for %s without querying a fallback child", async (_caseName, selectedKey, selectedProfiles) => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, selectedKey);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify([
      ...selectedProfiles,
      { key: "parent", name: "家長管理者", role: "parent", childId: null, color: "navy" },
    ]));
    window.history.replaceState({}, "", "/");
    const requestUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 11, name: "Twin" }, { id: 22, name: "Twin" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 40)); });
    expect(document.querySelector("main.weekly-main-hero")).toBeTruthy();
    expect(requestUrls.some((url) => url.includes("/learning-daily-queue"))).toBe(false);
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); });
    expect(window.location.pathname).toBe("/");
    expect(requestUrls.some((url) => url.includes("/learning-sessions"))).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("找不到這位學習者");
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("rejects a Daily Queue response whose childId differs from the explicitly selected backend profile", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(22, "Twin");
    window.history.replaceState({}, "", "/");
    const requestUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestUrls.push(url);
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 11, name: "Twin" }, { id: 22, name: "Twin" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/children/22/learning-daily-queue")) return new Response(JSON.stringify({ childId: 11, placementStart: "STARTER" }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 40)); });
    expect(requestUrls).toContain("/api/children/22/learning-daily-queue");
    expect(requestUrls).not.toContain("/api/children/11/learning-daily-queue");
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); });
    expect(window.location.pathname).toBe("/");
    expect(requestUrls.some((url) => url.includes("/learning-sessions"))).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("找不到這位學習者");
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("canonical Fast Track failure waits for same-session resume, repairs exact tasks, and returns Home without settlement", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/");
    const session = authoritativeSessionFixture("book1-l01", "repair-session");
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const repairAnswerIds: string[] = [];
    let completeCalls = 0;
    let releaseResume: ((response: Response) => void) | null = null;
    const resumeDeferred = new Promise<Response>((resolve) => { releaseResume = resolve; });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("daily-queue")) return new Response(JSON.stringify(noDueQueue(1)), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/book1-l01/fast-track") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        expect(body.session_id).toBe(session.id);
        session.status = "PAUSED";
        return new Response(JSON.stringify({
          childId: 1, sessionId: session.id, lessonId: "book1-l01", sessionStatus: "PAUSED",
          terminationReason: "FAST_TRACK_FAILED", passed: false, weakDomains: ["recognition"],
          nextMode: "REPAIR", masteryStatus: "IN_PROGRESS", nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/learning-sessions") && method === "POST") {
        const body = JSON.parse(String(init?.body));
        expect(body.expected_session_id).toBe(session.id);
        return resumeDeferred;
      }
      const answerMatch = url.match(/\/tasks\/([^/]+)\/answer$/);
      if (answerMatch && method === "POST") {
        const taskId = decodeURIComponent(answerMatch[1]);
        repairAnswerIds.push(taskId);
        const task = session.tasks.find((candidate) => candidate.id === taskId);
        if (task) task.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/complete") && method === "POST") completeCalls += 1;
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 40)); });
    await import("../pages/LessonPlayerPage");
    const normalCta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(normalCta).toBeTruthy();
    await act(async () => { normalCta.click(); await new Promise((resolve) => setTimeout(resolve, 60)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();

    await act(async () => { (document.querySelector(".fast-track-trigger-btn") as HTMLButtonElement).click(); });
    const fastTrackCards = Array.from(document.querySelectorAll(".exit-ticket-item-card"));
    expect(fastTrackCards.length).toBeGreaterThan(0);
    for (const card of fastTrackCards) {
      await act(async () => { (card.querySelector(".choice-card-btn") as HTMLButtonElement).click(); });
    }
    await act(async () => { (document.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement).click(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    // The REPAIR UI and all task actions stay absent while the authoritative resume is unresolved.
    expect(document.querySelector(".mode-badge.mode-fast_track")).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-repair")).toBeNull();
    expect(document.querySelector(".lesson-step-card")).toBeNull();
    expect(document.querySelector(".next-step-cta-btn")).toBeNull();
    expect(repairAnswerIds).toEqual([]);
    expect(requests.some((request) => request.url.includes("/fast-track") && request.method === "POST")).toBe(true);

    await act(async () => {
      session.status = "IN_PROGRESS";
      releaseResume?.(new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } }));
      await new Promise((resolve) => setTimeout(resolve, 70));
    });
    expect(document.querySelector(".mode-badge.mode-repair")).toBeTruthy();
    const repairStepIds: string[] = [];
    while (document.querySelector("[data-step-key='characters']")) {
      const targetCharacter = document.querySelector(".large-char-display")?.textContent ?? "";
      const correctChoice = Array.from(document.querySelectorAll(".char-choice-card"))
        .find((button) => button.textContent?.includes(targetCharacter)) as HTMLButtonElement | undefined;
      expect(correctChoice).toBeTruthy();
      const currentTaskId = session.tasks.find((task) => task.skillDomain === "recognition" && task.state !== "COMPLETED")?.id;
      expect(currentTaskId).toBeTruthy();
      repairStepIds.push(currentTaskId!);
      await act(async () => { correctChoice!.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
      await act(async () => { (document.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
    }
    expect(document.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    expect(repairAnswerIds).toEqual(repairStepIds);
    expect(repairAnswerIds).toEqual(session.tasks.filter((task) => task.skillDomain === "recognition").map((task) => task.id));
    await act(async () => { (document.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    expect(completeCalls).toBe(0);
    expect(session.status).toBe("IN_PROGRESS");
    expect(session.tasks.find((task) => task.key === "listen")?.state).toBe("PENDING");

    const nextNormalCta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    await act(async () => { nextNormalCta.click(); await new Promise((resolve) => setTimeout(resolve, 55)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(completeCalls).toBe(0);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("canonical REPAIR fails closed on resume identity/API failure and unsupported domains, with exact-session retry", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/");
    const session = authoritativeSessionFixture("book1-l01", "repair-unsupported-session");
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    let resumeCalls = 0;
    let answerCalls = 0;
    let completeCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      requests.push({ url, method, body });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("daily-queue")) return new Response(JSON.stringify(noDueQueue(1)), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/book1-l01/fast-track") && method === "POST") {
        expect(JSON.parse(body ?? "{}").session_id).toBe(session.id);
        session.status = "PAUSED";
        return new Response(JSON.stringify({
          childId: 1, sessionId: session.id, lessonId: "book1-l01", sessionStatus: "PAUSED",
          terminationReason: "FAST_TRACK_FAILED", passed: false, weakDomains: ["grammar"],
          nextMode: "REPAIR", masteryStatus: "IN_PROGRESS", nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/learning-sessions") && method === "POST") {
        expect(JSON.parse(body ?? "{}").expected_session_id).toBe(session.id);
        resumeCalls += 1;
        if (resumeCalls === 1) return new Response(JSON.stringify({ ...session, id: "different-session", sessionId: "different-session", status: "IN_PROGRESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (resumeCalls === 2) return new Response(JSON.stringify({ detail: "resume unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
        if (resumeCalls === 3) return new Response(JSON.stringify({ ...session, childId: 2, status: "IN_PROGRESS" }), { status: 200, headers: { "Content-Type": "application/json" } });
        session.status = "IN_PROGRESS";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.endsWith("/answer") && method === "POST") answerCalls += 1;
      if (url.endsWith("/complete") && method === "POST") completeCalls += 1;
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 35)); });
    await import("../pages/LessonPlayerPage");
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 55)); });
    await act(async () => { (document.querySelector(".fast-track-trigger-btn") as HTMLButtonElement).click(); });
    for (const card of Array.from(document.querySelectorAll(".exit-ticket-item-card"))) {
      await act(async () => { (card.querySelector(".choice-card-btn") as HTMLButtonElement).click(); });
    }
    await act(async () => { (document.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 35)); });

    // Identity mismatch blocks all task UI. Retry is constrained to the same backend session ID.
    expect(document.querySelector(".error-strip")).toBeTruthy();
    expect(document.querySelector(".lesson-step-card")).toBeNull();
    expect(document.querySelector(".next-step-cta-btn")).toBeNull();
    expect(answerCalls).toBe(0);
    await act(async () => { (document.querySelector(".error-strip button") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 35)); });
    expect(resumeCalls).toBe(2);
    expect(document.querySelector(".lesson-step-card")).toBeNull();
    expect(document.querySelector(".next-step-cta-btn")).toBeNull();
    expect(answerCalls).toBe(0);
    await act(async () => { (document.querySelector(".error-strip button") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 70)); });
    expect(resumeCalls).toBe(3);
    expect(document.querySelector(".lesson-step-card")).toBeNull();
    expect(document.querySelector(".next-step-cta-btn")).toBeNull();
    expect(answerCalls).toBe(0);
    await act(async () => { (document.querySelector(".error-strip button") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 70)); });

    // Book 1 has no curriculum task whose skillDomain is grammar. No fake exit-ticket repair is shown.
    expect(document.querySelector(".mode-badge.mode-repair")).toBeTruthy();
    expect(document.querySelector(".error-strip")).toBeTruthy();
    expect(document.querySelector(".lesson-step-card")).toBeNull();
    expect(document.querySelector(".next-step-cta-btn")).toBeNull();
    expect(document.querySelector(".exit-ticket-item-card")).toBeNull();
    expect(answerCalls).toBe(0);
    expect(completeCalls).toBe(0);
    expect(resumeCalls).toBe(4);
    expect(requests.filter((request) => request.url.endsWith("/learning-sessions") && request.method === "POST")
      .every((request) => JSON.parse(request.body ?? "{}").expected_session_id === session.id)).toBe(true);

    await act(async () => { (document.querySelector(".player-back-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 45)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    await act(async () => { (document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 55)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(completeCalls).toBe(0);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("routes the canonical due-review CTA through /learning-session in REVIEW, preserves the session on Home, and keeps the next normal launch in LEARN", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(22, "樂樂");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string }> = [];
    const reviewStates = { ni: "PENDING", hao: "PENDING" };
    const curriculumTasks = plannerTasksForLesson("book1-l01", false, false, 22).map((task) => ({
      ...task,
      id: `learn-session:${task.key}`,
      childId: 22,
      sessionId: "learn-session",
    }));
    const pendingCurriculum = curriculumTasks.find((task) => task.sourceQueue === "CURRICULUM" && task.required)!;
    const reviewTask = (which: "ni" | "hao") => ({
      id: `learn-session:review-recognition-${which === "ni" ? 1 : 2}`,
      sessionId: "learn-session",
      childId: 22,
      key: `review-recognition-${which === "ni" ? 1 : 2}`,
      taskType: "REVIEW_RECOGNITION",
      skillDomain: "recognition",
      sourceQueue: "REVIEW",
      itemId: which === "ni" ? "item-ni" : "item-hao",
      lessonId: which === "ni" ? "book1-l01" : "basic-l01",
      state: reviewStates[which],
      required: true,
      taskData: {
        prompt: which === "ni" ? "選出聽到的字：你" : "選出聽到的字：好",
        audioText: which === "ni" ? "你" : "好",
        choices: which === "ni"
          ? [{ id: "option-1", label: "好" }, { id: "option-2", label: "你" }]
          : [{ id: "option-1", label: "你" }, { id: "option-2", label: "好" }],
        dueAt: "2026-09-02T00:00:00Z",
      },
    });
    const session = (includeReviewTasks: boolean) => ({
      id: "learn-session",
      sessionId: "learn-session",
      childId: 22,
      status: "IN_PROGRESS",
      lessonId: "book1-l01",
      curriculumContext: { lessonId: "book1-l01", lessonMasteredBeforeSession: false },
      tasks: [...curriculumTasks, ...(includeReviewTasks ? [reviewTask("ni"), reviewTask("hao")] : [])],
    });
    let latestSessionResponse: ReturnType<typeof session> = session(false);
    let reviewTaskState = "PENDING";
    const dueQueue = {
      childId: 22,
      asOf: "2026-09-05T00:00:00Z",
      placementStart: "BOOK_1",
      review: { sourceQueue: "REVIEW", dueCount: 2, items: [
        { id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
        { id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "basic-l01", dueAt: "2026-09-02T00:00:00Z" },
      ] },
      newLesson: null,
      completedLesson: { sourceQueue: "CURRICULUM", lessonId: "book1-l01", title: "日月星辰", domains: ["recognition"], status: "COMPLETED" },
      currentLessonComplete: true,
      nextLessonComingSoon: true,
      nextAccessibleLesson: null,
      activeSession: { id: "learn-session", status: "IN_PROGRESS" },
      schoolQueueSeparate: true,
      targetMinutes: 18,
    };
    const normalQueue = {
      ...dueQueue,
      review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
      newLesson: { sourceQueue: "CURRICULUM", lessonId: "book1-l01", title: "日月星辰", domains: ["recognition"], status: "AVAILABLE", availableInLearningFlowV1: true },
      completedLesson: null,
      currentLessonComplete: false,
      nextLessonComingSoon: false,
    };

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requestLog.push({ url, method });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 11, name: "樂樂" }, { id: 22, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify(reviewTaskState === "COMPLETED" ? normalQueue : dueQueue), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/current")) {
        // After REVIEW, the next LEARN launch receives the same mixed session
        // with completed REVIEW evidence still attached to its parent rows.
        latestSessionResponse = reviewTaskState === "COMPLETED" ? session(true) : session(false);
        return new Response(JSON.stringify(latestSessionResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reconcile-reviews") && method === "POST") {
        latestSessionResponse = session(true);
        return new Response(JSON.stringify(latestSessionResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/learn-session:review-recognition-1/answer") && method === "POST") {
        reviewStates.ni = "COMPLETED";
        latestSessionResponse = session(true);
        return new Response(JSON.stringify(latestSessionResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/learn-session:review-recognition-2/answer") && method === "POST") {
        reviewStates.hao = "COMPLETED";
        reviewTaskState = "COMPLETED";
        latestSessionResponse = session(true);
        return new Response(JSON.stringify(latestSessionResponse), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });

    const dueCta = Array.from(document.querySelectorAll(".hero-primary-cta-row .launch-quiz-cta-btn"))
      .find((button) => button.textContent?.includes("開始複習任務")) as HTMLButtonElement;
    expect(dueCta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { dueCta.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector('main[aria-label="課堂學習播放器"]')).toBeTruthy();
    expect(document.querySelector(".mode-badge.mode-review")).toBeTruthy();
    expect(document.querySelector(".large-char-display")?.textContent).toBe("你");
    expect(requestLog.some((request) => request.url === "/api/children/22/learning-daily-queue")).toBe(true);
    expect(requestLog.some((request) => /\/api\/children\/22\/learning-sessions(?:\/|$)/.test(request.url))).toBe(true);
    expect(requestLog.some((request) => request.url.startsWith("/api/children/11/"))).toBe(false);
    expect(requestLog.some((request) => request.url.includes("/learning-sessions/learn-session/reconcile-reviews") && request.method === "POST")).toBe(true);

    const correctChoice = Array.from(document.querySelectorAll(".char-choice-card"))
      .find((button) => button.textContent?.includes("你")) as HTMLButtonElement;
    expect(correctChoice).toBeTruthy();
    await act(async () => { correctChoice.click(); });
    await act(async () => { (document.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(requestLog.some((request) => request.url.includes("/tasks/learn-session:review-recognition-1/answer") && request.method === "POST")).toBe(true);
    expect(document.querySelector(".large-char-display")?.textContent).toBe("好");
    expect(document.querySelector(".interaction-prompt")?.textContent).toContain("選出聽到的字：好");
    const correctBasicChoice = Array.from(document.querySelectorAll(".char-choice-card"))
      .find((button) => button.textContent?.includes("好")) as HTMLButtonElement;
    expect(correctBasicChoice).toBeTruthy();
    await act(async () => { correctBasicChoice.click(); });
    await act(async () => { (document.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(requestLog.some((request) => request.url.includes("/tasks/learn-session:review-recognition-2/answer") && request.method === "POST")).toBe(true);
    expect(document.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    await act(async () => { (document.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 45)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    expect(document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn")?.textContent).toContain("開始今日學習");
    expect(requestLog.some((request) => /\/learning-sessions\/learn-session\/complete(?:\?|$)/.test(request.url) && request.method === "POST")).toBe(false);
    expect(reviewStates).toEqual({ ni: "COMPLETED", hao: "COMPLETED" });
    expect(latestSessionResponse.status).toBe("IN_PROGRESS");
    expect(latestSessionResponse.tasks.find((task) => task.id === pendingCurriculum.id)?.state).toBe("PENDING");

    const normalCta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    await act(async () => { normalCta.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();
    expect(document.querySelector("[data-step-key='context']")).toBeTruthy();
    expect(requestLog.filter((request) => request.url.includes("/reconcile-reviews") && request.method === "POST")).toHaveLength(1);
    expect(requestLog.filter((request) => request.url.includes("/tasks/learn-session:review-recognition-1/answer") && request.method === "POST")).toHaveLength(1);
    expect(requestLog.filter((request) => request.url.includes("/tasks/learn-session:review-recognition-2/answer") && request.method === "POST")).toHaveLength(1);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it.each([
    ["reconcile returns the later due item", false],
    ["reconcile still omits the later due item", true],
  ])("canonical REVIEW reconciles only Daily Queue due IDs when %s", async (_caseName, omitDueItem) => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/");
    const requestLog: Array<{ url: string; method: string; body?: string }> = [];
    let dueBState = "PENDING";
    let reconcileCalls = 0;
    const curriculumTask = {
      id: "learn-session:recognition-1", key: "recognition-1", taskType: "RECOGNITION",
      sourceQueue: "CURRICULUM", skillDomain: "recognition", lessonId: "book1-l01",
      itemId: "curriculum-item-ni", state: "PENDING", required: true, taskData: {},
    };
    const reviewA = {
      id: "learn-session:review-recognition-1", sessionId: "learn-session", childId: 1, key: "review-recognition-1", taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW", skillDomain: "recognition", lessonId: "book1-l01", itemId: "item-ni",
      state: "COMPLETED", required: true,
      taskData: { prompt: "選出聽到的字：你", audioText: "你", choices: [{ id: "option-1", label: "好" }, { id: "option-2", label: "你" }], dueAt: "2026-08-01T00:00:00Z" },
    };
    const reviewB = () => ({
      id: "learn-session:review-recognition-2", sessionId: "learn-session", childId: 1, key: "review-recognition-2", taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW", skillDomain: "recognition", lessonId: "book1-l01", itemId: "item-hao",
      state: dueBState, required: true,
      taskData: { prompt: "選出新到期的字：好", audioText: "好", choices: [{ id: "option-1", label: "你" }, { id: "option-2", label: "好" }], dueAt: "2026-09-02T00:00:00Z" },
    });
    const session = (includeDueB: boolean) => ({
      id: "learn-session", sessionId: "learn-session", childId: 1, status: "IN_PROGRESS", lessonId: "book1-l01",
      curriculumContext: { lessonId: "book1-l01", lessonMasteredBeforeSession: true },
      tasks: [curriculumTask, reviewA, ...(includeDueB ? [reviewB()] : [])],
    });
    const dueQueue = {
      childId: 1, asOf: "2026-09-05T00:00:00Z", placementStart: "BOOK_1",
      review: { sourceQueue: "REVIEW", dueCount: 1, items: [{ id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] },
      newLesson: null, completedLesson: { sourceQueue: "CURRICULUM", lessonId: "book1-l01", title: "你好", domains: ["recognition"], status: "COMPLETED" },
      currentLessonComplete: true, nextLessonComingSoon: true, nextAccessibleLesson: null,
      activeSession: { id: "learn-session", status: "IN_PROGRESS" }, schoolQueueSeparate: true, targetMinutes: 18,
    };
    const normalQueue = { ...dueQueue, review: { sourceQueue: "REVIEW", dueCount: 0, items: [] }, newLesson: { sourceQueue: "CURRICULUM", lessonId: "book1-l01", title: "你好", domains: ["recognition"], status: "AVAILABLE", availableInLearningFlowV1: true }, completedLesson: null, currentLessonComplete: false, nextLessonComingSoon: false };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requestLog.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify(dueBState === "COMPLETED" ? normalQueue : dueQueue), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session(false)), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/reconcile-reviews") && method === "POST") {
        reconcileCalls += 1;
        return new Response(JSON.stringify(session(!omitDueItem)), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/learn-session:review-recognition-2/answer") && method === "POST") {
        dueBState = "COMPLETED";
        return new Response(JSON.stringify(session(true)), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const dueCta = Array.from(document.querySelectorAll(".hero-primary-cta-row .launch-quiz-cta-btn"))
      .find((button) => button.textContent?.includes("開始複習任務")) as HTMLButtonElement;
    expect(dueCta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { dueCta.click(); await new Promise((resolve) => setTimeout(resolve, 120)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-review")).toBeTruthy();
    expect(reconcileCalls).toBe(1);
    expect(requestLog.some((request) => request.url.includes("/learning-sessions/learn-session/reconcile-reviews") && request.method === "POST")).toBe(true);

    if (omitDueItem) {
      expect(document.querySelector(".error-strip")).toBeTruthy();
      expect(document.querySelector(".large-char-display")).toBeNull();
      expect(document.querySelector(".char-choice-card")).toBeNull();
      expect(document.querySelector("[data-step-key='wrap_up']")).toBeNull();
    } else {
      expect(document.querySelector(".large-char-display")?.textContent).toBe("好");
      expect(document.querySelector(".interaction-prompt")?.textContent).toContain("新到期的字：好");
      expect(document.querySelector(".large-char-display")?.textContent).not.toBe("你");
      const correctChoice = Array.from(document.querySelectorAll(".char-choice-card"))
        .find((button) => button.textContent?.includes("好")) as HTMLButtonElement;
      expect(correctChoice).toBeTruthy();
      await act(async () => { correctChoice.click(); });
      await act(async () => { (document.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
      expect(requestLog.some((request) => request.url.includes("/tasks/learn-session:review-recognition-2/answer") && request.method === "POST")).toBe(true);
      expect(requestLog.some((request) => request.url.includes("/tasks/learn-session:review-recognition-1/answer"))).toBe(false);
      expect(document.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
      expect(session(true).tasks.find((task) => task.id === curriculumTask.id)?.state).toBe("PENDING");
    }

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it.each([
    ["missing Queue payload", "missing"],
    ["throwing Queue request", "throw"],
    ["dueCount mismatch", "count-mismatch"],
    ["malformed due ID", "malformed-id"],
    ["duplicate due IDs", "duplicate-id"],
    ["cross-lesson due ID", "cross-lesson"],
    ["unsupported lesson package", "unsupported-package"],
    ["malformed authoritative task choices", "malformed-task"],
  ])("canonical REVIEW fails closed on %s instead of replaying a stale session task", async (_caseName, invalidQueue) => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/");
    let reconcileCalls = 0;
    const curriculumTask = {
      id: "learn-session:recognition-1", key: "recognition-1", taskType: "RECOGNITION",
      sourceQueue: "CURRICULUM", skillDomain: "recognition", lessonId: "book1-l01",
      itemId: "curriculum-item-ni", state: "PENDING", required: true, taskData: {},
    };
    const staleReviewTask = {
      id: "learn-session:review-recognition-1", sessionId: "learn-session", childId: 1, key: "review-recognition-1", taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW", skillDomain: "recognition", lessonId: "book1-l01", itemId: "item-ni",
      state: "COMPLETED", required: true,
      taskData: { prompt: "選出聽到的字：你", audioText: "你", choices: [{ id: "option-1", label: "好" }, { id: "option-2", label: "你" }], dueAt: "2026-08-01T00:00:00Z" },
    };
    const session = {
      id: "learn-session", sessionId: "learn-session", childId: 1, status: "IN_PROGRESS", lessonId: "book1-l01",
      curriculumContext: { lessonId: "book1-l01", lessonMasteredBeforeSession: true },
      tasks: [curriculumTask, staleReviewTask],
    };
    const dueQueue = {
      childId: 1, asOf: "2026-09-05T00:00:00Z", placementStart: "BOOK_1",
      review: { sourceQueue: "REVIEW", dueCount: 1, items: [{ id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] },
      newLesson: null, completedLesson: { sourceQueue: "CURRICULUM", lessonId: "book1-l01", title: "你好", domains: ["recognition"], status: "COMPLETED" },
      currentLessonComplete: true, nextLessonComingSoon: true, nextAccessibleLesson: null,
      activeSession: { id: "learn-session", status: "IN_PROGRESS" }, schoolQueueSeparate: true, targetMinutes: 18,
    };
    const invalidReview = invalidQueue === "count-mismatch"
      ? { ...dueQueue.review, dueCount: 2 }
      : invalidQueue === "malformed-id"
        ? { ...dueQueue.review, items: [{ skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] }
      : invalidQueue === "duplicate-id"
        ? { ...dueQueue.review, dueCount: 2, items: [dueQueue.review.items[0], dueQueue.review.items[0]] }
      : invalidQueue === "cross-lesson"
          ? { ...dueQueue.review, items: [{ ...dueQueue.review.items[0], lessonId: "basic-l01" }] }
        : invalidQueue === "unsupported-package"
          ? { ...dueQueue.review, items: [{ id: "item-unsupported", skillDomain: "recognition", character: "好", lessonId: "book1-l02", dueAt: "2026-09-02T00:00:00Z" }] }
        : dueQueue.review;
    const requestLog: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requestLog.push({ url, method });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) {
        if (window.location.pathname.includes("/learning-session")) {
          if (invalidQueue === "throw") throw new Error("Queue unavailable");
          if (invalidQueue === "missing") return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
          return new Response(JSON.stringify({ ...dueQueue, review: invalidReview }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify(dueQueue), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/reconcile-reviews") && method === "POST") {
        reconcileCalls += 1;
        const reconciledSession = invalidQueue === "malformed-task"
          ? {
            ...session,
            tasks: [...session.tasks, {
              id: "learn-session:review-recognition-2", sessionId: "learn-session", childId: 1,
              key: "review-recognition-2", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW",
              skillDomain: "recognition", lessonId: "book1-l01", itemId: "item-hao", state: "PENDING", required: true,
              taskData: { prompt: "選出聽到的字：好", audioText: "好", choices: [{ id: "same", label: "你" }, { id: "same", label: "好" }], dueAt: "2026-09-02T00:00:00Z" },
            }],
          }
          : session;
        return new Response(JSON.stringify(reconciledSession), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await new Promise((resolve) => setTimeout(resolve, 45)); });
    const dueCta = Array.from(document.querySelectorAll(".hero-primary-cta-row .launch-quiz-cta-btn"))
      .find((button) => button.textContent?.includes("開始複習任務")) as HTMLButtonElement;
    expect(dueCta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { dueCta.click(); await new Promise((resolve) => setTimeout(resolve, 120)); });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-review")).toBeTruthy();
    expect(document.querySelector(".error-strip")).toBeTruthy();
    expect(document.querySelector(".large-char-display")).toBeNull();
    expect(document.querySelector(".char-choice-card")).toBeNull();
    expect(document.querySelector("[data-step-key='wrap_up']")).toBeNull();
    expect(reconcileCalls).toBe(invalidQueue === "cross-lesson" || invalidQueue === "malformed-task" ? 1 : 0);
    expect(requestLog.some((request) => request.url.includes("/tasks/learn-session:review-recognition-1/answer"))).toBe(false);

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("clears REVIEW launch intent when browser history leaves the canonical lesson route", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/");
    let homeQueueMode: "due" | "normal" = "due";
    const queue = () => ({
      childId: 1,
      asOf: "2026-09-05T00:00:00Z",
      placementStart: "BOOK_1" as const,
      review: homeQueueMode === "due"
        ? { sourceQueue: "REVIEW" as const, dueCount: 1, items: [{ id: "item-ni", skillDomain: "recognition" as const, character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] }
        : { sourceQueue: "REVIEW" as const, dueCount: 0, items: [] },
      newLesson: homeQueueMode === "normal" ? { sourceQueue: "CURRICULUM" as const, lessonId: "book1-l01", title: "日月星辰", domains: ["recognition"], status: "AVAILABLE", availableInLearningFlowV1: true } : null,
      completedLesson: homeQueueMode === "due" ? { sourceQueue: "CURRICULUM" as const, lessonId: "book1-l01", title: "日月星辰", domains: ["recognition"], status: "COMPLETED" } : null,
      currentLessonComplete: homeQueueMode === "due",
      nextLessonComingSoon: false,
      nextAccessibleLesson: null,
      activeSession: { id: "learn-session", status: "IN_PROGRESS" },
      schoolQueueSeparate: true,
      targetMinutes: 18,
    });
    const activeSession = { id: "learn-session", status: "IN_PROGRESS", lessonId: "book1-l01", tasks: [] };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify(queue()), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(activeSession), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/reconcile-reviews") && init?.method === "POST") return new Response(JSON.stringify(activeSession), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => { root.render(React.createElement(AppShell)); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const dueCta = Array.from(document.querySelectorAll(".hero-primary-cta-row .launch-quiz-cta-btn"))
      .find((button) => button.textContent?.includes("開始複習任務")) as HTMLButtonElement;
    expect(dueCta).toBeTruthy();
    await import("../pages/LessonPlayerPage");
    await act(async () => { dueCta.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
    expect(document.querySelector(".mode-badge.mode-review")).toBeTruthy();
    expect(document.querySelector(".large-char-display")).toBeNull();
    expect(document.querySelector(".error-strip")).toBeTruthy();

    homeQueueMode = "normal";
    await act(async () => {
      window.history.replaceState({}, "", "/TongXuan-Chinese/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/");
    const normalCta = document.querySelector(".hero-primary-cta-row .launch-quiz-cta-btn") as HTMLButtonElement;
    expect(normalCta.textContent).toContain("開始今日學習");
    await act(async () => { normalCta.click(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 70)); });
    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.querySelector(".mode-badge.mode-learn")).toBeTruthy();

    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
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
    await act(async () => { (Array.from(document.querySelectorAll(".app-tab")).find((button) => button.textContent?.trim() === "我的") as HTMLButtonElement).click(); });
    await act(async () => { (Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("新增孩子資料")) as HTMLButtonElement).click(); });
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

  it("renders 你好 on the canonical home path for Book 1 placement", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/TongXuan-Chinese/");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/children")) {
        return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          asOf: "2026-09-25T08:00:00Z",
          placementStart: "BOOK_1",
          review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
          newLesson: {
            sourceQueue: "CURRICULUM",
            lessonId: "book1-l01",
            title: "你好",
            domains: ["listening", "speaking", "recognition", "pronunciation"],
            status: "NOT_STARTED",
            availableInLearningFlowV1: true
          },
          nextAccessibleLesson: null,
          activeSession: null,
          schoolQueueSeparate: true,
          targetMinutes: 18
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(React.createElement(AppShell));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const heroTitle = document.querySelector(".official-lesson-hero .story-main-title");
    expect(heroTitle?.textContent).toMatch(/你.*好/);
    const stageBadge = document.querySelector(".sprint-stage-badge");
    expect(stageBadge?.textContent).toContain("第一冊");

    root.unmount();
    vi.unstubAllGlobals();
  });

  it("ensures production home current lesson and Learning Session curriculumContext.lessonId agree for Starter, Basic, and Book 1 placements", async () => {
    const placements = [
      { placement: "STARTER" as const, stageId: "starter", lessonId: "starter-l01", title: "你好", stageTitle: "入門冊" },
      { placement: "BASIC" as const, stageId: "basic", lessonId: "basic-l01", title: "你好", stageTitle: "基礎冊" },
      { placement: "BOOK_1" as const, stageId: "book-1", lessonId: "book1-l01", title: "你好", stageTitle: "第1冊" },
    ];

    for (const testCase of placements) {
      localStorage.clear();
      localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
      persistSelectedBackendChild(1, "樂樂");
      window.history.replaceState({}, "", "/TongXuan-Chinese/");

      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url.endsWith("/api/children")) {
          return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/children/1/learning-daily-queue")) {
          return new Response(JSON.stringify({
            childId: 1,
            asOf: "2026-09-25T08:00:00Z",
            placementStart: testCase.placement,
            review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
            newLesson: {
              sourceQueue: "CURRICULUM",
              lessonId: testCase.lessonId,
              title: testCase.title,
              domains: ["listening", "speaking", "phonetics"],
              status: "NOT_STARTED",
              availableInLearningFlowV1: true
            },
            nextAccessibleLesson: null,
            activeSession: null,
            schoolQueueSeparate: true,
            targetMinutes: 18
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/children/1/learning-sessions/current")) {
          return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/children/1/learning-sessions/plan")) {
          return new Response(JSON.stringify({
            targetMinutes: 18,
            curriculumContext: {
              stageId: testCase.stageId,
              stageTitle: testCase.stageTitle,
              lessonId: testCase.lessonId,
              official: { title: testCase.title, objectiveSummary: "目標摘要" }
            },
            tasks: [],
            composition: { review: 0, newLesson: 0, closing: 0 }
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/api/children/1/learning-sessions")) {
          return new Response(JSON.stringify({
            id: "session-123",
            status: "IN_PROGRESS",
            targetMinutes: 18,
            activeSeconds: 0,
            tasks: [],
            curriculumContext: {
              stageId: testCase.stageId,
              stageTitle: testCase.stageTitle,
              lessonId: testCase.lessonId,
              official: { title: testCase.title, objectiveSummary: "目標摘要" }
            },
            reward: { points: 0, earned: false }
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }));

      document.body.innerHTML = '<div id="root"></div>';
      const root = createRoot(document.getElementById("root")!);
      await act(async () => {
        root.render(React.createElement(AppShell));
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // 1. Verify Home Current Lesson title & stage
      const homeLessonTitle = document.querySelector(".official-lesson-hero .story-main-title");
      expect(homeLessonTitle?.textContent).toMatch(/你.*好/);

      // 2. Click Primary CTA to launch Learning Session
      const ctaBtn = document.querySelector(".validated-session-entry") as HTMLButtonElement;
      expect(ctaBtn).toBeTruthy();
      await act(async () => {
        ctaBtn.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // 3. Verify route navigated and LearningSession agrees on lesson
      expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
      expect(document.body.textContent).toContain(testCase.title);

      root.unmount();
      vi.unstubAllGlobals();
    }
  });

  it("browsing or selecting Book 1 Lesson 2 in track keeps primary hero CTA launching book1-l01 and shows upcoming lesson card", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/TongXuan-Chinese/");

    let launchedLessonId = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/children")) {
        return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          asOf: "2026-09-25T08:00:00Z",
          placementStart: "BOOK_1",
          review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
          newLesson: {
            sourceQueue: "CURRICULUM",
            lessonId: "book1-l01",
            title: "你好",
            domains: ["listening", "speaking", "phonetics"],
            status: "NOT_STARTED",
            availableInLearningFlowV1: true
          },
          nextAccessibleLesson: { lessonId: "book1-l02", title: "你家幾個人", availableInLearningFlowV1: false },
          activeSession: null,
          schoolQueueSeparate: true,
          targetMinutes: 18
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions/current")) {
        return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions/plan")) {
        return new Response(JSON.stringify({
          targetMinutes: 18,
          curriculumContext: {
            stageId: "book-1",
            stageTitle: "第1冊",
            lessonId: "book1-l01",
            official: { title: "你好", objectiveSummary: "問候打招呼" }
          },
          tasks: [],
          composition: { review: 0, newLesson: 0, closing: 0 }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions")) {
        launchedLessonId = "book1-l01";
        return new Response(JSON.stringify({
          id: "session-123",
          status: "IN_PROGRESS",
          targetMinutes: 18,
          activeSeconds: 0,
          tasks: [],
          curriculumContext: {
            stageId: "book-1",
            stageTitle: "第1冊",
            lessonId: "book1-l01",
            official: { title: "你好", objectiveSummary: "問候打招呼" }
          },
          reward: { points: 0, earned: false }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(React.createElement(AppShell));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Initially on Book 1 L1
    const heroTitle = document.querySelector(".official-lesson-hero .story-main-title");
    expect(heroTitle?.textContent).toMatch(/你.*好/);

    // 2. Click Lesson 2 in the track nodes
    const lessonNodes = document.querySelectorAll(".sprint-node-btn");
    const lesson2Node = Array.from(lessonNodes).find((node) => node.textContent?.includes("第 2 課")) as HTMLButtonElement;
    expect(lesson2Node).toBeTruthy();
    await act(async () => {
      lesson2Node.click();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 3. Verify upcoming lesson card appears for Lesson 2
    const upcomingCard = document.querySelector("[data-testid='upcoming-course']");
    expect(upcomingCard).toBeTruthy();
    expect(upcomingCard?.textContent).toMatch(/你.*家.*幾.*個.*人/);
    expect(upcomingCard?.textContent).toContain("此課為後續課綱內容 · 請先完成今日課程");

    // 4. Verify Main Hero is STILL pinned to Lesson 1 (你好)
    const heroTitleAfterBrowse = document.querySelector(".official-lesson-hero .story-main-title");
    expect(heroTitleAfterBrowse?.textContent).toMatch(/你.*好/);

    // 5. Click Primary CTA on Hero, verify it launches book1-l01
    const ctaBtn = document.querySelector(".validated-session-entry") as HTMLButtonElement;
    expect(ctaBtn).toBeTruthy();
    await act(async () => {
      ctaBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.body.textContent).toContain("第1冊");
    expect(document.body.textContent).toMatch(/你.*好/);

    root.unmount();
    vi.unstubAllGlobals();
  });

  it("switching visible stage tab in track cannot silently change the lesson launched by the primary CTA", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/TongXuan-Chinese/");

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/children")) {
        return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          asOf: "2026-09-25T08:00:00Z",
          placementStart: "BOOK_1",
          review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
          newLesson: {
            sourceQueue: "CURRICULUM",
            lessonId: "book1-l01",
            title: "你好",
            domains: ["listening", "speaking", "phonetics"],
            status: "NOT_STARTED",
            availableInLearningFlowV1: true
          },
          nextAccessibleLesson: null,
          activeSession: null,
          schoolQueueSeparate: true,
          targetMinutes: 18
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions/current")) {
        return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions/plan")) {
        return new Response(JSON.stringify({
          targetMinutes: 18,
          curriculumContext: {
            stageId: "book-1",
            stageTitle: "第1冊",
            lessonId: "book1-l01",
            official: { title: "你好", objectiveSummary: "問候打招呼" }
          },
          tasks: [],
          composition: { review: 0, newLesson: 0, closing: 0 }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-sessions")) {
        return new Response(JSON.stringify({
          id: "session-123",
          status: "IN_PROGRESS",
          targetMinutes: 18,
          activeSeconds: 0,
          tasks: [],
          curriculumContext: {
            stageId: "book-1",
            stageTitle: "第1冊",
            lessonId: "book1-l01",
            official: { title: "你好", objectiveSummary: "問候打招呼" }
          },
          reward: { points: 0, earned: false }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(React.createElement(AppShell));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Switch stage arrow left to Starter/Basic
    const leftArrow = document.querySelector(".sprint-stage-arrow-btn[title='上一階段']") as HTMLButtonElement;
    expect(leftArrow).toBeTruthy();
    await act(async () => {
      leftArrow.click();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 2. Verify Hero remains pinned to Book 1 L1 (你好)
    const heroTitle = document.querySelector(".official-lesson-hero .story-main-title");
    expect(heroTitle?.textContent).toMatch(/你.*好/);

    // 3. Click Hero primary CTA and verify it launches Book 1 L1
    const ctaBtn = document.querySelector(".validated-session-entry") as HTMLButtonElement;
    expect(ctaBtn).toBeTruthy();
    await act(async () => {
      ctaBtn.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(window.location.pathname).toBe("/TongXuan-Chinese/learning-session");
    expect(document.body.textContent).toContain("第1冊");
    expect(document.body.textContent).toMatch(/你.*好/);

    root.unmount();
    vi.unstubAllGlobals();
  });

  it("renders mastered state on home when Book 1 L1 is mastered: displays mastered banner, next lesson preview, does not restart L1 as new, and nests draft cards", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "zh-Hant");
    persistSelectedBackendChild(1, "樂樂");
    window.history.replaceState({}, "", "/TongXuan-Chinese/");

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/api/children")) {
        return new Response(JSON.stringify([{ id: 1, name: "樂樂" }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/children/1/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          asOf: "2026-09-25T08:00:00Z",
          placementStart: "BOOK_1",
          review: { sourceQueue: "REVIEW", dueCount: 0, items: [] },
          newLesson: null,
          completedLesson: {
            sourceQueue: "CURRICULUM",
            lessonId: "book1-l01",
            title: "你好",
            domains: ["listening", "speaking", "phonetics"],
            status: "MASTERED"
          },
          currentLessonComplete: true,
          nextLessonComingSoon: true,
          nextAccessibleLesson: {
            lessonId: "book1-l02",
            title: "你家幾個人",
            availableInLearningFlowV1: false
          },
          activeSession: null,
          schoolQueueSeparate: true,
          targetMinutes: 18
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ balance: 0, rewards: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById("root")!);
    await act(async () => {
      root.render(React.createElement(AppShell));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // 1. Verify Mastered banner is present
    const masteredBanner = document.querySelector(".official-mastered-banner");
    expect(masteredBanner).toBeTruthy();
    expect(masteredBanner?.textContent).toContain("本課已掌握通關");

    // 2. Verify Next Lesson note is present
    const nextLessonNote = document.querySelector(".next-lesson-coming-soon-note");
    expect(nextLessonNote).toBeTruthy();
    expect(nextLessonNote?.textContent).toContain("下一課《你家幾個人》即將推出");

    // 3. Verify CTA button indicates completion and is disabled (not restarting L1 as new)
    const ctaBtn = document.querySelector(".hero-primary-cta-row .validated-session-entry") as HTMLButtonElement;
    expect(ctaBtn).toBeTruthy();
    expect(ctaBtn.disabled).toBe(true);
    expect(ctaBtn.textContent).toContain("今日學習已達成");

    // 4. Verify draft cards are strictly contained inside authored-draft-practice-section
    const draftSection = document.querySelector(".authored-draft-practice-section");
    expect(draftSection).toBeTruthy();
    const threeStarGrid = draftSection?.querySelector(".three-star-cards-grid");
    expect(threeStarGrid).toBeTruthy();
    expect(draftSection?.querySelector(".draft-cards-badge")?.textContent).toContain("自編練習卡片");

    root.unmount();
    vi.unstubAllGlobals();
  });
});
