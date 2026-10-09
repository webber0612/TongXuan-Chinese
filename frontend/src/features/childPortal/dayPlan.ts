import {
type CourseLevel,
type LearnerLevelProgress,generateQuizPaper
} from "../../data/learningPathData";

import { DailyDayPlan } from "./types";
export function courseLevelToDayPlan(level: CourseLevel, progress?: LearnerLevelProgress): DailyDayPlan {
  const isDone = progress?.status === "completed";
  const isCurrent = progress?.status === "current";
  return {
    dayId: level.levelId,
    dayName: level.title,
    dayEnglish: `Level ${level.levelNumber}`,
    isToday: isCurrent,
    status: progress?.status || "locked",
    starsEarned: progress?.starsEarned || 0,
    hasKey: isDone,
    themeTitle: level.themeTitle,
    themeSubtitle: level.themeSubtitle,
    estimatedMinutes: level.estimatedMinutes,
    characters: level.characters,
    vocabulary: level.vocabulary,
    lessonStory: level.lessonStory || [
      `歡迎來到${level.title}！本關卡聚焦於「${level.characters.map((c) => c.char).join("、")}」等生字學習與情境應用。`
    ],
    idiom: level.idiom || {
      idiomTitle: "循序漸進",
      idiomZhuyin: "ㄒㄩㄣˊ ㄒㄩˋ ㄐㄧㄢˋ ㄐㄧㄣˋ",
      idiomPinyin: "xún xù jiàn jìn",
      idiomMeaning: "按一定的順序、步驟逐漸進步與提高。",
      idiomIcon: "📖",
      storyContext: "學習中文就像爬樓梯，一步一步穩紮穩打，就能登上最高峰！"
    },
    quizQuestions: (level.quizQuestions && level.quizQuestions.length > 0)
      ? level.quizQuestions.map((q) => ({
          id: q.id,
          type: (q.type === "cloze-sentence" || q.type === "stroke-count" ? "listen-char" : q.type) as "listen-char" | "char-tone" | "img-vocab",
          title: q.title,
          prompt: q.prompt,
          audioText: q.audioText,
          options: q.options,
          explanation: q.explanation
        }))
      : generateQuizPaper(level).map((q) => ({
          id: q.id,
          type: (q.type === "cloze-sentence" || q.type === "stroke-count" ? "listen-char" : q.type) as "listen-char" | "char-tone" | "img-vocab",
          title: q.title,
          prompt: q.prompt,
          audioText: q.audioText,
          options: q.options,
          explanation: q.explanation
        }))
  };
}

