import type { ChildLearner } from "../../features/childPortal/types";
import type { LearnerLevelProgress } from "../../data/learningPathData";
import type { WritingProgress } from "../adaptiveWriting";

export const SCHEMA_VERSION = 1;
export const STORAGE_ERROR_KEY = "tongxuan_storage_errors";
const VERSION_KEY = "tongxuan_schema_version";
const LEGACY_TIME = "1970-01-01T00:00:00.000Z";

type StoredWriting = WritingProgress & { updatedAt: string };
type StoredLearner = Omit<ChildLearner, "book1Progress"> & { updatedAt: string; book1Progress?: Array<LearnerLevelProgress & { updatedAt: string }> };
type Validator = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const iso = (value: unknown): value is string => text(value) && !Number.isNaN(Date.parse(value));
const array = (value: unknown): value is unknown[] => Array.isArray(value);
const level = (value: unknown) => record(value) && number(value.levelNumber) && ["completed", "current", "locked"].includes(String(value.status)) && number(value.starsEarned) && (value.score === null || number(value.score)) && (value.completedAt === null || text(value.completedAt));
const learner = (value: unknown) => record(value) && text(value.id) && text(value.name) && record(value.points) && number(value.points.coins) && number(value.points.stars) && array(value.levelsProgress) && value.levelsProgress.every(level) && (value.book1Progress === undefined || (array(value.book1Progress) && value.book1Progress.every(level)));
const writing = (value: unknown) => record(value) && Object.values(value).every((entry) => record(entry) && number(entry.guidedSuccesses) && number(entry.reducedHintSuccesses) && number(entry.independentSuccesses) && number(entry.independentFailures) && typeof entry.mastered === "boolean");
const reward = (value: unknown) => record(value) && text(value.id) && text(value.name) && number(value.costCoins) && number(value.costStars);
const profile = (value: unknown) => record(value) && text(value.key) && text(value.name) && ["child", "parent"].includes(String(value.role));

const validators: Record<string, Validator> = {
  tongxuan_learners_list: (value) => array(value) && value.every(learner),
  tongxuan_writing_progress_v2: writing,
  tongxuan_expert_rewards_catalog: (value) => value === null || (array(value) && value.every(reward)),
  tongxuan_custom_rewards_catalog: (value) => array(value) && value.every(reward),
  tongxuan_levels_progress: (value) => array(value) && value.every(level),
  tongxuan_points_balance: (value) => record(value) && number(value.coins) && number(value.stars),
  tongxuan_redemptions_history: (value) => array(value) && value.every((item) => record(item) && text(item.id) && text(item.itemId)),
  "tongxuan.child-first.profiles": (value) => array(value) && value.every(profile),
  tongxuan_gdrive_auth: (value) => record(value) && text(value.accessToken) && text(value.email) && text(value.name) && number(value.expiresAt),
  tongxuan_deleted_learner_ids: (value) => record(value) && Object.values(value).every(iso),
  tongxuan_drive_sync_status: (value) => record(value) && ["idle", "syncing", "synced", "relink", "error"].includes(String(value.state)),
};
const stringValidators: Record<string, Validator> = {
  tongxuan_active_learner_id: text,
  tongxuan_display_lang: (v) => ["zh-Hant", "zh-Hans", "en", "ja", "ko", "es"].includes(String(v)),
  tongxuan_voice_guide: (v) => v === "true" || v === "false",
  tongxuan_onboarded: (v) => v === "true" || v === "false",
  tongxuan_hand_mode: (v) => v === "left" || v === "right",
  tongxuan_parent_pin: text,
  "tongxuan.child-first.active-profile": text,
  "tongxuan.display-language": (v) => ["zh-Hant", "zh-Hans", "en", "ja", "ko", "es"].includes(String(v)),
  "tongxuan.learning-locale": (v) => v === "zh-TW" || v === "zh-CN",
  "tongxuan.annotation-mode": (v) => ["AUTO", "BOPOMOFO", "PINYIN", "HIDDEN"].includes(String(v)),
  tongxuan_preferences_updated_at: iso,
  tongxuan_rewards_updated_at: iso,
  tongxuan_custom_rewards_updated_at: iso,
};

function backend(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function error(key: string, reason: string): void {
  const target = backend();
  if (!target) return;
  try {
    const previous = JSON.parse(target.getItem(STORAGE_ERROR_KEY) || "[]");
    const entries = Array.isArray(previous) ? previous : [];
    target.setItem(STORAGE_ERROR_KEY, JSON.stringify([...entries.slice(-49), { key, reason, at: new Date().toISOString() }]));
  } catch { /* Storage can be unavailable or full. */ }
}

function parse(key: string, raw: string): unknown | null {
  try {
    let value = JSON.parse(raw);
    if (key === "tongxuan_learners_list" && Array.isArray(value)) value = value.flatMap((item) => {
      if (!record(item) || !text(item.id)) { error(key, "discarded_record_missing_id"); return []; }
      const fillLevel = (entry: unknown) => {
        if (!record(entry)) { error(key, "repaired_invalid_level"); return null; }
        const repaired = { ...entry, status: ["completed", "current", "locked"].includes(String(entry.status)) ? entry.status : "locked", starsEarned: number(entry.starsEarned) ? entry.starsEarned : 0, score: entry.score === null || number(entry.score) ? entry.score : null, completedAt: entry.completedAt === null || text(entry.completedAt) ? entry.completedAt : null, updatedAt: iso(entry.updatedAt) ? entry.updatedAt : LEGACY_TIME };
        if (!level(entry)) error(key, "repaired_level_fields");
        return repaired;
      };
      const points = record(item.points) ? { coins: number(item.points.coins) ? item.points.coins : 0, stars: number(item.points.stars) ? item.points.stars : 0 } : { coins: 0, stars: 0 };
      if (!learner(item)) error(key, "repaired_learner_fields");
      return [{ ...item, name: text(item.name) ? item.name : "小朋友", points, levelsProgress: (Array.isArray(item.levelsProgress) ? item.levelsProgress : []).map(fillLevel).filter(Boolean), book1Progress: (Array.isArray(item.book1Progress) ? item.book1Progress : []).map(fillLevel).filter(Boolean) }];
    });
    if (key === "tongxuan_writing_progress_v2" && record(value)) value = Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
      if (!record(entry)) { error(key, "discarded_invalid_writing_record"); return []; }
      const repaired = { guidedSuccesses: 0, reducedHintSuccesses: 0, independentSuccesses: 0, independentFailures: 0, mastered: false, ...entry };
      if (!writing({ [id]: entry })) error(key, "repaired_writing_fields");
      return [[id, repaired]];
    }));
    if (!validators[key]?.(value) && !(key.startsWith("tongxuan_levels_progress:") && validators.tongxuan_levels_progress(value))) throw new Error("invalid_shape");
    return value;
  } catch (cause) { error(key, cause instanceof SyntaxError ? "invalid_json" : "invalid_shape"); return null; }
}

function stampLevels(next: unknown[], previous: unknown[], at: string): Array<LearnerLevelProgress & { updatedAt: string }> {
  return next.map((entry) => {
    const item = entry as LearnerLevelProgress & { updatedAt?: string };
    const old = previous.find((other) => record(other) && other.levelNumber === item.levelNumber) as (LearnerLevelProgress & { updatedAt?: string }) | undefined;
    const changed = !old || JSON.stringify({ ...old, updatedAt: undefined }) !== JSON.stringify({ ...item, updatedAt: undefined });
    return { ...item, updatedAt: changed ? at : (iso(old?.updatedAt) ? old.updatedAt : LEGACY_TIME) };
  });
}

function stampLearners(next: unknown[], previous: unknown[], at: string): StoredLearner[] {
  return next.map((entry) => {
    const item = entry as ChildLearner & { updatedAt?: string };
    const old = previous.find((other) => record(other) && other.id === item.id) as (ChildLearner & { updatedAt?: string }) | undefined;
    const book1Progress = item.book1Progress ? stampLevels(item.book1Progress, old?.book1Progress || [], at) : undefined;
    const { book1Progress: _oldProgress, ...rest } = item;
    const current = { ...rest, ...(book1Progress ? { book1Progress } : {}) };
    const changed = !old || JSON.stringify({ ...old, updatedAt: undefined, book1Progress: old.book1Progress?.map((p) => ({ ...p, updatedAt: undefined })) }) !== JSON.stringify({ ...current, updatedAt: undefined, book1Progress: book1Progress?.map((p) => ({ ...p, updatedAt: undefined })) });
    return { ...current, updatedAt: changed ? at : (iso(old?.updatedAt) ? old.updatedAt : LEGACY_TIME) };
  });
}

function stampWriting(next: Record<string, unknown>, previous: Record<string, unknown>, at: string): Record<string, StoredWriting> {
  return Object.fromEntries(Object.entries(next).map(([key, value]) => {
    const old = previous[key] as StoredWriting | undefined;
    const item = value as StoredWriting;
    const changed = !old || JSON.stringify({ ...old, updatedAt: undefined }) !== JSON.stringify({ ...item, updatedAt: undefined });
    return [key, { ...item, updatedAt: changed ? at : (iso(old?.updatedAt) ? old.updatedAt : LEGACY_TIME) }];
  }));
}

/** Compatibility facade: all browser storage reads and writes pass through validation here. */
export const appStorage = {
  getItem(key: string): string | null {
    const target = backend();
    const raw = target?.getItem(key) ?? null;
    if (raw === null) return null;
    if (validators[key] || key.startsWith("tongxuan_levels_progress:")) {
      const value = parse(key, raw);
      if (value === null) return null;
      const repaired = JSON.stringify(value);
      if (repaired !== raw) { try { target?.setItem(key, repaired); } catch { error(key, "repair_write_failed"); } }
      return repaired;
    }
    if (stringValidators[key] && !stringValidators[key](raw)) { error(key, "invalid_shape"); return null; }
    return raw;
  },
  setItem(key: string, raw: string): void {
    const target = backend();
    if (!target) return;
    try {
      if (validators[key] || key.startsWith("tongxuan_levels_progress:")) {
        const next = parse(key, raw);
        if (next === null) return;
        const previousRaw = target.getItem(key);
        const previous = previousRaw ? parse(key, previousRaw) : null;
        if (previousRaw !== null && previous === null) target.setItem(`tongxuan_backup_unreadable_${key}`, previousRaw);
        const at = new Date().toISOString();
        if (key === "tongxuan_learners_list") raw = JSON.stringify(stampLearners(next as unknown[], (previous as unknown[]) || [], at));
        if (key === "tongxuan_writing_progress_v2") raw = JSON.stringify(stampWriting(next as Record<string, unknown>, (previous as Record<string, unknown>) || {}, at));
      } else if (stringValidators[key] && !stringValidators[key](raw)) { error(key, "invalid_shape"); return; }
      const changed = target.getItem(key) !== raw;
      target.setItem(key, raw);
      if (changed) {
        const timestampKey = key === "tongxuan_display_lang" || key === "tongxuan_voice_guide" ? "tongxuan_preferences_updated_at"
          : key === "tongxuan_expert_rewards_catalog" ? "tongxuan_rewards_updated_at"
          : key === "tongxuan_custom_rewards_catalog" ? "tongxuan_custom_rewards_updated_at" : null;
        if (timestampKey) target.setItem(timestampKey, new Date().toISOString());
      }
    } catch { error(key, "write_failed"); }
  },
  /** Persist a validated merged snapshot without replacing its per-record timestamps. */
  setSyncedItem(key: string, raw: string): void {
    const target = backend();
    if (!target) return;
    try {
      if (validators[key] || key.startsWith("tongxuan_levels_progress:")) {
        if (parse(key, raw) === null) return;
      } else if (stringValidators[key] && !stringValidators[key](raw)) { error(key, "invalid_shape"); return; }
      target.setItem(key, raw);
    } catch { error(key, "write_failed"); }
  },
  removeItem(key: string): void { try { backend()?.removeItem(key); } catch { error(key, "remove_failed"); } },
};

/** Per-key typed accessors for new code; older callers use the validated facade above. */
export const getLearners = (): StoredLearner[] => JSON.parse(appStorage.getItem("tongxuan_learners_list") || "[]") as StoredLearner[];
export const setLearners = (value: ChildLearner[]): void => appStorage.setItem("tongxuan_learners_list", JSON.stringify(value));
export const getWritingProgress = (): Record<string, StoredWriting> => JSON.parse(appStorage.getItem("tongxuan_writing_progress_v2") || "{}") as Record<string, StoredWriting>;
export const setWritingProgress = (value: Record<string, WritingProgress>): void => appStorage.setItem("tongxuan_writing_progress_v2", JSON.stringify(value));
export const getActiveLearnerId = (): string => appStorage.getItem("tongxuan_active_learner_id") || "learner-1";
export const setActiveLearnerId = (value: string): void => appStorage.setItem("tongxuan_active_learner_id", value);
export const getDisplayLanguage = (): string => appStorage.getItem("tongxuan_display_lang") || "zh-Hant";
export const setDisplayLanguage = (value: string): void => appStorage.setItem("tongxuan_display_lang", value);
export const getVoiceGuide = (): boolean => appStorage.getItem("tongxuan_voice_guide") === "true";
export const setVoiceGuide = (value: boolean): void => appStorage.setItem("tongxuan_voice_guide", String(value));
export const getOnboarded = (): boolean => appStorage.getItem("tongxuan_onboarded") === "true";
export const setOnboarded = (value: boolean): void => appStorage.setItem("tongxuan_onboarded", String(value));
export const getHandMode = (): "left" | "right" => appStorage.getItem("tongxuan_hand_mode") === "left" ? "left" : "right";
export const setHandMode = (value: "left" | "right"): void => appStorage.setItem("tongxuan_hand_mode", value);
export const getParentPin = (): string => appStorage.getItem("tongxuan_parent_pin") || "8888";
export const setParentPin = (value: string): void => appStorage.setItem("tongxuan_parent_pin", value);
export const getPointsBalance = (): { coins: number; stars: number } => JSON.parse(appStorage.getItem("tongxuan_points_balance") || '{"coins":180,"stars":16}') as { coins: number; stars: number };
export const setPointsBalance = (value: { coins: number; stars: number }): void => appStorage.setItem("tongxuan_points_balance", JSON.stringify(value));
export const getLevelProgress = (learnerId?: string): LearnerLevelProgress[] => JSON.parse(appStorage.getItem(learnerId ? `tongxuan_levels_progress:${learnerId}` : "tongxuan_levels_progress") || "[]") as LearnerLevelProgress[];
export const setLevelProgress = (value: LearnerLevelProgress[], learnerId?: string): void => appStorage.setItem(learnerId ? `tongxuan_levels_progress:${learnerId}` : "tongxuan_levels_progress", JSON.stringify(value));
export const getRedemptions = <T>(): T[] => JSON.parse(appStorage.getItem("tongxuan_redemptions_history") || "[]") as T[];
export const setRedemptions = <T>(value: T[]): void => appStorage.setItem("tongxuan_redemptions_history", JSON.stringify(value));
export const getRewardsCatalog = <T>(kind: "expert" | "custom"): T[] => JSON.parse(appStorage.getItem(`tongxuan_${kind}_rewards_catalog`) || "[]") as T[];
export const setRewardsCatalog = <T>(kind: "expert" | "custom", value: T[]): void => appStorage.setItem(`tongxuan_${kind}_rewards_catalog`, JSON.stringify(value));
export const getActiveProfile = (): string => appStorage.getItem("tongxuan.child-first.active-profile") || "child-a";
export const setActiveProfile = (value: string): void => appStorage.setItem("tongxuan.child-first.active-profile", value);
export const getProfiles = <T>(): T[] => JSON.parse(appStorage.getItem("tongxuan.child-first.profiles") || "[]") as T[];
export const setProfiles = <T>(value: T[]): void => appStorage.setItem("tongxuan.child-first.profiles", JSON.stringify(value));
export const getLearningLocale = (): "zh-TW" | "zh-CN" => appStorage.getItem("tongxuan.learning-locale") === "zh-CN" ? "zh-CN" : "zh-TW";
export const setLearningLocale = (value: "zh-TW" | "zh-CN"): void => appStorage.setItem("tongxuan.learning-locale", value);
export const getAnnotationMode = (): "AUTO" | "BOPOMOFO" | "PINYIN" | "HIDDEN" => (appStorage.getItem("tongxuan.annotation-mode") || "AUTO") as "AUTO" | "BOPOMOFO" | "PINYIN" | "HIDDEN";
export const setAnnotationMode = (value: "AUTO" | "BOPOMOFO" | "PINYIN" | "HIDDEN"): void => appStorage.setItem("tongxuan.annotation-mode", value);
export const getDeletedLearnerIds = (): Record<string, string> => JSON.parse(appStorage.getItem("tongxuan_deleted_learner_ids") || "{}") as Record<string, string>;
export const setDeletedLearnerIds = (value: Record<string, string>): void => appStorage.setItem("tongxuan_deleted_learner_ids", JSON.stringify(value));

export function migrate(): void {
  const target = backend();
  if (!target || target.getItem(VERSION_KEY) === String(SCHEMA_VERSION)) return;
  const oldVersion = target.getItem(VERSION_KEY) || "0";
  const snapshot: Record<string, string> = {};
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key?.startsWith("tongxuan") && !key.startsWith("tongxuan_backup_") && key !== STORAGE_ERROR_KEY) snapshot[key] = target.getItem(key) || "";
  }
  try {
    target.setItem(`tongxuan_backup_${oldVersion}`, JSON.stringify(snapshot));
    for (const key of ["tongxuan_learners_list", "tongxuan_writing_progress_v2"]) {
      const raw = target.getItem(key);
      if (raw) {
        const value = parse(key, raw);
        if (value !== null) {
          const at = LEGACY_TIME;
          target.setItem(key, JSON.stringify(key === "tongxuan_learners_list" ? stampLearners(value as unknown[], value as unknown[], at) : stampWriting(value as Record<string, unknown>, value as Record<string, unknown>, at)));
        }
      }
    }
    target.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  } catch { error(VERSION_KEY, "migration_failed"); }
}
