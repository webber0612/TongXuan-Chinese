import { describe, expect, it } from "vitest";
import type { CourseLevel, LearnerLevelProgress } from "../../data/learningPathData";
import {
  completeLevel,
  completedCount,
  currentLevelNumber,
  localDayKey,
  nextStreak,
  stageNumbers,
  stopsForStage,
  visibleStreak,
} from "./homeModel";

function level(levelNumber: number, stageNumber: number): CourseLevel {
  return {
    levelNumber,
    levelId: `level-${levelNumber}`,
    stageNumber,
    type: "lesson",
    title: `Level ${levelNumber}`,
    themeTitle: "",
    themeSubtitle: "",
    icon: "",
    estimatedMinutes: 20,
    characters: [],
    vocabulary: [],
  };
}

function entry(levelNumber: number, status: LearnerLevelProgress["status"], starsEarned = 0): LearnerLevelProgress {
  return { levelNumber, status, completedAt: null, starsEarned, score: null, masteryStatus: "NOT_STARTED", softUnlocked: status !== "locked" };
}

const levels = [level(1, 1), level(2, 1), level(3, 2)];

describe("streak", () => {
  it("starts at 1 on the first active day", () => {
    expect(nextStreak(0, null, "2026-10-10")).toBe(1);
  });

  it("does not grow when a second level is finished on the same day", () => {
    expect(nextStreak(3, "2026-10-10", "2026-10-10")).toBe(3);
  });

  it("grows by one on the following day, across a month boundary", () => {
    expect(nextStreak(3, "2026-09-30", "2026-10-01")).toBe(4);
  });

  it("restarts at 1 after a missed day", () => {
    expect(nextStreak(9, "2026-10-07", "2026-10-10")).toBe(1);
  });

  it("restarts at 1 when the stored day is unreadable", () => {
    expect(nextStreak(5, "not-a-date", "2026-10-10")).toBe(1);
  });

  it("shows the streak through the next day and hides it after a missed day", () => {
    expect(visibleStreak(4, "2026-10-09", "2026-10-10")).toBe(4);
    expect(visibleStreak(4, "2026-10-08", "2026-10-10")).toBe(0);
    expect(visibleStreak(4, null, "2026-10-10")).toBe(0);
  });

  it("formats a local day with zero padding", () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("path", () => {
  it("treats level 1 as current when no progress is stored", () => {
    expect(currentLevelNumber(levels, [])).toBe(1);
  });

  it("returns the first unfinished level", () => {
    expect(currentLevelNumber(levels, [entry(1, "completed"), entry(2, "current"), entry(3, "locked")])).toBe(2);
  });

  it("returns null when every level is finished", () => {
    expect(currentLevelNumber(levels, levels.map((item) => entry(item.levelNumber, "completed")))).toBeNull();
  });

  it("groups stops by stage with their status and stars", () => {
    const stops = stopsForStage(levels, [entry(1, "completed", 3), entry(2, "current")], 1);
    expect(stops.map((stop) => [stop.level.levelNumber, stop.status, stop.starsEarned])).toEqual([[1, "completed", 3], [2, "current", 0]]);
    expect(stageNumbers(levels)).toEqual([1, 2]);
    expect(completedCount(levels, [entry(1, "completed")])).toBe(1);
  });
});

describe("completeLevel", () => {
  const start = [entry(1, "current"), entry(2, "locked"), entry(3, "locked")];

  it("marks the level practised, unlocks the next one, and leaves the input untouched", () => {
    const result = completeLevel(start, 1, 2, null, "2026/10/10");
    expect(result.unlockedNext).toBe(true);
    expect(result.progress[0]).toMatchObject({ status: "completed", starsEarned: 2, masteryStatus: "PRACTICED", completedAt: "2026/10/10" });
    expect(result.progress[1].status).toBe("current");
    expect(result.progress[2].status).toBe("locked");
    expect(start[0].status).toBe("current");
  });

  it("keeps the best star count and an existing mastery state on replay", () => {
    const replay = [{ ...entry(1, "completed", 3), masteryStatus: "MASTERED" as const }, entry(2, "current")];
    const result = completeLevel(replay, 1, 1, 80, "2026/10/11");
    expect(result.unlockedNext).toBe(false);
    expect(result.progress[0]).toMatchObject({ starsEarned: 3, masteryStatus: "MASTERED", score: 80 });
  });
});
