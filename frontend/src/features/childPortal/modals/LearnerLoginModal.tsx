import { useState,type ReactNode } from "react";
import {
X,GraduationCap
} from "lucide-react";
import { GoogleDriveSyncCard } from "../../../components/GoogleDriveSyncCard";
import {
getLearnerLevelsProgress
} from "../../../data/learningPathData";

import { ScriptMode,PhoneticAssist,HandMode,ChildLearner } from "../types";
/* ========================================================
   學習者切換與登入彈窗
   ======================================================== */
export function LearnerLoginModal({
  learners,
  activeLearnerId,
  beginnerMode,
  R,
  onSelectLearner,
  onAddLearner,
  onDeleteLearner,
  onClose,
  t
}: {
  learners: ChildLearner[];
  activeLearnerId: string;
  beginnerMode: boolean;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  onSelectLearner: (id: string) => void;
  onAddLearner: (learner: ChildLearner) => void;
  onDeleteLearner: (id: string) => void;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🐯");
  const [newScript, setNewScript] = useState<ScriptMode>("dual");
  const [newPhonetic, setNewPhonetic] = useState<PhoneticAssist>("zhuyin");
  const [newHand, setNewHand] = useState<HandMode>("right");

  const avatarOptions = ["🐯", "🐰", "🐼", "🦁", "🐨", "🦊", "🐱", "🐶", "🦄", "🦖"];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newL: ChildLearner = {
      id: `learner-${Date.now()}`,
      name: newName.trim(),
      avatar: newAvatar,
      role: "learner",
      scriptMode: newScript,
      phoneticAssist: newPhonetic,
      handMode: newHand,
      points: { coins: 100, stars: 0 },
      levelsProgress: getLearnerLevelsProgress(),
      redemptions: [],
      totalMinutesLearned: 0,
      streakDays: 0,
      activePinkyPromise: null
    };
    onAddLearner(newL);
  };

  return (
    <div className="modal-backdrop">
      <div className="learner-login-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        <div className="login-modal-header">
          <div className="login-modal-badge">
            <GraduationCap size={32} />
          </div>
          <h2>{R("選擇或管理學習者帳號")}</h2>
          <p className="login-modal-sub">{R("登入專屬檔案，同步保存你的打卡星星、金幣與學習進度！")}</p>
        </div>

        {!isAdding ? (
          <>
            <div className="learner-profiles-select-grid">
              {learners.map((l) => {
                const isActive = l.id === activeLearnerId;
                const curLvl = l.levelsProgress?.find((p) => p.status === "current")?.levelNumber || 1;
                const completedCount = l.levelsProgress?.filter((p) => p.status === "completed").length || 0;

                return (
                  <div
                    key={l.id}
                    className={`learner-select-tile ${isActive ? "is-active" : ""}`}
                    onClick={() => onSelectLearner(l.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="learner-tile-top-row">
                      <span className="learner-tile-avatar">{l.avatar}</span>
                      {learners.length > 1 && (
                        <button
                          type="button"
                          className="learner-tile-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLearner(l.id);
                          }}
                          title="刪除此學習者"
                          aria-label="刪除學習者"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <span className="learner-tile-name">{l.name}</span>
                    <span className="learner-tile-grade">
                      🎯 第 {curLvl} 關 · 已通關 {completedCount} 關
                    </span>

                    <div className="learner-tile-stats-row">
                      <span>🪙 {l.points?.coins || 0}</span>
                      <span>⭐ {l.points?.stars || 0}</span>
                      <span>⏱️ {l.totalMinutesLearned || 0}分</span>
                    </div>

                    {isActive && <span className="learner-tile-active-badge">當前使用中</span>}
                  </div>
                );
              })}

              <button
                type="button"
                className="learner-select-tile add-new-tile"
                onClick={() => setIsAdding(true)}
              >
                <span className="add-tile-plus">+</span>
                <span className="learner-tile-name">新增學習者</span>
                <small>建立全新學習檔案</small>
              </button>
            </div>

            {/* Google Drive User-Owned Cloud Sync Card */}
            <GoogleDriveSyncCard
              onSyncComplete={() => {
                setTimeout(() => {
                  window.location.reload();
                }, 400);
              }}
            />
          </>
        ) : (
          <form className="add-learner-form" onSubmit={handleCreate}>
            <div className="form-item">
              <label>小朋友姓名 / 暱稱：</label>
              <input
                type="text"
                className="learner-name-input"
                placeholder="例如：安安、小寶、Leo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={10}
                required
                autoFocus
              />
            </div>

            <div className="form-item">
              <label>選擇可愛代表動物：</label>
              <div className="avatar-palette">
                {avatarOptions.map((av) => (
                  <button
                    key={av}
                    type="button"
                    className={`avatar-choice-btn ${newAvatar === av ? "selected" : ""}`}
                    onClick={() => setNewAvatar(av)}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-item">
              <label>字體與拼讀偏好：</label>
              <div className="form-radio-pill-group">
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "dual" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("dual");
                    setNewPhonetic("zhuyin");
                  }}
                >
                  ✨ 繁簡雙軌
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "zhuyin" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("zhuyin");
                    setNewPhonetic("zhuyin");
                  }}
                >
                  🇹🇼 繁體注音
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "pinyin" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("pinyin");
                    setNewPhonetic("pinyin");
                  }}
                >
                  🔤 簡體拼音
                </button>
              </div>
            </div>

            <div className="form-item">
              <label>書寫習慣用手：</label>
              <div className="form-radio-pill-group">
                <button
                  type="button"
                  className={`radio-pill-btn ${newHand === "right" ? "active" : ""}`}
                  onClick={() => setNewHand("right")}
                >
                  ✋ 右手書寫
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newHand === "left" ? "active" : ""}`}
                  onClick={() => setNewHand("left")}
                >
                  🤚 左手書寫
                </button>
              </div>
            </div>

            <div className="form-actions-row">
              <button
                type="button"
                className="form-cancel-btn"
                onClick={() => setIsAdding(false)}
              >
                取消返回
              </button>
              <button
                type="submit"
                className="form-submit-btn"
                disabled={!newName.trim()}
              >
                🚀 立即開啟專屬學習檔案
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

