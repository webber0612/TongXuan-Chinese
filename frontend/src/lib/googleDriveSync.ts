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

export type SyncPayload = {
  version: number;
  updatedAt: string;
  sourceDevice?: string;
  learners: unknown[];
  activeLearnerId: string;
  writingProgress: Record<string, unknown>;
  rewardsCatalog?: unknown;
  displayLang?: string;
  voiceGuide?: boolean;
};

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
export function getSavedDriveAuth(): GoogleDriveAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleDriveAuth;
    if (parsed && parsed.accessToken && parsed.expiresAt > Date.now()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Save auth info to local storage */
export function saveDriveAuth(auth: GoogleDriveAuth | null): void {
  if (auth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
              expiresAt: Date.now() + (expiresInSec - 60) * 1000,
              lastSyncTime: new Date().toISOString()
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
  let learners: unknown[] = [];
  try {
    const raw = localStorage.getItem("tongxuan_learners_list");
    if (raw) learners = JSON.parse(raw);
  } catch {}

  let writingProgress = {};
  try {
    const raw = localStorage.getItem("tongxuan_writing_progress_v2");
    if (raw) writingProgress = JSON.parse(raw);
  } catch {}

  let rewardsCatalog = null;
  try {
    const raw = localStorage.getItem("tongxuan_expert_rewards_catalog");
    if (raw) rewardsCatalog = JSON.parse(raw);
  } catch {}

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceDevice: navigator.userAgent.slice(0, 40),
    learners,
    activeLearnerId: localStorage.getItem("tongxuan_active_learner_id") || "learner-1",
    writingProgress,
    rewardsCatalog,
    displayLang: localStorage.getItem("tongxuan_display_lang") || "zh-Hant",
    voiceGuide: localStorage.getItem("tongxuan_voice_guide") === "true"
  };
}

/** Apply remote progress payload to local storage */
export function applyRemotePayloadToLocal(payload: SyncPayload): void {
  if (Array.isArray(payload.learners) && payload.learners.length > 0) {
    localStorage.setItem("tongxuan_learners_list", JSON.stringify(payload.learners));
  }
  if (payload.activeLearnerId) {
    localStorage.setItem("tongxuan_active_learner_id", payload.activeLearnerId);
  }
  if (payload.writingProgress && typeof payload.writingProgress === "object") {
    localStorage.setItem("tongxuan_writing_progress_v2", JSON.stringify(payload.writingProgress));
  }
  if (payload.rewardsCatalog) {
    localStorage.setItem("tongxuan_expert_rewards_catalog", JSON.stringify(payload.rewardsCatalog));
  }
  if (payload.displayLang) {
    localStorage.setItem("tongxuan_display_lang", payload.displayLang);
  }
  if (typeof payload.voiceGuide === "boolean") {
    localStorage.setItem("tongxuan_voice_guide", payload.voiceGuide ? "true" : "false");
  }
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
export async function downloadProgressFromDrive(accessToken: string): Promise<{ data: SyncPayload | null; fileId: string | null; modifiedTime?: string }> {
  const fileId = await findProgressFileId(accessToken);
  if (!fileId) return { data: null, fileId: null };

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!resp.ok) throw new Error(`download_drive_failed_${resp.status}`);
  const data = (await resp.json()) as SyncPayload;
  return { data, fileId };
}

/** Upload local progress payload to Google Drive appDataFolder */
export async function uploadProgressToDrive(accessToken: string, payload: SyncPayload, existingFileId?: string | null): Promise<string> {
  const fileId = existingFileId ?? (await findProgressFileId(accessToken));
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

/** Execute a full 2-way sync: Download remote or upload local */
export async function performFullDriveSync(existingAuth?: GoogleDriveAuth | null): Promise<{ auth: GoogleDriveAuth; action: "uploaded" | "downloaded" | "synced" }> {
  let auth = existingAuth || getSavedDriveAuth();
  if (!auth) {
    auth = await requestDriveAccessToken();
  }

  // 1. Download remote file
  const { data: remoteData, fileId } = await downloadProgressFromDrive(auth.accessToken);
  const localData = getLocalProgressPayload();

  let action: "uploaded" | "downloaded" | "synced" = "synced";

  if (!remoteData) {
    // No remote file yet -> upload local to remote
    await uploadProgressToDrive(auth.accessToken, localData, fileId);
    action = "uploaded";
  } else {
    const remoteTime = new Date(remoteData.updatedAt || 0).getTime();
    const localTime = new Date(localData.updatedAt || 0).getTime();

    if (remoteTime > localTime && Array.isArray(remoteData.learners) && remoteData.learners.length > 0) {
      // Remote is newer -> apply to local
      applyRemotePayloadToLocal(remoteData);
      action = "downloaded";
    } else {
      // Local has data -> push to remote
      await uploadProgressToDrive(auth.accessToken, localData, fileId);
      action = "uploaded";
    }
  }

  const updatedAuth: GoogleDriveAuth = {
    ...auth,
    lastSyncTime: new Date().toISOString()
  };
  saveDriveAuth(updatedAuth);
  return { auth: updatedAuth, action };
}

/** Disconnect and revoke token */
export function disconnectGoogleDrive(): void {
  saveDriveAuth(null);
}
