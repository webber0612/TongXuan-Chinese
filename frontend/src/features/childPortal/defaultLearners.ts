import { getLearnerLevelsProgress } from "../../data/learningPathData";
import { detectRuntimeMode } from "../../lib/runtimeMode";
import type { ChildLearner } from "./types";

function blankLearner(id: string, name: string, avatar: string, usesPinyin: boolean): ChildLearner {
  return {
    id,
    name,
    avatar,
    role: "learner",
    scriptMode: usesPinyin ? "pinyin" : "dual",
    phoneticAssist: usesPinyin ? "pinyin" : "zhuyin",
    handMode: "right",
    // Every learner starts from zero; rewards are only ever earned.
    points: { coins: 0, stars: 0 },
    levelsProgress: getLearnerLevelsProgress(),
    redemptions: [],
    totalMinutesLearned: 0,
    streakDays: 0,
    lastActiveDay: null,
    activePinkyPromise: null,
  };
}

/**
 * Without a backend a family starts with one learner, named during onboarding.
 * The backend flow matches local learners to backend children by name, so it keeps its two seeds.
 */
export const DEFAULT_LEARNERS: ChildLearner[] = detectRuntimeMode() === "static"
  ? [blankLearner("learner-1", "小朋友", "🐼", false)]
  : [blankLearner("learner-1", "樂樂", "🐯", false), blankLearner("learner-2", "萌萌", "🐰", true)];
