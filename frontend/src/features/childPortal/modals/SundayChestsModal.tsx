import { type ReactNode } from "react";
import {
Sparkles,Flame,X,Gift,Key,
Crown,
Package
} from "lucide-react";

import { ScriptMode } from "../types";
/* ========================================================
   週日寶箱與鑰匙說明彈窗
   ======================================================== */
export function SundayChestsModal({
  keysEarned,
  streakDays,
  beginnerMode,
  R,
  t,
  onClose,
  onTestOpenChest
}: {
  keysEarned: number;
  streakDays: number;
  beginnerMode: boolean;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
  onClose: () => void;
  onTestOpenChest: (type: "normal" | "streak") => void;
}) {
  const normalChestUnlocked = keysEarned >= 6;
  const streakChestUnlocked = streakDays >= 6;

  return (
    <div className="modal-backdrop">
      <div className="sunday-chests-modal-card">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-chests-header">
          <Gift size={48} className="chest-gift-icon" />
          <h2>{R(t("chestTitle"))}</h2>
          <p className="modal-chests-sub">{R(t("chestSub"))}</p>
        </div>

        <div className="chests-duo-container">
          <div className={`chest-card ${normalChestUnlocked ? "unlocked" : "locked"}`}>
            <div className="chest-icon-wrapper">
              <Package size={52} className="chest-big-svg" />
              {normalChestUnlocked && <Sparkles size={24} className="sparkle-gold" />}
            </div>

            <div className="chest-card-info">
              <h3>{R(t("normalChestTitle"))}</h3>
              <p className="chest-condition">
                {R(t("normalChestCond"))}
              </p>

              <div className="chest-progress-bar-wrap">
                <div className="keys-progress-fill" style={{ width: `${(keysEarned / 6) * 100}%` }} />
                <span className="keys-progress-label">
                  <Key size={14} /> 🗝️ {keysEarned} / 6
                </span>
              </div>

              <div className="chest-reward-tag">
                <span>{R(t("rewardText"))}</span>
              </div>
            </div>

            <button
              className="open-chest-action-btn"
              disabled={!normalChestUnlocked}
              onClick={() => onTestOpenChest("normal")}
            >
              {normalChestUnlocked ? R(t("openChest")) : R(t("needKeys", { n: 6 - keysEarned }))}
            </button>
          </div>

          <div className={`chest-card ${streakChestUnlocked ? "unlocked golden" : "locked streak-locked"}`}>
            <div className="chest-crown-badge">
              <Crown size={16} /> <b>{R("連續全勤加贈")}</b>
            </div>

            <div className="chest-icon-wrapper streak-chest-wrap">
              <Crown size={52} className="crown-big-svg" />
              {streakChestUnlocked && <Sparkles size={24} className="sparkle-gold" />}
            </div>

            <div className="chest-card-info">
              <h3>{R(t("streakChestTitle"))}</h3>
              <p className="chest-condition">
                {R(t("streakChestCond"))}
              </p>

              <div className="chest-progress-bar-wrap streak-bar">
                <div className="keys-progress-fill streak-fill" style={{ width: `${(Math.min(streakDays, 6) / 6) * 100}%` }} />
                <span className="keys-progress-label">
                  <Flame size={14} /> {R("連續")} <b>{streakDays}</b> / 6 {R("天")}
                </span>
              </div>

              <div className="chest-reward-tag gold-tag">
                <span>{R(t("rewardStreakText"))}</span>
              </div>
            </div>

            <button
              className="open-chest-action-btn gold-btn"
              disabled={!streakChestUnlocked}
              onClick={() => onTestOpenChest("streak")}
            >
              {streakChestUnlocked ? R(t("openKingChest")) : R(t("needStreak", { n: 6 - Math.min(streakDays, 6) }))}
            </button>
          </div>
        </div>

        <p className="chests-footer-hint">
          {R(t("chestFooter"))}
        </p>
      </div>
    </div>
  );
}

