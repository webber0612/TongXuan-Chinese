import type {
  LessonPackage,
  PedagogyMode,
  LessonStepDefinition,
  ScaffoldVisibilityMode,
  ContentReviewStatus,
} from "../../../shared/lessonPackageSchema";

import book1L01Json from "../../../shared/lesson-packages/book1-l01.json";
import starterL01Json from "../../../shared/lesson-packages/starter-l01.json";
import basicL01Json from "../../../shared/lesson-packages/basic-l01.json";

export * from "../../../shared/lessonPackageSchema";

export const LESSON_PACKAGES: Record<string, LessonPackage> = {
  "book1-l01": book1L01Json as unknown as LessonPackage,
  "starter-l01": starterL01Json as unknown as LessonPackage,
  "basic-l01": basicL01Json as unknown as LessonPackage,
};

export function getLessonPackage(lessonId: string): LessonPackage | null {
  return LESSON_PACKAGES[lessonId] ?? null;
}

export function getAllLessonPackages(): LessonPackage[] {
  return Object.values(LESSON_PACKAGES);
}

export function buildReviewStepsFromDueItems(
  pkg: LessonPackage,
  dueItems: any[]
): LessonStepDefinition[] {
  const steps: LessonStepDefinition[] = [];
  let stepNum = 1;

  for (const due of dueItems) {
    const char = due.character || due.taskData?.audioText || due.itemId || "你";
    const charObj = pkg.characters.find((c) => c.char === char) || {
      char,
      pronunciation: { pinyin: "", zhuyin: "" },
      components: [],
      meaning: { zh: "", en: "" },
      commonWords: [],
      strokeCount: 0,
      reviewStatus: "APPROVED" as const,
    };
    const domain = due.skillDomain || due.domain || "recognition";

    steps.push({
      stepNumber: stepNum++,
      stepKey: "characters",
      domain: domain as any,
      title: "到期生字複習",
      subtitle: `複習生字「${char}」`,
      primaryAction: "確認答案",
      estimatedMinutes: 2,
      required: true,
      data: {
        dueItem: due,
        dueCharacter: char,
        charObj,
        recognitionCheck: {
          prompt: due.taskData?.prompt || "聽一聽發音，選出聽到的字：",
          audioText: char,
          choices: due.taskData?.choices || [
            { id: "option-1", label: char === "好" ? "你" : "好", isCorrect: false },
            { id: "option-2", label: char, isCorrect: true },
          ],
        },
      },
    });
  }

  if (steps.length > 0) {
    steps.push({
      stepNumber: stepNum,
      stepKey: "wrap_up",
      domain: null,
      title: "完成複習",
      subtitle: "太棒了！已完成今日到期複習。",
      primaryAction: "結束複習",
      estimatedMinutes: 1,
      required: true,
      data: {
        wrapUpSummary: {
          completionText: "到期複習完成！",
          masteryNotice: "已為您記錄有效證據並安排下一次 SRS 間隔複習。",
        },
      },
    });
  }

  return steps;
}

/**
 * Returns the deterministic step sequence for a given lesson and pedagogy mode.
 */
export function getStepsForMode(
  pkg: LessonPackage,
  mode: PedagogyMode,
  weakDomains: string[] = [],
  dueItems: any[] = []
): LessonStepDefinition[] {
  switch (mode) {
    case "FAST_TRACK":
      return pkg.taskBlueprint.fastTrackSteps;
    case "REVIEW": {
      // REVIEW mode must NEVER use static pkg.taskBlueprint.reviewSteps.
      // It must ONLY be built from authoritative due SRS items.
      // If no due items exist, return an empty array (no fake review steps).
      if (!dueItems || dueItems.length === 0) {
        return [];
      }
      return buildReviewStepsFromDueItems(pkg, dueItems);
    }
    case "REPAIR": {
      const repairSteps: LessonStepDefinition[] = [];
      let stepNum = 1;
      for (const domain of weakDomains) {
        const domainSteps = pkg.taskBlueprint.repairStepsByDomain[domain];
        if (domainSteps) {
          for (const s of domainSteps) {
            repairSteps.push({
              ...s,
              stepNumber: stepNum++,
            });
          }
        }
      }
      // If no domain-specific steps found, fallback to exit ticket check
      if (repairSteps.length === 0) {
        return pkg.taskBlueprint.fastTrackSteps;
      }
      // Add wrap-up step
      repairSteps.push({
        stepNumber: stepNum,
        stepKey: "wrap_up",
        domain: null,
        title: "補強練習完成",
        subtitle: "針對弱項領域的精準練習已完成！",
        primaryAction: "完成今日學習",
        estimatedMinutes: 1,
        required: true,
        data: {
          wrapUpSummary: {
            completionText: "弱項補強練習完成！",
            masteryNotice: "已更新該領域的學習紀錄。",
          },
        },
      });
      return repairSteps;
    }
    case "LEARN":
    default:
      return pkg.taskBlueprint.learnSteps;
  }
}

/**
 * Formats scaffold translation text with appropriate review badge and visibility.
 */
export function getScaffoldText(
  pkg: LessonPackage,
  scaffoldKey: string,
  visibility: ScaffoldVisibilityMode
): {
  visibleText: string | null;
  notes?: string;
  reviewStatus: ContentReviewStatus;
  isTapToReveal: boolean;
} {
  const entry = pkg.nativeLanguageSupport.entries[scaffoldKey];
  if (!entry) {
    return {
      visibleText: null,
      reviewStatus: "APPROVED",
      isTapToReveal: false,
    };
  }

  if (visibility === "HIDDEN") {
    return {
      visibleText: null,
      notes: entry.notes,
      reviewStatus: entry.reviewStatus,
      isTapToReveal: false,
    };
  }

  if (visibility === "TAP_TO_REVEAL") {
    return {
      visibleText: entry.naturalMeaning,
      notes: entry.notes,
      reviewStatus: entry.reviewStatus,
      isTapToReveal: true,
    };
  }

  return {
    visibleText: entry.naturalMeaning,
    notes: entry.notes,
    reviewStatus: entry.reviewStatus,
    isTapToReveal: false,
  };
}
