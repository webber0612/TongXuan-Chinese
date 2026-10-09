import { useState } from "react";
import { Flame, Star } from "lucide-react";
import appLogoIcon from "../../assets/app-logo-icon.png";
import type { CourseLevel } from "../../data/learningPathData";
import type { ChildLearner, DisplayLang, ScriptMode } from "../childPortal/types";
import { DialogueSheet } from "./DialogueSheet";
import type { DialogueLesson } from "./dialogueLessons";
import { homeTranslator } from "./homeCopy";
import { completedCount, currentLevelNumber, stageNumbers, statusOf, stopsForStage, visibleStreak } from "./homeModel";
import { LevelContents } from "./LevelContents";
import { ModeCards, type ModeKey } from "./ModeCards";
import { StagePath } from "./StagePath";
import { TodayHero } from "./TodayHero";

type ClassroomMode = "char" | "vocab" | "idiom";

export interface HomeScreenProps {
  learner: ChildLearner;
  levels: readonly CourseLevel[];
  today: string;
  displayLang: DisplayLang;
  scriptMode: ScriptMode;
  selectedLevelNumber: number;
  dialogueLessons: DialogueLesson[];
  dialogueDone: string[];
  isDarkEyeCare: boolean;
  onSelectLevel: (levelNumber: number) => void;
  onStartLevel: (level: CourseLevel, mode: ClassroomMode) => void;
  onStartQuiz: (level: CourseLevel) => void;
  onOpenDialogueLesson: (lessonId: string) => void;
  onOpenMenu: () => void;
  onOpenAbout: () => void;
  onFeedback: () => void;
  onSupport: () => void;
}

const FEEDBACK_URL = "mailto:webber0612@gmail.com?subject=%E3%80%90%E6%A1%90%E8%BB%92%E4%B8%AD%E6%96%87%E3%80%91%E5%95%8F%E9%A1%8C%E5%9B%9E%E5%A0%B1";
const SUPPORT_URL = "https://buymeacoffee.com/webber0612";

export function HomeScreen(props: HomeScreenProps) {
  const { learner, levels, scriptMode } = props;
  const copy = homeTranslator(props.displayLang);
  const progress = learner.levelsProgress ?? [];
  const todayLevelNumber = currentLevelNumber(levels, progress);
  const selectedLevel = levels.find((level) => level.levelNumber === props.selectedLevelNumber) ?? null;
  const todayLevel = levels.find((level) => level.levelNumber === todayLevelNumber) ?? null;
  const heroLevel = selectedLevel && statusOf(progress, selectedLevel.levelNumber) !== "locked" ? selectedLevel : todayLevel;
  // Once every level is finished there is no "today"; celebrate until the child picks a level to replay.
  const [hasPickedLevel, setHasPickedLevel] = useState(false);
  const showAllDone = todayLevelNumber === null && !hasPickedLevel;

  const stages = stageNumbers(levels);
  const [stageNumber, setStageNumber] = useState<number>(() => heroLevel?.stageNumber ?? stages[0] ?? 1);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const stageIndex = stages.indexOf(stageNumber);
  const streak = visibleStreak(learner.streakDays ?? 0, learner.lastActiveDay, props.today);

  const startHeroLevel = () => {
    if (!heroLevel) return;
    if (heroLevel.type === "lesson") props.onStartLevel(heroLevel, "char");
    else props.onStartQuiz(heroLevel);
  };

  const openMode = (mode: ModeKey) => {
    if (mode === "dialogue") { setDialogueOpen(true); return; }
    if (heroLevel && heroLevel.type === "lesson") props.onStartLevel(heroLevel, mode === "chars" ? "char" : "vocab");
  };

  const goToToday = () => {
    if (todayLevelNumber === null) return;
    props.onSelectLevel(todayLevelNumber);
    const level = levels.find((item) => item.levelNumber === todayLevelNumber);
    if (level) setStageNumber(level.stageNumber);
  };

  return (
    <div className={`tx-scope tx-home ${props.isDarkEyeCare ? "tx-home-dim" : ""}`}>
      <header className="tx-topbar">
        <div className="tx-brand">
          <img src={appLogoIcon} alt="" width={44} height={44} />
          <span className="tx-brand-name">桐軒中文</span>
        </div>
        <div className="tx-topbar-stats">
          <span className="tx-stat tx-stat-streak" role="img" aria-label={copy("streakAria", { n: streak })}>
            <Flame size={20} aria-hidden="true" /><b>{streak}</b>
          </span>
          <span className="tx-stat tx-stat-stars" role="img" aria-label={copy("starsAria", { n: learner.points?.stars ?? 0 })}>
            <Star size={20} fill="currentColor" aria-hidden="true" /><b>{learner.points?.stars ?? 0}</b>
          </span>
          <button type="button" className="tx-avatar-button" onClick={props.onOpenMenu} aria-label={copy("menuOpen")} aria-haspopup="dialog">
            <span className="tx-avatar" aria-hidden="true">{learner.avatar}</span>
            <span className="tx-avatar-name">{learner.name}</span>
          </button>
        </div>
      </header>

      <main className="tx-main">
        <TodayHero
          learnerName={learner.name}
          level={showAllDone ? null : heroLevel}
          status={heroLevel ? statusOf(progress, heroLevel.levelNumber) : "locked"}
          isToday={heroLevel !== null && heroLevel.levelNumber === todayLevelNumber}
          scriptMode={scriptMode}
          copy={copy}
          onStart={startHeroLevel}
          onBackToToday={goToToday}
        />

        <StagePath
          stops={stopsForStage(levels, progress, stageNumber)}
          stageNumber={stageNumber}
          hasPrevStage={stageIndex > 0}
          hasNextStage={stageIndex >= 0 && stageIndex < stages.length - 1}
          selectedLevelNumber={heroLevel?.levelNumber ?? null}
          summary={copy("progressSummary", { done: completedCount(levels, progress), total: levels.length })}
          copy={copy}
          onSelectLevel={(levelNumber) => { setHasPickedLevel(true); props.onSelectLevel(levelNumber); }}
          onChangeStage={(delta) => setStageNumber(stages[Math.min(stages.length - 1, Math.max(0, stageIndex + delta))])}
        />

        <ModeCards copy={copy} charsDisabled={!heroLevel || heroLevel.type !== "lesson"} onOpen={openMode} />

        {heroLevel && heroLevel.type === "lesson" && (
          <LevelContents level={heroLevel} scriptMode={scriptMode} copy={copy} onOpen={(mode) => props.onStartLevel(heroLevel, mode)} />
        )}
      </main>

      <footer className="tx-footer">
        <a href={FEEDBACK_URL} onClick={props.onFeedback}>{copy("feedback")}</a>
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" onClick={props.onSupport}>{copy("support")}</a>
        <button type="button" onClick={props.onOpenAbout}>{copy("disclaimer")}</button>
      </footer>

      {dialogueOpen && (
        <DialogueSheet
          lessons={props.dialogueLessons}
          doneLessonIds={props.dialogueDone}
          copy={copy}
          onOpenLesson={props.onOpenDialogueLesson}
          onClose={() => setDialogueOpen(false)}
        />
      )}
    </div>
  );
}
