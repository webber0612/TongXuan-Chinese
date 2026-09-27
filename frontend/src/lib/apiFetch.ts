/** Send the app's HttpOnly session cookie with same-site and configured cross-origin API calls. */
let csrfToken = "";

export function setApiCsrfToken(token: string | null) {
  csrfToken = token ?? "";
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (unsafe && csrfToken) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrfToken);
    return fetch(input, { ...init, headers, credentials: init.credentials ?? "include" });
  }
  return fetch(input, { ...init, credentials: init.credentials ?? "include" });
}
