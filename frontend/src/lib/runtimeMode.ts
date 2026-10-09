export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "";

export type RuntimeMode = "static" | "backend";

/**
 * "static" is the GitHub Pages product: no backend, progress lives in the browser.
 * Tests exercise the backend contracts, so they count as "backend" unless a caller overrides it.
 */
export function detectRuntimeMode(): RuntimeMode {
  return !API_BASE && import.meta.env.MODE !== "test" ? "static" : "backend";
}
