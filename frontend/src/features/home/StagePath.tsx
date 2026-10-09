import { Check, ChevronLeft, ChevronRight, Flag, Lock, Star } from "lucide-react";
import type { HomeTranslate } from "./homeCopy";
import type { PathStop } from "./homeModel";

interface StagePathProps {
  stops: PathStop[];
  stageNumber: number;
  hasPrevStage: boolean;
  hasNextStage: boolean;
  selectedLevelNumber: number | null;
  summary: string;
  copy: HomeTranslate;
  onSelectLevel: (levelNumber: number) => void;
  onChangeStage: (delta: -1 | 1) => void;
}

export function StagePath({ stops, stageNumber, hasPrevStage, hasNextStage, selectedLevelNumber, summary, copy, onSelectLevel, onChangeStage }: StagePathProps) {
  return (
    <section className="tx-path" aria-labelledby="tx-path-title">
      <header className="tx-section-header">
        <div>
          <h2 id="tx-path-title" className="tx-section-title">{copy("pathTitle")}</h2>
          <p className="tx-section-note">{summary}</p>
        </div>
        <div className="tx-stage-switch">
          <button type="button" className="tx-icon-button" disabled={!hasPrevStage} onClick={() => onChangeStage(-1)} aria-label={copy("prevStage")}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="tx-stage-label" aria-live="polite">{copy("stageN", { n: stageNumber })}</span>
          <button type="button" className="tx-icon-button" disabled={!hasNextStage} onClick={() => onChangeStage(1)} aria-label={copy("nextStage")}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <ol className="tx-path-track">
        {stops.map(({ level, status, starsEarned }) => {
          const isLocked = status === "locked";
          const isQuiz = level.type !== "lesson";
          const statusLabel = status === "completed" ? copy("stopDone") : status === "current" ? copy("stopCurrent") : copy("stopLocked");
          return (
            <li key={level.levelId} className="tx-path-item">
              <button
                type="button"
                className={`tx-stop tx-stop-${status} ${isQuiz ? "tx-stop-quiz" : ""}`}
                disabled={isLocked}
                aria-pressed={selectedLevelNumber === level.levelNumber}
                aria-label={`${copy("levelN", { n: level.levelNumber })} ${level.themeTitle || level.title}，${statusLabel}`}
                onClick={() => onSelectLevel(level.levelNumber)}
              >
                <span className="tx-stop-badge" aria-hidden="true">
                  {status === "completed" ? <Check size={22} strokeWidth={3} /> : isLocked ? <Lock size={18} /> : isQuiz ? <Flag size={20} /> : level.levelNumber}
                </span>
                <span className="tx-stop-title">{isQuiz ? copy("quizStop") : level.themeTitle || level.title}</span>
                <span className="tx-stop-stars" aria-hidden="true">
                  {[1, 2, 3].map((slot) => (
                    <Star key={slot} size={12} fill={slot <= starsEarned ? "currentColor" : "none"} className={slot <= starsEarned ? "tx-star-on" : "tx-star-off"} />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
