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

function plannerCharacterSet(lessonId: string): Set<string> {
  const lesson = officialCoursePath.stages.flatMap((stage) => stage.lessons).find((item) => item.id === lessonId);
  return new Set(lesson?.official.title.match(/[\u3400-\u9fff]/g) ?? []);
}

interface FastTrackListeningContract {
  questionId: string;
  prompt: string;
  audioText: string;
  choices: Array<{ id: string; label: string }>;
}

/** Read the one exact listening question from the executable Fast Track blueprint. */
function packageFastTrackListeningContract(pkg: unknown): FastTrackListeningContract | null {
  if (!pkg || typeof pkg !== "object") return null;
  const candidate = pkg as Record<string, any>;
  if (typeof candidate.lessonId !== "string" || !candidate.lessonId.trim()) return null;
  const source = candidate.curriculumSource;
  const blueprint = candidate.taskBlueprint;
  if (!source || typeof source !== "object" || typeof source.title !== "string" || !source.title.trim() ||
      !blueprint || typeof blueprint !== "object" || !Array.isArray(blueprint.fastTrackSteps)) return null;

  const exitTickets = blueprint.fastTrackSteps.filter((step: any) => step && typeof step === "object" && step.stepKey === "exit_ticket");
  if (exitTickets.length !== 1 || !exitTickets[0].data || typeof exitTickets[0].data !== "object" ||
      !Array.isArray(exitTickets[0].data.questions) || exitTickets[0].data.questions.length === 0) return null;

  const questions = exitTickets[0].data.questions as any[];
  if (!questions.every((question) => question && typeof question === "object" &&
      typeof question.id === "string" && Boolean(question.id.trim()) && typeof question.domain === "string")) return null;
  const ids = questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) return null;

  const listening = questions.filter((question) => question.domain === "listening");
  if (listening.length !== 1) return null;
  const question = listening[0];
  if (question.audioText !== source.title || typeof question.prompt !== "string" || !question.prompt.trim() ||
      !Array.isArray(question.choices) || question.choices.length !== 2 ||
      typeof question.correctChoiceId !== "string") return null;

  const choices = question.choices;
  if (!choices.every((choice: any) => choice && typeof choice === "object" &&
      typeof choice.id === "string" && Boolean(choice.id.trim()) &&
      typeof choice.label === "string" && Boolean(choice.label.trim()) &&
      (choice.isCorrect === undefined || typeof choice.isCorrect === "boolean"))) return null;
  const choiceIds = choices.map((choice: any) => choice.id);
  const labels = choices.map((choice: any) => choice.label);
  if (new Set(choiceIds).size !== choices.length || new Set(labels).size !== choices.length ||
      !choiceIds.includes(question.correctChoiceId)) return null;
  if (choices.some((choice: any) => choice.isCorrect !== undefined) &&
      choices.some((choice: any) => choice.isCorrect !== (choice.id === question.correctChoiceId))) return null;

  return {
    questionId: question.id,
    prompt: question.prompt,
    audioText: question.audioText,
    choices: choices.map((choice: any) => ({ id: choice.id, label: choice.label })),
  };
}

function samePublicChoices(left: unknown, right: Array<{ id: string; label: string }>): boolean {
  if (!validPublicReviewChoices(left)) return false;
  return left.length === right.length && left.every((choice, index) =>
    choice.id === right[index].id && choice.label === right[index].label);
}

export type ReviewSkillDomain = "recognition" | "writing" | "word" | "listening";
export interface ReviewDueItem {
  id: string;
  skillDomain: ReviewSkillDomain;
  lessonId: string;
  dueAt: string;
  character?: string;
  scriptMode?: "TRADITIONAL" | "SIMPLIFIED";
  word?: string;
  questionId?: string;
  prompt?: string;
  audioText?: string;
  choices?: Array<{ id: string; label: string }>;
}

function reviewIdentity(domain: string, itemId: string): string {
  return JSON.stringify([domain, itemId]);
}

/** Validate Daily Queue rows against the exact supported backend domain contract. */
export function validateReviewDueItems(dueItems: unknown): dueItems is ReviewDueItem[] {
  if (!Array.isArray(dueItems)) return false;
  const identities = new Set<string>();
  return dueItems.every((item: any) => {
    if (
      !item || typeof item !== "object" ||
      typeof item.id !== "string" || !item.id.trim() ||
      !["recognition", "writing", "word", "listening"].includes(item.skillDomain) ||
      typeof item.lessonId !== "string" || !getLessonPackage(item.lessonId) ||
      typeof item.dueAt !== "string" || !Number.isFinite(Date.parse(item.dueAt))
    ) return false;
    const domain = item.skillDomain as ReviewSkillDomain;
    if (domain === "recognition") {
      if (typeof item.character !== "string" || !plannerCharacterSet(item.lessonId).has(item.character)) return false;
    } else if (domain === "writing") {
      if (typeof item.character !== "string" || !plannerCharacterSet(item.lessonId).has(item.character) ||
          !["TRADITIONAL", "SIMPLIFIED"].includes(item.scriptMode) ||
          item.id !== `${String(item.scriptMode).toLowerCase()}::${item.character}`) return false;
    } else if (domain === "word") {
      if (item.word !== "你好" || !new RegExp(`^lf_\\d+_${item.lessonId}_vocabulary$`).test(item.id)) return false;
    } else {
      const pkg = getLessonPackage(item.lessonId);
      const listeningContract = packageFastTrackListeningContract(pkg);
      if (
        !new RegExp(`^lf_\\d+_${item.lessonId}_phrase$`).test(item.id) ||
        !listeningContract || item.questionId !== listeningContract.questionId ||
        item.prompt !== listeningContract.prompt || item.audioText !== listeningContract.audioText ||
        !samePublicChoices(item.choices, listeningContract.choices) ||
        "correctChoiceId" in item
      ) return false;
    }
    const identity = reviewIdentity(domain, item.id);
    if (identities.has(identity)) return false;
    identities.add(identity);
    return true;
  });
}

export function buildReviewStepsFromDueItems(
  _parentPkg: LessonPackage,
  dueItems: any[]
): LessonStepDefinition[] {
  const validatedTasks = getAuthoritativeReviewTasksAcrossPackages(dueItems);
  if (!validatedTasks) return [];
  const steps: LessonStepDefinition[] = [];
  let stepNum = 1;

  for (const due of validatedTasks) {
    const reviewPkg = getLessonPackage(due.lessonId!);
    if (!reviewPkg) return [];
    if (due.taskType === "REVIEW_RECOGNITION") {
      const char = due.taskData!.audioText;
      const charObj = reviewPkg.characters.find((item) => item.char === char) ??
        getAllLessonPackages().flatMap((lessonPackage) => lessonPackage.characters).find((item) => item.char === char);
      if (!charObj?.pronunciation?.pinyin || !charObj.pronunciation.zhuyin) return [];
      const packageRecognitionStep = reviewPkg.taskBlueprint.learnSteps.find(
        (step) => step.stepKey === "characters" && step.domain === "recognition",
      );
      steps.push({
        stepNumber: stepNum++, stepKey: "characters", domain: "recognition",
        title: packageRecognitionStep?.title ?? "到期生字複習", subtitle: `複習生字「${char}」`,
        primaryAction: packageRecognitionStep?.primaryAction ?? "確認答案", estimatedMinutes: 2, required: true,
        data: { taskId: due.id, dueItem: due, dueCharacter: char, charObj,
          recognitionCheck: { prompt: due.taskData!.prompt, audioText: char, choices: due.taskData!.choices } },
      });
    } else if (due.taskType === "REVIEW_WRITING") {
      steps.push({
        stepNumber: stepNum++, stepKey: "writing", domain: "writing", title: "到期書寫複習",
        subtitle: `書寫「${due.taskData!.character}」`, primaryAction: "完成書寫", estimatedMinutes: 2, required: true,
        data: { taskId: due.id, dueItem: due, character: due.taskData!.character, scriptMode: due.taskData!.scriptMode },
      });
    } else if (due.taskType === "REVIEW_LISTENING") {
      steps.push({
        stepNumber: stepNum++, stepKey: "mini_check", domain: "listening", title: "到期聆聽複習",
        subtitle: `聽「${due.taskData!.audioText}」再作答`, primaryAction: "確認答案", estimatedMinutes: 2, required: true,
        data: {
          taskId: due.id, taskType: due.taskType, questionId: due.taskData!.questionId,
          prompt: due.taskData!.prompt,
          audioText: due.taskData!.audioText, choices: due.taskData!.choices,
        },
      });
    } else {
      steps.push({
        stepNumber: stepNum++, stepKey: "vocabulary", domain: "vocabulary", title: "到期詞語複習",
        subtitle: `複習「${due.taskData!.word}」`, primaryAction: "確認答案", estimatedMinutes: 2, required: true,
        data: { taskId: due.id, dueItem: due, word: due.taskData!.word, prompt: due.taskData!.prompt, choices: due.taskData!.choices },
      });
    }
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
  sessionId?: string;
  childId?: number;
  key?: string;
  taskType?: string;
  evidenceType?: string;
  masteryImpact?: string;
  sourceQueue?: string;
  lessonId?: string;
  skillDomain?: string | null;
  state?: string;
  attemptCount?: number;
  required?: boolean;
  failureCount?: number;
  deferredReason?: string | null;
  itemId?: string | null;
  taskData?: Record<string, any>;
}

export function isPolicyAllowedReviewDeferral(task: LearningFlowTaskContract): boolean {
  return task.taskType === "REVIEW_WRITING" && task.sourceQueue === "REVIEW" && task.required === true &&
    task.state === "DEFERRED" && task.deferredReason === "WRITING_RETRY_CAP" &&
    typeof task.failureCount === "number" && Number.isInteger(task.failureCount) && task.failureCount >= 2;
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
    typeof task.key !== "string" || !/^review-(recognition|writing|word|listening)-\d+$/.test(task.key) ||
    !["REVIEW_RECOGNITION", "REVIEW_WRITING", "REVIEW_VOCABULARY", "REVIEW_LISTENING"].includes(task.taskType) || task.sourceQueue !== "REVIEW" ||
    task.required !== true ||
    typeof task.lessonId !== "string" || !task.lessonId.trim() ||
    task.lessonId !== pkg.lessonId ||
    (expectedLessonId !== undefined && task.lessonId !== expectedLessonId) ||
    typeof task.itemId !== "string" || !task.itemId.trim() ||
    (task.state !== "PENDING" && task.state !== "IN_PROGRESS" && task.state !== "COMPLETED" && !isPolicyAllowedReviewDeferral(task))
  ) return false;

  const data = task.taskData;
  if (!data || typeof data !== "object" || typeof data.dueAt !== "string" || !Number.isFinite(Date.parse(data.dueAt))) return false;
  if (task.taskType === "REVIEW_RECOGNITION") {
    return /^review-recognition-\d+$/.test(task.key) && task.skillDomain === "recognition" &&
      typeof data.prompt === "string" && Boolean(data.prompt.trim()) &&
      typeof data.audioText === "string" && plannerCharacterSet(pkg.lessonId).has(data.audioText) &&
      validReviewChoices(data.choices, data.audioText);
  }
  if (task.taskType === "REVIEW_WRITING") {
    const character = data.character;
    const scriptMode = data.scriptMode;
    return /^review-writing-\d+$/.test(task.key) && task.skillDomain === "writing" &&
      data.phase === "independent" && data.repeatCount === 1 &&
      typeof character === "string" && plannerCharacterSet(pkg.lessonId).has(character) &&
      ["TRADITIONAL", "SIMPLIFIED"].includes(scriptMode) &&
      task.itemId === `${String(scriptMode).toLowerCase()}::${character}`;
  }
  if (task.taskType === "REVIEW_LISTENING") {
    const listeningContract = packageFastTrackListeningContract(pkg);
    const exactPhraseId = typeof task.childId === "number" && Number.isSafeInteger(task.childId) && task.childId > 0
      ? `lf_${task.childId}_${pkg.lessonId}_phrase`
      : null;
    return /^review-listening-\d+$/.test(task.key) && task.skillDomain === "listening" && task.masteryImpact === "NONE" &&
      task.evidenceType === "fast_track_listening_choice" &&
      exactPhraseId !== null && task.itemId === exactPhraseId &&
      listeningContract !== null && data.questionId === listeningContract.questionId &&
      data.prompt === listeningContract.prompt && data.audioText === listeningContract.audioText &&
      !("correctChoiceId" in data) && samePublicChoices(data.choices, listeningContract.choices);
  }
  return /^review-word-\d+$/.test(task.key) && task.skillDomain === "word" && data.word === "你好" &&
    typeof data.prompt === "string" && Boolean(data.prompt.trim()) &&
    task.childId !== undefined && task.itemId === `lf_${task.childId}_${pkg.lessonId}_vocabulary` &&
    validReviewChoices(data.choices, "opt-hello", true);
}

function validReviewChoices(choices: unknown, expected: string, expectedIsChoiceId = false): boolean {
  if (!Array.isArray(choices) || choices.length !== 2) return false;
  const ids = choices.map((choice: any) => choice?.id);
  const labels = choices.map((choice: any) => choice?.label);
  return choices.every((choice: any) => choice && typeof choice === "object" &&
    typeof choice.id === "string" && Boolean(choice.id.trim()) &&
    typeof choice.label === "string" && Boolean(choice.label.trim())) &&
    new Set(ids).size === choices.length && new Set(labels).size === choices.length &&
    (expectedIsChoiceId ? ids.includes(expected) : labels.includes(expected) && labels.some((label: string) => label !== expected));
}

function validPublicReviewChoices(choices: unknown): choices is Array<{ id: string; label: string }> {
  if (!Array.isArray(choices) || choices.length !== 2) return false;
  const ids = choices.map((choice: any) => choice?.id);
  const labels = choices.map((choice: any) => choice?.label);
  return choices.every((choice: any) => choice && typeof choice === "object" &&
    typeof choice.id === "string" && Boolean(choice.id.trim()) &&
    typeof choice.label === "string" && Boolean(choice.label.trim()) &&
    !("isCorrect" in choice) && !("correctChoiceId" in choice)) &&
    new Set(ids).size === choices.length && new Set(labels).size === choices.length;
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
  const identities = candidates.map((task: any) => reviewIdentity(task.skillDomain, task.itemId));
  if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length || new Set(identities).size !== identities.length) return null;
  return candidates as LearningFlowTaskContract[];
}

/** Validate mixed-lesson REVIEW rows independently using each row's executable package. */
export function getAuthoritativeReviewTasksAcrossPackages(
  tasks: unknown,
  expectedSessionId?: string,
): LearningFlowTaskContract[] | null {
  if (!Array.isArray(tasks)) return null;
  const candidates = tasks.filter(isReviewTaskCandidate);
  if (!candidates.every((task: any) => {
    const pkg = typeof task?.lessonId === "string" ? getLessonPackage(task.lessonId) : null;
    return Boolean(pkg && isValidReviewTask(task, pkg, task.lessonId) &&
      (!expectedSessionId || task.id === `${expectedSessionId}:${task.key}`));
  })) return null;
  const ids = candidates.map((task: any) => task.id);
  const keys = candidates.map((task: any) => task.key);
  const identities = candidates.map((task: any) => reviewIdentity(task.skillDomain, task.itemId));
  if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length || new Set(identities).size !== identities.length) return null;
  return candidates as LearningFlowTaskContract[];
}

export function selectReviewTasksForDueItems(
  tasks: unknown,
  dueItems: unknown,
  pkg: LessonPackage,
  expectedLessonId: string,
): LearningFlowTaskContract[] | null {
  if (!validateReviewDueItems(dueItems)) return null;
  const authoritativeTasks = getAuthoritativeReviewTasks(tasks, pkg, expectedLessonId);
  if (!authoritativeTasks) return null;

  const dueIds = new Set<string>();
  const selected: LearningFlowTaskContract[] = [];
  for (const item of dueItems) {
    const identity = reviewIdentity(item.skillDomain, item.id);
    if (dueIds.has(identity) || item.lessonId !== expectedLessonId) return null;
    dueIds.add(identity);
    const exactTask = authoritativeTasks.find((task) => reviewIdentity(String(task.skillDomain), String(task.itemId)) === identity);
    if (!exactTask || !reviewTaskMatchesDueItem(exactTask, item)) return null;
    selected.push(exactTask);
  }
  return selected;
}

/** Require exact set equality between the Daily Queue and backend task rows. */
export function selectReviewTasksAcrossPackages(
  tasks: unknown,
  dueItems: unknown,
  expectedChildId: number,
  expectedSessionId: string,
): LearningFlowTaskContract[] | null {
  if (!validateReviewDueItems(dueItems)) return null;
  const authoritativeTasks = getAuthoritativeReviewTasksAcrossPackages(tasks, expectedSessionId);
  if (!authoritativeTasks) return null;
  if (authoritativeTasks.some((task) => task.childId !== expectedChildId || task.sessionId !== expectedSessionId)) return null;
  const byIdentity = new Map(authoritativeTasks.map((task) => [reviewIdentity(String(task.skillDomain), String(task.itemId)), task]));
  if (byIdentity.size !== authoritativeTasks.length) return null;
  const dueIds = new Set(dueItems.map((item) => reviewIdentity(item.skillDomain, item.id)));
  // A completed row can remain in a mixed session after its SRS item advances.
  // It is historical evidence, not part of today's exact actionable due set.
  if (authoritativeTasks.some((task) => !dueIds.has(reviewIdentity(String(task.skillDomain), String(task.itemId))) && task.state !== "COMPLETED")) return null;
  const selected: LearningFlowTaskContract[] = [];
  for (const item of dueItems) {
    if (item.skillDomain === "listening" && item.id !== `lf_${expectedChildId}_${item.lessonId}_phrase`) return null;
    const exactTask = byIdentity.get(reviewIdentity(item.skillDomain, item.id));
    if (!exactTask || !reviewTaskMatchesDueItem(exactTask, item)) return null;
    selected.push(exactTask);
  }
  return selected;
}

function reviewTaskMatchesDueItem(task: LearningFlowTaskContract, item: ReviewDueItem): boolean {
  if (task.lessonId !== item.lessonId || task.itemId !== item.id) return false;
  if (task.taskData?.dueAt !== item.dueAt) {
    const hasAttempted = typeof task.attemptCount === "number" && Number.isInteger(task.attemptCount) && task.attemptCount > 0;
    if (!hasAttempted || typeof task.taskData?.dueAt !== "string" || !Number.isFinite(Date.parse(task.taskData.dueAt))) return false;
  }
  if (item.skillDomain === "recognition") {
    return task.taskType === "REVIEW_RECOGNITION" && task.skillDomain === "recognition" && task.taskData?.audioText === item.character;
  }
  if (item.skillDomain === "writing") {
    return task.taskType === "REVIEW_WRITING" && task.skillDomain === "writing" &&
      task.taskData?.character === item.character && task.taskData?.scriptMode === item.scriptMode;
  }
  if (item.skillDomain === "listening") {
    return task.taskType === "REVIEW_LISTENING" && task.skillDomain === "listening" &&
      task.evidenceType === "fast_track_listening_choice" && task.masteryImpact === "NONE" &&
      task.taskData?.questionId === item.questionId && task.taskData?.prompt === item.prompt &&
      task.taskData?.audioText === item.audioText &&
      JSON.stringify(task.taskData?.choices) === JSON.stringify(item.choices);
  }
  return task.taskType === "REVIEW_VOCABULARY" && task.skillDomain === "word" && task.taskData?.word === item.word;
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
  if (tasks.some((task) => task?.sourceQueue !== "CURRICULUM" && task?.sourceQueue !== "REVIEW")) {
    return { valid: false, steps: [] };
  }
  // Cross-lesson review rows belong to the separate REVIEW cycle, not the
  // parent LEARN curriculum plan. Keep their presence from invalidating or
  // extending this lesson's exact planner task set.
  const curriculumTasks = tasks.filter((task) => task?.sourceQueue === "CURRICULUM");
  if (curriculumTasks.length === 0) return { valid: false, steps: [] };

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

  for (const task of curriculumTasks) {
    if (
      typeof task.id !== "string" || task.id.length === 0 ||
      typeof task.key !== "string" || task.key.length === 0 ||
      typeof task.taskType !== "string" ||
      task.lessonId !== pkg.lessonId ||
      task.sourceQueue !== "CURRICULUM" ||
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
    if (task.taskType === "RECOGNITION" || task.taskType === "MINI_CHECK") {
      if (task.taskType === "MINI_CHECK" && data.mode === "reflection" && task.key === "mini-check-reflection" && task.skillDomain === null) {
        if (!Array.isArray(data.choices) || data.choices.length < 2 || typeof data.prompt !== "string") return { valid: false, steps: [] };
        if (!append(task, "mini_check", null, { taskId: task.id, prompt: data.prompt, choices: data.choices })) return { valid: false, steps: [] };
        continue;
      }
      const recognitionKey = task.key.match(/^recognition-(\d+)$/);
      if (
        task.skillDomain !== "recognition" ||
        !recognitionKey || task.sourceQueue !== "CURRICULUM" ||
        !Array.isArray(data.choices) || data.choices.length < 2 ||
        typeof data.audioText !== "string"
      ) return { valid: false, steps: [] };
      const characterIndex = Number(recognitionKey[1]);
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
      if (!charObj.pronunciation?.pinyin || !charObj.pronunciation?.zhuyin) return { valid: false, steps: [] };
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
  const count = (taskType: string) => curriculumTasks.filter((task) => task.taskType === taskType).length;
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
  const recognitionTasks = curriculumTasks.filter((task) =>
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
  if (curriculumTasks.filter((task) => task.taskType === "MINI_CHECK" && task.taskData?.mode === "reflection").length !== 1) return { valid: false, steps: [] };
  if (!lessonMasteredBeforeSession && pkg.lessonId === "book1-l01" ? count("SENTENCE_PATTERN") !== 1 : count("SENTENCE_PATTERN") !== 0) return { valid: false, steps: [] };
  if (wrapCount !== 1 || mappedIds.size !== curriculumTasks.length || steps.at(-1)?.stepKey !== "wrap_up") {
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
  lockedRepairTaskIds?: string[],
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
      // A repair is an interaction with existing authoritative curriculum tasks,
      // never a locally-authored package task or the FAST_TRACK exit ticket.
      if (!learningFlowTasks) return [];
      const plan = buildAuthoritativeLearnSteps(pkg, learningFlowTasks);
      if (!plan.valid) return [];
      const weak = new Set(weakDomains);
      const lockedIds = lockedRepairTaskIds === undefined ? null : new Set(lockedRepairTaskIds);
      const taskById = new Map(learningFlowTasks.map((task) => [task.id, task]));
      const repairSteps: LessonStepDefinition[] = [];
      for (const step of plan.steps) {
        if (step.stepKey === "wrap_up") continue;
        const exactIds = step.data.taskId
          ? [step.data.taskId as string]
          : Array.isArray(step.data.taskIds) ? step.data.taskIds as string[] : [];
        const eligibleIds = exactIds.filter((id) => {
          const task = taskById.get(id);
          return Boolean(task && task.sourceQueue === "CURRICULUM" && task.lessonId === pkg.lessonId &&
            task.skillDomain && weak.has(task.skillDomain) &&
            (lockedIds ? lockedIds.has(id) && ["PENDING", "IN_PROGRESS", "COMPLETED", "DEFERRED"].includes(task.state ?? "") :
              (task.state === "PENDING" || task.state === "IN_PROGRESS")));
        });
        if (eligibleIds.length === 0) continue;
        const data = { ...step.data };
        if (step.data.taskId && !eligibleIds.includes(step.data.taskId as string)) continue;
        if (Array.isArray(step.data.taskIds)) {
          data.taskIds = eligibleIds;
          if (Array.isArray(step.data.speakingTasks)) {
            data.speakingTasks = step.data.speakingTasks.filter((task: { id: string }) => eligibleIds.includes(task.id));
          }
        }
        repairSteps.push({ ...step, stepNumber: repairSteps.length + 1, data });
      }
      if (repairSteps.length === 0) return [];
      repairSteps.push({
        stepNumber: repairSteps.length + 1,
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
            masteryNotice: "本輪補強已記錄；原課程進度會保留在今日學習中。",
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
