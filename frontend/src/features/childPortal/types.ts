import {
type RedemptionRecord
} from "../../data/rewardsShopData";
import {
type LearnerLevelProgress
} from "../../data/learningPathData";

export type ValidatedDailyQueue = {
  childId: number;
  asOf: string;
  placementStart: "STARTER" | "BASIC" | "BOOK_1";
  review: {
    sourceQueue: "REVIEW";
    dueCount: number;
    items: Array<{ id: string; character: string; lessonId: string; dueAt: string }>;
  };
  newLesson: {
    sourceQueue: "CURRICULUM";
    lessonId: string;
    title: string;
    domains: string[];
    status: string;
    availableInLearningFlowV1: boolean;
  } | null;
  completedLesson?: {
    sourceQueue: "CURRICULUM";
    lessonId: string;
    title: string;
    domains: string[];
    status: string;
  } | null;
  currentLessonComplete?: boolean;
  nextLessonComingSoon?: boolean;
  nextAccessibleLesson: { lessonId: string; title: string; availableInLearningFlowV1?: boolean } | null;
  activeSession: { id: string; status: string } | null;
  schoolQueueSeparate: boolean;
  targetMinutes: number;
};

export type ScriptMode = "zhuyin" | "pinyin" | "dual";
export type DisplayLang = "zh-Hant" | "zh-Hans" | "en" | "ja" | "ko" | "es";
export type PhoneticAssist = "zhuyin" | "pinyin" | "off";
export type HandMode = "right" | "left";
export type SpeechSpeed = "normal" | "slow";

// Multi-language UI Dictionaries for the Child Portal and Parent Settings

export interface DailyIdiomInfo {
  idiomTitle: string;
  idiomZhuyin?: string;
  idiomPinyin: string;
  idiomMeaning: string;
  idiomIcon: string;
  storyContext?: string;
}

export interface VocabularyItem {
  word: string;
  wordHans?: string;
  zhuyin: string;
  pinyin: string;
  meaning: string;
  icon: string;
  exampleSentence: string;
}

export interface QuizQuestion {
  id: string;
  type: "listen-char" | "char-tone" | "img-vocab";
  title: string;
  prompt: string;
  audioText?: string;
  options: {
    text: string;
    subText?: string;
    isCorrect: boolean;
  }[];
  explanation: string;
}

export interface DailyDayPlan {
  dayId: string;
  dayName: string;
  dayEnglish: string;
  isToday: boolean;
  status: "completed" | "current" | "locked";
  starsEarned: number;
  hasKey: boolean;
  themeTitle: string;
  themeSubtitle: string;
  estimatedMinutes: number;
  characters: HanziItem[];
  vocabulary: VocabularyItem[];
  lessonStory: string[];
  idiom: DailyIdiomInfo;
  quizQuestions: QuizQuestion[];
}

export interface HanziItem {
  char: string;
  charHans: string;
  zhuyin: string;
  zhuyinTone: string;
  pinyin: string;
  meaning: string;
  radical: string;
  strokeCount: number;
  strokeCountHans?: number;
  illustrationIcon: string;
  exampleWord: string;
  exampleWordHans?: string;
  exampleSentence: string;
  exampleSentenceHans?: string;
  strokeOrderSteps?: string[];
}


export interface PinkyPromisePact {
  bonusCoins: number;
  requiredDays: number;
  currentDays: number;
  startDate: string;
  isCompleted: boolean;
  rewardClaimed: boolean;
}

export interface ChildLearner {
  id: string;
  name: string;
  avatar: string;
  role?: "learner" | "parent";
  scriptMode: ScriptMode;
  phoneticAssist: PhoneticAssist;
  handMode: HandMode;
  points: { coins: number; stars: number };
  levelsProgress: LearnerLevelProgress[];
  redemptions: RedemptionRecord[];
  totalMinutesLearned: number;
  streakDays: number;
  activePinkyPromise?: PinkyPromisePact | null;
  /** Local day (YYYY-MM-DD) of the last finished level; drives the day-based streak. */
  lastActiveDay?: string | null;
}

