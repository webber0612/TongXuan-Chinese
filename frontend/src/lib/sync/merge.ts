import type { ChildLearner } from "../../features/childPortal/types";
import type { LearnerLevelProgress } from "../../data/learningPathData";
import type { WritingProgress } from "../adaptiveWriting";

const EPOCH = "1970-01-01T00:00:00.000Z";
type TimedLevel = LearnerLevelProgress & { updatedAt: string };
export type SyncedLearner = Omit<ChildLearner, "book1Progress" | "levelsProgress"> & {
  updatedAt: string;
  book1Progress?: TimedLevel[];
  levelsProgress: TimedLevel[];
};
export type SyncedWriting = WritingProgress & { updatedAt: string };

export type SyncPayload = {
  version: 2;
  schemaVersion: number;
  updatedAt: string;
  learners: SyncedLearner[];
  deletedLearnerIds: Record<string, string>;
  activeLearnerId: string;
  writingProgress: Record<string, SyncedWriting>;
  rewardsCatalog: unknown;
  customRewardsCatalog: unknown;
  rewardsUpdatedAt: string;
  customRewardsUpdatedAt: string;
  displayLang: string;
  voiceGuide: boolean;
  preferencesUpdatedAt: string;
};

export type LegacySyncPayload = Partial<Omit<SyncPayload, "version" | "learners" | "writingProgress">> & {
  version: 1;
  updatedAt?: string;
  learners?: unknown[];
  writingProgress?: Record<string, unknown>;
};

type Input = SyncPayload | LegacySyncPayload;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const time = (value: unknown, fallback = EPOCH): string => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
const later = (a: string, b: string): string => Date.parse(a) >= Date.parse(b) ? a : b;
const earlier = (a: string | null, b: string | null): string | null => a && b ? (Date.parse(a) <= Date.parse(b) ? a : b) : a || b;
const stable = (value: unknown): string => JSON.stringify(value) ?? "";
const pick = <T>(a: T, b: T, aTime: string, bTime: string): T => {
  const difference = Date.parse(aTime) - Date.parse(bTime);
  return difference > 0 ? a : difference < 0 ? b : stable(a) >= stable(b) ? a : b;
};
const pickPresent = (a: unknown, b: unknown, aTime: string, bTime: string): unknown => a === null ? b : b === null ? a : pick(a, b, aTime, bTime);
const rank = (status: string) => status === "completed" ? 2 : status === "current" ? 1 : 0;

function normalizeLevels(value: unknown, fallback: string): TimedLevel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => object(item) && typeof item.levelNumber === "number").map((item) => ({
    ...item as unknown as LearnerLevelProgress,
    updatedAt: time(item.updatedAt, fallback),
  }));
}

function normalizeLearners(value: unknown, fallback: string): SyncedLearner[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => object(item) && typeof item.id === "string").map((item) => {
    const { book1Progress, levelsProgress, ...rest } = item as unknown as ChildLearner;
    return {
      ...rest,
      updatedAt: time((item as Record<string, unknown>).updatedAt, fallback),
      levelsProgress: normalizeLevels(levelsProgress, fallback),
      ...(book1Progress === undefined ? {} : { book1Progress: normalizeLevels(book1Progress, fallback) }),
    };
  });
}

/** Version 1 records gain the file timestamp only as a best-effort legacy fallback. */
export function normalizeSyncPayload(input: Input): SyncPayload {
  const fallback = time(input.updatedAt);
  const writingProgress: Record<string, SyncedWriting> = {};
  if (object(input.writingProgress)) {
    for (const [key, value] of Object.entries(input.writingProgress)) {
      if (object(value)) writingProgress[key] = { ...value as WritingProgress, updatedAt: time(value.updatedAt, fallback) };
    }
  }
  const deletedLearnerIds: Record<string, string> = {};
  if (object(input.deletedLearnerIds)) for (const [id, deletedAt] of Object.entries(input.deletedLearnerIds)) deletedLearnerIds[id] = time(deletedAt, fallback);
  return {
    version: 2,
    schemaVersion: input.schemaVersion ?? 1,
    updatedAt: fallback,
    learners: normalizeLearners(input.learners, fallback),
    deletedLearnerIds,
    activeLearnerId: input.activeLearnerId || "",
    writingProgress,
    rewardsCatalog: input.rewardsCatalog ?? null,
    customRewardsCatalog: input.customRewardsCatalog ?? null,
    rewardsUpdatedAt: time(input.rewardsUpdatedAt, fallback),
    customRewardsUpdatedAt: time(input.customRewardsUpdatedAt, fallback),
    displayLang: input.displayLang || "zh-Hant",
    voiceGuide: input.voiceGuide === true,
    preferencesUpdatedAt: time(input.preferencesUpdatedAt, fallback),
  };
}

function mergeLevels(a: TimedLevel[], b: TimedLevel[]): TimedLevel[] {
  const byNumber = new Map<number, TimedLevel>();
  for (const item of [...a, ...b]) {
    const previous = byNumber.get(item.levelNumber);
    if (!previous) { byNumber.set(item.levelNumber, item); continue; }
    const stronger = rank(item.status) > rank(previous.status) ? item : rank(item.status) < rank(previous.status) ? previous : pick(previous, item, previous.updatedAt, item.updatedAt);
    byNumber.set(item.levelNumber, {
      ...stronger,
      status: stronger.status,
      starsEarned: Math.max(previous.starsEarned || 0, item.starsEarned || 0),
      score: previous.score === null ? item.score : item.score === null ? previous.score : Math.max(previous.score, item.score),
      completedAt: earlier(previous.completedAt, item.completedAt),
      softUnlocked: previous.softUnlocked || item.softUnlocked,
      updatedAt: later(previous.updatedAt, item.updatedAt),
    });
  }
  return [...byNumber.values()].sort((x, y) => x.levelNumber - y.levelNumber);
}

function mergeLearner(a: SyncedLearner, b: SyncedLearner): SyncedLearner {
  const base = pick(a, b, a.updatedAt, b.updatedAt);
  return {
    ...base,
    updatedAt: later(a.updatedAt, b.updatedAt),
    levelsProgress: mergeLevels(a.levelsProgress, b.levelsProgress),
    book1Progress: mergeLevels(a.book1Progress || [], b.book1Progress || []),
    // Balances are snapshots. Never add them; latest learner record wins.
    points: pick(a.points, b.points, a.updatedAt, b.updatedAt),
  };
}

/** Deterministic, side-effect-free merge of two device snapshots. */
export function mergeSyncPayloads(localInput: Input, remoteInput: Input): SyncPayload {
  const local = normalizeSyncPayload(localInput);
  const remote = normalizeSyncPayload(remoteInput);
  const deletedLearnerIds = { ...local.deletedLearnerIds };
  for (const [id, at] of Object.entries(remote.deletedLearnerIds)) deletedLearnerIds[id] = deletedLearnerIds[id] ? later(deletedLearnerIds[id], at) : at;
  const learnersById = new Map<string, SyncedLearner>();
  for (const learner of [...local.learners, ...remote.learners]) {
    const previous = learnersById.get(learner.id);
    learnersById.set(learner.id, previous ? mergeLearner(previous, learner) : learner);
  }
  const learners = [...learnersById.values()].filter((learner) => !deletedLearnerIds[learner.id] || Date.parse(deletedLearnerIds[learner.id]) <= Date.parse(learner.updatedAt)).sort((a, b) => a.id.localeCompare(b.id));
  const writingProgress = { ...local.writingProgress };
  for (const [key, value] of Object.entries(remote.writingProgress)) writingProgress[key] = writingProgress[key] ? pick(writingProgress[key], value, writingProgress[key].updatedAt, value.updatedAt) : value;
  const preference = pick(local, remote, local.preferencesUpdatedAt, remote.preferencesUpdatedAt);
  const preferredActive = pick(local, remote, local.updatedAt, remote.updatedAt).activeLearnerId;
  const activeLearnerId = learners.some((learner) => learner.id === preferredActive) ? preferredActive : learners[0]?.id || "";
  return {
    version: 2,
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    updatedAt: later(local.updatedAt, remote.updatedAt),
    learners,
    deletedLearnerIds,
    activeLearnerId,
    writingProgress: Object.fromEntries(Object.entries(writingProgress).sort(([a], [b]) => a.localeCompare(b))),
    rewardsCatalog: pickPresent(local.rewardsCatalog, remote.rewardsCatalog, local.rewardsUpdatedAt, remote.rewardsUpdatedAt),
    customRewardsCatalog: pickPresent(local.customRewardsCatalog, remote.customRewardsCatalog, local.customRewardsUpdatedAt, remote.customRewardsUpdatedAt),
    rewardsUpdatedAt: later(local.rewardsUpdatedAt, remote.rewardsUpdatedAt),
    customRewardsUpdatedAt: later(local.customRewardsUpdatedAt, remote.customRewardsUpdatedAt),
    displayLang: preference.displayLang,
    voiceGuide: preference.voiceGuide,
    preferencesUpdatedAt: later(local.preferencesUpdatedAt, remote.preferencesUpdatedAt),
  };
}
