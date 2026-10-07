import React, { useState, useEffect } from "react";
import {
  getSavedDriveAuth,
  performFullDriveSync,
  disconnectGoogleDrive,
  type GoogleDriveAuth
} from "../lib/googleDriveSync";

export function GoogleDriveSyncCard({
  onSyncComplete,
  compact = false
}: {
  onSyncComplete?: () => void;
  compact?: boolean;
}) {
  const [auth, setAuth] = useState<GoogleDriveAuth | null>(() => getSavedDriveAuth());
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setAuth(getSavedDriveAuth());
  }, []);

  const handleConnectAndSync = async () => {
    setSyncing(true);
    setStatusMsg("正在連結 Google 授權與同步進度...");
    setIsError(false);
    try {
      const result = await performFullDriveSync(auth);
      setAuth(result.auth);
      const actionText =
        result.action === "downloaded"
          ? "已從 Google Drive 下載最新進度！"
          : "已將進度安全備份至 Google Drive！";
      setStatusMsg(`✅ 同步成功：${actionText}`);
      onSyncComplete?.();
    } catch (err: any) {
      console.error("Google Drive sync error:", err);
      setIsError(true);
      if (err?.message?.includes("popup_closed")) {
        setStatusMsg("登入視窗已關閉。請點擊按鈕重試。");
      } else {
        setStatusMsg(`同步未完成：${err?.message || "請檢查網路或稍候再試"}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setAuth(null);
    setStatusMsg("已中斷 Google Drive 連結。");
    setIsError(false);
  };

  if (compact) {
    return (
      <div className="gdrive-sync-compact">
        {auth ? (
          <button
            type="button"
            className="gdrive-compact-btn connected"
            onClick={handleConnectAndSync}
            disabled={syncing}
            title={`已連結 Google Drive (${auth.email}) · 點擊立即同步`}
          >
            <span className="gdrive-icon">☁️</span>
            <span className="gdrive-text">{syncing ? "同步中..." : "已雲端同步"}</span>
          </button>
        ) : (
          <button
            type="button"
            className="gdrive-compact-btn not-connected"
            onClick={handleConnectAndSync}
            disabled={syncing}
            title="點擊連結 Google Drive 雲端自動備份"
          >
            <span className="gdrive-icon">☁️</span>
            <span className="gdrive-text">雲端同步</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`gdrive-sync-card ${auth ? "is-connected" : ""}`}>
      <div className="gdrive-card-header">
        <div className="gdrive-header-left">
          <h4 className="gdrive-title">
            雲端進度同步
            {auth && <span className="gdrive-status-tag">🟢 已連線</span>}
          </h4>
        </div>
      </div>

      {auth ? (
        <div className="gdrive-connected-body">
          <div className="gdrive-account-row">
            <span className="gdrive-account-label">帳號：</span>
            <strong className="gdrive-account-email">{auth.email}</strong>
            {auth.lastSyncTime && (
              <span className="gdrive-last-sync">
                （上次同步：{new Date(auth.lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}）
              </span>
            )}
          </div>

          {statusMsg && (
            <div className={`gdrive-status-notice ${isError ? "error" : "success"}`}>
              {statusMsg}
            </div>
          )}

          <div className="gdrive-action-buttons">
            <button
              type="button"
              className="gdrive-btn primary"
              onClick={handleConnectAndSync}
              disabled={syncing}
            >
              🔄 {syncing ? "同步中..." : "立即同步"}
            </button>
            <button
              type="button"
              className="gdrive-btn text-danger"
              onClick={handleDisconnect}
              disabled={syncing}
            >
              中斷連結
            </button>
          </div>
        </div>
      ) : (
        <div className="gdrive-unconnected-body">
          {statusMsg && (
            <div className={`gdrive-status-notice ${isError ? "error" : "info"}`}>
              {statusMsg}
            </div>
          )}

          <div className="gdrive-connect-row">
            <button
              type="button"
              className="gdrive-btn-connect"
              onClick={handleConnectAndSync}
              disabled={syncing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="google-icon">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{syncing ? "連接中..." : "連結 Google 帳號"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
