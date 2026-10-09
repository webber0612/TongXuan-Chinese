import { getAllLessonPackages } from "../../data/lessonPackages";
import { officialCoursePath } from "../../data/officialCoursePath";

export interface DialogueLesson {
  lessonId: string;
  stageId: string;
  stageTitle: string;
  lessonNumber: number;
  title: string;
}

const STAGE_ORDER = ["starter", "basic", "book-1"];
const STORAGE_PREFIX = "tongxuan_dialogue_done:";

export function listDialogueLessons(): DialogueLesson[] {
  return getAllLessonPackages()
    .map((pkg) => ({
      lessonId: pkg.lessonId,
      stageId: pkg.stageId,
      stageTitle: officialCoursePath.stages.find((stage) => stage.id === pkg.stageId)?.shortTitle ?? "",
      lessonNumber: pkg.lessonNumber,
      title: pkg.curriculumSource.title,
    }))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stageId) - STAGE_ORDER.indexOf(b.stageId) || a.lessonNumber - b.lessonNumber);
}

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem">;

/** Finished conversation lessons for one local learner. Unreadable data counts as nothing finished. */
export function loadDialogueDone(learnerId: string, store: ReadStore = localStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_PREFIX + learnerId) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function markDialogueDone(learnerId: string, lessonId: string, store: WriteStore = localStorage): string[] {
  const current = loadDialogueDone(learnerId, store);
  if (current.includes(lessonId)) return current;
  const next = [...current, lessonId];
  store.setItem(STORAGE_PREFIX + learnerId, JSON.stringify(next));
  return next;
}
