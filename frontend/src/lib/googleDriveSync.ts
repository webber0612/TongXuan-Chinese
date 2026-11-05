import { appStorage, getDeletedLearnerIds, getLearners, getWritingProgress, SCHEMA_VERSION } from "./storage";
import { mergeSyncPayloads, normalizeSyncPayload, type SyncPayload, type LegacySyncPayload } from "./sync/merge";
export type { SyncPayload } from "./sync/merge";
/**
 * TongXuan Chinese - Google Drive User-Owned Sync Service
 * 
 * Stores child learning progress, learners list, and writing mastery
 * directly in the user's personal Google Drive (drive.appdata space).
 * Zero server storage, 100% private, cross-device synchronization.
 */

export const GOOGLE_CLIENT_ID = "867092172555-k29g47ore92jnte887b0f50tjjh834bu.apps.googleusercontent.com";
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const AUTH_STORAGE_KEY = "tongxuan_gdrive_auth";
const PROGRESS_FILE_NAME = "tongxuan_progress.json";

export type GoogleDriveAuth = {
  accessToken: string;
  email: string;
  name: string;
  expiresAt: number; // timestamp ms
  lastSyncTime?: string;
};

export type DriveSyncStatus = { state: "idle" | "syncing" | "synced" | "relink" | "error"; at: string };

export function getDriveSyncStatus(): DriveSyncStatus {
  try { return JSON.parse(appStorage.getItem("tongxuan_drive_sync_status") || '{"state":"idle","at":""}') as DriveSyncStatus; }
  catch { return { state: "idle", at: "" }; }
}

function saveSyncStatus(state: DriveSyncStatus["state"]): void {
  appStorage.setItem("tongxuan_drive_sync_status", JSON.stringify({ state, at: new Date().toISOString() }));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("tongxuan-drive-sync-status"));
}

/** Ensure Google Identity Services SDK is loaded */
export async function ensureGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return;
  const win = window as any;
  if (win.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const timer = setTimeout(() => reject(new Error("google_script_load_timeout")), 10000);
    script.addEventListener("load", () => {
      clearTimeout(timer);
      resolve();
    });
    script.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("google_script_load_failed"));
    });
  });
}

/** Get stored auth info if valid */
export function getLinkedDriveAuth(): GoogleDriveAuth | null {
  try {
    const raw = appStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleDriveAuth;
    if (parsed && parsed.accessToken) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSavedDriveAuth(): GoogleDriveAuth | null {
  const auth = getLinkedDriveAuth();
  return auth && auth.expiresAt > Date.now() ? auth : null;
}

/** Save auth info to local storage */
export function saveDriveAuth(auth: GoogleDriveAuth | null): void {
  if (auth) {
    appStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } else {
    appStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/** Fetch user profile info from Google OAuth */
async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  try {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      return {
        email: data.email || "",
        name: data.name || data.given_name || "Google 使用者"
      };
    }
  } catch (err) {
    console.warn("Could not fetch userinfo, continuing with drive sync:", err);
  }
  return {
    email: "Google 帳號",
    name: "家長"
  };
}

/** Request an OAuth token with drive.appdata scope via popup */
export async function requestDriveAccessToken(): Promise<GoogleDriveAuth> {
  await ensureGoogleScript();
  const win = window as any;
  if (!win.google?.accounts?.oauth2) {
    throw new Error("google_oauth2_unavailable");
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = win.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_APPDATA_SCOPE,
        callback: async (tokenResp: { access_token?: string; error?: string; expires_in?: number }) => {
          if (tokenResp.error) {
            reject(new Error(tokenResp.error));
            return;
          }
          if (!tokenResp.access_token) {
            reject(new Error("no_access_token"));
            return;
          }

          try {
            const userInfo = await fetchGoogleUserInfo(tokenResp.access_token);
            const expiresInSec = tokenResp.expires_in || 3600;
            const auth: GoogleDriveAuth = {
              accessToken: tokenResp.access_token,
              email: userInfo.email,
              name: userInfo.name,
              expiresAt: Date.now() + (expiresInSec - 60) * 1000
            };
            saveDriveAuth(auth);
            resolve(auth);
          } catch (err) {
            reject(err);
          }
        },
        error_callback: (err: unknown) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

/** Collect current local progress payload */
export function getLocalProgressPayload(): SyncPayload {
  const learners = getLearners();
  const writingProgress = getWritingProgress();
  const deletedLearnerIds = getDeletedLearnerIds();
  const readJson = (key: string): unknown => {
    try { return JSON.parse(appStorage.getItem(key) || "null"); } catch { return null; }
  };
  const preferencesUpdatedAt = appStorage.getItem("tongxuan_preferences_updated_at") || "1970-01-01T00:00:00.000Z";
  const rewardsUpdatedAt = appStorage.getItem("tongxuan_rewards_updated_at") || "1970-01-01T00:00:00.000Z";
  const customRewardsUpdatedAt = appStorage.getItem("tongxuan_custom_rewards_updated_at") || "1970-01-01T00:00:00.000Z";
  const stamps = [preferencesUpdatedAt, rewardsUpdatedAt, customRewardsUpdatedAt, ...Object.values(deletedLearnerIds), ...learners.map((learner) => learner.updatedAt), ...Object.values(writingProgress).map((entry) => entry.updatedAt)];
  const updatedAt = stamps.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || "1970-01-01T00:00:00.000Z";
  return normalizeSyncPayload({
    version: 2, schemaVersion: SCHEMA_VERSION, updatedAt, learners,
    deletedLearnerIds,
    activeLearnerId: appStorage.getItem("tongxuan_active_learner_id") || "learner-1",
    writingProgress,
    rewardsCatalog: readJson("tongxuan_expert_rewards_catalog"),
    customRewardsCatalog: readJson("tongxuan_custom_rewards_catalog"),
    rewardsUpdatedAt, customRewardsUpdatedAt,
    displayLang: appStorage.getItem("tongxuan_display_lang") || "zh-Hant",
    voiceGuide: appStorage.getItem("tongxuan_voice_guide") === "true",
    preferencesUpdatedAt,
  } as unknown as SyncPayload);
}

/** Apply remote progress payload to local storage */
export function applyRemotePayloadToLocal(payload: SyncPayload): void {
  appStorage.setSyncedItem("tongxuan_learners_list", JSON.stringify(payload.learners));
  appStorage.setSyncedItem("tongxuan_deleted_learner_ids", JSON.stringify(payload.deletedLearnerIds));
  if (payload.activeLearnerId) appStorage.setSyncedItem("tongxuan_active_learner_id", payload.activeLearnerId);
  appStorage.setSyncedItem("tongxuan_writing_progress_v2", JSON.stringify(payload.writingProgress));
  if (payload.rewardsCatalog !== null) appStorage.setSyncedItem("tongxuan_expert_rewards_catalog", JSON.stringify(payload.rewardsCatalog));
  if (payload.customRewardsCatalog !== null) appStorage.setSyncedItem("tongxuan_custom_rewards_catalog", JSON.stringify(payload.customRewardsCatalog));
  appStorage.setSyncedItem("tongxuan_rewards_updated_at", payload.rewardsUpdatedAt);
  appStorage.setSyncedItem("tongxuan_custom_rewards_updated_at", payload.customRewardsUpdatedAt);
  appStorage.setSyncedItem("tongxuan_display_lang", payload.displayLang);
  appStorage.setSyncedItem("tongxuan_voice_guide", String(payload.voiceGuide));
  appStorage.setSyncedItem("tongxuan_preferences_updated_at", payload.preferencesUpdatedAt);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("tongxuan-sync-applied"));
}

/** Find existing tongxuan_progress.json in Google Drive appDataFolder */
async function findProgressFileId(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${PROGRESS_FILE_NAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`;
  
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`query_drive_failed_${resp.status}`);
  const json = await resp.json();
  if (Array.isArray(json.files) && json.files.length > 0) {
    return json.files[0].id;
  }
  return null;
}

/** Read progress data from Google Drive appDataFolder */
export async function downloadProgressFromDrive(accessToken: string): Promise<{ data: SyncPayload | LegacySyncPayload | null; fileId: string | null; modifiedTime?: string }> {
  const fileId = await findProgressFileId(accessToken);
  if (!fileId) return { data: null, fileId: null };

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`download_drive_failed_${resp.status}`);
  const data = (await resp.json()) as SyncPayload | LegacySyncPayload;
  return { data, fileId };
}

/** Upload local progress payload to Google Drive appDataFolder */
export async function uploadProgressToDrive(accessToken: string, payload: SyncPayload, existingFileId?: string | null): Promise<string> {
  const fileId = existingFileId === undefined ? await findProgressFileId(accessToken) : existingFileId;
  const content = JSON.stringify(payload, null, 2);

  if (fileId) {
    // Update existing file
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const resp = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: content
    });
    if (!resp.ok) throw new Error(`update_drive_failed_${resp.status}`);
    const json = await resp.json();
    return json.id || fileId;
  } else {
    // Create new file inside appDataFolder
    const metadata = {
      name: PROGRESS_FILE_NAME,
      parents: ["appDataFolder"]
    };
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      content +
      closeDelim;

    const createUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    const resp = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });
    if (!resp.ok) throw new Error(`create_drive_failed_${resp.status}`);
    const json = await resp.json();
    return json.id;
  }
}

let syncInFlight: Promise<{ auth: GoogleDriveAuth; action: "uploaded" | "downloaded" | "synced" }> | null = null;
let syncQueued = false;

/** Download, merge, persist, then upload. A failed upload never rolls back local progress. */
export function performFullDriveSync(existingAuth?: GoogleDriveAuth | null, interactive = true): Promise<{ auth: GoogleDriveAuth; action: "uploaded" | "downloaded" | "synced" }> {
  if (syncInFlight) return syncInFlight;
  const running = (async () => {
    saveSyncStatus("syncing");
    try {
      let auth = existingAuth || getLinkedDriveAuth();
      if (!auth || auth.expiresAt <= Date.now()) {
        if (!interactive) throw new Error("relink_required");
        auth = await requestDriveAccessToken();
      }
      const { data: remoteData, fileId } = await downloadProgressFromDrive(auth.accessToken);
      const localData = getLocalProgressPayload();
      const merged = remoteData ? mergeSyncPayloads(localData, remoteData) : normalizeSyncPayload(localData);
      applyRemotePayloadToLocal(merged);
      await uploadProgressToDrive(auth.accessToken, merged, fileId);
      const updatedAuth = { ...auth, lastSyncTime: new Date().toISOString() };
      saveDriveAuth(updatedAuth);
      saveSyncStatus("synced");
      const action: "uploaded" | "synced" | "downloaded" = !remoteData ? "uploaded" : JSON.stringify(merged) === JSON.stringify(localData) ? "synced" : "downloaded";
      return { auth: updatedAuth, action };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      saveSyncStatus(/relink_required|_401|_403/.test(message) ? "relink" : "error");
      throw cause;
    }
  })();
  syncInFlight = running;
  void running.then(() => {
    syncInFlight = null;
    if (syncQueued) { syncQueued = false; void autoSyncDrive(); }
  }, () => { syncInFlight = null; syncQueued = false; });
  return running;
}

/** Silent sync for the child flow; an expired token is surfaced only in the parent card. */
export async function autoSyncDrive(): Promise<void> {
  const auth = getLinkedDriveAuth();
  if (!auth) return;
  if (auth.expiresAt <= Date.now()) { saveSyncStatus("relink"); return; }
  if (syncInFlight) { syncQueued = true; await syncInFlight.catch(() => undefined); return; }
  await performFullDriveSync(auth, false).catch(() => undefined);
}

/** Disconnect and revoke token */
export function disconnectGoogleDrive(): void {
  saveDriveAuth(null);
  saveSyncStatus("idle");
}
