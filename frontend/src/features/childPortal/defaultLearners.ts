import {
getRedemptionHistory
} from "../../data/rewardsShopData";
import {
getLearnerLevelsProgress
} from "../../data/learningPathData";

import { ChildLearner } from "./types";
export const DEFAULT_LEARNERS: ChildLearner[] = [
  {
    id: "learner-1",
    name: "樂樂",
    avatar: "🐯",
    role: "learner",
    scriptMode: "dual",
    phoneticAssist: "zhuyin",
    handMode: "right",
    points: { coins: 180, stars: 16 },
    levelsProgress: getLearnerLevelsProgress(),
    redemptions: getRedemptionHistory(),
    totalMinutesLearned: 75,
    streakDays: 3,
    activePinkyPromise: null
  },
  {
    id: "learner-2",
    name: "萌萌",
    avatar: "🐰",
    role: "learner",
    scriptMode: "pinyin",
    phoneticAssist: "pinyin",
    handMode: "right",
    points: { coins: 120, stars: 9 },
    levelsProgress: getLearnerLevelsProgress(),
    redemptions: [],
    totalMinutesLearned: 45,
    streakDays: 2,
    activePinkyPromise: null
  }
];

