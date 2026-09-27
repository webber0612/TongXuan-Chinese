// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AppShell } from "../AppShell";
import { GoogleParentSignIn } from "../components/GoogleParentSignIn";
import { ACTIVE_PROFILE_STORAGE_KEY, PROFILE_STORAGE_KEY } from "./profiles";
import { DISPLAY_LANGUAGE_KEY } from "./i18n";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type GoogleCallback = (result: { credential?: string }) => void;
function installGoogle() {
  let callback: GoogleCallback | null = null;
  let initializeCount = 0;
  Object.defineProperty(window, "google", {
    configurable: true,
    value: {
      accounts: {
        id: {
          initialize: (options: { callback: GoogleCallback }) => { initializeCount += 1; callback = options.callback; },
          renderButton: (host: HTMLElement) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Google sign in";
            button.addEventListener("click", () => callback?.({ credential: "controlled-google-id-token" }));
            host.append(button);
          },
        },
      },
    },
  });
  return () => initializeCount;
}

function mountApp(path: string): Root {
  document.body.innerHTML = '<div id="root"></div>';
  window.history.replaceState({}, "", path);
  return createRoot(document.getElementById("root")!);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
}

describe("Google parent auth UI", () => {
  it("does not render protected child content while production auth is unresolved", async () => {
    localStorage.clear();
    const authResponse = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/session")) return authResponse.promise;
      return new Response("{}", { status: 200 });
    }));
    const root = mountApp("/");
    await act(async () => { root.render(React.createElement(AppShell)); });
    expect(document.querySelector(".main-column > .app-loading")).toBeTruthy();
    expect(document.querySelector(".main-column .weekly-header-bar")).toBeNull();
    await act(async () => { authResponse.resolve(new Response(JSON.stringify({ authRequired: true, authenticated: false, role: null, parent: null }), { status: 200 })); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(window.location.pathname).toContain("/parent-dashboard");
    expect(document.querySelector(".parent-google-sign-in")).toBeTruthy();
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("submits the returned ID credential with the fetched CSRF token", async () => {
    installGoogle();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/api/auth/google/csrf")) return new Response(JSON.stringify({ csrfToken: "csrf-from-cookie", clientId: "web-client.apps.googleusercontent.com" }), { status: 200 });
      if (url.endsWith("/api/auth/google")) return new Response(JSON.stringify({ authenticated: true, parent: { id: 4, email: "parent@example.com", displayName: "Parent" } }), { status: 200 });
      return new Response("{}", { status: 404 });
    }));
    const onSignedIn = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(GoogleParentSignIn, { onSignedIn })); });
    await settle();
    const button = Array.from(document.querySelectorAll("button")).find((item) => item.textContent === "Google sign in");
    expect(button).toBeTruthy();
    await act(async () => { button?.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    const login = requests.find((item) => item.url.endsWith("/api/auth/google"));
    expect(JSON.parse(String(login?.init?.body))).toEqual({ credential: "controlled-google-id-token", g_csrf_token: "csrf-from-cookie" });
    expect(login?.init?.credentials).toBe("include");
    expect(onSignedIn).toHaveBeenCalledWith({ id: 4, email: "parent@example.com", displayName: "Parent" });
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
    delete (window as Window & { google?: unknown }).google;
  });

  it("initializes the Google Identity Services callback once across Parent and Settings remounts", async () => {
    const getInitializeCount = installGoogle();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/google/csrf")) return new Response(JSON.stringify({ csrfToken: "csrf", clientId: "web-client.apps.googleusercontent.com" }), { status: 200 });
      if (String(input).endsWith("/api/auth/google")) return new Response(JSON.stringify({ authenticated: true, parent: { id: 12, email: "parent@example.com", displayName: "Parent" } }), { status: 200 });
      return new Response("{}", { status: 404 });
    }));
    const firstSignedIn = vi.fn();
    const firstContainer = document.createElement("div");
    document.body.append(firstContainer);
    const firstRoot = createRoot(firstContainer);
    await act(async () => { firstRoot.render(React.createElement(GoogleParentSignIn, { onSignedIn: firstSignedIn })); });
    await settle();
    expect(getInitializeCount()).toBe(1);
    await act(async () => { firstRoot.unmount(); });

    const secondSignedIn = vi.fn();
    const secondContainer = document.createElement("div");
    document.body.append(secondContainer);
    const secondRoot = createRoot(secondContainer);
    await act(async () => { secondRoot.render(React.createElement(GoogleParentSignIn, { onSignedIn: secondSignedIn })); });
    await settle();
    expect(getInitializeCount()).toBe(1);
    await act(async () => { secondContainer.querySelector("button")?.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(secondSignedIn).toHaveBeenCalledWith({ id: 12, email: "parent@example.com", displayName: "Parent" });
    expect(firstSignedIn).not.toHaveBeenCalled();
    await act(async () => { secondRoot.unmount(); });
    vi.unstubAllGlobals();
    delete (window as Window & { google?: unknown }).google;
  });

  it("shows a configured-service error and retry when Google sign-in is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "google_sign_in_unavailable" }), { status: 503 })));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(React.createElement(GoogleParentSignIn, { onSignedIn: vi.fn() })); });
    await settle();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/not configured|尚未設定|未配置/);
    expect(document.querySelector("button")?.textContent).toMatch(/Try again|再試一次|重试/);
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });

  it("requires a parent session before production Home, then creates and selects the backend child", async () => {
    installGoogle();
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "en");
    let authenticated = false;
    let children: Array<{ id: number; name: string }> = [];
    const calls: Array<{ url: string; method: string; headers: Headers }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, headers: new Headers(init?.headers) });
      if (url.endsWith("/api/auth/session")) return new Response(JSON.stringify(authenticated
        ? { authRequired: true, authenticated: true, role: "parent", csrfToken: "session-csrf", parent: { id: 9, email: "parent@example.com", displayName: "Parent" } }
        : { authRequired: true, authenticated: false, role: null, parent: null }), { status: 200 });
      if (url.endsWith("/api/auth/google/csrf")) return new Response(JSON.stringify({ csrfToken: "csrf", clientId: "web-client.apps.googleusercontent.com" }), { status: 200 });
      if (url.endsWith("/api/auth/google")) { authenticated = true; return new Response(JSON.stringify({ authenticated: true, parent: { id: 9, email: "parent@example.com", displayName: "Parent" } }), { status: 200 }); }
      if (url.endsWith("/api/children") && method === "POST") {
        const created = { id: 27, name: "New Learner" };
        children = [created];
        return new Response(JSON.stringify(created), { status: 200 });
      }
      if (url.endsWith("/api/children")) return authenticated ? new Response(JSON.stringify(children), { status: 200 }) : new Response("{}", { status: 401 });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify({ childId: 27, placementStart: "STARTER", review: { items: [] } }), { status: 200 });
      return new Response("{}", { status: 200 });
    }));
    const root = mountApp("/");
    await act(async () => { root.render(React.createElement(AppShell)); });
    await settle();
    expect(window.location.pathname).toContain("/parent-dashboard");
    expect(document.querySelector(".parent-google-sign-in")).toBeTruthy();
    expect(calls.some((call) => call.url.endsWith("/api/children"))).toBe(false);
    window.history.replaceState({}, "", "/TongXuan-Chinese/learning-session");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(window.location.pathname).toContain("/parent-dashboard");

    await act(async () => { (document.querySelector(".parent-google-sign-in button") as HTMLButtonElement | null)?.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(window.location.pathname).toContain("/me");
    expect(document.body.textContent).toContain("This parent account has no child profiles yet.");
    const add = Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.includes("Add a child profile")) as HTMLButtonElement | undefined;
    expect(add).toBeTruthy();
    await act(async () => { add?.click(); });
    const input = document.querySelector("#new-profile-name") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(input, "New Learner"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { document.querySelector(".add-learner-dialog .button-primary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)); });
    await settle();
    const createCall = calls.find((call) => call.url.endsWith("/api/children") && call.method === "POST");
    expect(createCall).toBeTruthy();
    expect(createCall?.headers.get("X-CSRF-Token")).toBe("session-csrf");
    expect(window.location.pathname).toMatch(/\/$/);
    expect(calls.some((call) => call.url.endsWith("/api/children/27/learning-daily-queue"))).toBe(true);
    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe("child-27");

    // Browser Back/Forward changes the URL and emits popstate without remounting AppShell.
    // The guard must consult the current authenticated parent session.
    window.history.pushState({}, "", "/TongXuan-Chinese/learning-session");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(window.location.pathname).toContain("/learning-session");
    window.history.pushState({}, "", "/TongXuan-Chinese/me");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(window.location.pathname).toContain("/me");
    await act(async () => { window.history.back(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(window.location.pathname).toContain("/learning-session");
    await act(async () => { window.history.forward(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(window.location.pathname).toContain("/me");
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
    delete (window as Window & { google?: unknown }).google;
  });

  it("keeps the selected duplicate-name child ID across refresh and sends only that ID", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "en");
    const stored = [{ key: "child-22", name: "Twin", role: "child", childId: 22, color: "mint" }, { key: "parent", name: "Parent", role: "parent", childId: null, color: "navy" }];
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, "parent");
    const queueCalls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return new Response(JSON.stringify({ authRequired: true, authenticated: true, role: "parent", parent: { id: 9, email: "parent@example.com", displayName: "Parent" } }), { status: 200 });
      if (url.endsWith("/api/children")) return new Response(JSON.stringify([{ id: 11, name: "Twin" }, { id: 22, name: "Twin" }]), { status: 200 });
      if (url.includes("/learning-daily-queue")) { queueCalls.push(url); return new Response(JSON.stringify({ childId: Number(url.match(/children\/(\d+)/)?.[1]), placementStart: "STARTER", review: { items: [] } }), { status: 200 }); }
      return new Response("{}", { status: 200 });
    }));
    const root = mountApp("/me");
    await act(async () => { root.render(React.createElement(AppShell)); });
    await settle();
    expect(queueCalls).toEqual([]);
    const childButton = document.querySelectorAll(".family-row-button")[1] as HTMLButtonElement;
    await act(async () => { childButton.click(); });
    await settle();
    expect(queueCalls).toEqual(["/api/children/22/learning-daily-queue"]);
    await act(async () => { root.unmount(); });

    queueCalls.length = 0;
    const refreshed = mountApp("/");
    await act(async () => { refreshed.render(React.createElement(AppShell)); });
    await settle();
    expect(queueCalls).toEqual(["/api/children/22/learning-daily-queue"]);
    expect(localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY)).toBe("child-22");
    await act(async () => { refreshed.unmount(); });
    vi.unstubAllGlobals();
  });

  it("ignores an in-flight child list response after the parent signs out", async () => {
    localStorage.clear();
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, "en");
    const childResponse = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return new Response(JSON.stringify({ authRequired: true, authenticated: true, role: "parent", csrfToken: "session-csrf", parent: { id: 9, email: "parent@example.com", displayName: "Parent" } }), { status: 200 });
      if (url.endsWith("/api/children")) return childResponse.promise;
      if (url.endsWith("/api/auth/logout")) return new Response("{}", { status: 200 });
      return new Response("{}", { status: 200 });
    }));
    const root = mountApp("/me");
    await act(async () => { root.render(React.createElement(AppShell)); });
    await settle();
    expect(document.querySelector(".parent-auth-status button")).toBeTruthy();
    await act(async () => { (document.querySelector(".parent-auth-status button") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(window.location.pathname).toContain("/parent-dashboard");

    await act(async () => { childResponse.resolve(new Response(JSON.stringify([{ id: 51, name: "Stale child" }]), { status: 200 })); await new Promise((resolve) => setTimeout(resolve, 10)); });
    window.history.pushState({}, "", "/TongXuan-Chinese/me");
    await act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(document.querySelectorAll(".family-row-button")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("Stale child");
    await act(async () => { root.unmount(); });
    vi.unstubAllGlobals();
  });
});
