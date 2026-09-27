import { describe, expect, it, vi } from "vitest";
import { apiFetch, setApiCsrfToken } from "./apiFetch";

describe("apiFetch auth transport", () => {
  it("includes the HttpOnly cookie by default and preserves existing bearer headers", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setApiCsrfToken("anti-csrf-from-session");
    const headers = new Headers({ Authorization: "Bearer internal-token", "X-Request-ID": "test-request" });
    await apiFetch("/api/dashboard?child_id=7", { method: "POST", headers });
    const call = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(call[0]).toBe("/api/dashboard?child_id=7");
    expect(call[1].credentials).toBe("include");
    expect(new Headers(call[1].headers).get("Authorization")).toBe("Bearer internal-token");
    expect(new Headers(call[1].headers).get("X-Request-ID")).toBe("test-request");
    expect(new Headers(call[1].headers).get("X-CSRF-Token")).toBe("anti-csrf-from-session");
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard?child_id=7", expect.objectContaining({
      credentials: "include",
    }));
    setApiCsrfToken(null);
    vi.unstubAllGlobals();
  });

  it("keeps an explicit caller credentials policy", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/health", { credentials: "omit" });
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { credentials: "omit" });
    setApiCsrfToken(null);
    vi.unstubAllGlobals();
  });
});
