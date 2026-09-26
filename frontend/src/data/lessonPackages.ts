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
import { officialCoursePath } from "./officialCoursePath";

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
  const validatedTasks = getAuthoritativeReviewTasks(dueItems, pkg);
  if (!validatedTasks) return [];
  const steps: LessonStepDefinition[] = [];
  let stepNum = 1;

  for (const due of validatedTasks) {
    const char = due.taskData!.audioText;
    const charObj = pkg.characters.find((c) => c.char === char)!;

    steps.push({
      stepNumber: stepNum++,
      stepKey: "characters",
      domain: "recognition",
      title: "到期生字複習",
      subtitle: `複習生字「${char}」`,
      primaryAction: "確認答案",
      estimatedMinutes: 2,
      required: true,
      data: {
        taskId: due.id,
        dueItem: due,
        dueCharacter: char,
        charObj,
        recognitionCheck: {
          prompt: due.taskData!.prompt,
          audioText: char,
          choices: due.taskData!.choices,
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

export interface LearningFlowTaskContract {
  id?: string;
  key?: string;
  taskType?: string;
  sourceQueue?: string;
  lessonId?: string;
  skillDomain?: string | null;
  state?: string;
  required?: boolean;
  itemId?: string | null;
  taskData?: Record<string, any>;
}

function isReviewTaskCandidate(task: any): boolean {
  return Boolean(task && typeof task === "object" && (
    task.sourceQueue === "REVIEW" ||
    task.taskType === "REVIEW_RECOGNITION" ||
    (typeof task.key === "string" && task.key.startsWith("review-"))
  ));
}

function isValidReviewTask(task: any, pkg: LessonPackage, expectedLessonId?: string): boolean {
  if (!isReviewTaskCandidate(task)) return false;
  if (
    typeof task.id !== "string" || !task.id.trim() ||
    typeof task.key !== "string" || !/^review-recognition-\d+$/.test(task.key) ||
    task.taskType !== "REVIEW_RECOGNITION" || task.sourceQueue !== "REVIEW" ||
    task.skillDomain !== "recognition" || task.required !== true ||
    typeof task.lessonId !== "string" || !task.lessonId.trim() ||
    task.lessonId !== pkg.lessonId ||
    (expectedLessonId !== undefined && task.lessonId !== expectedLessonId) ||
    typeof task.itemId !== "string" || !task.itemId.trim() ||
    (task.state !== "PENDING" && task.state !== "IN_PROGRESS" && task.state !== "COMPLETED")
  ) return false;

  const data = task.taskData;
  if (
    !data || typeof data !== "object" ||
    typeof data.prompt !== "string" || !data.prompt.trim() ||
    typeof data.audioText !== "string" || !data.audioText.trim() ||
    !pkg.characters.some((character) => character.char === data.audioText) ||
    typeof data.dueAt !== "string" || !Number.isFinite(Date.parse(data.dueAt)) ||
    !Array.isArray(data.choices) || data.choices.length !== 2
  ) return false;

  const choices = data.choices;
  const ids = choices.map((choice: any) => choice?.id);
  const labels = choices.map((choice: any) => choice?.label);
  return choices.every((choice: any) =>
    choice && typeof choice === "object" &&
    typeof choice.id === "string" && choice.id.trim() &&
    typeof choice.label === "string" && choice.label.trim()
  ) && new Set(ids).size === choices.length && new Set(labels).size === choices.length &&
    labels.includes(data.audioText) && labels.some((label: string) => label !== data.audioText);
}

/** REVIEW steps only exist for complete, unique backend planner task rows. */
export function getAuthoritativeReviewTasks(
  tasks: unknown,
  pkg: LessonPackage,
  expectedLessonId?: string,
): LearningFlowTaskContract[] | null {
  if (!Array.isArray(tasks)) return null;
  const candidates = tasks.filter(isReviewTaskCandidate);
  if (!candidates.every((task) => isValidReviewTask(task, pkg, expectedLessonId))) return null;

  const ids = candidates.map((task: any) => task.id);
  const keys = candidates.map((task: any) => task.key);
  const itemIds = candidates.map((task: any) => task.itemId);
  if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length || new Set(itemIds).size !== itemIds.length) return null;
  return candidates as LearningFlowTaskContract[];
}

export function selectReviewTasksForDueItems(
  tasks: unknown,
  dueItems: unknown,
  pkg: LessonPackage,
  expectedLessonId: string,
): LearningFlowTaskContract[] | null {
  if (!Array.isArray(dueItems)) return null;
  const authoritativeTasks = getAuthoritativeReviewTasks(tasks, pkg, expectedLessonId);
  if (!authoritativeTasks) return null;

  const dueIds = new Set<string>();
  const selected: LearningFlowTaskContract[] = [];
  for (const item of dueItems) {
    if (
      !item || typeof item !== "object" ||
      typeof item.id !== "string" || !item.id.trim() || dueIds.has(item.id) ||
      typeof item.character !== "string" || !pkg.characters.some((character) => character.char === item.character) ||
      typeof item.lessonId !== "string" || item.lessonId !== expectedLessonId ||
      typeof item.dueAt !== "string" || !Number.isFinite(Date.parse(item.dueAt))
    ) return null;
    dueIds.add(item.id);
    const exactTask = authoritativeTasks.find((task) => task.itemId === item.id);
    if (!exactTask || exactTask.lessonId !== item.lessonId || exactTask.taskData?.audioText !== item.character) return null;
    selected.push(exactTask);
  }
  return selected;
}

export interface AuthoritativeLearnStepPlan {
  valid: boolean;
  steps: LessonStepDefinition[];
}

/**
 * Bind the production Lesson Player to the exact task rows emitted by Learning
 * Flow. A task that cannot be represented by an existing player interaction
 * invalidates the plan instead of being silently omitted or locally invented.
 */
export function buildAuthoritativeLearnSteps(
  pkg: LessonPackage,
  tasks: LearningFlowTaskContract[] | undefined,
  lessonMasteredBeforeSession = false,
): AuthoritativeLearnStepPlan {
  if (!Array.isArray(tasks) || tasks.length === 0) return { valid: false, steps: [] };

  const ids = new Set<string>();
  const keys = new Set<string>();
  const mappedIds = new Set<string>();
  const recognitionItemIds = new Set<string>();
  const steps: LessonStepDefinition[] = [];
  let wrapCount = 0;
  const plannerLesson = officialCoursePath.stages
    .flatMap((stage) => stage.lessons)
    .find((lesson) => lesson.id === pkg.lessonId);
  const plannerCharacters = plannerLesson
    ? Array.from(new Set(plannerLesson.official.title.match(/[\u3400-\u9fff]/g) ?? [])).slice(0, 2)
    : [];
  if (!plannerLesson || plannerCharacters.length === 0) return { valid: false, steps: [] };

  const template = (stepKey: LessonStepDefinition["stepKey"]) =>
    pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === stepKey) ??
    (stepKey === "mini_check"
      ? pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === "exit_ticket")
      : undefined);
  const append = (
    task: LearningFlowTaskContract,
    stepKey: LessonStepDefinition["stepKey"],
    domain: LessonStepDefinition["domain"],
    data: Record<string, any>,
  ) => {
    const source = template(stepKey);
    if (!source) return false;
    steps.push({
      ...source,
      stepKey,
      stepNumber: steps.length + 1,
      domain,
      required: task.required === true,
      data: { ...data },
    });
    mappedIds.add(task.id!);
    return true;
  };

  for (const task of tasks) {
    if (
      typeof task.id !== "string" || task.id.length === 0 ||
      typeof task.key !== "string" || task.key.length === 0 ||
      typeof task.taskType !== "string" ||
      task.lessonId !== pkg.lessonId ||
      !["CURRICULUM", "REVIEW"].includes(task.sourceQueue || "") ||
      !["PENDING", "IN_PROGRESS", "COMPLETED", "DEFERRED"].includes(task.state || "") ||
      typeof task.required !== "boolean" ||
      (task.required === false && !task.taskType.startsWith("WRITING_")) ||
      ids.has(task.id) || keys.has(task.key)
    ) return { valid: false, steps: [] };
    ids.add(task.id);
    keys.add(task.key);
    const data = task.taskData ?? {};

    if (task.taskType === "LISTENING" && task.sourceQueue === "CURRICULUM" && task.required && task.key === "listen" && task.skillDomain === "listening") {
      if (!append(task, "context", "listening", { taskId: task.id, prompt: data.prompt, audioText: data.text || data.audioText })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType === "PHONETICS" && task.sourceQueue === "CURRICULUM" && task.required && task.key === "phonetics" && task.skillDomain === "phonetics") {
      if (!Array.isArray(data.questions) || data.questions.length === 0) return { valid: false, steps: [] };
      const questions = data.questions.map((question: any) => ({
        id: question.id,
        domain: "phonetics",
        prompt: data.prompt,
        audioText: question.character,
        choices: question.choices,
      }));
      if (questions.some((question: any) => typeof question.id !== "string" || !Array.isArray(question.choices) || question.choices.length < 2)) return { valid: false, steps: [] };
      if (!append(task, "exit_ticket", null, { taskId: task.id, taskType: task.taskType, prompt: data.prompt, questions })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType === "VOCABULARY" && task.sourceQueue === "CURRICULUM" && task.required && task.key === "vocabulary" && task.skillDomain === "vocabulary") {
      if (!Array.isArray(data.choices) || data.choices.length < 2) return { valid: false, steps: [] };
      if (!append(task, "vocabulary", "vocabulary", { taskId: task.id, prompt: data.prompt, choices: data.choices })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType === "SENTENCE_PATTERN" && task.sourceQueue === "CURRICULUM" && task.required && task.key === "sentence-pattern" && task.skillDomain === null) {
      if (!Array.isArray(data.choices) || data.choices.length < 2) return { valid: false, steps: [] };
      if (!append(task, "sentence_pattern", null, { taskId: task.id, prompt: data.prompt, choices: data.choices })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType === "RECOGNITION" || task.taskType === "REVIEW_RECOGNITION" || task.taskType === "MINI_CHECK") {
      if (task.taskType === "MINI_CHECK" && data.mode === "reflection" && task.key === "mini-check-reflection" && task.skillDomain === null) {
        if (!Array.isArray(data.choices) || data.choices.length < 2 || typeof data.prompt !== "string") return { valid: false, steps: [] };
        if (!append(task, "mini_check", null, { taskId: task.id, prompt: data.prompt, choices: data.choices })) return { valid: false, steps: [] };
        continue;
      }
      const review = task.taskType === "REVIEW_RECOGNITION";
      const recognitionKey = task.key.match(/^recognition-(\d+)$/);
      if (
        task.skillDomain !== "recognition" ||
        (review && (task.sourceQueue !== "REVIEW" || !task.key.startsWith("review-"))) ||
        (!review && (!recognitionKey || task.sourceQueue !== "CURRICULUM")) ||
        !Array.isArray(data.choices) || data.choices.length < 2 ||
        typeof data.audioText !== "string"
      ) return { valid: false, steps: [] };
      if (review) {
        if (!/^review-recognition-\d+$/.test(task.key) || typeof task.itemId !== "string" || task.itemId.length === 0) {
          return { valid: false, steps: [] };
        }
      } else {
        const characterIndex = Number(recognitionKey?.[1]);
        const itemSuffix = `_${pkg.lessonId}_char_${characterIndex}`;
        const itemPrefix = typeof task.itemId === "string" && task.itemId.endsWith(itemSuffix)
          ? task.itemId.slice(0, -itemSuffix.length)
          : "";
        if (
          !Number.isInteger(characterIndex) ||
          characterIndex < 1 || characterIndex > plannerCharacters.length ||
          data.audioText !== plannerCharacters[characterIndex - 1] ||
          !data.choices.some((choice: any) => choice?.label === data.audioText) ||
          !/^lf_\d+$/.test(itemPrefix) ||
          !task.itemId ||
          recognitionItemIds.has(task.itemId)
        ) return { valid: false, steps: [] };
        recognitionItemIds.add(task.itemId);
      }
      const character = data.audioText;
      const canonicalCharacter = getAllLessonPackages()
        .flatMap((lessonPackage) => lessonPackage.characters)
        .find((item) => item.char === character);
      const charObj = pkg.characters.find((item) => item.char === character) ?? canonicalCharacter ?? {
        char: character,
        pronunciation: { pinyin: "", zhuyin: "" },
        meaning: { zh: "", en: "" },
        writingRequired: false,
        learningRole: "RECOGNIZE" as const,
        strokeCount: 0,
        radical: "",
      };
      if (!review && (!charObj.pronunciation?.pinyin || !charObj.pronunciation?.zhuyin)) return { valid: false, steps: [] };
      if (!append(task, "characters", "recognition", { taskId: task.id, dueCharacter: character, charObj })) return { valid: false, steps: [] };
      continue;
    }
    if (
      (task.taskType === "SPEAKING_ATTEMPT" && task.key === "speaking" && task.skillDomain === "speaking") ||
      (task.taskType === "PRONUNCIATION_ATTEMPT" && task.key === "pronunciation" && task.skillDomain === "pronunciation")
    ) {
      if (task.sourceQueue !== "CURRICULUM" || typeof data.text !== "string") return { valid: false, steps: [] };
      const existing = steps.at(-1)?.stepKey === "speaking" ? steps.at(-1) : undefined;
      if (existing) {
        existing.data.taskIds = [...(existing.data.taskIds ?? []), task.id];
        existing.data.speakingTasks = [...(existing.data.speakingTasks ?? []), { id: task.id, taskType: task.taskType }];
        mappedIds.add(task.id);
      } else if (!append(task, "speaking", task.skillDomain, {
        taskIds: [task.id],
        speakingTasks: [{ id: task.id, taskType: task.taskType }],
        speakingPrompt: { instruction: data.text, expectedText: data.text, audioPolicy: "LOCAL_ONLY" },
      })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType.startsWith("WRITING_") && task.key.startsWith("writing-") && task.skillDomain === "writing" && task.required === false) {
      if (task.sourceQueue !== "CURRICULUM") return { valid: false, steps: [] };
      if (!append(task, "writing", "writing", { taskId: task.id, character: data.character })) return { valid: false, steps: [] };
      continue;
    }
    if (task.taskType === "LESSON_WRAP_UP" && task.key === "wrap-up" && task.skillDomain === null && task.required) {
      wrapCount += 1;
      if (!append(task, "wrap_up", null, { taskId: task.id, wrapUpSummary: { completionText: data.label || "", masteryNotice: data.masteryNotice || "" } })) return { valid: false, steps: [] };
      continue;
    }
    return { valid: false, steps: [] };
  }

  const lessonDomains = plannerLesson;
  const count = (taskType: string) => tasks.filter((task) => task.taskType === taskType).length;
  const exactlyOneForDomain: Record<string, string> = {
    listening: "LISTENING",
    vocabulary: "VOCABULARY",
    phonetics: "PHONETICS",
    speaking: "SPEAKING_ATTEMPT",
    pronunciation: "PRONUNCIATION_ATTEMPT",
  };
  for (const [domain, taskType] of Object.entries(exactlyOneForDomain)) {
    if (lessonDomains.tongxuan.domains.includes(domain as any) && !lessonMasteredBeforeSession && count(taskType) !== 1) return { valid: false, steps: [] };
    if ((!lessonDomains.tongxuan.domains.includes(domain as any) || lessonMasteredBeforeSession) && count(taskType) !== 0) return { valid: false, steps: [] };
  }
  const recognitionTasks = tasks.filter((task) =>
    task.skillDomain === "recognition" && (task.taskType === "RECOGNITION" || task.taskType === "MINI_CHECK")
  );
  const recognitionExpected = lessonDomains.tongxuan.domains.includes("recognition") && !lessonMasteredBeforeSession;
  if (!recognitionExpected && recognitionTasks.length !== 0) return { valid: false, steps: [] };
  if (recognitionExpected) {
    const fullCharacterSet = recognitionTasks.length === plannerCharacters.length && recognitionTasks.every((task, index) =>
      task.key === `recognition-${index + 1}` &&
      task.taskType === (index === 0 && recognitionTasks.length > 1 ? "RECOGNITION" : "MINI_CHECK") &&
      task.sourceQueue === "CURRICULUM" &&
      task.lessonId === pkg.lessonId &&
      task.skillDomain === "recognition" &&
      task.required === true &&
      Number(task.key.slice("recognition-".length)) === index + 1 &&
      task.taskData?.audioText === plannerCharacters[index] &&
      task.taskData?.choices?.some((choice: any) => choice?.label === task.taskData?.audioText)
    );
    const plannerPartialCharacterSet = plannerCharacters.length > 1 && recognitionTasks.length === 1 && (() => {
      const task = recognitionTasks[0];
      return task.key === "recognition-1" &&
        task.taskType === "MINI_CHECK" &&
        task.sourceQueue === "CURRICULUM" &&
        task.lessonId === pkg.lessonId &&
        task.skillDomain === "recognition" &&
        task.required === true &&
        task.taskData?.audioText === plannerCharacters[0] &&
        task.taskData?.choices?.some((choice: any) => choice?.label === task.taskData?.audioText) &&
        typeof task.itemId === "string" &&
        task.itemId.endsWith(`_${pkg.lessonId}_char_1`) &&
        task.taskData?.mode !== "reflection";
    })();
    if (!fullCharacterSet && !plannerPartialCharacterSet) return { valid: false, steps: [] };
  }
  if (tasks.filter((task) => task.taskType === "MINI_CHECK" && task.taskData?.mode === "reflection").length !== 1) return { valid: false, steps: [] };
  if (!lessonMasteredBeforeSession && pkg.lessonId === "book1-l01" ? count("SENTENCE_PATTERN") !== 1 : count("SENTENCE_PATTERN") !== 0) return { valid: false, steps: [] };
  if (wrapCount !== 1 || mappedIds.size !== tasks.length || steps.at(-1)?.stepKey !== "wrap_up") {
    return { valid: false, steps: [] };
  }
  return { valid: true, steps };
}

/**
 * Returns the deterministic step sequence for a given lesson and pedagogy mode.
 */
export function getStepsForMode(
  pkg: LessonPackage,
  mode: PedagogyMode,
  weakDomains: string[] = [],
  dueItems: any[] = [],
  learningFlowTasks?: LearningFlowTaskContract[],
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
      if (learningFlowTasks !== undefined) return buildAuthoritativeLearnSteps(pkg, learningFlowTasks).steps;
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
