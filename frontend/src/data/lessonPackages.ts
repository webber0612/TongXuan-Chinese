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

/**
 * Returns the deterministic step sequence for a given lesson and pedagogy mode.
 */
export function getStepsForMode(
  pkg: LessonPackage,
  mode: PedagogyMode,
  weakDomains: string[] = []
): LessonStepDefinition[] {
  switch (mode) {
    case "FAST_TRACK":
      return pkg.taskBlueprint.fastTrackSteps;
    case "REVIEW":
      return pkg.taskBlueprint.reviewSteps;
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
