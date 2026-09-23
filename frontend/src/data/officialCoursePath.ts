export type CourseStage = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  notation: "ZHUYIN" | "PINYIN" | "BRIDGE" | "TEXTBOOK";
  sourceUrl: string;
  contentStatus: "PATH_CONFIRMED" | "LESSON_IMPORT_PENDING";
};

/**
 * The product path is anchored to the official HuayuWorld / OCAC series.
 * Exact lesson content is never invented here: it is imported only after its
 * source file and licence status have been recorded.
 */
export const officialCoursePath = {
  series: "學華語向前走",
  provider: "僑務委員會・華語文學習中心 HuayuWorld",
  sourceUrl: "https://www.huayuworld.org/Ebook/LearnMandarinChildren",
  provenanceStatus: "LICENSE_REVIEW_REQUIRED",
  stages: [
    {
      id: "starter",
      title: "入門冊：注音 → 漢語拼音",
      shortTitle: "入門冊",
      description: "官方入門內容先建立注音，再以相同內容銜接漢語拼音。",
      notation: "ZHUYIN",
      sourceUrl: "https://www.huayuworld.org/Ebook/LearnMandarinChildren",
      contentStatus: "PATH_CONFIRMED",
    },
    {
      id: "basic",
      title: "基礎冊：銜接正式課本",
      shortTitle: "基礎冊",
      description: "完成入門後，先用基礎冊銜接第一冊。",
      notation: "BRIDGE",
      sourceUrl: "https://www.huayuworld.org/Ebook/ebookDetail?EID=627",
      contentStatus: "PATH_CONFIRMED",
    },
    {
      id: "book-1a-lesson-1",
      title: "第一冊 A・第一課：你好",
      shortTitle: "第一課：你好",
      description: "官方第一冊 A 的第一個主題入口；精確教材內容待完成來源登錄後匯入。",
      notation: "TEXTBOOK",
      sourceUrl: "https://www.huayuworld.org/Ebook/ebookDetail?EID=629",
      contentStatus: "LESSON_IMPORT_PENDING",
    },
  ] satisfies CourseStage[],
} as const;

export const officialCourseSourceNote =
  "課程順序採官方《學華語向前走》：入門冊（注音先、同內容銜接拼音）→ 基礎冊 → 第一冊。教材文字與媒體需逐項完成來源及授權登錄後才會進入學習內容。";
