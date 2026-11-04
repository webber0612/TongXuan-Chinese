import { describe, expect, it } from "vitest";
import { alignBook1Progress, BOOK1_LEVELS, initialBook1Progress } from "./book1";

describe("book 1 levels", () => {
  it("builds stage 1 as four lessons followed by its checkpoint", () => {
    const stage1 = BOOK1_LEVELS.filter((level) => level.stageNumber === 1);
    expect(stage1.map((level) => [level.levelNumber, level.type, level.themeTitle])).toEqual([
      [1, "lesson", "你好"],
      [2, "lesson", "一二三"],
      [3, "lesson", "我七歲"],
      [4, "lesson", "我的家"],
      [5, "stage_quiz", "第 1 階段檢核"],
    ]);
    expect(stage1[4].quizScope).toEqual([1, 2, 3, 4]);
  });

  it("carries lesson text, writing marks and authored quizzes into each lesson", () => {
    const lesson1 = BOOK1_LEVELS[0];
    expect(lesson1.lessonText?.[0]).toMatchObject({ speaker: "A", text: "你好！" });
    expect(lesson1.characters.filter((item) => item.write).map((item) => item.char)).toEqual(["他", "好", "不"]);
    expect(lesson1.quizQuestions).toHaveLength(6);
    expect(BOOK1_LEVELS[4].quizQuestions?.length).toBe(8);
  });

  it("gives tone questions the matching zhuyin for every pinyin option", () => {
    const toneQuestion = BOOK1_LEVELS[0].quizQuestions!.find((item) => item.type === "char-tone")!;
    expect(toneQuestion.options.map((option) => [option.text, option.subText])).toEqual([
      ["hǎo", "ㄏㄠˇ"], ["hào", "ㄏㄠˋ"], ["háo", "ㄏㄠˊ"], ["hāo", "ㄏㄠ"],
    ]);
  });

  it("splits zhuyin tone marks the way the classroom expects", () => {
    const de = BOOK1_LEVELS[3].characters.find((item) => item.char === "的")!;
    expect([de.zhuyin, de.zhuyinTone]).toEqual(["˙ㄉㄜ", ""]);
    const ni = BOOK1_LEVELS[0].characters.find((item) => item.char === "你")!;
    expect([ni.zhuyin, ni.zhuyinTone]).toEqual(["ㄋㄧ", "ˇ"]);
  });
});

describe("book 1 progress", () => {
  it("opens only the first level for a new learner", () => {
    const progress = initialBook1Progress();
    expect(progress[0].status).toBe("current");
    expect(progress.slice(1).every((entry) => entry.status === "locked")).toBe(true);
  });

  it("keeps stored entries and opens the next level when new levels are appended later", () => {
    const short = BOOK1_LEVELS.slice(0, 2);
    const stored = initialBook1Progress(short).map((entry) => ({ ...entry, status: "completed" as const }));
    const aligned = alignBook1Progress(stored, BOOK1_LEVELS.slice(0, 4));
    expect(aligned.map((entry) => entry.status)).toEqual(["completed", "completed", "current", "locked"]);
  });
});
