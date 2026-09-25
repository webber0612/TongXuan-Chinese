import slice from "../../../shared/validated-curriculum-slice.json";

export type CurriculumDomain =
  | "listening"
  | "speaking"
  | "recognition"
  | "writing"
  | "reading"
  | "phonetics"
  | "pronunciation"
  | "vocabulary"
  | "grammar";

export type OfficialLesson = {
  id: string;
  number: number;
  official: {
    title: string;
    source: {
      kind: "OFFICIAL_OCAC";
      name: string;
      url: string;
      book: string;
      lesson: string;
      provenanceStatus: "VERIFIED_OFFICIAL_TITLE";
      licenseStatus: "PERMISSION_REQUIRED";
      commercialReady: false;
    };
  };
  tongxuan: {
    handbookSummary: {
      text: string;
      sourceUrl: string;
      authorship: "TONGXUAN_PARAPHRASE";
    };
    domains: CurriculumDomain[];
    practiceTargets: string[];
  };
};

export const officialCoursePath = {
  series: slice.series,
  provider: slice.provider,
  sourceUrl: slice.sourceUrl,
  canonicalHierarchy: slice.canonicalHierarchy,
  provenanceStatus: slice.provenanceDefaults.provenanceStatus,
  outOfScopeBooks: slice.outOfScopeBooks,
  stages: slice.stages.map((stage) => ({
    ...stage,
    notation: stage.notation as "ZHUYIN_PINYIN" | "BRIDGE" | "TEXTBOOK",
    contentStatus: "VALIDATED_SLICE" as const,
    sourceUrl: stage.sources[0].sourceUrl,
    lessons: stage.lessons.map((lesson) => {
      const source = stage.sources.find((entry) => entry.sourceBook === lesson.sourceBook)
        ?? stage.sources.find((entry) => entry.sourceBook.startsWith(lesson.sourceBook))
        ?? stage.sources[0];
      return {
        id: lesson.id,
        number: lesson.number,
        official: {
          title: lesson.title,
          source: {
            kind: "OFFICIAL_OCAC" as const,
            name: `${slice.series} · ${lesson.sourceBook}`,
            url: source.sourceUrl,
            book: lesson.sourceBook,
            lesson: `第${lesson.number}課`,
            provenanceStatus: "VERIFIED_OFFICIAL_TITLE" as const,
            licenseStatus: "PERMISSION_REQUIRED" as const,
            commercialReady: false as const,
          },
        },
        tongxuan: {
          handbookSummary: {
            text: lesson.officialObjectiveSummary,
            sourceUrl: lesson.objectiveSourceUrl,
            authorship: "TONGXUAN_PARAPHRASE" as const,
          },
          domains: lesson.domains as CurriculumDomain[],
          practiceTargets: lesson.practiceTargets,
        },
      } satisfies OfficialLesson;
    }),
  })),
} as const;

export const officialCourseSourceNote =
  "課程順序依官方《學華語向前走》：入門冊 → 基礎冊 → 第一冊。教師手冊目標以摘要記錄並連回原頁；第一冊本次只驗證前三課。資料庫不複製課文、音檔、圖片或練習；使用前仍須取得授權。";
