declare const __GIT_COMMIT_HASH__: string | undefined;

export const APP_VERSION = "0.2.0";
export const COMMIT_HASH = typeof __GIT_COMMIT_HASH__ !== "undefined" ? __GIT_COMMIT_HASH__ : "local";
export const FULL_VERSION = `v${APP_VERSION} (${COMMIT_HASH})`;
export const BUILD_DATE = "2026-10-07";
export const APP_CODENAME = "Cloud Harmony (Google Drive Sync)";

/**
 * Outputs a subtle, styled build/version badge in the F12 developer console
 * and binds metadata to window.__TONGXUAN__ for quick debugging.
 */
export function logVersionInfo(): void {
  if (typeof window === "undefined") return;

  // Pretty F12 DevTools Console Banner
  const brandStyle =
    "background: #2e746a; color: #ffffff; font-weight: 700; padding: 3px 7px; border-radius: 4px 0 0 4px; font-size: 11px;";
  const versionStyle =
    "background: #3b8b7e; color: #ffffff; padding: 3px 7px; font-weight: 600; font-size: 11px;";
  const dateStyle =
    "background: #e6f4f1; color: #205c53; padding: 3px 7px; border-radius: 0 4px 4px 0; font-size: 11px;";

  console.log(
    `%c同軒中文 TongXuan%cv${APP_VERSION} #${COMMIT_HASH}%c${BUILD_DATE}`,
    brandStyle,
    versionStyle,
    dateStyle
  );

  // Expose global window.__TONGXUAN__ object for easy F12 inspection
  (window as any).__TONGXUAN__ = Object.freeze({
    version: APP_VERSION,
    commit: COMMIT_HASH,
    fullVersion: FULL_VERSION,
    buildDate: BUILD_DATE,
    codename: APP_CODENAME,
    mode: import.meta.env.MODE,
    storage: "Google Drive appDataFolder + localStorage fallback"
  });
}
