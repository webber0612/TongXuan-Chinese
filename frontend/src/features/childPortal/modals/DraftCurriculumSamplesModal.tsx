import { useState,type ReactNode } from "react";
import {
ArrowRight,X
} from "lucide-react";
import { TONGXUAN_AUTHORED_DRAFT_VOLUMES,type AuthoredDraftVolume,type AuthoredDraftLesson } from "../../../data/ocacTextbooksData";

/* ========================================================
   2. Legacy authored draft samples retained for internal history
   ======================================================== */
export function DraftCurriculumSamplesModal({
  selectedVolumeNum,
  onSelectLesson,
  onClose,
  R
}: {
  selectedVolumeNum: number;
  onSelectLesson: (vol: AuthoredDraftVolume, lesson: AuthoredDraftLesson) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const [activeVol, setActiveVol] = useState<number>(selectedVolumeNum);
  const currVol = TONGXUAN_AUTHORED_DRAFT_VOLUMES.find((v) => v.volume === activeVol) || TONGXUAN_AUTHORED_DRAFT_VOLUMES[0];

  return (
    <div className="modal-backdrop">
      <div className="curriculum-hub-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="curriculum-hub-header">
          <div className="hub-badge-icon">📚</div>
          <div>
            <h2>桐軒自編示範素材（內部草稿）</h2>
            <p className="hub-sub">以下舊素材未逐課對照官方教材，僅保留作為內部草稿，不代表官方課程範圍。</p>
          </div>
        </div>

        {/* 10 Volume Tabs */}
        <div className="volume-tabs-scroller">
          {TONGXUAN_AUTHORED_DRAFT_VOLUMES.map((v) => (
            <button
              key={v.volume}
              className={`vol-tab-btn ${v.volume === activeVol ? "active" : ""}`}
              onClick={() => setActiveVol(v.volume)}
              style={{
                borderBottomColor: v.volume === activeVol ? v.colorTheme : "transparent"
              }}
            >
              <span className="vol-tab-icon">{v.badgeIcon}</span>
              <span className="vol-tab-title">示範 {v.volume}</span>
            </button>
          ))}
        </div>

        {/* Volume Detail Hero */}
        <div className="volume-detail-hero" style={{ borderLeftColor: currVol.colorTheme }}>
          <div className="vol-hero-main">
            <h3>{currVol.gradeName}</h3>
              <span className="vol-target-chip">INTERNAL DRAFT · {currVol.targetAudience}</span>
            <span className="vol-chars-count-chip">🀄 共 {currVol.totalChars} 生字</span>
          </div>
          <p className="vol-desc-text">{currVol.description}</p>
        </div>

        {/* Lessons Grid in this Volume */}
        <div className="volume-lessons-list">
          {currVol.lessons.length > 0 ? (
            currVol.lessons.map((lesson) => (
              <div key={lesson.lessonId} className="curriculum-lesson-card">
                <div className="lesson-card-header">
                  <span className="lesson-num-badge">第 {lesson.lessonNumber} 課</span>
                  <h4>{lesson.title}</h4>
                  <span className="lesson-theme-pill">{lesson.theme}</span>
                </div>

                <p className="lesson-subtitle-desc">{lesson.subtitle}</p>

                {/* Character reading cues */}
                <div className="lesson-chars-cue-row">
                  {lesson.characters.map((c) => (
                    <span key={c.char} className="lesson-char-cue-pill">
                      <b>{c.char}</b>
                      <small>{c.pinyin}</small>
                    </span>
                  ))}
                </div>

                <div className="lesson-action-bottom">
                  <button
                    className="launch-lesson-btn"
                    onClick={() => onSelectLesson(currVol, lesson)}
                  >
                    <span>✍️ 進入本課生字與閱讀</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-vol-state">
              <span>📖</span>
              <p>示範 {currVol.volume} 尚無課次樣本；可使用內部草稿字庫練習，已驗證課程請查看學習地圖。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

