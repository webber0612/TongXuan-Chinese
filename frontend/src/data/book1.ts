import type { CourseLevel, HanziCharItem, LearnerLevelProgress, QuizQuestionItem, VocabItem } from "./learningPathData";
export type { LessonLine } from "./learningPathData";
import { toneOptions } from "../lib/tones";

/** Book 1 (TBCL level 1) lessons, written in shared/curriculum/book1 and checked by scripts/curriculum_check.py. */

interface StageCharacter {
  char: string;
  charHans: string;
  zhuyin: string;
  pinyin: string;
  meaning: string;
  meaningEn: string;
  radical: string;
  strokes: number;
  strokesHans?: number;
  write: boolean;
}

interface StageWord { word: string; wordHans: string; zhuyin: string; pinyin: string; meaningEn: string }
interface StageLine { text: string; textHans: string; en?: string; speaker?: string }

type StageQuiz =
  | { type: "listen-char"; audio: string; answer: string; options: string[] }
  | { type: "char-tone"; char: string; answer: string; options: string[] }
  | { type: "cloze-sentence"; sentence: string; answer: string; options: string[] }
  | { type: "stroke-count"; char: string; answer: string; options: string[] };

interface StageLesson {
  lesson: number;
  title: string;
  goal: string;
  characters: StageCharacter[];
  words: StageWord[];
  sentences: StageLine[];
  dialogue: StageLine[];
  quiz: StageQuiz[];
}

interface StageFile {
  stage: number;
  title: string;
  lessons: StageLesson[];
  checkpoint?: { title: string; scope: number[]; quiz: StageQuiz[] };
}

const MINUTES_PER_LESSON = 15;
const MINUTES_PER_CHECKPOINT = 10;

/** Old data keeps the tone mark in a separate field; neutral-tone syllables keep their leading dot in the base. */
function splitZhuyin(zhuyin: string): { zhuyin: string; zhuyinTone: string } {
  const match = /^(.*?)([ˊˇˋ]?)$/.exec(zhuyin);
  return { zhuyin: match?.[1] ?? zhuyin, zhuyinTone: match?.[2] ?? "" };
}

function firstContaining(lines: StageLine[], needle: string): StageLine | undefined {
  return lines.find((line) => line.text.includes(needle));
}

function quizItem(item: StageQuiz, index: number, lesson: StageLesson | null, characters: Map<string, StageCharacter>): QuizQuestionItem {
  const id = `b1-${lesson?.lesson ?? "check"}-q${index + 1}`;
  if (item.type === "listen-char") {
    return {
      id, type: "listen-char", title: "聽音辨字", prompt: "聽一聽，選出聽到的字：", audioText: item.audio,
      options: item.options.map((text) => ({ text, subText: characters.get(text) ? `${characters.get(text)!.pinyin} / ${characters.get(text)!.zhuyin}` : undefined, isCorrect: text === item.answer })),
      explanation: `聽到的是「${item.answer}」。`,
    };
  }
  if (item.type === "char-tone") {
    const entry = characters.get(item.char);
    const zhuyinByPinyin = new Map(entry ? toneOptions(entry.pinyin, entry.zhuyin).map((option) => [option.pinyin, option.zhuyin]) : []);
    return {
      id, type: "char-tone", title: "選聲調", prompt: `「${item.char}」怎麼唸？`,
      options: item.options.map((text) => ({ text, subText: zhuyinByPinyin.get(text), isCorrect: text === item.answer })),
      explanation: `「${item.char}」唸 ${item.answer}${entry ? ` / ${entry.zhuyin}` : ""}。`,
    };
  }
  if (item.type === "cloze-sentence") {
    return {
      id, type: "cloze-sentence", title: "填填看", prompt: `空格裡要填哪個字？　${item.sentence}`,
      options: item.options.map((text) => ({ text, isCorrect: text === item.answer })),
      explanation: `答案是「${item.answer}」：${item.sentence.replace("＿＿", item.answer).replace("＿", item.answer)}`,
    };
  }
  return {
    id, type: "stroke-count", title: "數筆畫", prompt: `「${item.char}」有幾畫？`,
    options: item.options.map((text) => ({ text: `${text} 畫`, isCorrect: text === item.answer })),
    explanation: `「${item.char}」有 ${item.answer} 畫。`,
  };
}

function lessonLevel(lesson: StageLesson, stage: StageFile, levelNumber: number, characters: Map<string, StageCharacter>): CourseLevel {
  const lines = [...lesson.dialogue, ...lesson.sentences];
  const hanzi: HanziCharItem[] = lesson.characters.map((entry) => {
    const word = lesson.words.find((item) => item.word.includes(entry.char));
    const sentence = firstContaining(lines, entry.char);
    return {
      char: entry.char,
      charHans: entry.charHans,
      ...splitZhuyin(entry.zhuyin),
      pinyin: entry.pinyin,
      meaning: entry.meaning,
      radical: entry.radical,
      strokeCount: entry.strokes,
      strokeCountHans: entry.strokesHans,
      illustrationIcon: "",
      exampleWord: word?.word ?? entry.char,
      exampleWordHans: word?.wordHans,
      exampleSentence: sentence?.text ?? "",
      exampleSentenceHans: sentence?.textHans,
      write: entry.write,
    };
  });
  const vocabulary: VocabItem[] = lesson.words.map((word) => ({
    word: word.word,
    zhuyin: word.zhuyin,
    pinyin: word.pinyin,
    meaning: word.meaningEn,
    icon: "",
    exampleSentence: firstContaining(lines, word.word)?.text ?? "",
  }));
  return {
    levelNumber,
    levelId: `b1-l${String(lesson.lesson).padStart(2, "0")}`,
    stageNumber: stage.stage,
    type: "lesson",
    title: `第 ${lesson.lesson} 課 · ${lesson.title}`,
    themeTitle: lesson.title,
    themeSubtitle: lesson.goal,
    icon: "",
    estimatedMinutes: MINUTES_PER_LESSON,
    characters: hanzi,
    vocabulary,
    lessonStory: lines.map((line) => line.text),
    lessonText: lines,
    quizQuestions: lesson.quiz.map((item, index) => quizItem(item, index, lesson, characters)),
  };
}

function buildBook1(files: StageFile[]): CourseLevel[] {
  const characters = new Map(files.flatMap((file) => file.lessons.flatMap((lesson) => lesson.characters.map((entry): [string, StageCharacter] => [entry.char, entry]))));
  const levels: CourseLevel[] = [];
  for (const stage of [...files].sort((a, b) => a.stage - b.stage)) {
    const lessonLevels = stage.lessons.map((lesson) => lessonLevel(lesson, stage, levels.length + stage.lessons.indexOf(lesson) + 1, characters));
    levels.push(...lessonLevels);
    if (stage.checkpoint) {
      levels.push({
        levelNumber: levels.length + 1,
        levelId: `b1-s${stage.stage}-check`,
        stageNumber: stage.stage,
        type: "stage_quiz",
        title: stage.checkpoint.title,
        themeTitle: stage.checkpoint.title,
        themeSubtitle: `第 ${stage.stage} 階段「${stage.title}」總複習`,
        icon: "",
        estimatedMinutes: MINUTES_PER_CHECKPOINT,
        quizScope: lessonLevels.map((level) => level.levelNumber),
        characters: [],
        vocabulary: [],
        quizQuestions: stage.checkpoint.quiz.map((item, index) => quizItem(item, index, null, characters)),
      });
    }
  }
  return levels;
}

const stageModules = import.meta.glob<StageFile>("../../../shared/curriculum/book1/stage-*.json", { eager: true, import: "default" });

export const BOOK1_LEVELS: CourseLevel[] = buildBook1(Object.values(stageModules));

/** Citation readings of every taught character, under both its traditional and simplified form. */
export const BOOK1_READINGS: ReadonlyMap<string, { zhuyin: string; pinyin: string }> = new Map(
  Object.values(stageModules).flatMap((stage) => stage.lessons.flatMap((lesson) => lesson.characters.flatMap((entry) => {
    const reading = { zhuyin: entry.zhuyin, pinyin: entry.pinyin };
    return entry.charHans !== entry.char ? [[entry.char, reading], [entry.charHans, reading]] as const : [[entry.char, reading]] as const;
  }))),
);

/** Fresh progress: the first lesson open, everything else locked. Book 1 progress is stored apart from the old prototype levels. */
export function initialBook1Progress(levels: readonly CourseLevel[] = BOOK1_LEVELS): LearnerLevelProgress[] {
  return levels.map((level, index) => ({
    levelNumber: level.levelNumber,
    status: index === 0 ? "current" : "locked",
    completedAt: null,
    starsEarned: 0,
    score: null,
    masteryStatus: "NOT_STARTED",
    softUnlocked: index === 0,
  }));
}

/** Keeps stored progress aligned when new stages are added: existing entries stay, new levels arrive locked. */
export function alignBook1Progress(stored: readonly LearnerLevelProgress[] | undefined, levels: readonly CourseLevel[] = BOOK1_LEVELS): LearnerLevelProgress[] {
  const fresh = initialBook1Progress(levels);
  if (!stored || stored.length === 0) return fresh;
  const byNumber = new Map(stored.map((entry) => [entry.levelNumber, entry]));
  const aligned = fresh.map((entry) => byNumber.get(entry.levelNumber) ?? entry);
  // A level after the last completed one must be open, even if it was added after that completion.
  const firstOpen = aligned.findIndex((entry) => entry.status !== "completed");
  return firstOpen >= 0 && aligned[firstOpen].status === "locked"
    ? aligned.map((entry, index) => (index === firstOpen ? { ...entry, status: "current", softUnlocked: true } : entry))
    : aligned;
}
