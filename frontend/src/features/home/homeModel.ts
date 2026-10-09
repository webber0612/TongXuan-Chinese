import type { CourseLevel, LearnerLevelProgress } from "../../data/learningPathData";

export type LevelStatus = LearnerLevelProgress["status"];

export interface PathStop {
  level: CourseLevel;
  status: LevelStatus;
  starsEarned: number;
}

const MS_PER_DAY = 86_400_000;

/** Local calendar day as YYYY-MM-DD, so a streak follows the child's own clock. */
export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayNumber(dayKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY);
}

/**
 * A streak counts days, not finished levels: a second level on the same day keeps it,
 * the next day extends it, and any gap restarts it at 1.
 */
export function nextStreak(previousStreak: number, lastActiveDay: string | null | undefined, today: string): number {
  const todayNumber = dayNumber(today);
  const lastNumber = lastActiveDay ? dayNumber(lastActiveDay) : null;
  if (todayNumber === null || lastNumber === null) return 1;
  const gap = todayNumber - lastNumber;
  if (gap === 0) return Math.max(1, previousStreak);
  if (gap === 1) return Math.max(0, previousStreak) + 1;
  return 1;
}

/** The streak to display: it lapses once a full day has been missed. */
export function visibleStreak(streak: number, lastActiveDay: string | null | undefined, today: string): number {
  const todayNumber = dayNumber(today);
  const lastNumber = lastActiveDay ? dayNumber(lastActiveDay) : null;
  if (todayNumber === null || lastNumber === null) return 0;
  return todayNumber - lastNumber <= 1 ? Math.max(0, streak) : 0;
}

export function statusOf(progress: readonly LearnerLevelProgress[], levelNumber: number): LevelStatus {
  const entry = progress.find((item) => item.levelNumber === levelNumber);
  if (entry) return entry.status;
  return levelNumber === 1 ? "current" : "locked";
}

/** The first level the learner has not finished; null once every level is done. */
export function currentLevelNumber(levels: readonly CourseLevel[], progress: readonly LearnerLevelProgress[]): number | null {
  const next = levels.find((level) => statusOf(progress, level.levelNumber) !== "completed");
  return next ? next.levelNumber : null;
}

export function stopsForStage(
  levels: readonly CourseLevel[],
  progress: readonly LearnerLevelProgress[],
  stageNumber: number,
): PathStop[] {
  return levels
    .filter((level) => level.stageNumber === stageNumber)
    .map((level) => ({
      level,
      status: statusOf(progress, level.levelNumber),
      starsEarned: progress.find((item) => item.levelNumber === level.levelNumber)?.starsEarned ?? 0,
    }));
}

export function stageNumbers(levels: readonly CourseLevel[]): number[] {
  return [...new Set(levels.map((level) => level.stageNumber))].sort((a, b) => a - b);
}

export function completedCount(levels: readonly CourseLevel[], progress: readonly LearnerLevelProgress[]): number {
  return levels.filter((level) => statusOf(progress, level.levelNumber) === "completed").length;
}

/**
 * Marks one level as practised and unlocks the following one. Completion records
 * practice only; it never asserts mastery.
 */
export function completeLevel(
  progress: readonly LearnerLevelProgress[],
  levelNumber: number,
  earnedStars: number,
  quizScore: number | null,
  completedAt: string,
): { progress: LearnerLevelProgress[]; unlockedNext: boolean } {
  let unlockedNext = false;
  const updated = progress.map((item) => {
    if (item.levelNumber === levelNumber) {
      return {
        ...item,
        status: "completed" as const,
        completedAt,
        starsEarned: Math.max(item.starsEarned, earnedStars),
        score: quizScore !== null ? quizScore : item.score,
        masteryStatus: item.masteryStatus === "MASTERED" ? ("MASTERED" as const) : ("PRACTICED" as const),
        softUnlocked: true,
      };
    }
    if (item.levelNumber === levelNumber + 1 && item.status === "locked") {
      unlockedNext = true;
      return { ...item, status: "current" as const, softUnlocked: true };
    }
    return item;
  });
  return { progress: updated, unlockedNext };
}
