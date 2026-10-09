import { type ReactNode } from "react";
import {
X
} from "lucide-react";

import { ChildLearner } from "../types";
/* ========================================================
   7. 我的成就與量化學習數據彈窗 (Learner Achievements Modal)
   - 累計時長、認識生字、詞彙、成語量化
   - 榮譽徽章牆 (初學啟航、妙筆生花、答題王者、全勤之星、榮譽狀元)
   ======================================================== */
export function LearnerAchievementsModal({
  learner,
  onClose,
  R,
  t
}: {
  learner: ChildLearner;
  onClose: () => void;
  R: (text: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const completedLevels = learner.levelsProgress?.filter((p) => p.status === "completed") || [];
  const completedCount = completedLevels.length;
  const currentLevelNum = learner.levelsProgress?.find((p) => p.status === "current")?.levelNumber || 1;
  const totalChars = completedCount * 6;
  const totalVocab = completedCount * 6;
  const totalIdioms = completedCount;
  const totalMinutes = learner.totalMinutesLearned || 0;
  const streak = learner.streakDays || 0;

  // Badges Definitions with unlock conditions
  const badges = [
    { id: "b1", icon: "🌅", name: t("badge1Name"), desc: t("badge1Desc"), isUnlocked: completedCount >= 1 },
    { id: "b2", icon: "✍️", name: t("badge2Name"), desc: t("badge2Desc"), isUnlocked: completedCount >= 5 },
    { id: "b3", icon: "📝", name: t("badge3Name"), desc: t("badge3Desc"), isUnlocked: completedCount >= 5 },
    { id: "b4", icon: "🔥", name: t("badge4Name"), desc: t("badge4Desc"), isUnlocked: streak >= 3 },
    { id: "b5", icon: "🤙", name: t("badge5Name"), desc: t("badge5Desc"), isUnlocked: learner.activePinkyPromise?.isCompleted === true || completedCount >= 10 },
    { id: "b6", icon: "🎁", name: t("badge6Name"), desc: t("badge6Desc"), isUnlocked: (learner.redemptions || []).some((r) => r.status === "claimed") },
    { id: "b7", icon: "👑", name: t("badge7Name"), desc: t("badge7Desc"), isUnlocked: completedCount >= 25 }
  ];

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  return (
    <div className="modal-backdrop">
      <div className="achievements-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="achievements-modal-header">
          <div className="achieve-hero-badge">
            <span className="achieve-avatar">{learner.avatar}</span>
            <span className="achieve-sparkle">🏆</span>
          </div>
          <div className="achieve-header-info">
            <h2>{learner.name} · {t("achievementsTitle")}</h2>
            <p>{t("achievementsSub")}</p>
          </div>
        </div>

        {/* Quantitative Metrics Grid */}
        <div className="achieve-metrics-grid">
          <div className="metric-item-card">
            <span className="metric-icon">⏱️</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalMinutes}</strong>
              <span className="metric-unit">{t("unitMinutes")}</span>
            </div>
            <span className="metric-label">{t("statMinutes")}</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🀄</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalChars}</strong>
              <span className="metric-unit">個</span>
            </div>
            <span className="metric-label">{t("statChars")}</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">📚</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalVocab}</strong>
              <span className="metric-unit">個</span>
            </div>
            <span className="metric-label">{t("statVocab")}</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">📖</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalIdioms}</strong>
              <span className="metric-unit">則</span>
            </div>
            <span className="metric-label">{t("statIdioms")}</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🎯</span>
            <div className="metric-text-group">
              <strong className="metric-num">{completedCount}</strong>
              <span className="metric-unit">/ 25 關</span>
            </div>
            <span className="metric-label">{t("statLevels")}</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🔥</span>
            <div className="metric-text-group">
              <strong className="metric-num">{streak}</strong>
              <span className="metric-unit">天</span>
            </div>
            <span className="metric-label">{t("statStreak")}</span>
          </div>
        </div>

        {/* Badges Wall Section */}
        <div className="achieve-badges-section">
          <div className="badges-header-row">
            <span className="badges-title">{t("badgeWallTitle")}（{t("badgeUnlockedCount", { current: unlockedCount, total: badges.length })}）</span>
          </div>

          <div className="badges-wall-grid">
            {badges.map((b) => (
              <div key={b.id} className={`badge-card-item ${b.isUnlocked ? "unlocked" : "locked"}`}>
                <div className="badge-icon-bubble">
                  {b.isUnlocked ? b.icon : "🔒"}
                </div>
                <strong className="badge-name">{b.name}</strong>
                <p className="badge-desc">{b.desc}</p>
                <span className={`badge-status-tag ${b.isUnlocked ? "unlocked" : "locked"}`}>
                  {b.isUnlocked ? t("badgeStatusUnlocked") : t("badgeStatusLocked")}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="achieve-footer-action">
          <button type="button" className="achieve-done-btn" onClick={onClose}>
            {t("achieveDoneBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}



