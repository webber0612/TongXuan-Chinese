import { describe, expect, it } from "vitest";
import { mergeSyncPayloads, type SyncPayload, type SyncedLearner } from "./merge";

const early = "2026-10-01T00:00:00.000Z";
const late = "2026-10-02T00:00:00.000Z";
const later = "2026-10-03T00:00:00.000Z";

function learner(id: string, status: "locked" | "current" | "completed", updatedAt = early, level = 1): SyncedLearner {
  return {
    id, name: id, avatar: "🐼", scriptMode: "dual", phoneticAssist: "zhuyin", handMode: "right",
    points: { coins: 10, stars: 2 }, levelsProgress: [], redemptions: [], totalMinutesLearned: 0, streakDays: 0,
    updatedAt,
    book1Progress: [{ levelNumber: level, status, completedAt: status === "completed" ? updatedAt : null, starsEarned: status === "completed" ? 3 : 0, score: status === "completed" ? 95 : null, masteryStatus: status === "completed" ? "PRACTICED" : "IN_PROGRESS", softUnlocked: status !== "locked", updatedAt }],
  };
}

function payload(learners: SyncedLearner[], updatedAt = early): SyncPayload {
  return { version: 2, schemaVersion: 1, updatedAt, learners, deletedLearnerIds: {}, activeLearnerId: learners[0]?.id || "", writingProgress: {}, rewardsCatalog: null, customRewardsCatalog: null, rewardsUpdatedAt: early, customRewardsUpdatedAt: early, displayLang: "zh-Hant", voiceGuide: false, preferencesUpdatedAt: early };
}

describe("per-record Drive merge", () => {
  it("keeps different completed levels from two devices", () => {
    const a = payload([learner("a", "completed", early, 1)]);
    const b = payload([learner("a", "completed", late, 2)], late);
    const levels = mergeSyncPayloads(a, b).learners[0].book1Progress!;
    expect(levels.map((item) => [item.levelNumber, item.status])).toEqual([[1, "completed"], [2, "completed"]]);
  });

  it("prefers completed status, higher stars/score, and earliest completion", () => {
    const a = payload([learner("a", "completed", early)]);
    const b = payload([learner("a", "current", late)], late);
    b.learners[0].book1Progress![0].score = 98;
    b.learners[0].book1Progress![0].starsEarned = 4;
    const result = mergeSyncPayloads(a, b).learners[0].book1Progress![0];
    expect(result).toMatchObject({ status: "completed", score: 98, starsEarned: 4, completedAt: early });
  });

  it("uses a later tombstone while retaining one-sided learners", () => {
    const a = payload([learner("a", "current"), learner("b", "current")]);
    const b = payload([]);
    b.deletedLearnerIds.a = late;
    expect(mergeSyncPayloads(a, b).learners.map((item) => item.id)).toEqual(["b"]);
    a.learners[0].updatedAt = later;
    expect(mergeSyncPayloads(a, b).learners.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("merges version 1 cloud records using its file timestamp", () => {
    const local = payload([learner("a", "current")]);
    const remote = { version: 1 as const, updatedAt: late, learners: [{ ...learner("a", "completed"), updatedAt: undefined, book1Progress: [{ ...learner("a", "completed").book1Progress![0], updatedAt: undefined }] }], writingProgress: {} };
    expect(mergeSyncPayloads(local, remote).learners[0].book1Progress![0].status).toBe("completed");
  });

  it("chooses newer writing retry state and newer balance/preference snapshots", () => {
    const a = payload([learner("a", "current")]);
    const b = payload([learner("a", "current", late)], late);
    a.writingProgress.x = { guidedSuccesses: 2, reducedHintSuccesses: 1, independentSuccesses: 1, independentFailures: 0, mastered: true, retryPending: false, updatedAt: early };
    b.writingProgress.x = { guidedSuccesses: 2, reducedHintSuccesses: 1, independentSuccesses: 1, independentFailures: 1, mastered: false, retryPending: true, updatedAt: late };
    b.learners[0].points.coins = 4;
    b.displayLang = "en";
    b.voiceGuide = true;
    b.preferencesUpdatedAt = late;
    const result = mergeSyncPayloads(a, b);
    expect(result.writingProgress.x.retryPending).toBe(true);
    expect(result.learners[0].points.coins).toBe(4);
    expect([result.displayLang, result.voiceGuide]).toEqual(["en", true]);
  });

  it("is idempotent and commutative", () => {
    const a = payload([learner("a", "completed", early), learner("b", "current")]);
    const b = payload([learner("a", "current", late), learner("c", "completed", late)], late);
    const merged = mergeSyncPayloads(a, b);
    expect(mergeSyncPayloads(merged, merged)).toEqual(merged);
    expect(mergeSyncPayloads(a, b)).toEqual(mergeSyncPayloads(b, a));
  });
});
