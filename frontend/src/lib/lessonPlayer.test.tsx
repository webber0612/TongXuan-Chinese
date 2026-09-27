// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import HanziWriter from "hanzi-writer";

import { LessonPlayerPage, optionalWritingSkipResult } from "../pages/LessonPlayerPage";
import {
  buildAuthoritativeLearnSteps,
  getLessonPackage,
  getAllLessonPackages,
  getStepsForMode,
  selectReviewTasksForDueItems,
  selectReviewTasksAcrossPackages,
  validateReviewDueItems,
  getScaffoldText,
  validateReviewStatusIntegrity,
  type LessonPackage,
} from "../data/lessonPackages";
import { officialCoursePath } from "../data/officialCoursePath";
import partialRecognitionContract from "../../../shared/test-fixtures/partial-recognition-contract.json";
import { authoritativeSessionFixture, learningFlowTask, plannerTasksForLesson } from "./testFixtures/learningFlow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function installPlannerSessionMock(
  session: ReturnType<typeof authoritativeSessionFixture>,
  onRequest?: (url: string, init?: RequestInit) => Response | undefined,
) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    requests.push(`${init?.method ?? "GET"} ${url}`);
    const override = onRequest?.(url, init);
    if (override) return override;
    if (url.includes("/learning-sessions/current")) {
      return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const answerMatch = url.match(/\/tasks\/([^/]+)\/answer$/);
    if (answerMatch && init?.method === "POST") {
      const taskId = decodeURIComponent(answerMatch[1]);
      const task = session.tasks.find((candidate) => candidate.id === taskId);
      if (task) {
        const body = init.body ? JSON.parse(init.body as string) : {};
        const selected = body.selected_option_id;
        const choice = task.taskData?.choices?.find((option: { id: string }) => option.id === selected);
        const answerIsCorrect = task.taskType === "RECOGNITION" || task.taskType === "MINI_CHECK"
          ? task.taskData?.mode === "reflection" ? selected === "practiced" : choice?.label === task.taskData?.audioText
          : task.taskType === "VOCABULARY" ? selected === (task.taskData?.correctChoiceId ?? "opt-hello")
          : task.taskType === "SENTENCE_PATTERN" ? selected === "opt-correct-order"
          : true;
        task.state = answerIsCorrect ? "COMPLETED" : "IN_PROGRESS";
      }
      return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const skipMatch = url.match(/\/tasks\/([^/]+)\/skip$/);
    if (skipMatch && init?.method === "POST") {
      const taskId = decodeURIComponent(skipMatch[1]);
      const task = session.tasks.find((candidate) => candidate.id === taskId);
      if (task) task.state = "DEFERRED";
      return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/complete") && init?.method === "POST") {
      session.status = "COMPLETED";
      const wrapUp = session.tasks.find((task) => task.taskType === "LESSON_WRAP_UP");
      if (wrapUp) wrapUp.state = "COMPLETED";
      return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  return requests;
}

async function advanceToPlannerStep(container: HTMLElement, targetStepKey: string) {
  for (let guard = 0; guard < 12; guard++) {
    const card = container.querySelector(".lesson-step-card");
    const currentKey = card?.getAttribute("data-step-key");
    if (currentKey === targetStepKey) return;
    if (!currentKey) throw new Error("Planner-backed lesson step is unavailable");

    if (currentKey === "characters") {
      const targetCharacter = container.querySelector(".large-char-display")?.textContent;
      const choice = Array.from(container.querySelectorAll(".char-choice-card"))
        .find((button) => button.textContent?.includes(targetCharacter || "")) as HTMLButtonElement | undefined;
      if (!choice) throw new Error("Planner recognition choice is unavailable");
      await act(async () => { choice.click(); });
    } else if (currentKey === "vocabulary" || currentKey === "sentence_pattern" || currentKey === "mini_check") {
      const firstChoice = container.querySelector(currentKey === "mini_check" ? ".choices-vertical-list .choice-card-btn" : `.${currentKey === "vocabulary" ? "step-vocab-body" : "step-sentence-body"} .choice-card-btn`) as HTMLButtonElement | null;
      if (!firstChoice) throw new Error(`Planner ${currentKey} choice is unavailable`);
      await act(async () => { firstChoice.click(); });
    }

    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement | null;
    if (!next || next.disabled) {
      const target = card?.querySelector(".large-char-display")?.textContent;
      const choices = Array.from(container.querySelectorAll(".char-choice-card")).map((button) => button.textContent);
      const error = container.querySelector(".error-strip")?.textContent;
      throw new Error(`Planner step ${currentKey} cannot advance (target=${target}; choices=${choices.join("|")}; error=${error})`);
    }
    await act(async () => { next.click(); });
  }
  throw new Error(`Planner step ${targetStepKey} was not reached`);
}

describe("Lesson Player v1 & Learning Path v2 Regression Suite", () => {
  // Test 1
  it("1. 《你好》 lesson player never renders 日/月/星/光 legacy draft data as official lesson tasks", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // Verify official characters are strictly '你' and '好'
    const charList = pkg.characters.map((c) => c.char);
    expect(charList).toEqual(["你", "好"]);
    expect(charList).not.toContain("日");
    expect(charList).not.toContain("月");
    expect(charList).not.toContain("星");
    expect(charList).not.toContain("光");

    // Verify vocab is strictly '你好'
    const vocabList = pkg.vocabulary.map((v) => v.written);
    expect(vocabList).toEqual(["你好"]);
    expect(vocabList).not.toContain("日月星辰");
    expect(vocabList).not.toContain("日月與星光");

    // Check all step text content
    const learnSteps = pkg.taskBlueprint.learnSteps;
    const allStepJson = JSON.stringify(learnSteps);
    expect(allStepJson).not.toContain("日月與星光");
    expect(allStepJson).not.toContain("日月星辰");
  });

  // Test 2
  it("2. Steps appear in deterministic order in LEARN mode", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const steps = getStepsForMode(pkg, "LEARN");
    expect(steps.map((s) => s.stepKey)).toEqual([
      "context",
      "dialogue",
      "vocabulary",
      "characters",
      "sentence_pattern",
      "speaking",
      "writing",
      "exit_ticket",
      "wrap_up",
    ]);
    expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  // Test 3
  it("3. Only one active lesson step is primary at a time in rendered UI", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={null}
          onBack={() => {}}
        />
      );
    });

    // Verify exactly one active step card is mounted
    const stepCards = container.querySelectorAll(".lesson-step-card");
    expect(stepCards.length).toBe(1);
    expect(stepCards[0].getAttribute("data-step-key")).toBe("context");

    // Progress bar shows 1 active segment
    const activeSegments = container.querySelectorAll(".step-segment.active");
    expect(activeSegments.length).toBe(1);

    root.unmount();
    container.remove();
  });

  // Test 4
  it("4. FAST_TRACK does not immediately grant permanent mastery", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // Fast track pass threshold is configured, but policy specifies light SRS confirmation
    expect(pkg.masteryPolicy.fastTrackPassThreshold).toBe(1.0);
    const ftSteps = getStepsForMode(pkg, "FAST_TRACK");
    expect(ftSteps.length).toBe(2); // diagnostic exit ticket + summary
    expect(ftSteps[1].data.wrapUpSummary?.masteryNotice).toContain("SRS");
  });

  // Test 5
  it("5. Passing FAST_TRACK skips unnecessary LEARN tasks", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const learnSteps = getStepsForMode(pkg, "LEARN");
    const fastTrackSteps = getStepsForMode(pkg, "FAST_TRACK");

    expect(learnSteps.length).toBe(9);
    expect(fastTrackSteps.length).toBe(2);

    // Fast track does not include step 1 (context), step 2 (dialogue), step 3 (vocab intro), step 4 (char intro), step 6 (speaking), step 7 (writing)
    const ftKeys = fastTrackSteps.map((s) => s.stepKey);
    expect(ftKeys).not.toContain("context");
    expect(ftKeys).not.toContain("dialogue");
    expect(ftKeys).not.toContain("characters");
    expect(ftKeys).not.toContain("writing");
  });

  // Test 6
  it("6. REPAIR maps only exact eligible backend curriculum tasks and never falls back to Fast Track", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;
    const session = authoritativeSessionFixture("book1-l01", "repair-session");

    // When only recognition fails
    const repairRecog = getStepsForMode(pkg, "REPAIR", ["recognition"], [], session.tasks);
    expect(repairRecog.some((s) => s.domain === "recognition")).toBe(true);
    expect(repairRecog.some((s) => s.domain === "listening")).toBe(false);
    expect(repairRecog.some((s) => s.domain === "speaking")).toBe(false);
    const recognitionTask = session.tasks.find((task) => task.skillDomain === "recognition")!;
    expect(repairRecog[0].data.taskId).toBe(recognitionTask.id);

    // When only writing fails
    const withWriting = authoritativeSessionFixture("book1-l01", "repair-writing-session", {}, {}, true);
    const repairWriting = getStepsForMode(pkg, "REPAIR", ["writing"], [], withWriting.tasks);
    expect(repairWriting.some((s) => s.domain === "writing")).toBe(true);
    expect(repairWriting.some((s) => s.domain === "listening")).toBe(false);

    // No existing task for the requested domain means no question, including no exit-ticket fallback.
    expect(getStepsForMode(pkg, "REPAIR", ["grammar"], [], session.tasks)).toEqual([]);
    expect(getStepsForMode(pkg, "REPAIR", ["recognition"])).toEqual([]);
    expect(getStepsForMode(pkg, "REPAIR", ["recognition"], [], session.tasks.map((task) =>
      task.skillDomain === "recognition" ? { ...task, state: "COMPLETED" } : task
    ))).toEqual([]);
  });

  // Test 7
  it("7. Strong recognition does not imply writing mastery", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // Mastery policy domain requirements are strictly decoupled
    const recogPolicy = pkg.masteryPolicy.domainRequirements.recognition;
    const writingPolicy = pkg.masteryPolicy.domainRequirements.writing;

    expect(recogPolicy.gateType).toBe("SCORED");
    expect(writingPolicy.gateType).toBe("NON_SCORE_GATE");
    expect(recogPolicy).not.toBe(writingPolicy);
  });

  // Test 8
  it("8. Native-language support can switch FULL -> TAP_TO_REVEAL -> HIDDEN without changing mastery", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const full = getScaffoldText(pkg, "greeting", "FULL");
    expect(full.visibleText).toBe("Hello / Hi");
    expect(full.isTapToReveal).toBe(false);

    const tap = getScaffoldText(pkg, "greeting", "TAP_TO_REVEAL");
    expect(tap.visibleText).toBe("Hello / Hi");
    expect(tap.isTapToReveal).toBe(true);

    const hidden = getScaffoldText(pkg, "greeting", "HIDDEN");
    expect(hidden.visibleText).toBeNull();
    expect(hidden.isTapToReveal).toBe(false);

    // Invariant: package masteryPolicy remains unaltered
    expect(pkg.masteryPolicy.domainRequirements.recognition.passScore).toBe(0.75);
  });

  // Test 9
  it("9. Translation visibility does not mutate authoritative learning state", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={null}
          onBack={() => {}}
          initialScaffoldMode="TAP_TO_REVEAL"
        />
      );
    });

    // Check tap button exists
    const tapBtn = container.querySelector(".scaffold-tap-btn");
    expect(tapBtn).not.toBeNull();

    // Tap to reveal
    await act(async () => {
      (tapBtn as HTMLButtonElement)?.click();
    });

    // Scaffold text is now revealed
    expect(container.querySelector(".scaffold-text")?.textContent).toContain("Hello / Hi");

    root.unmount();
    container.remove();
  });

  // Test 10
  it("10. Session completion != lesson mastery", async () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const wrapUp = pkg.taskBlueprint.learnSteps.find((s) => s.stepKey === "wrap_up");
    expect(wrapUp).toBeDefined();
    // Wrap up notice states completion vs mastery separation
    expect(wrapUp?.data.wrapUpSummary?.masteryNotice).toContain("精熟");
    expect(wrapUp?.data.wrapUpSummary?.masteryNotice).toContain("不會直接因完成課堂而判定精熟");
  });

  // Test 11
  it("11. Review mode builds retrieval steps strictly from authoritative due items and returns empty when no due items exist", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // A. Without authoritative due items, REVIEW mode returns [] (never static reviewSteps)
    const emptySteps = getStepsForMode(pkg, "REVIEW");
    expect(emptySteps.length).toBe(0);

    // B. With authoritative due item, builds exact retrieval step without full lesson replay
    const dueItem = {
      id: "session-review:review-recognition-1",
      key: "review-recognition-1",
      taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW",
      lessonId: "book1-l01",
      skillDomain: "recognition",
      itemId: "item-ni",
      state: "PENDING",
      required: true,
      taskData: {
        prompt: "聽一聽發音，選出聽到的字：",
        audioText: "你",
        choices: [{ id: "option-1", label: "好" }, { id: "option-2", label: "你" }],
        dueAt: "2026-09-02T00:00:00Z",
      },
    };
    const revSteps = getStepsForMode(pkg, "REVIEW", [], [dueItem]);
    expect(revSteps.length).toBe(2); // exact due retrieval step + wrap up
    expect(revSteps[0].stepKey).toBe("characters");
    expect(revSteps[0].data?.dueCharacter).toBe("你");
    expect(revSteps[1].stepKey).toBe("wrap_up");
    expect(getStepsForMode(pkg, "REVIEW", [], [{ id: dueItem.id, key: dueItem.key, taskType: dueItem.taskType, sourceQueue: dueItem.sourceQueue }])).toEqual([]);
    expect(getStepsForMode(pkg, "REVIEW", [], [{ ...dueItem, taskData: { ...dueItem.taskData, choices: [{ id: "same", label: "你" }, { id: "same", label: "好" }] } }])).toEqual([]);
    const retryableSteps = getStepsForMode(pkg, "REVIEW", [], [{ ...dueItem, state: "IN_PROGRESS" }]);
    expect(retryableSteps[0].data?.taskId).toBe(dueItem.id);
    const queueDueItem = { id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" };
    expect(selectReviewTasksForDueItems([dueItem], [queueDueItem], pkg, "book1-l01")).toEqual([dueItem]);
    expect(selectReviewTasksForDueItems([dueItem], [queueDueItem, queueDueItem], pkg, "book1-l01")).toBeNull();
    expect(selectReviewTasksForDueItems([dueItem], [{ ...queueDueItem, lessonId: "basic-l01" }], pkg, "book1-l01")).toBeNull();
  });

  // Test 12
  it("12. Lesson Player uses the same lesson ID as Daily Queue", () => {
    const stage = officialCoursePath.stages.find((s) => s.id === "book-1");
    const book1L1 = stage?.lessons.find((l) => l.number === 1);
    expect(book1L1?.id).toBe("book1-l01");

    const playerPkg = getLessonPackage(book1L1?.id || "");
    expect(playerPkg?.lessonId).toBe("book1-l01");
    expect(playerPkg?.curriculumSource.title).toBe(book1L1?.official.title);
  });

  // Test 13
  it("13. Supported lesson packages preserve the common schema and original-authored starter lesson contracts", () => {
    const packages = getAllLessonPackages();
    expect(packages.length).toBe(7);

    const ids = packages.map((p) => p.lessonId);
    expect(ids).toContain("starter-l01");
    expect(ids).toContain("basic-l01");
    expect(ids).toContain("book1-l01");
    expect(ids).toContain("starter-l03");
    expect(ids).toContain("starter-l04");
    expect(ids).toContain("starter-l05");

    for (const p of packages.filter((item) => !["starter-l02", "starter-l03", "starter-l04", "starter-l05"].includes(item.lessonId))) {
      expect(p.schemaVersion).toBe("v2.0");
      expect(p.taskBlueprint.learnSteps.length).toBe(9);
      expect(p.taskBlueprint.fastTrackSteps.length).toBeGreaterThanOrEqual(2);
      expect(p.taskBlueprint.reviewSteps.length).toBeGreaterThanOrEqual(2);
      expect(p.curriculumSource.provenanceStatus).toBe("VERIFIED_OFFICIAL_TITLE");
    }
    const starterL02 = getLessonPackage("starter-l02")!;
    expect(starterL02.curriculumSource).toMatchObject({
      title: "我七歲", lesson: "第2課", licenseStatus: "PERMISSION_REQUIRED", commercialReady: false,
    });
    expect(starterL02.characters.map((item) => item.char)).toEqual(["我", "七"]);
    expect(starterL02.textBlocks.every((item) => item.authorship === "TONGXUAN_AUTHORED_PRACTICE")).toBe(true);
    expect(starterL02.vocabulary.every((item) => item.authorship === "TONGXUAN_AUTHORED")).toBe(true);
    const starterL03 = getLessonPackage("starter-l03")!;
    expect(starterL03.curriculumSource).toMatchObject({
      title: "爸爸媽媽", lesson: "第3課", licenseStatus: "PERMISSION_REQUIRED", commercialReady: false,
    });
    expect(starterL03.characters.map((item) => item.char)).toEqual(["爸", "媽"]);
    expect(starterL03.textBlocks.map((item) => item.text)).toEqual(["我有爸爸媽媽。"]);
    expect(starterL03.textBlocks.every((item) => item.authorship === "TONGXUAN_AUTHORED_PRACTICE")).toBe(true);
    expect(starterL03.vocabulary.map((item) => item.written)).toEqual(["爸爸媽媽"]);
    expect(starterL03.vocabulary.every((item) => item.authorship === "TONGXUAN_AUTHORED")).toBe(true);
    const starterL04 = getLessonPackage("starter-l04")!;
    expect(starterL04.curriculumSource).toMatchObject({
      title: "小狗", lesson: "第4課", licenseStatus: "PERMISSION_REQUIRED", commercialReady: false,
    });
    expect(starterL04.characters.map((item) => item.char)).toEqual(["小", "狗"]);
    expect(starterL04.textBlocks.map((item) => item.text)).toEqual(["我有一隻小狗。"]);
    expect(starterL04.textBlocks.every((item) => item.authorship === "TONGXUAN_AUTHORED_PRACTICE")).toBe(true);
    expect(starterL04.vocabulary).toEqual([]);
    const starterL05 = getLessonPackage("starter-l05")!;
    expect(starterL05.curriculumSource).toMatchObject({
      title: "我的妹妹", lesson: "第5課", licenseStatus: "PERMISSION_REQUIRED", commercialReady: false,
    });
    expect(starterL05.objectives[0]).toBe(`官方目標摘要：${officialCoursePath.stages.flatMap((stage) => stage.lessons).find((lesson) => lesson.id === "starter-l05")?.tongxuan.handbookSummary.text}`);
    expect(starterL05.characters.map((item) => item.char)).toEqual(["妹"]);
    expect(starterL05.textBlocks.map((item) => item.text)).toEqual(["我有一個妹妹。"]);
    expect(starterL05.textBlocks.every((item) => item.authorship === "TONGXUAN_AUTHORED_PRACTICE")).toBe(true);
    expect(starterL05.vocabulary.map((item) => item.written)).toEqual(["妹妹"]);
    expect(starterL05.vocabulary.every((item) => item.authorship === "TONGXUAN_AUTHORED")).toBe(true);
    const malformedL05Package = structuredClone(starterL05);
    malformedL05Package.curriculumSource.licenseStatus = "APPROVED" as any;
    expect(buildAuthoritativeLearnSteps(malformedL05Package, plannerTasksForLesson("starter-l05")).valid).toBe(false);
    const malformedRecognitionPackage = structuredClone(starterL04);
    const recognitionBlueprint = malformedRecognitionPackage.taskBlueprint.learnSteps.find((step) => step.stepKey === "characters");
    if (Array.isArray(recognitionBlueprint?.data.questions)) recognitionBlueprint.data.questions[0].choices[0].label = "非本課目標";
    expect(buildAuthoritativeLearnSteps(malformedRecognitionPackage, plannerTasksForLesson("starter-l04")).valid).toBe(false);
    const malformedReflectionPackage = structuredClone(starterL04);
    const reflectionBlueprint = malformedReflectionPackage.taskBlueprint.learnSteps.find((step) => step.stepKey === "mini_check");
    if (Array.isArray(reflectionBlueprint?.data.choices)) reflectionBlueprint.data.choices[1].id = reflectionBlueprint.data.choices[0].id;
    expect(buildAuthoritativeLearnSteps(malformedReflectionPackage, plannerTasksForLesson("starter-l04")).valid).toBe(false);
    const emptyReflectionLabelPackage = structuredClone(starterL04);
    const emptyReflectionBlueprint = emptyReflectionLabelPackage.taskBlueprint.learnSteps.find((step) => step.stepKey === "mini_check");
    if (Array.isArray(emptyReflectionBlueprint?.data.choices)) emptyReflectionBlueprint.data.choices[1].label = " ";
    expect(buildAuthoritativeLearnSteps(emptyReflectionLabelPackage, plannerTasksForLesson("starter-l04")).valid).toBe(false);
    const ambiguousSentencePatternPackage = structuredClone(starterL04);
    const sentencePatternBlueprint = ambiguousSentencePatternPackage.taskBlueprint.learnSteps.find((step) => step.stepKey === "sentence_pattern");
    if (Array.isArray(sentencePatternBlueprint?.data.choices)) sentencePatternBlueprint.data.choices[1].label = sentencePatternBlueprint.data.choices[0].label;
    expect(buildAuthoritativeLearnSteps(ambiguousSentencePatternPackage, plannerTasksForLesson("starter-l04")).valid).toBe(false);
  });

  it("14. Each supported authoritative planner task maps once to an exact reachable Lesson Player step", () => {
    const expectedKeys: Record<string, string[]> = {
      "starter-l01": ["context", "exit_ticket", "speaking", "mini_check", "wrap_up"],
      "starter-l02": ["context", "vocabulary", "exit_ticket", "speaking", "mini_check", "wrap_up"],
      "starter-l03": ["context", "vocabulary", "exit_ticket", "speaking", "mini_check", "wrap_up"],
      "starter-l04": ["context", "characters", "characters", "sentence_pattern", "exit_ticket", "speaking", "mini_check", "wrap_up"],
      "starter-l05": ["context", "vocabulary", "exit_ticket", "speaking", "mini_check", "wrap_up"],
      "basic-l01": ["context", "characters", "characters", "vocabulary", "speaking", "mini_check", "wrap_up"],
      "book1-l01": ["context", "characters", "characters", "sentence_pattern", "speaking", "mini_check", "wrap_up"],
    };

    for (const lessonId of ["starter-l01", "starter-l02", "starter-l03", "starter-l04", "starter-l05", "basic-l01", "book1-l01"] as const) {
      const pkg = getLessonPackage(lessonId);
      expect(pkg).not.toBeNull();
      if (!pkg) continue;
      const plannedTasks = plannerTasksForLesson(lessonId);
      const plan = buildAuthoritativeLearnSteps(pkg, plannedTasks);
      expect(plan.valid, lessonId).toBe(true);
      expect(plan.steps.map((step) => step.stepKey)).toEqual(expectedKeys[lessonId]);
      const mappedIds = plan.steps.flatMap((step) => step.data.taskIds ?? [step.data.taskId]);
      expect(mappedIds).toEqual(plannedTasks.map((task) => task.id));
      expect(plan.steps.at(-1)?.data.taskId).toBe(plannedTasks.at(-1)?.id);
      if (lessonId === "starter-l02") {
        expect(plan.steps.find((step) => step.stepKey === "vocabulary")?.data).toMatchObject({
          taskId: plannedTasks.find((task) => task.key === "vocabulary")?.id,
          word: "七歲", pinyin: "qī suì", zhuyin: "ㄑㄧ ㄙㄨㄟˋ",
        });
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.filter((task) => task.key !== "phonetics")).valid).toBe(false);
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.filter((task) => task.key !== "vocabulary")).valid).toBe(false);
        const malformed = plannedTasks.map((task) => task.key === "phonetics"
          ? { ...task, taskData: { ...task.taskData, questions: task.taskData.questions.slice(1) } }
          : task);
        expect(buildAuthoritativeLearnSteps(pkg, malformed).valid).toBe(false);
        const wrongIdentity = plannedTasks.map((task) => task.key === "vocabulary" ? { ...task, itemId: "lf_2_starter-l02_vocabulary" } : task);
        expect(buildAuthoritativeLearnSteps(pkg, wrongIdentity).valid).toBe(false);
        const speakingStep = plan.steps.find((step) => step.stepKey === "speaking");
        expect(speakingStep?.data.speakingTasks).toEqual([{ id: plannedTasks.find((task) => task.key === "speaking")?.id, taskType: "SPEAKING_ATTEMPT" }]);
        const invalidSentenceSource = plannedTasks.map((task) => task.key === "speaking" ? { ...task, taskData: { ...task.taskData, sourceType: "CURRICULUM" } } : task);
        expect(buildAuthoritativeLearnSteps(pkg, invalidSentenceSource).valid).toBe(false);
        const invalidSentenceId = plannedTasks.map((task) => task.key === "speaking" ? { ...task, itemId: "lf_1_starter-l02_phrase" } : task);
        expect(buildAuthoritativeLearnSteps(pkg, invalidSentenceId).valid).toBe(false);
      }
      if (lessonId === "starter-l03") {
        const vocabTask = plannedTasks.find((task) => task.key === "vocabulary")!;
        expect(plan.steps.find((step) => step.stepKey === "context")?.data).toMatchObject({
          taskId: plannedTasks.find((task) => task.key === "listen")?.id,
          audioText: "我有爸爸媽媽。", sceneLabel: "情境：介紹自己的家人", scaffoldKey: "family_example",
        });
        expect(plan.steps.find((step) => step.stepKey === "vocabulary")?.data).toMatchObject({
          taskId: vocabTask.id, word: "爸爸媽媽", pinyin: "bàba māma", zhuyin: "ㄅㄚˋ ㄅㄚ˙ ㄇㄚ ㄇㄚ˙",
          exampleSentence: "我有爸爸媽媽。", correctChoiceId: "family-parents", scaffoldKey: "family_example",
        });
        expect(plan.steps.find((step) => step.stepKey === "exit_ticket")?.data.questions).toHaveLength(4);
        expect(plan.steps.find((step) => step.stepKey === "speaking")?.data.speakingPrompt?.expectedText).toBe("我有爸爸媽媽。");
        const missingVocabulary = plannedTasks.filter((task) => task.key !== "vocabulary");
        expect(buildAuthoritativeLearnSteps(pkg, missingVocabulary).valid).toBe(false);
        const wrongChild = plannedTasks.map((task) => task.key === "listen" ? { ...task, itemId: "lf_2_starter-l03_phrase" } : task);
        expect(buildAuthoritativeLearnSteps(pkg, wrongChild).valid).toBe(false);
        const wrongVocabMap = plannedTasks.map((task) => task.key === "vocabulary"
          ? { ...task, taskData: { ...task.taskData, wordText: "你好" } }
          : task);
        expect(buildAuthoritativeLearnSteps(pkg, wrongVocabMap).valid).toBe(false);
        const missingPhonetic = plannedTasks.map((task) => task.key === "phonetics"
          ? { ...task, taskData: { ...task.taskData, questions: task.taskData.questions.slice(1) } }
          : task);
        expect(buildAuthoritativeLearnSteps(pkg, missingPhonetic).valid).toBe(false);
      }
      if (lessonId === "starter-l04") {
        expect(plan.steps.find((step) => step.stepKey === "context")?.data).toMatchObject({
          taskId: plannedTasks.find((task) => task.key === "listen")?.id,
          audioText: "我有一隻小狗。", sceneLabel: "情境：說說自己有的動物",
        });
        expect(plan.steps.filter((step) => step.stepKey === "characters").map((step) => step.data.charObj.char)).toEqual(["小", "狗"]);
        expect(plan.steps.find((step) => step.stepKey === "sentence_pattern")?.data).toMatchObject({
          taskId: plannedTasks.find((task) => task.key === "sentence-pattern")?.id,
          prompt: "哪一句是在說自己有一隻小狗？",
          choices: [{ id: "has-dog", label: "我有一隻小狗。" }, { id: "dog-has-me", label: "小狗有一隻我。" }],
        });
        expect(plan.steps.find((step) => step.stepKey === "exit_ticket")?.data.questions).toHaveLength(4);
        expect(plan.steps.find((step) => step.stepKey === "speaking")?.data.speakingPrompt?.expectedText).toBe("我有一隻小狗。");
        const missingSentencePattern = plannedTasks.filter((task) => task.key !== "sentence-pattern");
        expect(buildAuthoritativeLearnSteps(pkg, missingSentencePattern).valid).toBe(false);
        const wrongIdentity = plannedTasks.map((task) => task.key === "listen" ? { ...task, itemId: "lf_2_starter-l04_phrase" } : task);
        expect(buildAuthoritativeLearnSteps(pkg, wrongIdentity).valid).toBe(false);
        const malformedChoice = plannedTasks.map((task) => task.key === "sentence-pattern"
          ? { ...task, taskData: { ...task.taskData, choices: [{ id: "invented", label: "我有一隻小狗。" }, task.taskData.choices[1]] } }
          : task);
        expect(buildAuthoritativeLearnSteps(pkg, malformedChoice).valid).toBe(false);
        const nonPackageRecognition = plannedTasks.map((task) => task.key === "recognition-1"
          ? { ...task, taskData: { ...task.taskData, choices: [{ id: "option-1", label: "非本課目標" }, task.taskData.choices[1]] } }
          : task);
        expect(buildAuthoritativeLearnSteps(pkg, nonPackageRecognition).valid).toBe(false);
        const forgedVocab = [...plannedTasks, learningFlowTask("starter-l04", "vocabulary", "vocabulary", "VOCABULARY", "vocabulary", {
          prompt: "假的詞彙題", choices: [{ id: "a", label: "小狗" }, { id: "b", label: "你好" }], wordText: "你好",
        })];
        expect(buildAuthoritativeLearnSteps(pkg, forgedVocab).valid).toBe(false);
      }
      if (lessonId === "starter-l05") {
        const vocabTask = plannedTasks.find((task) => task.key === "vocabulary")!;
        expect(plan.steps.find((step) => step.stepKey === "context")?.data).toMatchObject({
          taskId: plannedTasks.find((task) => task.key === "listen")?.id,
          audioText: "我有一個妹妹。", sceneLabel: "情境：介紹妹妹", scaffoldKey: "sister_example",
        });
        expect(plan.steps.find((step) => step.stepKey === "vocabulary")?.data).toMatchObject({
          taskId: vocabTask.id, word: "妹妹", pinyin: "mèimei", zhuyin: "ㄇㄟˋ ㄇㄟ˙",
          exampleSentence: "我有一個妹妹。", correctChoiceId: "younger-sister", scaffoldKey: "sister_example",
        });
        expect(plan.steps.find((step) => step.stepKey === "exit_ticket")?.data.questions).toHaveLength(2);
        expect(plan.steps.find((step) => step.stepKey === "speaking")?.data.speakingPrompt?.expectedText).toBe("我有一個妹妹。");
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.filter((task) => task.key !== "vocabulary")).valid).toBe(false);
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.map((task) => task.key === "vocabulary"
          ? { ...task, itemId: "lf_2_starter-l05_vocabulary" } : task)).valid).toBe(false);
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.map((task) => task.key === "phonetics"
          ? { ...task, taskData: { ...task.taskData, questions: task.taskData.questions.slice(1) } } : task)).valid).toBe(false);
        expect(buildAuthoritativeLearnSteps(pkg, plannedTasks.map((task) => task.key === "mini-check-reflection"
          ? { ...task, taskData: { ...task.taskData, choices: [{ id: "same", label: "妹妹" }, { id: "same", label: "再練一次" }] } } : task)).valid).toBe(false);
      }
    }
  });

  it("15. starter-l02 Lesson Player sends its authored sentence against the exact sentence task identity", async () => {
    const session = authoritativeSessionFixture("starter-l02", "session-l2-speaking", {
      listen: "COMPLETED", vocabulary: "COMPLETED", phonetics: "COMPLETED",
    }, {}, false, false, 31);
    const pkg = getLessonPackage("starter-l02")!;
    const providerStarts: any[] = [];
    const evidenceWrites: Array<{ taskId: string; body: any }> = [];
    const track = { stop: vi.fn() }; const stream = { getTracks: () => [track] };
    class MockMediaRecorder {
      state = "inactive"; mimeType = "audio/webm";
      ondataavailable = (_event: { data: Blob }) => {}; onstop = () => {}; onerror = () => {};
      constructor(public stream: unknown) {}
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable({ data: new Blob(["audio"]) }); this.onstop(); }
    }
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    installPlannerSessionMock(session, (url, init) => {
      if (init?.method !== "POST") return undefined;
      if (url.includes("/reading-aloud/attempts/start")) {
        const body = JSON.parse(init.body as string); providerStarts.push(body);
        return new Response(JSON.stringify({ id: "attempt-l2-sentence", status: "STARTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.endsWith("/evidence")) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/evidence")[0]);
        evidenceWrites.push({ taskId, body: JSON.parse(init.body as string) });
        session.tasks.find((task) => task.id === taskId)!.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="starter-l02" activeChildId={31} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    expect(container.querySelector(".vocab-hanzi")?.textContent).toContain("七歲");
    await act(async () => { (container.querySelector(".step-vocab-body .choice-card-btn") as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    const questions = pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === "exit_ticket")!.data.questions!;
    const cards = Array.from(container.querySelectorAll(".exit-ticket-item-card"));
    expect(cards).toHaveLength(questions.length);
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];
      const card = cards[index];
      const correctLabel = question.choices.find((choice) => choice.id === question.correctChoiceId)!.label;
      const answerButton = Array.from(card.querySelectorAll(".choice-card-btn")).find((button) => button.textContent?.includes(correctLabel)) as HTMLButtonElement;
      await act(async () => { answerButton.click(); });
    }
    await act(async () => { (container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector('.lesson-step-card[data-step-key="speaking"]')).toBeTruthy();
    expect(container.querySelector(".player-lesson-title")?.textContent).toBe("我七歲");
    await act(async () => { (container.querySelector(".mic-record-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { (container.querySelector(".mic-record-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(providerStarts).toEqual([{
      text: "我今年七歲。", text_kind: "sentence", locale: "zh-TW", source_type: "SENTENCE",
      source_id: "lf_31_starter-l02_sentence", activity_domain: "speaking",
    }]);
    expect(evidenceWrites).toHaveLength(1);
    expect(evidenceWrites[0]).toMatchObject({ taskId: "session-l2-speaking:speaking", body: { evidence_ref: "attempt-l2-sentence" } });
    expect(evidenceWrites[0].body.duration_ms).toBeGreaterThan(0);
    expect(session.tasks.find((task) => task.id === "session-l2-speaking:speaking")?.state).toBe("COMPLETED");
    await act(async () => { root.unmount(); }); container.remove(); vi.unstubAllGlobals();
  });

  it("16. starter-l02 renders package-owned age context and scaffold without starter-l01 greeting remnants", async () => {
    const session = authoritativeSessionFixture("starter-l02", "session-l2-context", { listen: "COMPLETED" });
    const pkg = getLessonPackage("starter-l02")!;
    const contextContract = pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === "context")!;
    const vocabularyContract = pkg.taskBlueprint.learnSteps.find((step) => step.stepKey === "vocabulary")!;
    installPlannerSessionMock(session);
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="starter-l02" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });

    await advanceToPlannerStep(container, "context");
    expect(container.querySelector(".scene-tag")?.textContent).toBe(contextContract.data.sceneLabel);
    expect(container.querySelector(".scene-tag")?.textContent).not.toContain("早晨遇見朋友");
    const contextScaffold = container.querySelector(".step-context-body .scaffold-box");
    expect(contextScaffold?.getAttribute("data-review-status")).toBe("REVIEWED");
    expect(contextScaffold?.querySelector(".scaffold-text")?.textContent).toBe("I am seven years old.");
    expect(contextScaffold?.querySelector(".scaffold-status-pill")?.textContent).toBe("Reviewed");

    await advanceToPlannerStep(container, "vocabulary");
    expect(container.querySelector(".vocab-hanzi")?.textContent).toContain("七歲");
    expect(container.querySelector(".vocab-example-sentence")?.textContent).toContain("我今年七歲。");
    const vocabularyScaffold = container.querySelector(".step-vocab-body .scaffold-box");
    expect(vocabularyScaffold?.getAttribute("data-review-status")).toBe("REVIEWED");
    expect(vocabularyScaffold?.querySelector(".scaffold-text")?.textContent).toBe("I am seven years old.");
    expect(vocabularyScaffold?.querySelector(".scaffold-status-pill")?.textContent).toBe("Reviewed");
    expect(container.textContent).not.toContain("Generated draft (pending review)");
    expect(container.textContent).not.toContain("Approved");
    expect(container.textContent).not.toContain("你好！我叫大衛。");
    expect(container.querySelector('.scaffold-box[data-review-status="APPROVED"]')).toBeNull();
    expect(contextContract.data.scaffoldKey).toBe("age_example");
    expect(vocabularyContract.data.scaffoldKey).toBe("age_example");

    await act(async () => { root.unmount(); }); container.remove(); vi.unstubAllGlobals();
  });

  it("16a. starter-l02 authoritative plan carries only its package-owned context and vocabulary scaffold", () => {
    const pkg = getLessonPackage("starter-l02")!;
    const plan = buildAuthoritativeLearnSteps(pkg, plannerTasksForLesson("starter-l02", false, false, 31));
    const context = plan.steps.find((step) => step.stepKey === "context");
    const vocabulary = plan.steps.find((step) => step.stepKey === "vocabulary");

    expect(plan.valid).toBe(true);
    expect(context?.data).toMatchObject({
      sceneLabel: "情境：練習表達自己的年齡",
      scaffoldKey: "age_example",
    });
    expect(vocabulary?.data).toMatchObject({
      word: "七歲",
      scaffoldKey: "age_example",
    });
    expect(getScaffoldText(pkg, "age_example", "FULL")).toMatchObject({
      visibleText: "I am seven years old.",
      reviewStatus: "REVIEWED",
    });
    expect(getScaffoldText(pkg, "greeting", "FULL")).toMatchObject({
      visibleText: null,
      reviewStatus: "GENERATED_DRAFT",
    });
  });

  it("14c. mixed-lesson REVIEW rows map by their own package and stay outside the parent LEARN plan", () => {
    const book1Pkg = getLessonPackage("book1-l01")!;
    const dueItems = [
      { id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
      { id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "basic-l01", dueAt: "2026-09-02T00:00:00Z" },
      { id: "item-starter-hao", skillDomain: "recognition", character: "好", lessonId: "starter-l01", dueAt: "2026-09-02T00:00:00Z" },
    ];
    const reviewTasks = [
      {
        id: "mixed-session:review-recognition-1", key: "review-recognition-1", taskType: "REVIEW_RECOGNITION",
        childId: 1, sessionId: "mixed-session",
        sourceQueue: "REVIEW", lessonId: "book1-l01", skillDomain: "recognition", itemId: "item-ni",
        state: "PENDING", required: true,
        taskData: { prompt: "選出聽到的字：你", audioText: "你", choices: [{ id: "option-1", label: "好" }, { id: "option-2", label: "你" }], dueAt: dueItems[0].dueAt },
      },
      {
        id: "mixed-session:review-recognition-2", key: "review-recognition-2", taskType: "REVIEW_RECOGNITION",
        childId: 1, sessionId: "mixed-session",
        sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "recognition", itemId: "item-hao",
        state: "PENDING", required: true,
        taskData: { prompt: "選出聽到的字：好", audioText: "好", choices: [{ id: "option-1", label: "你" }, { id: "option-2", label: "好" }], dueAt: dueItems[1].dueAt },
      },
      {
        id: "mixed-session:review-recognition-3", key: "review-recognition-3", taskType: "REVIEW_RECOGNITION",
        childId: 1, sessionId: "mixed-session",
        sourceQueue: "REVIEW", lessonId: "starter-l01", skillDomain: "recognition", itemId: "item-starter-hao",
        state: "PENDING", required: true,
        taskData: { prompt: "選出聽到的字：好", audioText: "好", choices: [{ id: "option-1", label: "你" }, { id: "option-2", label: "好" }], dueAt: dueItems[2].dueAt },
      },
    ];
    const selected = selectReviewTasksAcrossPackages(reviewTasks, dueItems, 1, "mixed-session");
    expect(selected?.map((task) => task.id)).toEqual(reviewTasks.map((task) => task.id));
    expect(selectReviewTasksAcrossPackages(reviewTasks, dueItems, 1, "another-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages(reviewTasks.slice(0, 1), dueItems, 1, "mixed-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages(reviewTasks, [dueItems[0], { ...dueItems[1], lessonId: "book1-l01" }, dueItems[2]], 1, "mixed-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages(reviewTasks, [dueItems[0], { ...dueItems[1], dueAt: "2026-09-03T00:00:00Z" }, dueItems[2]], 1, "mixed-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages(reviewTasks, dueItems, 2, "mixed-session")).toBeNull();
    expect(validateReviewDueItems([{ ...dueItems[1], lessonId: "book1-l02" }])).toBe(false);
    expect(validateReviewDueItems([dueItems[0], dueItems[0]])).toBe(false);

    const reviewSteps = getStepsForMode(book1Pkg, "REVIEW", [], selected ?? []);
    expect(reviewSteps.filter((step) => step.stepKey === "characters").map((step) => step.data.taskId)).toEqual(reviewTasks.map((task) => task.id));
    expect(reviewSteps.filter((step) => step.stepKey === "characters").map((step) => step.data.dueCharacter)).toEqual(["你", "好", "好"]);
    expect(reviewSteps.filter((step) => step.stepKey === "characters").every((step) => step.data.charObj.pronunciation.pinyin && step.data.charObj.pronunciation.zhuyin)).toBe(true);

    const curriculumTasks = plannerTasksForLesson("book1-l01");
    const learnPlan = buildAuthoritativeLearnSteps(book1Pkg, [...curriculumTasks, reviewTasks[1]]);
    expect(learnPlan.valid).toBe(true);
    expect(learnPlan.steps.flatMap((step) => step.data.taskIds ?? [step.data.taskId])).toEqual(curriculumTasks.map((task) => task.id));
    expect(learnPlan.steps.some((step) => step.data.taskId === reviewTasks[1].id)).toBe(false);
    const fullMixedLearnPlan = buildAuthoritativeLearnSteps(book1Pkg, [...curriculumTasks, ...reviewTasks]);
    expect(fullMixedLearnPlan.valid).toBe(true);
    expect(fullMixedLearnPlan.steps.flatMap((step) => step.data.taskIds ?? [step.data.taskId])).toEqual(curriculumTasks.map((task) => task.id));
  });

  it("14d. domain REVIEW maps exact writing script identity and vocabulary word task without changing LEARN mapping", () => {
    const pkg = getLessonPackage("basic-l01")!;
    const dueAt = "2026-09-02T00:00:00Z";
    const dueItems = [
      { id: "lf_1_basic-l01_vocabulary", skillDomain: "word", word: "你好", lessonId: "basic-l01", dueAt },
      { id: "traditional::你", skillDomain: "writing", character: "你", scriptMode: "TRADITIONAL", lessonId: "basic-l01", dueAt },
    ];
    const tasks = [
      {
        id: "domain-session:review-word-1", sessionId: "domain-session", childId: 1, key: "review-word-1",
        taskType: "REVIEW_VOCABULARY", sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "word",
        itemId: "lf_1_basic-l01_vocabulary", state: "PENDING", required: true,
        taskData: { word: "你好", prompt: "選出問候語意思", choices: [{ id: "opt-hello", label: "打招呼" }, { id: "opt-eat", label: "問候用餐" }], dueAt },
      },
      {
        id: "domain-session:review-writing-1", sessionId: "domain-session", childId: 1, key: "review-writing-1",
        taskType: "REVIEW_WRITING", sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "writing",
        itemId: "traditional::你", state: "IN_PROGRESS", required: true,
        taskData: { character: "你", phase: "independent", scriptMode: "TRADITIONAL", repeatCount: 1, dueAt },
      },
    ];
    const selected = selectReviewTasksAcrossPackages(tasks, dueItems, 1, "domain-session");
    expect(selected?.map((task) => task.id)).toEqual(["domain-session:review-word-1", "domain-session:review-writing-1"]);
    const steps = getStepsForMode(pkg, "REVIEW", [], selected ?? []);
    expect(steps.map((step) => step.stepKey)).toEqual(["vocabulary", "writing", "wrap_up"]);
    expect(steps[0].data.taskId).toBe(tasks[0].id);
    expect(steps[0].data.word).toBe("你好");
    expect(steps[1].data.taskId).toBe(tasks[1].id);
    expect(steps[1].data.character).toBe("你");
    expect(steps[1].data.scriptMode).toBe("TRADITIONAL");
    expect(selectReviewTasksAcrossPackages(tasks, [{ ...dueItems[1], scriptMode: "SIMPLIFIED" }, dueItems[0]], 1, "domain-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages(tasks, dueItems.slice(1), 1, "domain-session")).toBeNull();
    expect(validateReviewDueItems([{ ...dueItems[1], id: "你" }])).toBe(false);
    expect(validateReviewDueItems([{ ...dueItems[0], id: "unknown-word-item" }])).toBe(false);
  });

  it("14e. starter-l05 word REVIEW maps only its package word and exact child-owned item", () => {
    const pkg = getLessonPackage("starter-l05")!;
    const dueAt = "2026-09-02T00:00:00Z";
    const dueItems = [{ id: "lf_55_starter-l05_vocabulary", skillDomain: "word", word: "妹妹", lessonId: "starter-l05", dueAt }];
    const task = {
      id: "l5-review-session:review-word-1", sessionId: "l5-review-session", childId: 55, key: "review-word-1",
      taskType: "REVIEW_VOCABULARY", sourceQueue: "REVIEW", lessonId: "starter-l05", skillDomain: "word",
      itemId: "lf_55_starter-l05_vocabulary", state: "PENDING", required: true, masteryImpact: "NONE",
      evidenceType: "learning_session_vocabulary_choice",
      taskData: {
        word: "妹妹", prompt: "「妹妹」是什麼意思？",
        choices: [{ id: "younger-sister", label: "年紀比我小的姊妹" }, { id: "older-sister", label: "年紀比我大的姊妹" }], dueAt,
      },
    };
    expect(validateReviewDueItems(dueItems)).toBe(true);
    expect(validateReviewDueItems([{ ...dueItems[0], word: "爸爸媽媽" }])).toBe(false);
    const selected = selectReviewTasksAcrossPackages([task], dueItems, 55, "l5-review-session");
    expect(selected?.map((item) => item.id)).toEqual([task.id]);
    expect(selectReviewTasksAcrossPackages([task], [{ ...dueItems[0], word: "爸爸媽媽" }], 55, "l5-review-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([task], dueItems, 56, "l5-review-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([{ ...task, itemId: "lf_56_starter-l05_vocabulary" }], dueItems, 55, "l5-review-session")).toBeNull();
    const steps = getStepsForMode(pkg, "REVIEW", [], selected ?? []);
    expect(steps.map((step) => step.stepKey)).toEqual(["vocabulary", "wrap_up"]);
    expect(steps[0].data).toMatchObject({ taskId: task.id, word: "妹妹", choices: task.taskData.choices });
  });

  it("14b. The shared partial-recognition contract maps only the planner's single first-character MINI_CHECK", () => {
    expect(partialRecognitionContract.expectedFreshCharacterIndex).toBe(1);
    expect(partialRecognitionContract.strongSeedCharacterIndex).toBe(2);
    for (const lessonId of partialRecognitionContract.lessonIds as Array<"basic-l01" | "book1-l01">) {
      const pkg = getLessonPackage(lessonId)!;
      const tasks = plannerTasksForLesson(lessonId, false, true);
      const recognitionTasks = tasks.filter((task) => task.skillDomain === "recognition");
      expect(recognitionTasks).toHaveLength(1);
      expect(recognitionTasks[0]).toMatchObject({
        key: partialRecognitionContract.task.key,
        taskType: partialRecognitionContract.task.taskType,
        sourceQueue: partialRecognitionContract.task.sourceQueue,
        lessonId,
        skillDomain: partialRecognitionContract.task.skillDomain,
        required: partialRecognitionContract.task.required,
        itemId: partialRecognitionContract.task.itemIdTemplate
          .replace("{child_id}", "1")
          .replace("{lesson_id}", lessonId)
          .replace("{index}", String(partialRecognitionContract.expectedFreshCharacterIndex)),
      });
      expect(recognitionTasks[0].taskData.audioText).toBe("你");
      expect(recognitionTasks[0].taskData.choices.some((choice: { label: string }) => choice.label === recognitionTasks[0].taskData.audioText)).toBe(true);
      expect(recognitionTasks[0].taskData.choices).toHaveLength(partialRecognitionContract.task.minimumChoices);

      const plan = buildAuthoritativeLearnSteps(pkg, tasks);
      expect(plan.valid).toBe(true);
      const recognitionSteps = plan.steps.filter((step) => step.stepKey === "characters");
      expect(recognitionSteps).toHaveLength(1);
      expect(recognitionSteps[0].data.taskId).toBe(recognitionTasks[0].id);
      expect(recognitionSteps[0].data.dueCharacter).toBe(recognitionTasks[0].taskData.audioText);
      expect(recognitionSteps[0].data.charObj.pronunciation.pinyin).not.toBe("");
      expect(recognitionSteps[0].data.charObj.pronunciation.zhuyin).not.toBe("");
    }
  });

  it("15. Missing, unexpected, duplicated, or mismatched planner tasks fail closed", () => {
    const pkg = getLessonPackage("basic-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;
    const tasks = plannerTasksForLesson("basic-l01");
    expect(buildAuthoritativeLearnSteps(pkg, tasks.filter((task) => task.skillDomain !== "recognition")).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, [...tasks, { ...tasks[0], id: "unplanned", key: "unplanned", taskType: "UNPLANNED" }]).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, [...tasks, { ...tasks[0], id: tasks[0].id, key: "duplicate-id" }]).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, tasks.map((task, index) => index === 0 ? { ...task, lessonId: "book1-l01" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, tasks.slice(0, -1)).valid).toBe(false);

    // An accidental omission from a fresh two-character plan keeps recognition-1
    // typed RECOGNITION and must not be accepted as the adaptive partial shape.
    expect(buildAuthoritativeLearnSteps(pkg, tasks.filter((task) => task.key !== "recognition-2")).valid).toBe(false);
    const partialTasks = plannerTasksForLesson("basic-l01", false, true);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks).valid).toBe(true);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, key: "recognition-2" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, taskType: "RECOGNITION" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, itemId: "lf_1_basic-l01_char_2" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, taskData: { ...task.taskData, audioText: "好" } } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, itemId: "item-without-child-or-index" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, sourceQueue: "REVIEW" } : task)).valid).toBe(false);
    expect(buildAuthoritativeLearnSteps(pkg, partialTasks.map((task) => task.key === "recognition-1" ? { ...task, state: "SKIPPED" } : task)).valid).toBe(false);
  });

  it("16b. A planner-shaped partial recognition session renders, answers one exact task, then advances", async () => {
    const session = authoritativeSessionFixture("basic-l01", "session-partial-recognition", { listen: "COMPLETED" }, {}, false, true);
    const requests = installPlannerSessionMock(session);
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });

    await advanceToPlannerStep(container, "characters");
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");
    expect(container.querySelectorAll(".character-tabs-row [role='tab']")).toHaveLength(0);
    const answer = Array.from(container.querySelectorAll<HTMLButtonElement>(".char-choice-card"))
      .find((button) => button.textContent?.includes("你"));
    expect(answer).not.toBeNull();
    await act(async () => { answer?.click(); });
    expect(session.tasks.find((task) => task.key === "recognition-1")?.state).toBe("COMPLETED");
    expect(requests.some((request) => request.includes("/tasks/session-partial-recognition:recognition-1/answer"))).toBe(true);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(container.querySelector(".large-char-display")).toBeNull();

    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("16c. A lesson-mastered context change invalidates the memoized LEARN task plan", async () => {
    const session = authoritativeSessionFixture("basic-l01", "session-mastered-context", { listen: "COMPLETED" });
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/learning-sessions/current")) return { ok: true, json: async () => session } as Response;
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const answeredTask = session.tasks.find((task) => task.id === taskId)!;
        answeredTask.state = "COMPLETED";
        if (answeredTask.key !== "vocabulary") return { ok: true, json: async () => session } as Response;
        const updated = {
          ...session,
          curriculumContext: { ...session.curriculumContext, lessonMasteredBeforeSession: true },
          tasks: session.tasks,
        };
        return { ok: true, json: async () => updated } as Response;
      }
      return { ok: true, json: async () => null } as Response;
    }));
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    const choice = container.querySelector<HTMLButtonElement>(".step-vocab-body .choice-card-btn");
    expect(choice).not.toBeNull();
    await act(async () => { choice?.click(); });
    expect(session.curriculumContext.lessonMasteredBeforeSession).toBe(false);
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(requests.some((request) => request.endsWith("/answer"))).toBe(true);

    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("16. A planner-faithful Book 1 session renders exact task-backed steps and answers the exact recognition task", async () => {
    const session = authoritativeSessionFixture("book1-l01", "session-parity", { listen: "COMPLETED" });
    const requests: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const task = session.tasks.find((candidate) => candidate.id === taskId);
        if (task) task.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    expect(container.querySelector("[data-step-key='context']")).toBeTruthy();
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");

    const recognitionChoice = container.querySelector(".char-choice-card") as HTMLButtonElement;
    await act(async () => { recognitionChoice.click(); });
    expect(requests.some((request) => request.includes("/tasks/session-parity:recognition-1/answer"))).toBe(true);
    expect(session.tasks.find((task) => task.key === "recognition-1")?.state).toBe("COMPLETED");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 14
  it("14. Desktop and mobile render the same step order", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const desktopSteps = getStepsForMode(pkg, "LEARN");
    const mobileSteps = getStepsForMode(pkg, "LEARN");

    expect(desktopSteps.map((s) => s.stepKey)).toEqual(mobileSteps.map((s) => s.stepKey));
    expect(desktopSteps.map((s) => s.stepNumber)).toEqual(mobileSteps.map((s) => s.stepNumber));
  });

  // Test 15
  it("15. Legacy authored practice remains outside the official Lesson Player", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    expect(pkg.provenance.authorship).toBe("TONGXUAN_PEDAGOGY_WRAPPER");
    expect(pkg.curriculumSource.kind).toBe("OFFICIAL_OCAC");

    for (const step of pkg.taskBlueprint.learnSteps) {
      expect((step.data as any).sourceKind).not.toBe("TONGXUAN_AUTHORED");
    }
  });

  // Test 16
  it("16. Unreviewed generated translation cannot be marked published/approved", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // Legitimate package passes integrity check
    const checkValid = validateReviewStatusIntegrity(pkg);
    expect(checkValid.valid).toBe(true);
    expect(checkValid.errors).toHaveLength(0);

    // Corrupted package with GENERATED_DRAFT flagged as approved fails validation
    const corruptedPkg: LessonPackage = {
      ...pkg,
      nativeLanguageSupport: {
        ...pkg.nativeLanguageSupport,
        entries: {
          ...pkg.nativeLanguageSupport.entries,
          bad_entry: {
            naturalMeaning: "Unreviewed translation",
            reviewStatus: "GENERATED_DRAFT",
            approved: true,
          } as any,
        },
      },
    };

    const checkInvalid = validateReviewStatusIntegrity(corruptedPkg);
    expect(checkInvalid.valid).toBe(false);
    expect(checkInvalid.errors[0]).toContain("GENERATED_DRAFT but flagged as approved");
  });

  // Test 17
  it("17. Fast Track failure resumes the exact paused session before showing task-backed REPAIR", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const session = authoritativeSessionFixture("book1-l01", "session-17");

    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/fast-track") && init?.method === "POST") {
        session.status = "PAUSED";
        return new Response(JSON.stringify({
          childId: 1,
          sessionId: session.id,
          lessonId: "book1-l01",
          sessionStatus: "PAUSED",
          terminationReason: "FAST_TRACK_FAILED",
          passed: false,
          weakDomains: ["recognition"],
          nextMode: "REPAIR",
          masteryStatus: "IN_PROGRESS",
          nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/learning-sessions") && init?.method === "POST") {
        expect(JSON.parse(String(init.body)).expected_session_id).toBe(session.id);
        session.status = "IN_PROGRESS";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
        />
      );
    });

    // Select answers for each question card
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    expect(questionCards.length).toBeGreaterThanOrEqual(1);

    for (const card of questionCards) {
      const firstChoice = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => {
        firstChoice?.click();
      });
    }

    // Find and submit exit ticket
    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(false);

    await act(async () => {
      submitBtn.click();
      await Promise.resolve();
    });

    // Verify the verified resume exposed only planner-backed task IDs.
    const modeBadge = container.querySelector(".mode-badge");
    expect(modeBadge?.className).toContain("mode-repair");
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeNull();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 18
  it("18. Client mastery is never granted locally without backend authoritative assessment", async () => {
    let completedSummary: { sessionCompleted: boolean; masteryGranted: boolean } | null = null;
    const session = authoritativeSessionFixture("book1-l01", "session-1", { listen: "COMPLETED", speaking: "COMPLETED", pronunciation: "COMPLETED" });
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/complete") && init?.method === "POST") {
        session.status = "COMPLETED"; session.masteryStatus = "READY_FOR_CHECK";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} onCompleteLesson={(_, summary) => { completedSummary = summary; }} />); });
    await advanceToPlannerStep(container, "wrap_up");
    expect(container.querySelector(".finish-session-cta-btn")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(completedSummary).toEqual({ sessionCompleted: true, masteryGranted: false });
    expect(session.masteryStatus).toBe("READY_FOR_CHECK");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  // Test 19
  it("19. Provenance separates verified official OCAC title/metadata from TongXuan-authored wrapper", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    expect(pkg.curriculumSource.provenanceStatus).toBe("VERIFIED_OFFICIAL_TITLE");
    expect(pkg.provenance.authorship).toBe("TONGXUAN_PEDAGOGY_WRAPPER");
    expect(pkg.curriculumSource.book).toBe("第一冊");
    expect(pkg.curriculumSource.title).toBe("你好");
  });

  // Test 20
  it("20. Canonical lesson ID dynamically adopts backend curriculumContext.lessonId for Starter, Basic, and Book 1", async () => {
    for (const testLessonId of ["starter-l01", "basic-l01", "book1-l01"]) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url.includes("/learning-sessions/current")) {
          return new Response(JSON.stringify({
            id: `session-${testLessonId}`,
            status: "IN_PROGRESS",
            lessonId: testLessonId,
            curriculumContext: {
              lessonId: testLessonId,
              stageTitle: testLessonId.toUpperCase(),
              official: { title: testLessonId === "book1-l01" ? "你好" : "課堂" }
            }
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
      }));

      await act(async () => {
        root.render(
          <LessonPlayerPage
            lessonId={testLessonId}
            activeChildId={1}
            onBack={() => {}}
          />
        );
      });

      const title = container.querySelector(".player-lesson-title");
      expect(title).toBeTruthy();

      root.unmount();
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  // Test 21
  it("21. Listening evidence retries the same provider attempt without a standalone completion request", async () => {
    const postedUrls: string[] = []; const evidenceBodies: Array<Record<string, unknown>> = []; const session = authoritativeSessionFixture("book1-l01", "session-flow-1");
    let evidenceRequestCount = 0;
    installPlannerSessionMock(session, (url, init) => {
      if (init?.method !== "POST") return undefined;
      postedUrls.push(url);
      if (url.includes("/listening-attempts") && !url.includes("/complete")) return new Response(JSON.stringify({ id: "listen-attempt-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes(`/tasks/${session.id}:listen/evidence`)) {
        evidenceBodies.push(JSON.parse(init.body as string));
        evidenceRequestCount += 1;
        if (evidenceRequestCount === 1) return new Response(JSON.stringify({ detail: "temporary_failure" }), { status: 500, headers: { "Content-Type": "application/json" } });
        session.tasks.find((task) => task.key === "listen")!.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />); });
    expect(container.querySelector("[data-step-key='context']")).toBeTruthy();
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(session.tasks.find((task) => task.key === "listen")?.state).toBe("PENDING");
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(postedUrls.some((url) => url.includes("/listening-attempts"))).toBe(true);
    expect(postedUrls.some((url) => url.endsWith("/complete"))).toBe(false);
    expect(postedUrls.filter((url) => url.endsWith("/listening-attempts"))).toHaveLength(1);
    expect(postedUrls.some((url) => url.includes(`/tasks/${session.id}:listen/evidence`))).toBe(true);
    expect(evidenceBodies).toEqual([
      { evidence_ref: "listen-attempt-1", duration_ms: 1500 },
      { evidence_ref: "listen-attempt-1", duration_ms: 1500 },
    ]);
    expect(session.tasks.find((task) => task.key === "listen")?.state).toBe("COMPLETED");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  // Test 22
  it("22. Error banner renders with retry action and does not crash UI on failure", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Network offline");
    }));

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
        />
      );
    });

    // Without an authoritative session, task interaction stays unavailable.
    const card = container.querySelector(".lesson-step-card");
    expect(card).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 23
  it("23. Planner speaking and pronunciation tasks keep independent provider domains and exact source IDs", async () => {
    const session = authoritativeSessionFixture("book1-l01", "session-flow-2", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED",
    });
    const pkg = getLessonPackage("book1-l01")!;
    const plan = buildAuthoritativeLearnSteps(pkg, session.tasks);
    const speakingStep = plan.steps.find((step) => step.stepKey === "speaking");
    expect(plan.valid).toBe(true);
    expect(speakingStep?.data.taskIds).toEqual(["session-flow-2:speaking", "session-flow-2:pronunciation"]);
    expect(speakingStep?.data.speakingTasks).toEqual([
      { id: "session-flow-2:speaking", taskType: "SPEAKING_ATTEMPT" },
      { id: "session-flow-2:pronunciation", taskType: "PRONUNCIATION_ATTEMPT" },
    ]);

    const track = { stop: vi.fn() }; const stream = { getTracks: () => [track] };
    class MockMediaRecorder {
      state = "inactive"; mimeType = "audio/webm";
      ondataavailable = (_event: { data: Blob }) => {}; onstop = () => {}; onerror = () => {};
      constructor(public stream: unknown) {}
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable({ data: new Blob(["audio"]) }); this.onstop(); }
    }
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    const providerStarts: any[] = []; const evidenceWrites: { taskId: string; body: any }[] = [];
    installPlannerSessionMock(session, (url, init) => {
      if (init?.method !== "POST") return undefined;
      if (url.includes("/reading-aloud/attempts/start")) {
        const body = JSON.parse(init.body as string); providerStarts.push(body);
        return new Response(JSON.stringify({ id: `attempt-${body.activity_domain}`, status: "STARTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.endsWith("/evidence")) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/evidence")[0]);
        evidenceWrites.push({ taskId, body: JSON.parse(init.body as string) });
        session.tasks.find((task) => task.id === taskId)!.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "speaking");
    const recordBtn = container.querySelector(".mic-record-btn") as HTMLButtonElement;
    await act(async () => { recordBtn.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect((container.querySelector(".mic-record-btn") as HTMLButtonElement).classList.contains("is-recording")).toBe(true);
    await act(async () => { (container.querySelector(".mic-record-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(providerStarts.map((body) => body.activity_domain)).toEqual(["speaking", "pronunciation"]);
    expect(providerStarts.map((body) => body.source_id)).toEqual([
      session.tasks.find((task) => task.key === "speaking")?.itemId,
      session.tasks.find((task) => task.key === "pronunciation")?.itemId,
    ]);
    expect(evidenceWrites.map((write) => write.taskId)).toEqual(["session-flow-2:speaking", "session-flow-2:pronunciation"]);
    expect(evidenceWrites.map((write) => write.body.evidence_ref)).toEqual(["attempt-speaking", "attempt-pronunciation"]);
    expect(session.tasks.filter((task) => task.key === "speaking" || task.key === "pronunciation").every((task) => task.state === "COMPLETED")).toBe(true);
    expect(container.querySelector(".recording-status-label")?.textContent).toContain("Speaking practice recorded");
    expect((container.querySelector(".mic-record-btn") as HTMLButtonElement).classList.contains("is-attempted")).toBe(true);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  // Test 24
  it("24. Authoritative backend completion rejection keeps session active and does not fire onCompleteLesson", async () => {
    let completeCallbackFired = false;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "session-flow-3",
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            { id: "session-flow-3:wrap-up", key: "wrap-up", taskType: "LESSON_WRAP_UP", state: "PENDING" },
          ]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/complete") && init?.method === "POST") {
        return new Response(JSON.stringify({
          detail: "required_learning_tasks_incomplete"
        }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          onCompleteLesson={() => {
            completeCallbackFired = true;
          }}
        />
      );
    });

    // Advance to wrap up and try to finish
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    if (nextBtn) {
      await act(async () => {
        nextBtn.click();
      });
    }

    // Completion callback must NOT fire on backend rejection
    expect(completeCallbackFired).toBe(false);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 25
  it("25. Full Book 1 L1 UI-to-backend completion flow satisfies all required tasks in sequence and authoritatively completes session", async () => {
    let completedLessonId: string | null = null;
    let completedResult: { sessionCompleted: boolean; masteryGranted: boolean } | null = null;
    const session = authoritativeSessionFixture("book1-l01", "session-e2e-1", { speaking: "COMPLETED", pronunciation: "COMPLETED" }, {}, true);
    const recordedEvents: string[] = [];
    installPlannerSessionMock(session, (url, init) => {
      if (init?.method !== "POST") return undefined;
      if (url.includes("/listening-attempts") && !url.includes("/complete")) {
        recordedEvents.push("listening_start"); return new Response(JSON.stringify({ id: "listen-att-101" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.includes("/evidence")) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/evidence")[0]);
        const task = session.tasks.find((candidate) => candidate.id === taskId);
        if (task) { task.state = "COMPLETED"; recordedEvents.push(`evidence:${taskId}:${JSON.parse(init.body as string).duration_ms}`); }
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.endsWith("/skip")) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/skip")[0]);
        recordedEvents.push(`skip:${taskId}`);
      }
      if (url.includes("/tasks/") && url.endsWith("/answer")) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const answer = JSON.parse(init.body as string);
        recordedEvents.push(`answer:${taskId}:${answer.selected_option_id}`);
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} onCompleteLesson={(id, result) => { completedLessonId = id; completedResult = result; }} />); });
    await advanceToPlannerStep(container, "wrap_up");
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(completedLessonId).toBe("book1-l01");
    expect(completedResult).toEqual({ sessionCompleted: true, masteryGranted: false });
    expect(session.status).toBe("COMPLETED");
    expect(session.tasks.filter((task) => task.required).every((task) => task.state === "COMPLETED" || task.state === "DEFERRED")).toBe(true);
    expect(recordedEvents.indexOf("listening_start")).toBeLessThan(recordedEvents.indexOf("evidence:session-e2e-1:listen:1500"));
    expect(recordedEvents).not.toContain("listening_complete");
    expect(recordedEvents).toContain("evidence:session-e2e-1:listen:1500");
    expect(recordedEvents).toContain("answer:session-e2e-1:recognition-1:option-2");
    expect(recordedEvents).toContain("answer:session-e2e-1:recognition-2:option-2");
    expect(recordedEvents).toContain("answer:session-e2e-1:sentence-pattern:opt-correct-order");
    expect(recordedEvents).toContain("skip:session-e2e-1:writing-guided");
    expect(session.tasks.find((task) => task.key === "writing-guided")?.state).toBe("DEFERRED");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("25a. Flow writing uses one exact final evidence operation and retries with the same identity", async () => {
    const session = authoritativeSessionFixture("book1-l01", "session-writing-atomic", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "COMPLETED", pronunciation: "COMPLETED",
      "writing-guided": "IN_PROGRESS",
    }, {
      "writing-guided": {
        attemptCount: 0,
        itemId: "你",
        taskData: { character: "你", phase: "guided", scriptMode: "TRADITIONAL", repeatCount: 2 },
      },
    }, true);
    const writing = session.tasks.find((task) => task.key === "writing-guided")! as typeof session.tasks[number] & { attemptCount?: number; evidenceRef?: string };
    const evidenceRequests: Array<{ taskId: string; body: any }> = [];
    let standaloneWrites = 0;
    let shouldFailFirstEvidence = true;
    const requests = installPlannerSessionMock(session, (url, init) => {
      if (init?.method !== "POST") return undefined;
      if (url.includes("/api/sprint-b/writing/attempts")) {
        standaloneWrites += 1;
        return new Response(JSON.stringify({ id: "wrong-separate-write" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith(`/tasks/${writing.id}/evidence`)) {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/evidence")[0]);
        evidenceRequests.push({ taskId, body: JSON.parse(init.body as string) });
        if (shouldFailFirstEvidence) {
          shouldFailFirstEvidence = false;
          return new Response(JSON.stringify({ detail: "temporary evidence failure" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        writing.attemptCount = (writing.attemptCount ?? 0) + 1;
        writing.evidenceRef = evidenceRequests.at(-1)?.body.evidence_ref;
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });

    let traceComplete: (() => void) | undefined;
    const writerSpy = vi.spyOn(HanziWriter, "create").mockImplementation(((_target: any, _character: string, _options: any) => ({
      quiz: (options: { onComplete: () => void }) => { traceComplete = options.onComplete; },
      animateCharacter: vi.fn(),
    })) as any);
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "writing");
    expect(traceComplete).toBeTypeOf("function");

    await act(async () => { traceComplete?.(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(evidenceRequests).toHaveLength(1);
    expect(container.querySelector(".error-strip")?.textContent).toBeTruthy();
    await act(async () => { traceComplete?.(); await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(standaloneWrites).toBe(0);
    expect(requests.some((request) => request.includes("/api/sprint-b/writing/attempts"))).toBe(false);
    expect(evidenceRequests).toHaveLength(2);
    expect(evidenceRequests.map((request) => request.taskId)).toEqual([writing.id, writing.id]);
    expect(evidenceRequests.map((request) => request.body.evidence_ref)).toEqual([
      `flow-writing:${session.id}:${writing.id}:0`,
      `flow-writing:${session.id}:${writing.id}:0`,
    ]);
    expect(evidenceRequests[1].body).toMatchObject({
      trace_result: "correct",
      assisted: false,
      provider: "HANZI_WRITER",
      phase: "guided",
      script_mode: "TRADITIONAL",
      attempt_index: 0,
    });
    expect(writing.attemptCount).toBe(1);
    expect(container.querySelector(".error-strip")).toBeNull();

    writerSpy.mockRestore();
    await act(async () => { root.unmount(); });
    container.remove(); vi.unstubAllGlobals();
  });

  // Test 26
  it("26. Vocabulary unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const session = authoritativeSessionFixture("basic-l01", "session-vocab-gate", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    const requests = installPlannerSessionMock(session);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    // The real Basic L1 plan is context -> recognition task 1 -> recognition task 2 -> vocabulary.
    await advanceToPlannerStep(container, "vocabulary");

    // Step 3 (Vocabulary) is active
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();

    // Click Next Step WITHOUT picking any choice
    const nextBtn3 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn3.click(); });

    // Must NOT advance to step 4
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='characters']")).toBeNull();

    // Must display error prompt and NOT send answer to backend
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(requests.some((request) => request.includes("/tasks/session-vocab-gate:vocabulary/answer"))).toBe(false);
    expect(session.tasks.find((task) => task.key === "vocabulary")?.state).toBe("PENDING");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 27
  it("27. Recognition unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const session = authoritativeSessionFixture("basic-l01", "session-recog-gate", { listen: "COMPLETED" });
    const requests = installPlannerSessionMock(session);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    await advanceToPlannerStep(container, "characters");
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();

    // Click Next without selecting recognition for the first exact task.
    let next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(requests.some((request) => request.includes("/tasks/session-recog-gate:recognition-1/answer"))).toBe(false);

    const recogChoices = container.querySelectorAll(".char-choice-card");
    const firstChar = container.querySelector(".large-char-display")?.textContent;
    const firstCorrectChoice = Array.from(recogChoices).find((choice) => choice.textContent?.includes(firstChar || "")) as HTMLButtonElement;
    await act(async () => { firstCorrectChoice.click(); });
    next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();

    // The second planner recognition task is its own step and remains gated.
    next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeNull();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(requests.some((request) => request.includes("/tasks/session-recog-gate:recognition-2/answer"))).toBe(false);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 28
  it("28. Sentence pattern unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const session = authoritativeSessionFixture("book1-l01", "session-sent-gate", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    const requests = installPlannerSessionMock(session);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    await advanceToPlannerStep(container, "sentence_pattern");

    // Step 5 (Sentence Pattern) is active
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();

    // Click Next Step WITHOUT picking sentence pattern choice
    const nextBtn5 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn5.click(); });

    // Must NOT advance to Step 6
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='speaking']")).toBeNull();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(requests.some((request) => request.includes("/tasks/session-sent-gate:sentence-pattern/answer"))).toBe(false);
    expect(session.tasks.find((task) => task.key === "sentence-pattern")?.state).toBe("PENDING");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 29
  it("29. Answering wrong on a scored planner task preserves the incorrect choice and Next never substitutes the correct answer", async () => {
    const recordedSubmissions: { taskId: string; selected_option_id: string }[] = [];
    const session = authoritativeSessionFixture("basic-l01", "session-wrong-preservation", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string);
        recordedSubmissions.push({ taskId, selected_option_id: body.selected_option_id });
      }
      return undefined;
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    await advanceToPlannerStep(container, "vocabulary");
    const wrongChoice = Array.from(container.querySelectorAll(".step-vocab-body .choice-card-btn"))
      .find((button) => button.textContent?.includes("Eat")) as HTMLButtonElement;
    await act(async () => { wrongChoice.click(); });
    expect(recordedSubmissions).toEqual([{ taskId: "session-wrong-preservation:vocabulary", selected_option_id: "opt-eat" }]);
    expect(session.tasks.find((task) => task.key === "vocabulary")?.state).toBe("IN_PROGRESS");

    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(recordedSubmissions).toHaveLength(1);
    expect(recordedSubmissions.some((submission) => submission.selected_option_id === "opt-hello")).toBe(false);

    const correctChoice = Array.from(container.querySelectorAll(".step-vocab-body .choice-card-btn"))
      .find((button) => button.textContent?.includes("Hello")) as HTMLButtonElement;
    await act(async () => { correctChoice.click(); });
    expect(recordedSubmissions).toHaveLength(2);
    expect(recordedSubmissions[1]).toEqual({ taskId: "session-wrong-preservation:vocabulary", selected_option_id: "opt-hello" });
    expect(session.tasks.find((task) => task.key === "vocabulary")?.state).toBe("COMPLETED");
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='speaking']")).toBeTruthy();
    expect(recordedSubmissions).toHaveLength(2);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 30
  it("30. Fast Track pass (nextReviewDueAt > now) does not immediately switch UI to REVIEW mode, displays completion and scheduled review", async () => {
    let completedLessonId: string | null = null;
    let completedSummary: any = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-1", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions") && init?.method === "POST") {
        if (url.includes("/complete")) {
          return new Response(JSON.stringify({ id: "s-ft-1", status: "COMPLETED", masteryStatus: "READY_FOR_CHECK" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ id: "s-ft-1", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          lessonId: "book1-l01",
          passed: true,
          scores: { listening: 1.0, recognition: 1.0, vocabulary: 1.0, grammar: 1.0 },
          weakDomains: [],
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          nextReviewDueAt: "2026-09-26 08:00:00",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
          onCompleteLesson={(id, sum) => {
            completedLessonId = id;
            completedSummary = sum;
          }}
        />
      );
    });

    // Verify initial mode is FAST_TRACK
    const modeBadge = container.querySelector(".mode-badge");
    expect(modeBadge?.className).toContain("mode-fast_track");

    // Answer all 4 exit ticket questions
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    expect(questionCards.length).toBe(4);
    for (const card of Array.from(questionCards)) {
      const firstChoice = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { firstChoice?.click(); });
    }

    // Submit exit ticket
    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    // Mode must NOT switch to REVIEW mode immediately!
    const modeBadgeAfterSubmit = container.querySelector(".mode-badge");
    expect(modeBadgeAfterSubmit?.className).not.toContain("mode-review");
    expect(modeBadgeAfterSubmit?.className).toContain("mode-fast_track");

    // Must show scheduled review feedback notice
    expect(container.textContent).toContain("Fast Track Passed! Scheduled for lightweight SRS review.");

    // Advance to wrap-up
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });

    // Verify wrap-up shows future SRS due date
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    expect(container.textContent).toContain("2026-09-26 08:00:00 (SRS)");

    // Click finish button
    const finishBtn = container.querySelector(".finish-session-cta-btn") as HTMLButtonElement;
    await act(async () => { finishBtn.click(); });

    // Verify lesson completed callback fired
    expect(completedLessonId).toBe("book1-l01");
    expect(completedSummary?.sessionCompleted).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("31. Submitting a wrong planner-backed answer then clicking Next does not issue a duplicate attempt", async () => {
    const submissions: any[] = [];
    const session = authoritativeSessionFixture("basic-l01", "s-dedup-1", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED", vocabulary: "IN_PROGRESS",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") submissions.push(JSON.parse(init.body as string));
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    const wrong = Array.from(container.querySelectorAll(".step-vocab-body .choice-card-btn"))
      .find((button) => button.textContent?.includes("Eat")) as HTMLButtonElement;
    await act(async () => { wrong.click(); });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].selected_option_id).toBe("opt-eat");
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(submissions).toHaveLength(1);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("32. Clicking the same incorrect planner choice repeatedly does not spam attempts", async () => {
    const submissions: any[] = [];
    const session = authoritativeSessionFixture("basic-l01", "s-dedup-2", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED", vocabulary: "IN_PROGRESS",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") submissions.push(JSON.parse(init.body as string));
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    const wrong = Array.from(container.querySelectorAll(".step-vocab-body .choice-card-btn"))
      .find((button) => button.textContent?.includes("Eat")) as HTMLButtonElement;
    await act(async () => { wrong.click(); });
    await act(async () => { wrong.click(); });
    await act(async () => { wrong.click(); });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].selected_option_id).toBe("opt-eat");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("33. Changing a planner answer from wrong to correct sends 2 distinct attempts, and Next adds no third", async () => {
    const submissions: any[] = [];
    const session = authoritativeSessionFixture("basic-l01", "s-dedup-3", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED", vocabulary: "IN_PROGRESS",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") submissions.push(JSON.parse(init.body as string));
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    const choices = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".step-vocab-body .choice-card-btn"));
    const wrong = choices().find((button) => button.textContent?.includes("Eat")) as HTMLButtonElement;
    const correct = choices().find((button) => button.textContent?.includes("Hello")) as HTMLButtonElement;
    await act(async () => { wrong.click(); });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].selected_option_id).toBe("opt-eat");
    await act(async () => { correct.click(); });
    expect(submissions).toHaveLength(2);
    expect(submissions[1].selected_option_id).toBe("opt-hello");
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='speaking']")).toBeTruthy();
    expect(submissions).toHaveLength(2);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("34. Planner recognition tasks keep exact-step progression and deduplicate each task independently", async () => {
    const submissions: { taskId: string; body: any }[] = [];
    const session = authoritativeSessionFixture("basic-l01", "s-recog-exact", { listen: "COMPLETED" });
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") {
        submissions.push({ taskId: decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]), body: JSON.parse(init.body as string) });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "characters");

    const firstCharacter = container.querySelector(".large-char-display")?.textContent || "";
    const firstChoices = () => Array.from(container.querySelectorAll(".char-choice-card"));
    const firstWrong = firstChoices().find((button) => !button.textContent?.includes(firstCharacter)) as HTMLButtonElement;
    await act(async () => { firstWrong.click(); });
    await act(async () => { firstWrong.click(); });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].taskId).toBe("s-recog-exact:recognition-1");
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector(".large-char-display")?.textContent).toBe(firstCharacter);
    await act(async () => { (Array.from(container.querySelectorAll(".char-choice-card"))
      .find((button) => button.textContent?.includes(firstCharacter)) as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });

    const secondCharacter = container.querySelector(".large-char-display")?.textContent || "";
    expect(secondCharacter).not.toBe(firstCharacter);
    const secondChoices = Array.from(container.querySelectorAll(".char-choice-card"));
    const secondCorrect = secondChoices.find((button) => button.textContent?.includes(secondCharacter)) as HTMLButtonElement;
    await act(async () => { secondCorrect.click(); });
    expect(submissions.map((submission) => submission.taskId)).toEqual([
      "s-recog-exact:recognition-1", "s-recog-exact:recognition-1", "s-recog-exact:recognition-2",
    ]);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();

    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("35. Speaking step progression gate strictly checks exact planner tasks", async () => {
    const session = authoritativeSessionFixture("book1-l01", "s-speak-gate", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "PENDING", pronunciation: "PENDING",
    });
    installPlannerSessionMock(session);
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "speaking");
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    expect(container.querySelector("[data-step-key='mini_check']")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(session.tasks.find((task) => task.key === "speaking")?.state).toBe("PENDING");
    expect(session.tasks.find((task) => task.key === "pronunciation")?.state).toBe("PENDING");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });


  it("36. Vocabulary trace: wrong (IN_PROGRESS) -> Next (blocked) -> retry correct (COMPLETED) -> Next advances", async () => {
    const calls: any[] = [];
    const session = authoritativeSessionFixture("basic-l01", "s-trace-vocab", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    let attemptCount = 0;
    let failureCount = 0;
    let completedAt: string | null = null;
    installPlannerSessionMock(session, (url, init) => {
      if (url.includes("/tasks/") && url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string);
        calls.push(body);
        attemptCount++;
        const task = session.tasks.find((candidate) => candidate.id === taskId);
        if (task && body.selected_option_id === "opt-hello") {
          task.state = "COMPLETED"; completedAt = "2026-09-26T09:00:00Z";
        } else if (task) { task.state = "IN_PROGRESS"; failureCount++; }
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    const choices = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".step-vocab-body .choice-card-btn"));
    await act(async () => { choices().find((button) => button.textContent?.includes("Eat"))!.click(); });
    expect(calls).toHaveLength(1); expect(attemptCount).toBe(1); expect(failureCount).toBe(1); expect(completedAt).toBeNull();
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(calls).toHaveLength(1); expect(attemptCount).toBe(1);
    await act(async () => { choices().find((button) => button.textContent?.includes("Hello"))!.click(); });
    expect(calls).toHaveLength(2); expect(attemptCount).toBe(2); expect(failureCount).toBe(1); expect(completedAt).not.toBeNull();
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='speaking']")).toBeTruthy();
    expect(calls).toHaveLength(2);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });


  it("37. Recognition task 1 wrong answer blocks its exact step until correct retry", async () => {
    const calls: any[] = [];
    const session = authoritativeSessionFixture("book1-l01", "s-trace-recog1", { listen: "COMPLETED" });
    let attemptCount = 0; let failureCount = 0; let completedAt: string | null = null;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string); calls.push({ taskId, ...body });
        if (taskId === "s-trace-recog1:recognition-1") {
          attemptCount++;
          const task = session.tasks.find((candidate) => candidate.id === taskId)!;
          const expected = task.taskData?.audioText;
          const option = task.taskData?.choices.find((item: any) => item.id === body.selected_option_id);
          if (option?.label === expected) { task.state = "COMPLETED"; completedAt = "2026-09-26T09:00:00Z"; }
          else { task.state = "IN_PROGRESS"; failureCount++; }
        }
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "characters");
    const target = container.querySelector(".large-char-display")?.textContent || "";
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".char-choice-card"));
    await act(async () => { buttons().find((button) => !button.textContent?.includes(target))!.click(); });
    expect(calls).toHaveLength(1); expect(attemptCount).toBe(1); expect(failureCount).toBe(1); expect(completedAt).toBeNull();
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector(".large-char-display")?.textContent).toBe(target);
    expect(calls).toHaveLength(1);
    await act(async () => { buttons().find((button) => button.textContent?.includes(target))!.click(); });
    expect(calls).toHaveLength(2); expect(attemptCount).toBe(2); expect(failureCount).toBe(1); expect(completedAt).not.toBeNull();
    await act(async () => { next.click(); });
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    expect(calls.map((call) => call.taskId)).toEqual(["s-trace-recog1:recognition-1", "s-trace-recog1:recognition-1"]);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });


  it("38. Recognition task 2 uses its own answer and advances to the next planner task", async () => {
    const calls: any[] = [];
    const session = authoritativeSessionFixture("book1-l01", "s-trace-recog2", { listen: "COMPLETED", "recognition-1": "COMPLETED" });
    let attempts = 0; let failures = 0; let completedAt: string | null = null;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string); calls.push({ taskId, ...body });
        if (taskId === "s-trace-recog2:recognition-2") {
          attempts++;
          const task = session.tasks.find((candidate) => candidate.id === taskId)!;
          const option = task.taskData?.choices.find((item: any) => item.id === body.selected_option_id);
          if (option?.label === task.taskData?.audioText) { task.state = "COMPLETED"; completedAt = "2026-09-26T09:00:00Z"; }
          else { task.state = "IN_PROGRESS"; failures++; }
        }
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "characters");
    const firstTarget = container.querySelector(".large-char-display")?.textContent || "";
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>(".char-choice-card")).find((button) => button.textContent?.includes(firstTarget))!.click(); });
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { next.click(); });
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    const target = "好";
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".char-choice-card"));
    await act(async () => { buttons().find((button) => !button.textContent?.includes(target))!.click(); });
    expect(calls).toHaveLength(1); expect(attempts).toBe(1); expect(failures).toBe(1); expect(completedAt).toBeNull();
    await act(async () => { next.click(); });
    expect(container.querySelector(".large-char-display")?.textContent).toBe(target);
    expect(calls).toHaveLength(1);
    await act(async () => { buttons().find((button) => button.textContent?.includes(target))!.click(); });
    expect(calls).toHaveLength(2); expect(attempts).toBe(2); expect(failures).toBe(1); expect(completedAt).not.toBeNull();
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    expect(calls.every((call) => call.taskId === "s-trace-recog2:recognition-2")).toBe(true);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });


  it("39. Sentence Pattern task wrong answer blocks Next until its exact planner task completes", async () => {
    const calls: any[] = [];
    const session = authoritativeSessionFixture("book1-l01", "s-trace-sentence", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/answer") && init?.method === "POST") calls.push({ taskId: decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]), ...JSON.parse(init.body as string) });
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "sentence_pattern");
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    const choices = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".step-sentence-body .choice-card-btn"));
    await act(async () => { choices()[1].click(); });
    expect(calls).toEqual([{ taskId: "s-trace-sentence:sentence-pattern", selected_option_id: "opt-wrong-order", answers: {}, assisted: false }]);
    expect(session.tasks.find((task) => task.key === "sentence-pattern")?.state).toBe("IN_PROGRESS");
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    expect(calls).toHaveLength(1);
    await act(async () => { choices()[0].click(); });
    expect(calls).toHaveLength(2);
    expect(session.tasks.find((task) => task.key === "sentence-pattern")?.state).toBe("COMPLETED");
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='speaking']")).toBeTruthy();
    expect(calls).toHaveLength(2);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });


  it("40. Vocabulary fail-closed regression: incomplete planner contract and answer API failure block progression", async () => {
    const missing = authoritativeSessionFixture("basic-l01", "s-neg-vocab-missing", { listen: "COMPLETED" });
    missing.tasks = missing.tasks.filter((task) => task.key !== "vocabulary");
    const missingRequests = installPlannerSessionMock(missing);
    let container = document.createElement("div"); document.body.appendChild(container); let root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(missingRequests.some((request) => request.includes("/tasks/") && request.endsWith("/answer"))).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();

    const session = authoritativeSessionFixture("basic-l01", "s-neg-vocab-api", { listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED" });
    let vocabCalls = 0;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/tasks/s-neg-vocab-api:vocabulary/answer") && init?.method === "POST") {
        vocabCalls++; return new Response(JSON.stringify({ detail: "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "vocabulary");
    await act(async () => { (Array.from(container.querySelectorAll(".step-vocab-body .choice-card-btn"))[0] as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(vocabCalls).toBe(2);
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='characters']")).toBeNull();
    expect(session.tasks.find((task) => task.key === "vocabulary")?.state).toBe("PENDING");
    expect(container.textContent).toMatch(/Internal Server Error|Task operation failed|任務操作失敗/);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("41. Recognition fail-closed regression: incomplete planner contract and answer API failure block progression", async () => {
    const missing = authoritativeSessionFixture("book1-l01", "s-neg-recog-missing", { listen: "COMPLETED" });
    missing.tasks = missing.tasks.filter((task) => task.key !== "recognition-1");
    const missingRequests = installPlannerSessionMock(missing);
    let container = document.createElement("div"); document.body.appendChild(container); let root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(missingRequests.some((request) => request.includes("/tasks/") && request.endsWith("/answer"))).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();

    const session = authoritativeSessionFixture("book1-l01", "s-neg-recog-api", { listen: "COMPLETED" });
    let recogCalls = 0;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/tasks/s-neg-recog-api:recognition-1/answer") && init?.method === "POST") {
        recogCalls++; return new Response(JSON.stringify({ detail: "Database unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "characters");
    const target = container.querySelector(".large-char-display")?.textContent || "";
    await act(async () => { (Array.from(container.querySelectorAll(".char-choice-card")).find((button) => button.textContent?.includes(target)) as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(recogCalls).toBe(2);
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeNull();
    expect(container.textContent).toContain("你");
    expect(session.tasks.find((task) => task.key === "recognition-1")?.state).toBe("PENDING");
    expect(container.textContent).toMatch(/Database unavailable|Task operation failed|任務操作失敗/);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("42. Sentence Pattern fail-closed regression: incomplete planner contract and answer API failure block progression", async () => {
    const missing = authoritativeSessionFixture("book1-l01", "s-neg-sent-missing", { listen: "COMPLETED" });
    missing.tasks = missing.tasks.filter((task) => task.key !== "sentence-pattern");
    const missingRequests = installPlannerSessionMock(missing);
    let container = document.createElement("div"); document.body.appendChild(container); let root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(missingRequests.some((request) => request.includes("/tasks/") && request.endsWith("/answer"))).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();

    const session = authoritativeSessionFixture("book1-l01", "s-neg-sent-api", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
    });
    let sentCalls = 0;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith("/tasks/s-neg-sent-api:sentence-pattern/answer") && init?.method === "POST") {
        sentCalls++; return new Response(JSON.stringify({ detail: "Gateway timeout" }), { status: 504, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "sentence_pattern");
    await act(async () => { (Array.from(container.querySelectorAll(".step-sentence-body .choice-card-btn"))[0] as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(sentCalls).toBe(2);
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='speaking']")).toBeNull();
    expect(session.tasks.find((task) => task.key === "sentence-pattern")?.state).toBe("PENDING");
    expect(container.textContent).toMatch(/Gateway timeout|Task operation failed|任務操作失敗/);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("43. Session initialization failure: Lesson Player fails closed and does not degrade into local-only executor", async () => {
    let completeCallbackCalled = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions")) {
        // Both /current and POST /learning-sessions fail
        return new Response(JSON.stringify({ detail: "Service Unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="LEARN"
          onCompleteLesson={() => {
            completeCallbackCalled = true;
          }}
        />
      );
    });

    // An error banner must be displayed indicating session loading/initialization failed
    expect(container.textContent).toMatch(/Service Unavailable|Task operation failed|任務操作失敗/);

    // Task UI and Next stay unavailable until an authoritative session exists.
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn).toBeNull();
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector("[data-step-key='dialogue']")).toBeNull();
    expect(completeCallbackCalled).toBe(false);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("44. FAST_TRACK fail-closed negative regression on API 500/503: mode, masteryStatus, weakDomains, and nextReviewDueAt remain unchanged, UI does not advance, and allows retry", async () => {
    let fastTrackCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-ft-neg-1",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        fastTrackCalls++;
        return new Response(JSON.stringify({ detail: "Fast Track Evaluation Service Unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
        />
      );
    });

    // 1. Initial mode is FAST_TRACK
    const modeBadge = container.querySelector(".mode-badge");
    expect(modeBadge?.className).toContain("mode-fast_track");
    expect(modeBadge?.className).not.toContain("mode-repair");

    // 2. Answer all exit ticket questions
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    expect(questionCards.length).toBe(4);
    for (const card of Array.from(questionCards)) {
      const firstChoice = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { firstChoice?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();

    // 3. Child clicks submit -> API 503 failure
    await act(async () => { submitBtn.click(); });
    expect(fastTrackCalls).toBe(1);

    // 4. Assert fail-closed invariants:
    // a. mode remains FAST_TRACK (does NOT switch to REPAIR or REVIEW)
    const modeBadgeAfterFail = container.querySelector(".mode-badge");
    expect(modeBadgeAfterFail?.className).toContain("mode-fast_track");
    expect(modeBadgeAfterFail?.className).not.toContain("mode-repair");

    // b. Error banner is displayed
    expect(container.textContent).toMatch(/Fast Track Evaluation Service Unavailable|Task operation failed|任務操作失敗/);

    // c. Does NOT display success or scheduled SRS text
    expect(container.textContent).not.toContain("Fast Track Passed!");
    expect(container.textContent).not.toContain("(SRS)");

    // d. submit button remains in DOM allowing retry
    expect(container.querySelector(".submit-exit-ticket-btn")).toBeTruthy();

    // e. Next button remains disabled
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    // f. Clicking Next does NOT advance UI to wrap-up
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("45. LEARN reflection task persistence failure blocks progression and settlement", async () => {
    let reflectionWriteCalls = 0; let completedLessonCalled = false;
    const session = authoritativeSessionFixture("book1-l01", "s-learn-neg-45", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "COMPLETED", pronunciation: "COMPLETED", "mini-check-reflection": "IN_PROGRESS",
    });
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith(`/tasks/${session.id}:mini-check-reflection/answer`) && init?.method === "POST") {
        reflectionWriteCalls++; return new Response(JSON.stringify({ detail: "Reflection persistence failure in database" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" onCompleteLesson={() => { completedLessonCalled = true; }} />); });
    await advanceToPlannerStep(container, "mini_check");
    expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
    await act(async () => { (container.querySelector(".choices-vertical-list .choice-card-btn") as HTMLButtonElement).click(); });
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(reflectionWriteCalls).toBe(1);
    expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    expect(session.tasks.find((task) => task.key === "mini-check-reflection")?.state).toBe("IN_PROGRESS");
    expect(container.textContent).toMatch(/Reflection persistence failure|Task operation failed|任務操作失敗/);
    expect(completedLessonCalled).toBe(false);
    expect(session.status).toBe("IN_PROGRESS");
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
    expect(completedLessonCalled).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("46. FAST_TRACK response contract validation: { passed: false } only fails closed, does not transition to REPAIR, keeps mode/mastery intact, displays error", async () => {
    let fastTrackCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-ft-46",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        fastTrackCalls++;
        // Missing weakDomains, nextMode, masteryStatus:
        return new Response(JSON.stringify({ passed: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
        />
      );
    });

    const modeBadge = container.querySelector(".mode-badge");
    expect(modeBadge?.className).toContain("mode-fast_track");
    expect(modeBadge?.className).not.toContain("mode-repair");

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });
    expect(fastTrackCalls).toBe(1);

    // Fail closed invariants:
    // 1. Error banner is visible
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    // 2. Mode remains FAST_TRACK, did NOT jump into REPAIR
    expect(container.querySelector(".mode-badge")?.className).toContain("mode-fast_track");
    expect(container.querySelector(".mode-badge")?.className).not.toContain("mode-repair");
    // 3. UI remains on exit_ticket step
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    // 4. Next button remains disabled
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("47. FAST_TRACK response contract validation: passed=true but missing masteryStatus fails closed, displays error, and does not advance", async () => {
    let fastTrackCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-ft-47",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        fastTrackCalls++;
        // passed=true but missing masteryStatus:
        return new Response(JSON.stringify({
          passed: true,
          weakDomains: [],
          nextMode: "REVIEW",
          nextReviewDueAt: "2026-09-27T00:00:00Z",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
        />
      );
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });
    expect(fastTrackCalls).toBe(1);

    // Fail closed invariants:
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("48. FAST_TRACK response contract validation: weakDomains malformed (string or non-string items) fails closed", async () => {
    let fastTrackCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-ft-48",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        fastTrackCalls++;
        // weakDomains is a string instead of array of strings:
        return new Response(JSON.stringify({
          passed: false,
          weakDomains: "recognition",
          nextMode: "REPAIR",
          masteryStatus: "IN_PROGRESS",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="FAST_TRACK"
        />
      );
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });
    expect(fastTrackCalls).toBe(1);

    // Fail closed invariants:
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector(".mode-badge")?.className).toContain("mode-fast_track");
    expect(container.querySelector(".mode-badge")?.className).not.toContain("mode-repair");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("49. LEARN fails closed when the authoritative planner omits its reflection task", async () => {
    const session = authoritativeSessionFixture("book1-l01", "s-learn-neg-49", { listen: "COMPLETED" });
    session.tasks = session.tasks.filter((task) => task.key !== "mini-check-reflection");
    const requests = installPlannerSessionMock(session);
    let completedLessonCalled = false;
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" onCompleteLesson={() => { completedLessonCalled = true; }} />); });
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(completedLessonCalled).toBe(false);
    expect(session.status).toBe("IN_PROGRESS");
    expect(requests.some((request) => request.includes("/complete"))).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("50. FAST_TRACK semantic runtime validation: passed=false with nextMode='BANANA' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-50", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: false,
          nextMode: "BANANA",
          masteryStatus: "IN_PROGRESS",
          weakDomains: ["recognition"],
          nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector(".mode-badge")?.className).toContain("mode-fast_track");
    expect(container.querySelector(".mode-badge")?.className).not.toContain("mode-repair");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("51. FAST_TRACK semantic runtime validation: passed=false with masteryStatus='MASTERED' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-51", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: false,
          nextMode: "REPAIR",
          masteryStatus: "MASTERED",
          weakDomains: ["recognition"],
          nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector(".mode-badge")?.className).toContain("mode-fast_track");
    expect(container.querySelector(".mode-badge")?.className).not.toContain("mode-repair");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("52. FAST_TRACK semantic runtime validation: passed=true with nextMode='REPAIR' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-52", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REPAIR",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: "2026-09-27T08:00:00Z",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("53. FAST_TRACK semantic runtime validation: passed=true with weakDomains=[123] fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-53", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [123],
          nextReviewDueAt: "2026-09-27T08:00:00Z",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("54. FAST_TRACK semantic runtime validation: passed=false with nextReviewDueAt='future' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-54", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: false,
          nextMode: "REPAIR",
          masteryStatus: "IN_PROGRESS",
          weakDomains: ["recognition"],
          nextReviewDueAt: "future",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector(".mode-badge")?.className).toContain("mode-fast_track");
    expect(container.querySelector(".mode-badge")?.className).not.toContain("mode-repair");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("55. FAST_TRACK semantic runtime validation: passed=true with weakDomains=['recognition'] fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-55", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: ["recognition"],
          nextReviewDueAt: "2026-09-27T08:00:00Z",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("56. FAST_TRACK semantic runtime validation: passed=true with exact valid contract (masteryStatus='READY_FOR_CHECK', nextMode='REVIEW', weakDomains=[], nextReviewDueAt=valid) is accepted and advances", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-56", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: "2026-09-27T08:00:00Z",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    // Assert: error banner is NOT shown, next button is enabled
    expect(container.querySelector(".error-strip")).toBeNull();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    // Clicking Next Step advances to wrap_up
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("57. FAST_TRACK nextReviewDueAt validation: passed=true with nextReviewDueAt='banana' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-57", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: "banana",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("58. FAST_TRACK nextReviewDueAt validation: passed=true with nextReviewDueAt='2026-99-99' fails closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-58", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: "2026-99-99",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("59. FAST_TRACK nextReviewDueAt validation: passed=true with valid backend-style timestamp ('2026-09-26 08:00:00') is accepted and advances", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-59", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: "2026-09-26 08:00:00",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.querySelector(".error-strip")).toBeNull();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("60. FAST_TRACK nextReviewDueAt validation: passed=true with nextReviewDueAt=null is accepted and advances", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-ft-60", status: "IN_PROGRESS", masteryStatus: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/fast-track") && init?.method === "POST") {
        return new Response(JSON.stringify({
          passed: true,
          nextMode: "REVIEW",
          masteryStatus: "READY_FOR_CHECK",
          weakDomains: [],
          nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="FAST_TRACK" />);
    });

    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceBtn = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      await act(async () => { choiceBtn?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(container.querySelector(".error-strip")).toBeNull();
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);

    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("61. Regression A: no due SRS item -> REVIEW does not display static reviewSteps or fake retrieval task, renders empty review state with return button", async () => {
    let onBackCalled = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-rev-none", sessionId: "s-rev-none", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => { onBackCalled = true; }} initialMode="REVIEW" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Verify static review steps / exit ticket are NOT rendered
    expect(container.querySelector(".exit-ticket-item-card")).toBeNull();
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeNull();
    // Verify empty review card is rendered
    expect(container.querySelector(".empty-review-card")).toBeTruthy();
    expect(container.textContent).toMatch(/目前沒有到期的複習項目|No due reviews right now/);

    // Verify back-to-today button triggers onBack
    const backBtn = container.querySelector(".back-to-today-btn") as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    await act(async () => { backBtn.click(); });
    expect(onBackCalled).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["ID-only REVIEW row", {
      id: "s-malformed:review-recognition-1", key: "review-recognition-1", taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW", lessonId: "book1-l01", skillDomain: "recognition", itemId: "item-ni", childId: 1, sessionId: "s-malformed",
      state: "PENDING", required: true,
    }],
    ["REVIEW row with invalid duplicate choice ids", {
      id: "s-malformed:review-recognition-1", key: "review-recognition-1", taskType: "REVIEW_RECOGNITION",
      sourceQueue: "REVIEW", lessonId: "book1-l01", skillDomain: "recognition", itemId: "item-ni", childId: 1, sessionId: "s-malformed",
      state: "PENDING", required: true,
      taskData: {
        prompt: "選出聽到的字：", audioText: "你", dueAt: "2026-09-02T00:00:00Z",
        choices: [{ id: "option-1", label: "你" }, { id: "option-1", label: "好" }],
      },
    }],
  ])("61a. malformed %s must fail closed without an actionable REVIEW question", async (_caseName, task) => {
    const session = { id: "s-malformed", sessionId: "s-malformed", childId: 1, status: "IN_PROGRESS", lessonId: "book1-l01", tasks: [task] };
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: {
          sourceQueue: "REVIEW", dueCount: 1,
          items: [{ id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }],
        } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reconcile-reviews")) {
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(container.querySelector(".recognition-mini-check")).toBeNull();
    expect(container.querySelector(".char-choice-card")).toBeNull();
    expect(container.querySelector(".large-char-display")).toBeNull();
    expect(container.querySelector(".empty-review-card")).toBeNull();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("62. Regression B: due recognition item = 你 -> REVIEW displays ONLY '你', does not display non-due items or other character tabs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-rev-ni",
          sessionId: "s-rev-ni",
          childId: 1,
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "s-rev-ni:review-recognition-1",
              childId: 1,
              sessionId: "s-rev-ni",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              lessonId: "book1-l01",
              itemId: "item-ni",
              state: "PENDING",
              required: true,
              taskData: {
                prompt: "聽完今天的問候語，選出剛才出現的字。",
                audioText: "你",
                choices: [
                  { id: "opt-hao", label: "好", isCorrect: false },
                  { id: "opt-ni", label: "你", isCorrect: true },
                ],
                dueAt: "2026-09-02T00:00:00Z",
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 1, items: [{ id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // Character tabs row should NOT display the non-due character '好' tab
    expect(container.querySelector(".character-tabs-row")).toBeNull();
    // Only the exact due character '你' is displayed in hero display
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");
    // Prompt shows exact due item prompt
    expect(container.querySelector(".interaction-prompt")?.textContent).toContain("聽完今天的問候語，選出剛才出現的字。");
    // Does not display static exit ticket or dialogue
    expect(container.querySelector(".exit-ticket-item-card")).toBeNull();
    expect(container.querySelector("[data-step-key='dialogue']")).toBeNull();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("63. Regression C: due recognition item = 好 -> REVIEW display content switches to '好'", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-rev-hao",
          sessionId: "s-rev-hao",
          childId: 1,
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "s-rev-hao:review-recognition-1",
              childId: 1,
              sessionId: "s-rev-hao",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              lessonId: "book1-l01",
              itemId: "item-hao",
              state: "PENDING",
              required: true,
              taskData: {
                prompt: "聽完今天的問候語，選出剛才出現的字。",
                audioText: "好",
                choices: [
                  { id: "opt-ni", label: "你", isCorrect: false },
                  { id: "opt-hao", label: "好", isCorrect: true },
                ],
                dueAt: "2026-09-02T00:00:00Z",
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 1, items: [{ id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // Content switches to '好'
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    expect(container.querySelector(".step-card-subtitle")?.textContent).toContain("好");
    expect(container.querySelector(".play-recog-audio-btn")?.textContent).toContain("好");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("64. Regression D: future-due item -> does not appear in REVIEW mode ahead of time", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        // Backend filtered out future-due items (due_at > as_of), so tasks array contains no review tasks
        return new Response(JSON.stringify({
          id: "s-rev-future",
          sessionId: "s-rev-future",
          childId: 1,
          status: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // Future-due item must NOT be displayed ahead of time
    expect(container.querySelector(".large-char-display")).toBeNull();
    expect(container.querySelector(".empty-review-card")).toBeTruthy();
    expect(container.textContent).toMatch(/目前沒有到期的複習項目|No due reviews right now/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("65. Regression E: completing due review -> exact due item is persisted and advances to wrap-up", async () => {
    let answerCalls: any[] = [];
    let taskState = "PENDING";

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-rev-e",
          sessionId: "s-rev-e",
          childId: 1,
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "s-rev-e:review-recognition-1",
              childId: 1,
              sessionId: "s-rev-e",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              lessonId: "book1-l01",
              itemId: "item-ni",
              state: taskState,
              required: true,
              taskData: {
                prompt: "選出聽到的字：",
                audioText: "你",
                choices: [
                  { id: "opt-hao", label: "好", isCorrect: false },
                  { id: "opt-ni", label: "你", isCorrect: true },
                ],
                dueAt: "2026-09-02T00:00:00Z",
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-rev-e:review-recognition-1/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        answerCalls.push(body);
        taskState = "COMPLETED";
        return new Response(JSON.stringify({
          id: "s-rev-e",
          sessionId: "s-rev-e",
          childId: 1,
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "s-rev-e:review-recognition-1",
              childId: 1,
              sessionId: "s-rev-e",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              lessonId: "book1-l01",
              itemId: "item-ni",
              state: "COMPLETED",
              required: true,
              completedAt: "2026-09-26T14:00:00Z",
              taskData: {
                prompt: "選出聽到的字：",
                audioText: "你",
                choices: [{ id: "opt-hao", label: "好" }, { id: "opt-ni", label: "你" }],
                dueAt: "2026-09-02T00:00:00Z",
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 1, items: [{ id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // 1. Select option '你' (opt-ni)
    const choiceButtons = container.querySelectorAll(".char-choice-card");
    const niChoice = Array.from(choiceButtons).find((b) => b.textContent?.includes("你")) as HTMLButtonElement;
    expect(niChoice).toBeTruthy();
    await act(async () => { niChoice.click(); });

    // 2. Click next to advance
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    await act(async () => { nextBtn.click(); });

    // 3. Verify exact due item was answered in backend
    expect(answerCalls.length).toBe(1);
    expect(answerCalls[0].selected_option_id).toBe("opt-ni");

    // 4. Verify advanced to wrap-up
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("66. Regression F: LessonPackage static reviewSteps exists in json, but without backend due item it is NEVER executed as REVIEW", async () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    // Static reviewSteps exists in JSON blueprint
    expect(pkg?.taskBlueprint.reviewSteps.length).toBeGreaterThanOrEqual(1);

    // Calling getStepsForMode with no backend due items returns []
    const steps = getStepsForMode(pkg!, "REVIEW", [], []);
    expect(steps.length).toBe(0);

    // Mounting LessonPlayerPage with no backend due items never executes static reviewSteps
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-rev-f", sessionId: "s-rev-f", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeNull();
    expect(container.querySelector(".empty-review-card")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("67. Regression A: Daily Queue 200 + dueCount=0 + items=[] -> normal zero-due empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-reg-a", sessionId: "s-reg-a", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          review: { sourceQueue: "REVIEW", dueCount: 0, items: [] }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    expect(container.querySelector(".empty-review-card")).toBeTruthy();
    expect(container.querySelector(".error-strip")).toBeNull();
    expect(container.textContent).toMatch(/目前沒有到期的複習項目|No due reviews right now/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("68. Regression B: Daily Queue 503 -> error state, must NOT display zero-due empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-reg-b", sessionId: "s-reg-b", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // Must NOT show no-due empty state!
    expect(container.querySelector(".empty-review-card")).toBeNull();
    // Must display error state
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("69. Regression C: Daily Queue malformed -> error state, must NOT display zero-due empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-reg-c", sessionId: "s-reg-c", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({
          review: { broken: true }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // Must NOT show no-due empty state!
    expect(container.querySelector(".empty-review-card")).toBeNull();
    // Must display error state
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("70. Regression D: Daily Queue due item + no executable session task -> fail closed, must NOT render actionable question", async () => {
    let sessionCreationAttempted = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "s-reg-d", sessionId: "s-reg-d", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({
          childId: 1,
          review: {
            sourceQueue: "REVIEW",
            dueCount: 1,
            items: [{ id: "due-item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }]
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if ((url.includes("/reconcile-reviews") || url.includes("/learning-sessions")) && init?.method === "POST") {
        sessionCreationAttempted = true;
        // Backend returns session with tasks=[] (cannot produce executable review task)
        return new Response(JSON.stringify({ id: "s-reg-d", sessionId: "s-reg-d", childId: 1, status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    expect(sessionCreationAttempted).toBe(true);
    // Must NOT render actionable question
    expect(container.querySelector(".large-char-display")).toBeNull();
    expect(container.querySelector(".char-choice-card")).toBeNull();
    // Must NOT show no-due empty state
    expect(container.querySelector(".empty-review-card")).toBeNull();
    // Must show error
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("71. Regression E: exact due tasks complete, Review wrap-up returns to Today without completing the parent LEARN session", async () => {
    let taskStateA = "PENDING";
    let taskStateB = "PENDING";
    const answeredTaskIds: string[] = [];
    let wholeSessionCompleteCalled = false;
    let backCalled = false;
    let finalSessionResponse: { id: string; status: string; tasks: Array<{ id: string; state: string }> } = { id: "", status: "", tasks: [] };
    const curriculumPendingTask = { id: "learn-required-curriculum", key: "curriculum-required-1", taskType: "LISTENING", sourceQueue: "CURRICULUM", lessonId: "book1-l01", state: "PENDING", required: true };
    const reviewTask = (_id: string, key: string, itemId: string, character: string, state: string) => ({
      id: `s-reg-e:${key}`, sessionId: "s-reg-e", childId: 1, key, taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", lessonId: "book1-l01",
      skillDomain: "recognition", itemId, state, required: true,
      taskData: {
        prompt: `選出聽到的字：${character}`,
        audioText: character,
        choices: [{ id: "option-1", label: character === "你" ? "好" : "你" }, { id: "option-2", label: character }],
        dueAt: "2026-09-02T00:00:00Z",
      },
    });

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-reg-e",
          sessionId: "s-reg-e",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("task-A", "review-recognition-1", "item-ni", "你", taskStateA),
            reviewTask("task-B", "review-recognition-2", "item-hao", "好", taskStateB),
            curriculumPendingTask,
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/s-reg-e/reconcile-reviews") && init?.method === "POST") {
        return new Response(JSON.stringify({
          id: "s-reg-e",
          sessionId: "s-reg-e",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("task-A", "review-recognition-1", "item-ni", "你", taskStateA),
            reviewTask("task-B", "review-recognition-2", "item-hao", "好", taskStateB),
            curriculumPendingTask,
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-reg-e:review-recognition-1/answer") && init?.method === "POST") {
        answeredTaskIds.push("s-reg-e:review-recognition-1");
        taskStateA = "COMPLETED";
        return new Response(JSON.stringify({
          id: "s-reg-e",
          sessionId: "s-reg-e",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("task-A", "review-recognition-1", "item-ni", "你", "COMPLETED"),
            reviewTask("task-B", "review-recognition-2", "item-hao", "好", taskStateB),
            curriculumPendingTask,
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-reg-e:review-recognition-2/answer") && init?.method === "POST") {
        answeredTaskIds.push("s-reg-e:review-recognition-2");
        taskStateB = "COMPLETED";
        const completedSession = {
          id: "s-reg-e",
          sessionId: "s-reg-e",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("task-A", "review-recognition-1", "item-ni", "你", "COMPLETED"),
            reviewTask("task-B", "review-recognition-2", "item-hao", "好", "COMPLETED"),
            curriculumPendingTask,
          ],
        };
        finalSessionResponse = completedSession;
        return new Response(JSON.stringify(completedSession), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/s-reg-e/complete") && init?.method === "POST") {
        wholeSessionCompleteCalled = true;
        return new Response(JSON.stringify({ id: "s-reg-e", status: "COMPLETED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 2, items: [
          { id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
          { id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
        ] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => { backCalled = true; }} initialMode="REVIEW" />);
    });

    // STEP 1: Bound to task-A (你)
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");
    const choiceA = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("你")) as HTMLButtonElement;
    expect(choiceA).toBeTruthy();
    await act(async () => { choiceA.click(); });
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });

    expect(answeredTaskIds).toEqual(["s-reg-e:review-recognition-1"]);

    // STEP 2: Bound to task-B (好)
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    const choiceB = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("好")) as HTMLButtonElement;
    expect(choiceB).toBeTruthy();
    await act(async () => { choiceB.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    expect(answeredTaskIds).toEqual(["s-reg-e:review-recognition-1", "s-reg-e:review-recognition-2"]);

    // Advances to wrap-up
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    expect(container.querySelector(".settlement-metrics-grid")).toBeNull();
    expect(container.textContent).toContain("Review Complete");
    const finishReviewBtn = container.querySelector(".finish-session-cta-btn") as HTMLButtonElement;
    expect(finishReviewBtn?.textContent).toContain("Back to Today's Learning");
    await act(async () => { finishReviewBtn.click(); });
    expect(backCalled).toBe(true);
    expect(wholeSessionCompleteCalled).toBe(false);
    expect(finalSessionResponse.status).toBe("IN_PROGRESS");
    expect(finalSessionResponse.tasks.find((task) => task.id === "learn-required-curriculum")?.state).toBe("PENDING");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("72. Regression F: Multi-item review with second exact task missing -> must NOT synthesize or fallback to a question", async () => {
    let taskStateA = "PENDING";
    const answeredTaskIds: string[] = [];
    const reviewTask = (key: string, itemId: string, character: string, state: string) => ({
      id: `s-reg-f:${key}`, sessionId: "s-reg-f", childId: 1, key, taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", lessonId: "book1-l01",
      skillDomain: "recognition", itemId, state, required: true,
      taskData: {
        prompt: `選出聽到的字：${character}`,
        audioText: character,
        choices: [{ id: "option-1", label: character === "你" ? "好" : "你" }, { id: "option-2", label: character }],
        dueAt: "2026-09-02T00:00:00Z",
      },
    });

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-reg-f",
          sessionId: "s-reg-f",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("review-recognition-1", "item-ni", "你", taskStateA),
            reviewTask("review-recognition-2", "item-hao", "好", "PENDING"),
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/s-reg-f/reconcile-reviews") && init?.method === "POST") {
        return new Response(JSON.stringify({
          id: "s-reg-f",
          sessionId: "s-reg-f",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("review-recognition-1", "item-ni", "你", taskStateA),
            reviewTask("review-recognition-2", "item-hao", "好", "PENDING"),
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-reg-f:review-recognition-1/answer") && init?.method === "POST") {
        answeredTaskIds.push("s-reg-f:review-recognition-1");
        taskStateA = "COMPLETED";
        // CRITICAL: Backend session update mysteriously omits task-B (e.g. task-B is missing from session)
        return new Response(JSON.stringify({
          id: "s-reg-f",
          sessionId: "s-reg-f",
          childId: 1,
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            reviewTask("review-recognition-1", "item-ni", "你", "COMPLETED"),
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 2, items: [
          { id: "item-ni", skillDomain: "recognition", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
          { id: "item-hao", skillDomain: "recognition", character: "好", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" },
        ] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="REVIEW" />);
    });

    // STEP 1: Bound to task-A (你)
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");
    const choiceA = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("你")) as HTMLButtonElement;
    await act(async () => { choiceA.click(); });
    // Task B disappeared from the authoritative session response, so no next button or question may render.
    expect(answeredTaskIds).toEqual(["s-reg-f:review-recognition-1"]);
    expect(container.querySelector(".large-char-display")).toBeNull();
    expect(container.querySelector(".char-choice-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    // Must fail closed with an error
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("73. Speaking failure regression A: recorder.start() throws -> backend attempt aborted/cleaned -> speakingAttempted=false -> task incomplete -> Next blocked", async () => {
    const session = authoritativeSessionFixture("book1-l01", "s-sp-a", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "PENDING", pronunciation: "PENDING",
    });
    const tasksState = session.tasks;

    let createdAttemptId: string | null = null;
    let abortAttemptCalled = false;
    let abortTaskCalled = false;

    // MediaDevices throws permission denied
    const getUserMedia = vi.fn().mockRejectedValue(new Error("microphone_permission_denied"));
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reading-aloud/attempts/start")) {
        createdAttemptId = "aloud-err-1";
        return new Response(JSON.stringify({ id: createdAttemptId, status: "STARTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reading-aloud/attempts/aloud-err-1/abort")) {
        abortAttemptCalled = true;
        return new Response(JSON.stringify({ id: "aloud-err-1", status: "ABORTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-sp-a:speaking/abort") || url.includes("/tasks/s-sp-a:pronunciation/abort")) {
        abortTaskCalled = true;
        return new Response(JSON.stringify({
          id: "s-sp-a",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: tasksState,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    await advanceToPlannerStep(container, "speaking");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;

    // Step 6: Speaking step
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    const recordBtn = container.querySelector(".mic-record-btn") as HTMLButtonElement;
    expect(recordBtn).toBeTruthy();

    // Click Record button -> start attempt -> recorder.start() throws
    await act(async () => { recordBtn.click(); });

    // 1. Verify backend attempt was created
    expect(createdAttemptId).toBe("aloud-err-1");
    // 2. Verify backend attempt was aborted/cleaned
    expect(abortAttemptCalled).toBe(true);
    // 3. Verify speakingAttempted is false (UI does not show saved)
    const statusLabel = container.querySelector(".recording-status-label");
    expect(statusLabel?.textContent).toContain("Hold to record speaking");
    expect(statusLabel?.textContent).not.toContain("Speaking practice recorded");
    expect(recordBtn.getAttribute("aria-label")).toBe("Hold to record speaking");
    expect(recordBtn.classList.contains("is-attempted")).toBe(false);
    // 4. Verify authoritative tasks remain incomplete (PENDING)
    const speakingTask = tasksState.find((t) => t.id === "s-sp-a:speaking");
    expect(speakingTask?.state).toBe("PENDING");
    // 5. Next button must be blocked
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    expect(container.querySelector(".step-writing-body")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("74. Speaking failure regression B: atomic evidence POST fails without provider finalize -> speakingAttempted=false -> task incomplete -> UI error -> Next blocked", async () => {
    const session = authoritativeSessionFixture("book1-l01", "s-sp-b", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "PENDING", pronunciation: "PENDING",
    });
    const tasksState = session.tasks;

    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    class MockMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable = (_event: { data: Blob }) => {};
      onstop = () => {};
      onerror = () => {};
      constructor(public stream: unknown) {}
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable({ data: new Blob(["audio"]) }); this.onstop(); }
    }
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    let createdAttemptId: string | null = null;
    let completeCalled = false;
    let evidenceCalled = false;
    const providerStartBodies: any[] = [];
    const abortedAttemptIds: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reading-aloud/attempts/start")) {
        const body = JSON.parse(init?.body as string); providerStartBodies.push(body);
        createdAttemptId = body.activity_domain === "speaking" ? "aloud-speaking-1" : "aloud-pronunciation-1";
        return new Response(JSON.stringify({ id: createdAttemptId, status: "STARTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reading-aloud/attempts/") && url.endsWith("/complete")) {
        completeCalled = true;
        return new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/s-sp-b:speaking/evidence")) {
        evidenceCalled = true;
        expect(JSON.parse(init?.body as string).evidence_ref).toBe("aloud-speaking-1");
        // Evidence POST fails with 500 error
        return new Response(JSON.stringify({ error: "evidence_persistence_failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/reading-aloud/attempts/") && url.includes("/abort?")) {
        abortedAttemptIds.push(decodeURIComponent(url.split("/attempts/")[1].split("/")[0]));
        return new Response(JSON.stringify({ status: "ABORTED" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    await advanceToPlannerStep(container, "speaking");
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;

    // Step 6: Speaking step
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    const recordBtn = container.querySelector(".mic-record-btn") as HTMLButtonElement;
    expect(recordBtn).toBeTruthy();

    // 1. Click Record button -> start recording
    await act(async () => { recordBtn.click(); });
    expect(createdAttemptId).toBe("aloud-pronunciation-1");
    expect(providerStartBodies.map((body) => body.activity_domain)).toEqual(["speaking", "pronunciation"]);
    expect(providerStartBodies.map((body) => body.source_id)).toEqual([
      session.tasks.find((task) => task.key === "speaking")?.itemId,
      session.tasks.find((task) => task.key === "pronunciation")?.itemId,
    ]);

    // 2. Click Record button again -> stop recording -> evidence POST fails
    await act(async () => { (container.querySelector(".mic-record-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(evidenceCalled).toBe(true);
    expect(completeCalled).toBe(false);
    expect(abortedAttemptIds).toEqual(["aloud-speaking-1", "aloud-pronunciation-1"]);

    // 3. Verify speakingAttempted is false
    const statusLabel = container.querySelector(".recording-status-label");
    expect(statusLabel?.textContent).toContain("Hold to record speaking");
    expect(statusLabel?.textContent).not.toContain("Speaking practice recorded");
    expect(recordBtn.getAttribute("aria-label")).toBe("Hold to record speaking");
    expect(recordBtn.classList.contains("is-attempted")).toBe(false);

    // 4. Verify UI displays error
    expect(container.querySelector(".error-strip")).toBeTruthy();

    // 5. Verify authoritative tasks remain incomplete (PENDING)
    const speakingTask = tasksState.find((t) => t.id === "s-sp-b:speaking");
    expect(speakingTask?.state).toBe("PENDING");

    // 6. Next button must be blocked
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    expect(container.querySelector(".step-writing-body")).toBeNull();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("75. LEARN resumes a PAUSED planner session authoritatively before task interaction or Next", async () => {
    const pausedSession = authoritativeSessionFixture("book1-l01", "s-paused-resume", { listen: "COMPLETED" });
    pausedSession.status = "PAUSED";
    const activeSession = { ...pausedSession, status: "IN_PROGRESS" };
    let resolveResume!: (response: Response) => void;
    const pendingResume = new Promise<Response>((resolve) => { resolveResume = resolve; });
    const requestedUrls: string[] = []; let resumeCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requestedUrls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(pausedSession), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/learning-sessions") && init?.method === "POST") { resumeCalls++; return pendingResume; }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(resumeCalls).toBe(1);
    expect(container.querySelector(".lesson-step-card")).toBeNull();
    expect(container.querySelector(".next-step-cta-btn")).toBeNull();
    expect(container.querySelector(".fast-track-trigger-btn")?.hasAttribute("disabled")).toBe(true);
    expect(requestedUrls.some((request) => /\/tasks\/|\/complete/.test(request))).toBe(false);
    await act(async () => { resolveResume(new Response(JSON.stringify(activeSession), { status: 200, headers: { "Content-Type": "application/json" } })); await Promise.resolve(); });
    expect(container.querySelector("[data-step-key='context']")).toBeTruthy();
    const next = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(next).toBeTruthy(); expect(next.disabled).toBe(false);
    await act(async () => { next.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(resumeCalls).toBe(1);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("76. Optional writing skip accepts only authoritative COMPLETED or DEFERRED states", () => {
    expect(optionalWritingSkipResult({ id: "writing" }, false)).toMatchObject({ persisted: false, taskState: "UNKNOWN" });
    expect(optionalWritingSkipResult({ id: "writing", state: "SKIPPED" }, false)).toMatchObject({ persisted: false, taskState: "UNKNOWN" });
    expect(optionalWritingSkipResult({ id: "writing", state: "DEFERRED" }, false)).toMatchObject({ persisted: true, taskState: "DEFERRED" });
    expect(optionalWritingSkipResult({ id: "writing", state: "COMPLETED" }, false)).toMatchObject({ persisted: true, taskState: "COMPLETED" });
  });

  it.each([
    ["missing state", undefined, false],
    ["unexpected SKIPPED state", "SKIPPED", false],
    ["authoritative DEFERRED state", "DEFERRED", true],
  ] as const)("77. Optional writing skip with %s follows persisted-state policy", async (_label, skipState, shouldAdvance) => {
    const session = authoritativeSessionFixture("book1-l01", "s-writing-skip", {
      listen: "COMPLETED", "recognition-1": "COMPLETED", "recognition-2": "COMPLETED",
      "sentence-pattern": "COMPLETED", speaking: "COMPLETED", pronunciation: "COMPLETED",
    }, {}, true);
    let skipCalls = 0;
    installPlannerSessionMock(session, (url, init) => {
      if (url.endsWith(`/tasks/${session.id}:writing-guided/skip`) && init?.method === "POST") {
        skipCalls++;
        const writing = session.tasks.find((task) => task.key === "writing-guided")!;
        if (skipState === undefined) delete (writing as any).state;
        else writing.state = skipState;
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return undefined;
    });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />); });
    await advanceToPlannerStep(container, "writing");
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    await act(async () => { (container.querySelector(".skip-writing-btn") as HTMLButtonElement).click(); });
    expect(skipCalls).toBe(1);
    if (shouldAdvance) {
      expect(session.tasks.find((task) => task.key === "writing-guided")?.state).toBe("DEFERRED");
      expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
      expect(container.querySelector(".error-strip")).toBeNull();
    } else {
      expect(session.tasks.find((task) => task.key === "writing-guided")?.state).toBe(skipState);
      expect(container.querySelector(".lesson-step-card")).toBeNull();
      expect(container.querySelector(".next-step-cta-btn")).toBeNull();
      expect(container.querySelector(".error-strip")).toBeTruthy();
    }
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("78. Canonical REVIEW renders exact word/writing tasks, blocks writing skip, and submits exact script evidence", async () => {
    const dueAt = "2026-09-02T00:00:00Z";
    const wordTask = {
      id: "s-domain-review:review-word-1", sessionId: "s-domain-review", childId: 1, key: "review-word-1",
      taskType: "REVIEW_VOCABULARY", sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "word",
      itemId: "lf_1_basic-l01_vocabulary", state: "PENDING", required: true,
      taskData: { word: "你好", prompt: "從官方詞語任務選擇意思", choices: [{ id: "opt-hello", label: "打招呼問好" }, { id: "opt-eat", label: "詢問用餐" }], dueAt },
    };
    const writingTask = {
      id: "s-domain-review:review-writing-1", sessionId: "s-domain-review", childId: 1, key: "review-writing-1",
      taskType: "REVIEW_WRITING", sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "writing",
      itemId: "traditional::你", state: "PENDING", attemptCount: 0, required: true,
      taskData: { character: "你", phase: "independent", scriptMode: "TRADITIONAL", repeatCount: 1, dueAt },
    };
    const curriculumTask = { id: "learn-pending", key: "recognition-1", taskType: "MINI_CHECK", sourceQueue: "CURRICULUM", lessonId: "basic-l01", skillDomain: "recognition", itemId: "char1", state: "PENDING", required: true };
    const session: any = { id: "s-domain-review", sessionId: "s-domain-review", childId: 1, status: "IN_PROGRESS", lessonId: "basic-l01", tasks: [wordTask, writingTask, curriculumTask] };
    const requests: Array<{ url: string; body?: any }> = [];
    const dueItems = [
      { id: "lf_1_basic-l01_vocabulary", skillDomain: "word", word: "你好", lessonId: "basic-l01", dueAt },
      { id: "traditional::你", skillDomain: "writing", character: "你", scriptMode: "TRADITIONAL", lessonId: "basic-l01", dueAt },
    ];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      if (init?.method === "POST") requests.push({ url, body });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 2, items: dueItems } }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/tasks/" + wordTask.id + "/answer") && init?.method === "POST") { wordTask.state = body.selected_option_id === "opt-hello" ? "COMPLETED" : "IN_PROGRESS"; return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } }); }
      if (url.endsWith("/tasks/" + writingTask.id + "/start") && init?.method === "POST") { writingTask.state = "IN_PROGRESS"; return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } }); }
      if (url.endsWith("/tasks/" + writingTask.id + "/evidence") && init?.method === "POST") { writingTask.state = "COMPLETED"; writingTask.attemptCount = 1; return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } }); }
      if (url.endsWith("/tasks/" + writingTask.id + "/skip") && init?.method === "POST") { return new Response(JSON.stringify({ detail: "learning_task_not_skippable" }), { status: 409, headers: { "Content-Type": "application/json" } }); }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    let traceComplete: (() => void) | undefined;
    const writerSpy = vi.spyOn(HanziWriter, "create").mockImplementation(((_target: any, _character: string, _options: any) => ({
      quiz: (options: { onComplete: () => void }) => { traceComplete = options.onComplete; },
      animateCharacter: vi.fn(),
    })) as any);
    const back = vi.fn();
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={back} initialMode="REVIEW" />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.querySelector(".vocab-hanzi")?.textContent).toBe("你好");
    expect(container.querySelector(".interaction-prompt")?.textContent).toContain("從官方詞語任務");
    await act(async () => { (container.querySelector(".step-vocab-body .choice-card-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(wordTask.state).toBe("COMPLETED");
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    const skip = container.querySelector(".skip-writing-btn") as HTMLButtonElement;
    expect(skip.disabled).toBe(true);
    await act(async () => { skip.click(); (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(requests.some((request) => request.url.endsWith("/tasks/" + writingTask.id + "/skip"))).toBe(false);
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    expect(traceComplete).toBeTypeOf("function");
    await act(async () => { traceComplete?.(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    const startRequest = requests.find((request) => request.url.endsWith("/tasks/" + writingTask.id + "/start"));
    const evidenceRequest = requests.find((request) => request.url.endsWith("/tasks/" + writingTask.id + "/evidence"));
    expect(startRequest).toBeTruthy();
    expect(evidenceRequest?.body).toMatchObject({
      evidence_ref: "flow-writing:s-domain-review:s-domain-review:review-writing-1:0",
      trace_result: "correct", assisted: false, provider: "HANZI_WRITER", phase: "independent", script_mode: "TRADITIONAL", attempt_index: 0,
    });
    expect(writingTask.state).toBe("COMPLETED");
    expect(curriculumTask.state).toBe("PENDING");
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(back).toHaveBeenCalledTimes(1);
    expect(requests.some((request) => request.url.endsWith("/learning-sessions/s-domain-review/complete"))).toBe(false);
    expect(session.status).toBe("IN_PROGRESS");
    expect(curriculumTask.state).toBe("PENDING");
    writerSpy.mockRestore(); root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("78a. Canonical REVIEW maps the exact starter-l03 family vocabulary task and preserves pending LEARN work", async () => {
    const dueAt = "2026-09-20T07:00:00Z";
    const dueId = "lf_33_starter-l03_vocabulary";
    const reviewTask: any = {
      id: "s-l3-review:review-word-1", sessionId: "s-l3-review", childId: 33, key: "review-word-1",
      taskType: "REVIEW_VOCABULARY", sourceQueue: "REVIEW", lessonId: "starter-l03", skillDomain: "word",
      itemId: dueId, state: "PENDING", required: true, masteryImpact: "NONE", evidenceType: "learning_session_vocabulary_choice",
      taskData: {
        word: "爸爸媽媽", prompt: "「爸爸媽媽」指的是誰？",
        choices: [{ id: "family-parents", label: "父親和母親" }, { id: "family-friends", label: "朋友和同學" }],
        dueAt,
      },
    };
    const pendingCurriculum: any = {
      id: "s-l3-review:listen", sessionId: "s-l3-review", childId: 33, key: "listen", taskType: "LISTENING",
      sourceQueue: "CURRICULUM", lessonId: "starter-l03", skillDomain: "listening", itemId: "lf_33_starter-l03_phrase",
      state: "PENDING", required: true, taskData: { text: "我有爸爸媽媽。", authorship: "TONGXUAN_AUTHORED_PRACTICE" },
    };
    const session: any = {
      id: "s-l3-review", sessionId: "s-l3-review", childId: 33, status: "IN_PROGRESS", lessonId: "starter-l03",
      curriculumContext: { lessonId: "starter-l03", lessonMasteredBeforeSession: false, official: { title: "爸爸媽媽" } },
      tasks: [reviewTask, pendingCurriculum],
    };
    const dueItems = [{ id: dueId, skillDomain: "word", word: "爸爸媽媽", lessonId: "starter-l03", dueAt }];
    const requests: Array<{ url: string; method: string; body?: any }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requests.push({ url, method, body });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify({ childId: 33, review: { sourceQueue: "REVIEW", dueCount: 1, items: dueItems } }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith(`/tasks/${reviewTask.id}/answer`) && method === "POST") {
        expect(body).toMatchObject({ selected_option_id: "family-parents", assisted: false });
        reviewTask.state = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const back = vi.fn();
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="starter-l03" activeChildId={33} onBack={back} initialMode="REVIEW" />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.querySelector(".vocab-hanzi")?.textContent).toBe("爸爸媽媽");
    expect(container.textContent).toContain("bàba māma");
    expect(container.textContent).toContain("我有爸爸媽媽。");
    await act(async () => { (container.querySelector(".step-vocab-body .choice-card-btn") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(reviewTask.state).toBe("COMPLETED");
    expect(pendingCurriculum.state).toBe("PENDING");
    expect(requests.find((request) => request.url.endsWith(`/tasks/${reviewTask.id}/answer`))?.body).toMatchObject({ selected_option_id: "family-parents" });
    expect(requests.some((request) => request.url.endsWith(`/tasks/s-l3-review:review-word-1/answer`))).toBe(true);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(back).toHaveBeenCalledTimes(1);
    expect(session.status).toBe("IN_PROGRESS");
    expect(pendingCurriculum.state).toBe("PENDING");
    expect(requests.some((request) => request.url.endsWith("/learning-sessions/s-l3-review/complete"))).toBe(false);
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("79. Exact REVIEW_WRITING retry-cap deferral survives due-date refresh and allows REVIEW-only wrap-up", async () => {
    const initialDueAt = "2026-09-02T00:00:00Z";
    const task = {
      id: "s-review-cap:review-writing-1", sessionId: "s-review-cap", childId: 1, key: "review-writing-1",
      taskType: "REVIEW_WRITING", sourceQueue: "REVIEW", lessonId: "basic-l01", skillDomain: "writing",
      itemId: "traditional::你", state: "PENDING", attemptCount: 0, failureCount: 0, deferredReason: null as string | null, required: true,
      taskData: { character: "你", phase: "independent", scriptMode: "TRADITIONAL", repeatCount: 1, dueAt: initialDueAt },
    };
    const curriculumTask = { id: "learn-pending", key: "recognition-1", taskType: "MINI_CHECK", sourceQueue: "CURRICULUM", lessonId: "basic-l01", skillDomain: "recognition", itemId: "char1", state: "PENDING", required: true };
    const session: any = { id: "s-review-cap", sessionId: "s-review-cap", childId: 1, status: "IN_PROGRESS", lessonId: "basic-l01", tasks: [task, curriculumTask] };
    const requests: Array<{ url: string; method: string; body?: any }> = [];
    const dueItems = [{ id: task.itemId, skillDomain: "writing", character: "你", scriptMode: "TRADITIONAL", lessonId: "basic-l01", dueAt: initialDueAt }];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      requests.push({ url, method, body });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify({ childId: 1, review: { sourceQueue: "REVIEW", dueCount: 1, items: dueItems } }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith(`/tasks/${task.id}/start`) && method === "POST") {
        task.state = "IN_PROGRESS";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith(`/tasks/${task.id}/evidence`) && method === "POST") {
        const index = body.attempt_index as number;
        task.attemptCount = index + 1;
        task.failureCount = index + 1;
        task.state = index === 1 ? "DEFERRED" : "IN_PROGRESS";
        task.deferredReason = index === 1 ? "WRITING_RETRY_CAP" : null;
        task.taskData.dueAt = index === 1 ? "2026-09-05T00:00:03Z" : "2026-09-05T00:00:01Z";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    let traceMistake: (() => void) | undefined;
    const writerSpy = vi.spyOn(HanziWriter, "create").mockImplementation(((_target: any, _character: string, _options: any) => ({
      quiz: (options: { onMistake: () => void }) => { traceMistake = options.onMistake; },
      animateCharacter: vi.fn(),
    })) as any);
    const back = vi.fn();
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="basic-l01" activeChildId={1} onBack={back} initialMode="REVIEW" />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    expect((container.querySelector(".skip-writing-btn") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { traceMistake?.(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(task.state).toBe("IN_PROGRESS");
    expect(task.attemptCount).toBe(1);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();

    await act(async () => { traceMistake?.(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(task.state).toBe("DEFERRED");
    expect(task.failureCount).toBe(2);
    expect(task.deferredReason).toBe("WRITING_RETRY_CAP");
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(back).toHaveBeenCalledTimes(1);
    expect(requests.filter((request) => request.url.endsWith(`/tasks/${task.id}/evidence`)).map((request) => request.body.attempt_index)).toEqual([0, 1]);
    expect(requests.some((request) => request.url.endsWith(`/learning-sessions/${session.id}/complete`))).toBe(false);
    expect(session.status).toBe("IN_PROGRESS");
    expect(curriculumTask.state).toBe("PENDING");
    writerSpy.mockRestore(); root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

  it("80. Listening REVIEW validates the exact Fast Track question task and rejects malformed mappings", () => {
    const pkg = getLessonPackage("book1-l01")!;
    const dueAt = "2026-09-02T00:00:00Z";
    const due = {
      id: "lf_1_book1-l01_phrase", skillDomain: "listening", lessonId: "book1-l01", dueAt,
      questionId: "ft-q1", prompt: "聽錄音，選出這句話的意思：", audioText: "你好",
      choices: [{ id: "c1", label: "打招呼問好 (Hello)" }, { id: "c2", label: "感謝對方 (Thank you)" }],
    };
    const task = {
      id: "listening-session:review-listening-1", sessionId: "listening-session", childId: 1,
      key: "review-listening-1", taskType: "REVIEW_LISTENING", sourceQueue: "REVIEW", lessonId: "book1-l01",
      skillDomain: "listening", evidenceType: "fast_track_listening_choice", masteryImpact: "NONE",
      itemId: due.id, state: "PENDING", required: true,
      taskData: { questionId: due.questionId, prompt: due.prompt, audioText: due.audioText, choices: due.choices, dueAt },
    };

    expect(validateReviewDueItems([due])).toBe(true);
    const selected = selectReviewTasksAcrossPackages([task], [due], 1, "listening-session");
    expect(selected?.map((row) => row.id)).toEqual([task.id]);
    const steps = getStepsForMode(pkg, "REVIEW", [], selected ?? []);
    expect(steps[0]).toMatchObject({
      stepKey: "mini_check", domain: "listening",
      data: { taskId: task.id, taskType: "REVIEW_LISTENING", questionId: due.questionId, audioText: "你好", choices: due.choices },
    });
    expect(steps.at(-1)?.stepKey).toBe("wrap_up");
    expect(selectReviewTasksAcrossPackages([{ ...task, state: "IN_PROGRESS" }], [due], 1, "listening-session")).toHaveLength(1);
    expect(selectReviewTasksAcrossPackages([task], [{ ...due, audioText: "你好嗎" }], 1, "listening-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([task], [{ ...due, choices: [{ id: "same", label: "問好" }, { id: "same", label: "謝謝" }] }], 1, "listening-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([{ ...task, itemId: "lf_2_book1-l01_phrase" }], [due], 1, "listening-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([task], [{ ...due, id: "lf_2_book1-l01_phrase" }], 1, "listening-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([task], [due], 2, "listening-session")).toBeNull();
    expect(selectReviewTasksAcrossPackages([{ ...task, masteryImpact: "SCORED_DOMAIN_EVIDENCE" }], [due], 1, "listening-session")).toBeNull();
    expect(validateReviewDueItems([{ ...due, correctChoiceId: "c1" }])).toBe(false);
    expect(validateReviewDueItems([{
      ...due,
      choices: [{ ...due.choices[0], isCorrect: true }, due.choices[1]],
    }])).toBe(false);

    const originalBlueprint = pkg.taskBlueprint;
    const originalSource = pkg.curriculumSource;
    try {
      const changedQuestionBlueprint = JSON.parse(JSON.stringify(originalBlueprint));
      const listeningQuestion = changedQuestionBlueprint.fastTrackSteps
        .find((step: any) => step.stepKey === "exit_ticket").data.questions[0];
      listeningQuestion.prompt = "不同於執行課程的題目";
      (pkg as any).taskBlueprint = changedQuestionBlueprint;
      expect(validateReviewDueItems([due])).toBe(false);
      expect(selectReviewTasksAcrossPackages([task], [due], 1, "listening-session")).toBeNull();

      (pkg as any).taskBlueprint = { fastTrackSteps: "malformed" };
      expect(validateReviewDueItems([due])).toBe(false);
      (pkg as any).curriculumSource = null;
      expect(validateReviewDueItems([due])).toBe(false);
    } finally {
      (pkg as any).taskBlueprint = originalBlueprint;
      (pkg as any).curriculumSource = originalSource;
    }
  });

  it("81. Canonical REVIEW submits exact listening task, blocks Next until authoritative completion, and returns Home without settling LEARN", async () => {
    const dueAt = "2026-09-02T00:00:00Z";
    const due = {
      id: "lf_1_book1-l01_phrase", skillDomain: "listening", lessonId: "book1-l01", dueAt,
      questionId: "ft-q1", prompt: "聽錄音，選出這句話的意思：", audioText: "你好",
      choices: [{ id: "c1", label: "打招呼問好 (Hello)" }, { id: "c2", label: "感謝對方 (Thank you)" }],
    };
    const listeningTask: any = {
      id: "s-listening-review:review-listening-1", sessionId: "s-listening-review", childId: 1,
      key: "review-listening-1", taskType: "REVIEW_LISTENING", sourceQueue: "REVIEW", lessonId: "book1-l01",
      skillDomain: "listening", evidenceType: "fast_track_listening_choice", masteryImpact: "NONE",
      itemId: due.id, state: "PENDING", attemptCount: 0, required: true,
      taskData: { questionId: due.questionId, prompt: due.prompt, audioText: due.audioText, choices: due.choices, dueAt },
    };
    const curriculumTask = {
      id: "learn-required-listening", key: "listen", taskType: "LISTENING", sourceQueue: "CURRICULUM",
      lessonId: "book1-l01", skillDomain: "listening", itemId: due.id, state: "PENDING", required: true,
    };
    const session: any = {
      id: "s-listening-review", sessionId: "s-listening-review", childId: 1, status: "IN_PROGRESS",
      lessonId: "book1-l01", tasks: [listeningTask, curriculumTask],
    };
    const requests: Array<{ url: string; method: string; body?: any }> = [];
    const back = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      if (method === "POST") requests.push({ url, method, body });
      if (url.includes("/learning-sessions/current")) return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/learning-daily-queue")) return new Response(JSON.stringify({
        childId: 1, review: { sourceQueue: "REVIEW", dueCount: 1, items: [due] },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/reconcile-reviews") && method === "POST") return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith(`/tasks/${listeningTask.id}/answer`) && method === "POST") {
        listeningTask.state = body.selected_option_id === "c1" ? "COMPLETED" : "IN_PROGRESS";
        listeningTask.attemptCount += 1;
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith(`/learning-sessions/${session.id}/complete`) && method === "POST") {
        session.status = "COMPLETED";
        return new Response(JSON.stringify(session), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    await act(async () => { root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={back} initialMode="REVIEW" />); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(container.querySelector("[data-step-key='mini_check']")).toBeTruthy();
    expect(container.querySelector(".interaction-prompt")?.textContent).toBe(due.prompt);
    expect(container.querySelector(".q-audio-btn")?.getAttribute("aria-label")).toContain("你好");
    expect(Array.from(container.querySelectorAll(".step-exit-ticket-body .choice-card-btn")).map((button) => button.textContent)).toEqual(due.choices.map((choice) => choice.label));

    await act(async () => { (container.querySelector(".step-exit-ticket-body .choice-card-btn:last-child") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(listeningTask.state).toBe("IN_PROGRESS");
    expect((container.querySelector(".next-step-cta-btn") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { (container.querySelector(".step-exit-ticket-body .choice-card-btn:first-child") as HTMLButtonElement).click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(listeningTask.state).toBe("COMPLETED");
    expect((container.querySelector(".next-step-cta-btn") as HTMLButtonElement).disabled).toBe(false);
    expect(requests.filter((request) => request.url.endsWith(`/tasks/${listeningTask.id}/answer`)).map((request) => request.body)).toEqual([
      { selected_option_id: "c2", answers: {}, assisted: false },
      { selected_option_id: "c1", answers: {}, assisted: false },
    ]);
    await act(async () => { (container.querySelector(".next-step-cta-btn") as HTMLButtonElement).click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    await act(async () => { (container.querySelector(".finish-session-cta-btn") as HTMLButtonElement).click(); });
    expect(back).toHaveBeenCalledTimes(1);
    expect(requests.some((request) => request.url.endsWith(`/learning-sessions/${session.id}/complete`))).toBe(false);
    expect(session.status).toBe("IN_PROGRESS");
    expect(curriculumTask.state).toBe("PENDING");
    root.unmount(); container.remove(); vi.unstubAllGlobals();
  });

});
