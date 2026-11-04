// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_WRITING_PROGRESS } from "../adaptiveWriting";
import { appStorage, getLearners, getWritingProgress, migrate, SCHEMA_VERSION, setLearners, setWritingProgress, STORAGE_ERROR_KEY } from "./index";

const learner = {
  id: "child-1", name: "小安", avatar: "🐼", scriptMode: "dual" as const,
  phoneticAssist: "zhuyin" as const, handMode: "right" as const,
  points: { coins: 7, stars: 3 }, levelsProgress: [], redemptions: [],
  totalMinutesLearned: 2, streakDays: 1,
  book1Progress: [{ levelNumber: 1, status: "completed" as const, completedAt: "2026-10-01", starsEarned: 3, score: 95, masteryStatus: "PRACTICED" as const, softUnlocked: true }],
};

beforeEach(() => localStorage.clear());

describe("versioned local storage", () => {
  it("backs up and migrates unversioned progress without changing balances", () => {
    localStorage.setItem("tongxuan_learners_list", JSON.stringify([learner]));
    localStorage.setItem("tongxuan_writing_progress_v2", JSON.stringify({ "child-1::你::trad": EMPTY_WRITING_PROGRESS }));
    migrate();
    expect(localStorage.getItem("tongxuan_schema_version")).toBe(String(SCHEMA_VERSION));
    expect(JSON.parse(localStorage.getItem("tongxuan_backup_0")!).tongxuan_learners_list).toBe(JSON.stringify([learner]));
    expect(getLearners()[0].points).toEqual({ coins: 7, stars: 3 });
    expect(getLearners()[0].book1Progress?.[0].updatedAt).toBeTruthy();
    expect(getWritingProgress()["child-1::你::trad"].updatedAt).toBeTruthy();
  });

  it("records malformed JSON and missing required fields without throwing", () => {
    localStorage.setItem("tongxuan_learners_list", "{broken");
    expect(getLearners()).toEqual([]);
    localStorage.setItem("tongxuan_learners_list", JSON.stringify([{ name: "missing id" }]));
    expect(getLearners()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_ERROR_KEY)!)).toHaveLength(2);
  });

  it("repairs one incomplete level and preserves learner balances", () => {
    const incomplete = structuredClone(learner) as typeof learner;
    delete (incomplete.book1Progress[0] as { score?: number }).score;
    localStorage.setItem("tongxuan_learners_list", JSON.stringify([incomplete]));
    expect(getLearners()[0].points.coins).toBe(7);
    expect(getLearners()[0].book1Progress?.[0].score).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_ERROR_KEY)!).length).toBeGreaterThan(0);
  });

  it("drops only a learner without an id and keeps the other learner", () => {
    localStorage.setItem("tongxuan_learners_list", JSON.stringify([learner, { name: "壞資料" }]));
    expect(getLearners().map((entry) => entry.id)).toEqual(["child-1"]);
  });

  it("repairs one writing record without dropping valid records", () => {
    localStorage.setItem("tongxuan_writing_progress_v2", JSON.stringify({ good: EMPTY_WRITING_PROGRESS, broken: { mastered: true } }));
    expect(Object.keys(getWritingProgress())).toEqual(["good", "broken"]);
    expect(getWritingProgress().broken.guidedSuccesses).toBe(0);
  });

  it("backs up an unreadable old value before replacing it", () => {
    localStorage.setItem("tongxuan_learners_list", "{broken");
    setLearners([learner]);
    expect(localStorage.getItem("tongxuan_backup_unreadable_tongxuan_learners_list")).toBe("{broken");
    expect(getLearners()[0].id).toBe("child-1");
  });

  it("is idempotent and only stamps changed learner and writing records", () => {
    localStorage.setItem("tongxuan_learners_list", JSON.stringify([learner]));
    migrate();
    const once = localStorage.getItem("tongxuan_learners_list");
    const backup = localStorage.getItem("tongxuan_backup_0");
    migrate();
    expect(JSON.parse(localStorage.getItem("tongxuan_learners_list")!)).toEqual(JSON.parse(once!));
    expect(localStorage.getItem("tongxuan_backup_0")).toBe(backup);
    setLearners(getLearners());
    expect(JSON.parse(localStorage.getItem("tongxuan_learners_list")!)).toEqual(JSON.parse(once!));
    setLearners([{ ...getLearners()[0], points: { coins: 8, stars: 3 } }]);
    expect(getLearners()[0].points.coins).toBe(8);
    setWritingProgress({ a: EMPTY_WRITING_PROGRESS });
    const first = getWritingProgress().a.updatedAt;
    setWritingProgress(getWritingProgress());
    expect(getWritingProgress().a.updatedAt).toBe(first);
    expect(appStorage.getItem("tongxuan_voice_guide")).toBeNull();
  });
});
