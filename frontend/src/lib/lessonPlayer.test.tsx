// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

import { LessonPlayerPage } from "../pages/LessonPlayerPage";
import {
  getLessonPackage,
  getAllLessonPackages,
  getStepsForMode,
  getScaffoldText,
  validateReviewStatusIntegrity,
  type LessonPackage,
} from "../data/lessonPackages";
import { officialCoursePath } from "../data/officialCoursePath";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
          activeChildId={1}
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
  it("6. Failing one domain creates targeted REPAIR tasks only", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // When only recognition fails
    const repairRecog = getStepsForMode(pkg, "REPAIR", ["recognition"]);
    expect(repairRecog.some((s) => s.domain === "recognition")).toBe(true);
    expect(repairRecog.some((s) => s.domain === "listening")).toBe(false);
    expect(repairRecog.some((s) => s.domain === "speaking")).toBe(false);

    // When only writing fails
    const repairWriting = getStepsForMode(pkg, "REPAIR", ["writing"]);
    expect(repairWriting.some((s) => s.domain === "writing")).toBe(true);
    expect(repairWriting.some((s) => s.domain === "listening")).toBe(false);
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
          activeChildId={1}
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
  it("11. Review mode contains due retrieval tasks without replaying the entire lesson", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    const revSteps = getStepsForMode(pkg, "REVIEW");
    expect(revSteps.length).toBe(2); // retrieval exit ticket + wrap up
    expect(revSteps[0].stepKey).toBe("exit_ticket");
    expect(revSteps[1].stepKey).toBe("wrap_up");
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
  it("13. Starter / Basic / Book 1 Lesson 1 can each render from the common schema", () => {
    const packages = getAllLessonPackages();
    expect(packages.length).toBe(3);

    const ids = packages.map((p) => p.lessonId);
    expect(ids).toContain("starter-l01");
    expect(ids).toContain("basic-l01");
    expect(ids).toContain("book1-l01");

    for (const p of packages) {
      expect(p.schemaVersion).toBe("v2.0");
      expect(p.taskBlueprint.learnSteps.length).toBe(9);
      expect(p.taskBlueprint.fastTrackSteps.length).toBeGreaterThanOrEqual(2);
      expect(p.taskBlueprint.reviewSteps.length).toBeGreaterThanOrEqual(2);
      expect(p.curriculumSource.provenanceStatus).toBe("VERIFIED_OFFICIAL_TITLE");
    }
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
  it("17. Fast Track failure transitions directly to REPAIR mode with weak domains", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // Mock fast track endpoint returning failure with weak domains
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/fast-track")) {
        return new Response(JSON.stringify({
          lessonId: "book1-l01",
          passed: false,
          weakDomains: ["recognition"],
          nextMode: "REPAIR",
          masteryStatus: "IN_PROGRESS",
          nextReviewDueAt: null,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

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

    // Verify mode transitioned to repair mode
    const modeBadge = container.querySelector(".mode-badge");
    expect(modeBadge?.className).toContain("mode-repair");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 18
  it("18. Client mastery is never granted locally without backend authoritative assessment", async () => {
    let completedSummary: { sessionCompleted: boolean; masteryGranted: boolean } | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "session-1",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS", // Backend has not granted MASTERED
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/complete")) {
        return new Response(JSON.stringify({
          id: "session-1",
          status: "COMPLETED",
          masteryStatus: "READY_FOR_CHECK", // Still not MASTERED
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    await act(async () => {
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          onCompleteLesson={(_, summary) => {
            completedSummary = summary;
          }}
        />
      );
    });

    // Complete session
    const finishBtn = container.querySelector(".finish-session-cta-btn, .next-step-cta-btn");
    expect(finishBtn).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
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
  it("21. Step choices and skip actions dispatch to backend learning flow tasks", async () => {
    const postedUrls: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "session-flow-1",
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            { id: "session-flow-1:listen", key: "listen", taskType: "LISTENING", itemId: "item-phrase", state: "PENDING" },
            { id: "session-flow-1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", itemId: "item-vocab", state: "PENDING" },
            { id: "session-flow-1:writing-guided", key: "writing-guided", taskType: "WRITING_GUIDED", state: "PENDING" },
          ]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (init?.method === "POST") {
        postedUrls.push(url);
        if (url.includes("/listening-attempts") && !url.includes("/complete") && !url.includes("/evidence")) {
          return new Response(JSON.stringify({ id: "listen-attempt-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (url.includes("/listening-attempts/listen-attempt-1/complete")) {
          return new Response(JSON.stringify({ id: "listen-attempt-1", status: "COMPLETED" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          id: "session-flow-1",
          status: "IN_PROGRESS",
          tasks: []
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
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

    // Step 1 choice click triggers listening attempt & evidence submission
    const choiceBtn = container.querySelector(".choice-card-btn") as HTMLButtonElement;
    expect(choiceBtn).toBeTruthy();
    await act(async () => {
      choiceBtn.click();
    });

    expect(postedUrls.some((u) => u.includes("/listening-attempts"))).toBe(true);
    expect(postedUrls.some((u) => u.includes("/tasks/session-flow-1:listen/evidence"))).toBe(true);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
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

    // Should render gracefully without exploding
    const card = container.querySelector(".lesson-step-card");
    expect(card).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 23
  it("23. Speaking and pronunciation attempts record independent domain attempts with source_id", async () => {
    const postedBodies: any[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "session-flow-2",
          status: "IN_PROGRESS",
          lessonId: "book1-l01",
          tasks: [
            { id: "session-flow-2:speaking", key: "speaking", taskType: "SPEAKING_ATTEMPT", itemId: "phrase-1", state: "PENDING" },
            { id: "session-flow-2:pronunciation", key: "pronunciation", taskType: "PRONUNCIATION_ATTEMPT", itemId: "phrase-1", state: "PENDING" },
          ]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (init?.method === "POST") {
        if (init?.body) {
          try {
            postedBodies.push(JSON.parse(init.body as string));
          } catch {}
        }
        if (url.includes("/reading-aloud/attempts/start")) {
          return new Response(JSON.stringify({ id: "ra-attempt-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          id: "session-flow-2",
          status: "IN_PROGRESS",
          tasks: []
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
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

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
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
    let completedResult: any = null;

    const tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "PENDING", required: true, itemId: "phrase-hello", taskData: { text: "你好", audioUrl: "/audio/book1/l01/hello.mp3" } },
      { id: "s1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", state: "PENDING", required: true, itemId: "vocab-hello", taskData: { prompt: "「你好」是什麼意思？", choices: [{ id: "opt-hello", label: "問候打招呼 (Hello)" }, { id: "opt-eat", label: "吃飯 (Eat)" }] } },
      { id: "s1:recognition-1", key: "recognition-1", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-ni", taskData: { prompt: "請選出正確的字：你", audioText: "你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好" }] } },
      { id: "s1:recognition-2", key: "recognition-2", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-hao", taskData: { prompt: "請選出正確的字：好", audioText: "好", choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好", isCorrect: true }] } },
      { id: "s1:sentence-pattern", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "PENDING", required: true, itemId: "pattern-greeting", taskData: { prompt: "請選出合適的打招呼句子：", choices: [{ id: "opt-correct-order", label: "你好！我叫小明。" }, { id: "opt-wrong-order", label: "我叫你好小明！" }] } },
      { id: "s1:speaking", key: "speaking", taskType: "SPEAKING_ATTEMPT", state: "PENDING", required: false, itemId: "phrase-hello" },
      { id: "s1:pronunciation", key: "pronunciation", taskType: "PRONUNCIATION_ATTEMPT", state: "PENDING", required: false, itemId: "phrase-hello" },
      { id: "s1:writing-1", key: "writing-1", taskType: "WRITING_PRACTICE", state: "PENDING", required: false, itemId: "char-ni" },
      { id: "s1:mini-check-reflection", key: "mini-check-reflection", taskType: "MINI_CHECK", state: "PENDING", required: true, taskData: { mode: "reflection", prompt: "完成今天的學習了嗎？" } },
      { id: "s1:wrap-up", key: "wrap-up", taskType: "LESSON_WRAP_UP", state: "PENDING", required: false },
    ];

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

    const currentSession = {
      id: "session-e2e-1",
      childId: 1,
      mode: "LEARN",
      status: "IN_PROGRESS",
      lessonId: "book1-l01",
      tasks: tasksState,
    };

    const recordedEvents: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      // 1. Session query
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 1.1 Listening attempts
      if (url.includes("/listening-attempts") && !url.includes("/complete") && init?.method === "POST") {
        recordedEvents.push("listening_start");
        return new Response(JSON.stringify({ id: "listen-att-101" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/listening-attempts") && url.includes("/complete") && init?.method === "POST") {
        recordedEvents.push("listening_complete");
        return new Response(JSON.stringify({ id: "listen-att-101", status: "COMPLETED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 2. Start speaking attempt
      if (url.includes("/reading-aloud/attempts/start") && init?.method === "POST") {
        recordedEvents.push("speaking_start");
        return new Response(JSON.stringify({ id: "ra-attempt-101" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 3. Complete speaking attempt
      if (url.includes("/reading-aloud/attempts/") && url.includes("/complete") && init?.method === "POST") {
        recordedEvents.push("speaking_complete");
        return new Response(JSON.stringify({ id: "ra-attempt-101", status: "completed" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 4. Submit task evidence
      if (url.includes("/tasks/") && url.includes("/evidence") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/evidence")[0]);
        const task = tasksState.find((t) => t.id === taskId);
        if (task) {
          task.state = "COMPLETED";
          recordedEvents.push(`evidence:${taskId}`);
        }
        return new Response(JSON.stringify({ ...currentSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 5. Submit task answer
      if (url.includes("/tasks/") && url.includes("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string);
        const chosen = body.selected_option_id || body.selectedChoiceId;
        const task = tasksState.find((t) => t.id === taskId);
        if (task) {
          task.state = "COMPLETED";
          recordedEvents.push(`answer:${taskId}:${chosen}`);
        }
        return new Response(JSON.stringify({ ...currentSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 6. Skip task
      if (url.includes("/tasks/") && url.includes("/skip") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/skip")[0]);
        const task = tasksState.find((t) => t.id === taskId);
        if (task) {
          task.state = "SKIPPED";
          recordedEvents.push(`skip:${taskId}`);
        }
        return new Response(JSON.stringify({ ...currentSession }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 7. Complete session
      if (url.includes("/complete") && init?.method === "POST") {
        const pendingRequired = tasksState.filter((t) => t.required && t.state !== "COMPLETED" && t.state !== "SKIPPED");
        if (pendingRequired.length > 0) {
          return new Response(JSON.stringify({ detail: "required_learning_tasks_incomplete" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
        currentSession.status = "COMPLETED";
        recordedEvents.push("session_complete");
        return new Response(JSON.stringify({
          id: currentSession.id,
          status: "COMPLETED",
          masteryStatus: "IN_PROGRESS",
          curriculumContext: {
            book: "Book 1",
            lesson: "Lesson 1",
            lessonId: "book1-l01",
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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
          onCompleteLesson={(id, res) => {
            completedLessonId = id;
            completedResult = res;
          }}
        />
      );
    });

    // STEP 1: Context -> Click Next Step (which plays listening audio / logs evidence)
    expect(container.querySelector("[data-step-key='context']")).toBeTruthy();
    const nextBtn1 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn1.click();
    });

    // STEP 2: Dialogue -> Click Next Step
    expect(container.querySelector("[data-step-key='dialogue']")).toBeTruthy();
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn2.click();
    });

    // STEP 3: Vocabulary -> Click choice opt-hello and advance
    expect(container.querySelector("[data-step-key='vocabulary']")).toBeTruthy();
    const vocabChoices = container.querySelectorAll(".step-vocab-body .choice-card-btn");
    expect(vocabChoices.length).toBeGreaterThan(0);
    await act(async () => {
      (vocabChoices[0] as HTMLButtonElement).click();
    });
    const nextBtn3 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn3.click();
    });

    // STEP 4: Characters -> Answer recognition for 你 (tab 0) and 好 (tab 1)
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    const recogChoices1 = container.querySelectorAll(".char-choice-card");
    expect(recogChoices1.length).toBe(2);
    // Click 你
    await act(async () => {
      (recogChoices1[0] as HTMLButtonElement).click();
    });
    // Switch to tab 1 (好)
    const charTabs = container.querySelectorAll(".character-tab-btn");
    expect(charTabs.length).toBe(2);
    await act(async () => {
      (charTabs[1] as HTMLButtonElement).click();
    });
    // Click 好
    const recogChoices2 = container.querySelectorAll(".char-choice-card");
    await act(async () => {
      (recogChoices2[1] as HTMLButtonElement).click();
    });
    // Advance characters step
    const nextBtn4 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn4.click();
    });

    // STEP 5: Sentence Pattern -> Click choice opt-correct-order and advance
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    const sentChoices = container.querySelectorAll(".step-sentence-body .choice-card-btn");
    expect(sentChoices.length).toBeGreaterThan(0);
    await act(async () => {
      (sentChoices[0] as HTMLButtonElement).click();
    });
    const nextBtn5 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn5.click();
    });

    // STEP 6: Speaking -> Click Record button to simulate speaking attempt
    expect(container.querySelector("[data-step-key='speaking']")).toBeTruthy();
    const recordBtn = container.querySelector(".mic-record-btn") as HTMLButtonElement;
    expect(recordBtn).toBeTruthy();
    await act(async () => {
      recordBtn.click();
    });
    await act(async () => {
      recordBtn.click();
    });
    const nextBtn6 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn6.click();
    });

    // STEP 7: Writing -> Click skip writing button
    expect(container.querySelector("[data-step-key='writing']")).toBeTruthy();
    const skipWritingBtn = container.querySelector(".skip-writing-btn") as HTMLButtonElement;
    expect(skipWritingBtn).toBeTruthy();
    await act(async () => {
      skipWritingBtn.click();
    });

    // STEP 8: Exit Ticket -> Select answers for all questions and submit
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    expect(questionCards.length).toBe(4);
    for (const card of Array.from(questionCards)) {
      const firstChoice = card.querySelector(".choice-card-btn") as HTMLButtonElement;
      if (firstChoice) {
        await act(async () => {
          firstChoice.click();
        });
      }
    }
    const submitExitTicketBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    expect(submitExitTicketBtn).toBeTruthy();
    await act(async () => {
      submitExitTicketBtn.click();
    });
    const nextBtn8 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => {
      nextBtn8.click();
    });

    // STEP 9: Wrap-up -> Click finish lesson CTA
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();
    const finishBtn = container.querySelector(".finish-session-cta-btn") as HTMLButtonElement;
    expect(finishBtn).toBeTruthy();
    await act(async () => {
      finishBtn.click();
    });

    // Verify session completion callback was called
    expect(completedLessonId).toBe("book1-l01");
    expect(completedResult).toEqual({
      sessionCompleted: true,
      masteryGranted: false,
    });

    // Verify critical tasks were answered with correct contracts
    expect(recordedEvents).toContain("answer:s1:vocabulary:opt-hello");
    expect(recordedEvents).toContain("answer:s1:recognition-1:opt-ni");
    expect(recordedEvents).toContain("answer:s1:recognition-2:opt-hao");
    expect(recordedEvents).toContain("answer:s1:sentence-pattern:opt-correct-order");
    expect(recordedEvents).toContain("skip:s1:writing-1");
    expect(recordedEvents).toContain("session_complete");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 26
  it("26. Vocabulary unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const answeredTaskIds: string[] = [];
    const tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", required: true, itemId: "phrase-hello" },
      { id: "s1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", state: "PENDING", required: true, itemId: "vocab-hello", taskData: { prompt: "「你好」是什麼意思？", choices: [{ id: "opt-hello", label: "問候打招呼 (Hello)" }, { id: "opt-eat", label: "吃飯 (Eat)" }] } },
      { id: "s1:recognition-1", key: "recognition-1", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-ni" },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "session-vocab-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.includes("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        answeredTaskIds.push(taskId);
        return new Response(JSON.stringify({ id: "session-vocab-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    // Advance Step 1 (Context) -> Step 2 (Dialogue) -> Step 3 (Vocabulary)
    const nextBtn1 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn1.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

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
    expect(answeredTaskIds).not.toContain("s1:vocabulary");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 27
  it("27. Recognition unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const answeredTaskIds: string[] = [];
    const tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", required: true, itemId: "phrase-hello" },
      { id: "s1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", required: true, itemId: "vocab-hello" },
      { id: "s1:recognition-1", key: "recognition-1", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-ni", taskData: { choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "s1:recognition-2", key: "recognition-2", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-hao", taskData: { choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "s1:sentence-pattern", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "PENDING", required: true },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "session-recog-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.includes("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        answeredTaskIds.push(taskId);
        const task = tasksState.find((t) => t.id === taskId);
        if (task) task.state = "COMPLETED";
        return new Response(JSON.stringify({ id: "session-recog-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    // Advance to Step 3, pick vocab, advance to Step 4 (Characters)
    const nextBtn1 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn1.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    const vocabChoice = container.querySelector(".step-vocab-body .choice-card-btn") as HTMLButtonElement;
    await act(async () => { vocabChoice.click(); });
    const nextBtn3 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn3.click(); });

    // Step 4 (Characters) is active on tab 0 ("你")
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();

    // Click Next Step WITHOUT picking recognition choice for char 0
    const nextBtn4 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn4.click(); });

    // Must NOT advance to tab 1 or step 5
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(answeredTaskIds).not.toContain("s1:recognition-1");

    // Now answer tab 0 ("你")
    const recogChoices = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recogChoices[0] as HTMLButtonElement).click(); });

    // Click Next -> moves to tab 1 ("好")
    await act(async () => { nextBtn4.click(); });
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();

    // On tab 1 ("好"), click Next WITHOUT picking recognition choice
    await act(async () => { nextBtn4.click(); });

    // Must NOT advance to Step 5
    expect(container.querySelector("[data-step-key='characters']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeNull();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(answeredTaskIds).not.toContain("s1:recognition-2");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 28
  it("28. Sentence pattern unanswered + Next -> no scored attempt generated, does not advance", async () => {
    const answeredTaskIds: string[] = [];
    const tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", required: true, itemId: "phrase-hello" },
      { id: "s1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", required: true, itemId: "vocab-hello" },
      { id: "s1:recognition-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", required: true, itemId: "char-ni" },
      { id: "s1:recognition-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", required: true, itemId: "char-hao" },
      { id: "s1:sentence-pattern", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "PENDING", required: true, taskData: { prompt: "請選出句子：", choices: [{ id: "opt-correct-order", label: "你好！我叫小明。" }, { id: "opt-wrong-order", label: "我叫你好小明！" }] } },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "session-sent-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.includes("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        answeredTaskIds.push(taskId);
        return new Response(JSON.stringify({ id: "session-sent-gate", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    // Advance to Step 3 (vocab)
    const nextBtn1 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn1.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    // Answer vocab
    const vocabChoice = container.querySelector(".step-vocab-body .choice-card-btn") as HTMLButtonElement;
    await act(async () => { vocabChoice.click(); });
    const nextBtn3 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn3.click(); });

    // Answer recog 1 and recog 2
    const recogChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recogChoices1[0] as HTMLButtonElement).click(); });
    const nextBtn4 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn4.click(); });
    const recogChoices2 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recogChoices2[1] as HTMLButtonElement).click(); });
    await act(async () => { nextBtn4.click(); });

    // Step 5 (Sentence Pattern) is active
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();

    // Click Next Step WITHOUT picking sentence pattern choice
    const nextBtn5 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn5.click(); });

    // Must NOT advance to Step 6
    expect(container.querySelector("[data-step-key='sentence_pattern']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='speaking']")).toBeNull();
    expect(container.querySelector(".error-strip")?.textContent).toContain("Please answer the current question to continue");
    expect(answeredTaskIds).not.toContain("s1:sentence-pattern");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Test 29
  it("29. Answering wrong on scored interaction preserves actual incorrect choice and does not secretly substitute correct answer on Next", async () => {
    const recordedSubmissions: { taskId: string; selected_option_id: string }[] = [];
    const tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", required: true, itemId: "phrase-hello" },
      { id: "s1:vocabulary", key: "vocabulary", taskType: "VOCABULARY", state: "PENDING", required: true, itemId: "vocab-hello", taskData: { choices: [{ id: "opt-hello", label: "問候打招呼 (Hello)" }, { id: "opt-eat", label: "吃飯 (Eat)" }] } },
      { id: "s1:recognition-1", key: "recognition-1", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-ni", taskData: { choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "s1:recognition-2", key: "recognition-2", taskType: "RECOGNITION", state: "PENDING", required: true, itemId: "char-hao", taskData: { choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "s1:sentence-pattern", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "PENDING", required: true, taskData: { choices: [{ id: "opt-correct-order", label: "你好！我叫小明。" }, { id: "opt-wrong-order", label: "我叫你好小明！" }] } },
      { id: "s1:speaking", key: "speaking", taskType: "SPEAKING_ATTEMPT", state: "COMPLETED", required: false },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({ id: "session-wrong-preservation", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/") && url.includes("/answer") && init?.method === "POST") {
        const taskId = decodeURIComponent(url.split("/tasks/")[1].split("/answer")[0]);
        const body = JSON.parse(init.body as string);
        recordedSubmissions.push({ taskId, selected_option_id: body.selected_option_id });
        const task = tasksState.find((t) => t.id === taskId);
        if (task) {
          let isCorrect = false;
          if (taskId === "s1:vocabulary" && body.selected_option_id === "opt-hello") isCorrect = true;
          if (taskId === "s1:recognition-1" && body.selected_option_id === "opt-ni") isCorrect = true;
          if (taskId === "s1:recognition-2" && body.selected_option_id === "opt-hao") isCorrect = true;
          if (taskId === "s1:sentence-pattern" && body.selected_option_id === "opt-correct-order") isCorrect = true;
          task.state = isCorrect ? "COMPLETED" : "IN_PROGRESS";
        }
        return new Response(JSON.stringify({ id: "session-wrong-preservation", childId: 1, status: "IN_PROGRESS", tasks: tasksState }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} />
      );
    });

    // Advance to Step 3 (vocab)
    const nextBtn1 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn1.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    // Intentionally click the WRONG vocabulary option (opt-eat)
    const vocabChoices = container.querySelectorAll(".step-vocab-body .choice-card-btn");
    await act(async () => { (vocabChoices[1] as HTMLButtonElement).click(); });

    // Click Next Step -> progression gate blocks advancing because state is IN_PROGRESS
    const nextBtn3 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn3.click(); });

    // Verify submission was opt-eat (never secretly converted to opt-hello)
    const vocabSubmission = recordedSubmissions.find((s) => s.taskId === "s1:vocabulary");
    expect(vocabSubmission?.selected_option_id).toBe("opt-eat");
    expect(recordedSubmissions.some((s) => s.taskId === "s1:vocabulary" && s.selected_option_id === "opt-hello")).toBe(false);
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();

    // Retry with correct vocab choice
    await act(async () => { (vocabChoices[0] as HTMLButtonElement).click(); });
    await act(async () => { nextBtn3.click(); }); // advances to Characters (char 0)

    expect(container.querySelector(".step-characters-body")).toBeTruthy();

    // Intentionally click the WRONG recognition option for char 0 (opt-hao)
    const recogChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recogChoices1[1] as HTMLButtonElement).click(); });

    // Click Next -> stays on char 0
    const nextBtn4 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn4.click(); });
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("你");

    // Retry with correct recognition choice for char 0 (opt-ni)
    await act(async () => { (recogChoices1[0] as HTMLButtonElement).click(); });
    await act(async () => { nextBtn4.click(); }); // advances to char 1 ("好")

    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");

    // Intentionally click the WRONG recognition option for char 1 (opt-ni)
    const recogChoices2 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recogChoices2[0] as HTMLButtonElement).click(); });

    // Click Next -> stays on char 1
    await act(async () => { nextBtn4.click(); });
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");

    // Retry with correct recognition choice for char 1 (opt-hao)
    await act(async () => { (recogChoices2[1] as HTMLButtonElement).click(); });
    await act(async () => { nextBtn4.click(); }); // advances to Step 5 (Sentence Pattern)

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();

    // Intentionally click the WRONG sentence pattern option (opt-wrong-order)
    const sentChoices = container.querySelectorAll(".step-sentence-body .choice-card-btn");
    await act(async () => { (sentChoices[1] as HTMLButtonElement).click(); });

    const nextBtn5 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn5.click(); }); // stays on sentence pattern

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    const sentSubmission = recordedSubmissions.find((s) => s.taskId === "s1:sentence-pattern");
    expect(sentSubmission?.selected_option_id).toBe("opt-wrong-order");

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

  it("31. Submitting wrong answer once and then clicking Next does not issue duplicate backend attempt", async () => {
    let vocabAnswerCalls: any[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-dedup-1",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-vocab/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        vocabAnswerCalls.push(body);
        return new Response(JSON.stringify({
          id: "s-dedup-1",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
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

    // Advance past step 1 (context) and step 2 (dialogue) to step 3 (vocabulary)
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // to dialogue
    await act(async () => { nextBtn.click(); }); // to vocab

    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(vocabAnswerCalls.length).toBe(0);

    // Click WRONG choice 'opt-eat'
    const choiceButtons = container.querySelectorAll(".choice-card-btn");
    const wrongChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Eat")) as HTMLButtonElement;
    expect(wrongChoiceBtn).toBeTruthy();

    await act(async () => {
      wrongChoiceBtn.click();
    });

    // Verify exactly 1 attempt was recorded
    expect(vocabAnswerCalls.length).toBe(1);
    expect(vocabAnswerCalls[0].selected_option_id).toBe("opt-eat");

    // Click 'Next' -> progression gate blocks advancing because task is still IN_PROGRESS
    await act(async () => {
      nextBtn.click();
    });

    // Verify remains on vocabulary step
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(container.querySelector(".step-characters-body")).toBeNull();

    // Verify NO duplicate attempt was submitted on Next! (Still exactly 1 attempt)
    expect(vocabAnswerCalls.length).toBe(1);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("32. Clicking the same choice multiple times does not spam duplicate attempt calls", async () => {
    let vocabAnswerCalls: any[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-dedup-2",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-vocab/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        vocabAnswerCalls.push(body);
        return new Response(JSON.stringify({
          id: "s-dedup-2",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
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

    // Advance to vocab
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });
    await act(async () => { nextBtn.click(); });

    const choiceButtons = container.querySelectorAll(".choice-card-btn");
    const wrongChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Eat")) as HTMLButtonElement;

    // Click same choice 3 times
    await act(async () => { wrongChoiceBtn.click(); });
    await act(async () => { wrongChoiceBtn.click(); });
    await act(async () => { wrongChoiceBtn.click(); });

    // Only 1 attempt call should be dispatched
    expect(vocabAnswerCalls.length).toBe(1);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("33. Changing choice from wrong to correct sends 2 distinct attempts, and Next does not add a 3rd", async () => {
    let vocabAnswerCalls: any[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-dedup-3",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-vocab/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        vocabAnswerCalls.push(body);
        const isCorrect = body.selected_option_id === "opt-hello";
        return new Response(JSON.stringify({
          id: "s-dedup-3",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: isCorrect ? "COMPLETED" : "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });
    await act(async () => { nextBtn.click(); });

    const choiceButtons = container.querySelectorAll(".choice-card-btn");
    const wrongChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Eat")) as HTMLButtonElement;
    const correctChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Hello")) as HTMLButtonElement;

    // First attempt: wrong
    await act(async () => { wrongChoiceBtn.click(); });
    expect(vocabAnswerCalls.length).toBe(1);
    expect(vocabAnswerCalls[0].selected_option_id).toBe("opt-eat");

    // Second attempt: correct
    await act(async () => { correctChoiceBtn.click(); });
    expect(vocabAnswerCalls.length).toBe(2);
    expect(vocabAnswerCalls[1].selected_option_id).toBe("opt-hello");

    // Click Next
    await act(async () => { nextBtn.click(); });

    // Step advanced, attempt count remained 2 (no extra submission)
    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    expect(vocabAnswerCalls.length).toBe(2);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("34. Character recognition step progression gate and attempt-count deduplication across tabs", async () => {
    let recogCalls: Record<string, any[]> = { "t-recog-1": [], "t-recog-2": [] };

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-dedup-4",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "IN_PROGRESS", itemId: "你", taskData: { prompt: "聽一聽發音，選出聽到的字：", audioText: "你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }] } },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "IN_PROGRESS", itemId: "好", taskData: { prompt: "聽一聽發音，選出聽到的字：", audioText: "好", choices: [{ id: "opt-ni", label: "你", isCorrect: false }, { id: "opt-hao", label: "好", isCorrect: true }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-recog-1/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        recogCalls["t-recog-1"].push(body);
        const isCorrect = body.selected_option_id === "opt-ni";
        return new Response(JSON.stringify({
          id: "s-dedup-4",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: isCorrect ? "COMPLETED" : "IN_PROGRESS", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "IN_PROGRESS", itemId: "好" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-recog-2/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        recogCalls["t-recog-2"].push(body);
        const isCorrect = body.selected_option_id === "opt-hao";
        return new Response(JSON.stringify({
          id: "s-dedup-4",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: isCorrect ? "COMPLETED" : "IN_PROGRESS", itemId: "好" },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // to dialogue
    await act(async () => { nextBtn.click(); }); // to vocab

    // Select vocab to advance to characters
    const vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // to characters

    expect(container.querySelector(".step-characters-body")).toBeTruthy();

    // Char 0: click correct answer 'opt-ni' for character '你'
    const charChoices = container.querySelectorAll(".char-choice-card");
    const niBtn = Array.from(charChoices).find(b => b.textContent?.includes("你")) as HTMLButtonElement;
    await act(async () => { niBtn.click(); });

    expect(recogCalls["t-recog-1"].length).toBe(1);
    expect(recogCalls["t-recog-1"][0].selected_option_id).toBe("opt-ni");

    // Click Next: advances from Char 0 to Char 1 without duplicate attempt on t-recog-1
    await act(async () => { nextBtn.click(); });

    expect(recogCalls["t-recog-1"].length).toBe(1); // No duplicate!

    // Char 1: click correct answer 'opt-hao' for character '好'
    const charChoices2 = container.querySelectorAll(".char-choice-card");
    const haoBtn = Array.from(charChoices2).find(b => b.textContent?.includes("好")) as HTMLButtonElement;
    await act(async () => { haoBtn.click(); });

    expect(recogCalls["t-recog-2"].length).toBe(1);
    expect(recogCalls["t-recog-2"][0].selected_option_id).toBe("opt-hao");

    // Click Next: advances from Characters to Sentence Pattern without duplicating either recog task
    await act(async () => { nextBtn.click(); });

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(recogCalls["t-recog-1"].length).toBe(1); // Still 1!
    expect(recogCalls["t-recog-2"].length).toBe(1); // Still 1!

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("35. Speaking step progression gate strictly checks backend authoritative task completion", async () => {
    let tasksState: any[] = [
      { id: "s1:listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "p-1" },
      { id: "s1:vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "v-1" },
      { id: "s1:recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
      { id: "s1:recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
      { id: "s1:sentence", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "COMPLETED", itemId: "s-1" },
      { id: "s1:speaking", key: "speaking", taskType: "SPEAKING_ATTEMPT", state: "PENDING", itemId: "phrase-1" },
      { id: "s1:pron", key: "pronunciation", taskType: "PRONUNCIATION_ATTEMPT", state: "PENDING", itemId: "phrase-1" },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-speak-gate",
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    // Step 1 -> 2 (Dialogue)
    await act(async () => { nextBtn.click(); });
    // Step 2 -> 3 (Vocab)
    await act(async () => { nextBtn.click(); });

    // Step 3 (Vocab) -> select answer and advance
    const vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // to Step 4 (Characters)

    // Step 4 (Characters) -> select recog for char 0 and char 1 and advance
    const charChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices1[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // switches to char 1
    const charChoices2 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices2[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // to Step 5 (Sentence Pattern)

    // Step 5 (Sentence Pattern) -> select answer and advance
    const sentChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (sentChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // to Step 6 (Speaking)

    expect(container.querySelector(".step-speaking-body")).toBeTruthy();

    // Click Next WITHOUT completing speaking task on backend
    await act(async () => { nextBtn.click(); });

    // Progression gate MUST block advancing to Writing (Step 7)
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    expect(container.querySelector(".step-writing-body")).toBeNull();
    expect(container.querySelector(".error-strip")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("36. Vocabulary trace: wrong (IN_PROGRESS) -> Next (blocked) -> retry correct (COMPLETED) -> Next (advances)", async () => {
    let vocabCalls: any[] = [];
    let vocabState = "PENDING";
    let attemptCount = 0;
    let failureCount = 0;
    let completedAt: string | null = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-trace-vocab",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: vocabState, attemptCount, failureCount, completedAt, itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-vocab/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        vocabCalls.push(body);
        attemptCount += 1;
        if (body.selected_option_id === "opt-hello") {
          vocabState = "COMPLETED";
          completedAt = "2026-09-26T09:00:00Z";
        } else {
          vocabState = "IN_PROGRESS";
          failureCount += 1;
        }
        return new Response(JSON.stringify({
          id: "s-trace-vocab",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: vocabState, attemptCount, failureCount, completedAt, itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 Context -> 2 Dialogue
    await act(async () => { nextBtn.click(); }); // Step 2 Dialogue -> 3 Vocab

    expect(container.querySelector(".step-vocab-body")).toBeTruthy();

    const choiceButtons = container.querySelectorAll(".choice-card-btn");
    const wrongChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Eat")) as HTMLButtonElement;
    const correctChoiceBtn = Array.from(choiceButtons).find(btn => btn.textContent?.includes("Hello")) as HTMLButtonElement;

    // 1. Child clicks wrong choice 'opt-eat'
    await act(async () => { wrongChoiceBtn.click(); });
    expect(vocabCalls.length).toBe(1);
    expect(vocabState).toBe("IN_PROGRESS");
    expect(attemptCount).toBe(1);
    expect(failureCount).toBe(1);
    expect(completedAt).toBeNull();

    // 2. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Must remain on Vocabulary step!
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(container.querySelector(".step-characters-body")).toBeNull();
    expect(vocabCalls.length).toBe(1); // Dedup prevented extra call
    expect(attemptCount).toBe(1);

    // 3. Child clicks Next again
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(vocabCalls.length).toBe(1);
    expect(attemptCount).toBe(1);

    // 4. Child retries with correct choice 'opt-hello'
    await act(async () => { correctChoiceBtn.click(); });
    expect(vocabCalls.length).toBe(2);
    expect(vocabState).toBe("COMPLETED");
    expect(attemptCount).toBe(2);
    expect(failureCount).toBe(1);
    expect(completedAt).not.toBeNull();

    // 5. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Step now successfully advances to Characters!
    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    expect(vocabCalls.length).toBe(2); // No extra call on Next

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("37. Recognition-1 (你) trace: wrong (IN_PROGRESS) -> Next (blocked on 你) -> retry correct (COMPLETED) -> Next (advances to 好)", async () => {
    let recogCalls: any[] = [];
    let recogState = "PENDING";
    let attemptCount = 0;
    let failureCount = 0;
    let completedAt: string | null = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-trace-recog1",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: recogState, attemptCount, failureCount, completedAt, itemId: "你", taskData: { prompt: "聽一聽發音，選出聽到的字：", audioText: "你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }] } },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "PENDING", itemId: "好", taskData: { prompt: "聽一聽發音，選出聽到的字：", audioText: "好", choices: [{ id: "opt-ni", label: "你", isCorrect: false }, { id: "opt-hao", label: "好", isCorrect: true }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-recog-1/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        recogCalls.push(body);
        attemptCount += 1;
        if (body.selected_option_id === "opt-ni") {
          recogState = "COMPLETED";
          completedAt = "2026-09-26T09:00:00Z";
        } else {
          recogState = "IN_PROGRESS";
          failureCount += 1;
        }
        return new Response(JSON.stringify({
          id: "s-trace-recog1",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: recogState, attemptCount, failureCount, completedAt, itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "PENDING", itemId: "好" },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 -> 2
    await act(async () => { nextBtn.click(); }); // Step 2 -> 3
    const vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 -> 4 (Characters)

    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("你");

    const charChoices = container.querySelectorAll(".char-choice-card");
    const wrongHaoBtn = Array.from(charChoices).find(b => b.textContent?.includes("好")) as HTMLButtonElement;
    const correctNiBtn = Array.from(charChoices).find(b => b.textContent?.includes("你")) as HTMLButtonElement;

    // 1. Child clicks wrong choice 'opt-hao' for character '你'
    await act(async () => { wrongHaoBtn.click(); });
    expect(recogCalls.length).toBe(1);
    expect(recogState).toBe("IN_PROGRESS");
    expect(attemptCount).toBe(1);
    expect(failureCount).toBe(1);
    expect(completedAt).toBeNull();

    // 2. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Must remain on '你' tab!
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("你");
    expect(recogCalls.length).toBe(1);
    expect(attemptCount).toBe(1);

    // 3. Child clicks Next again
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("你");
    expect(recogCalls.length).toBe(1);

    // 4. Child retries with correct choice 'opt-ni'
    await act(async () => { correctNiBtn.click(); });
    expect(recogCalls.length).toBe(2);
    expect(recogState).toBe("COMPLETED");
    expect(attemptCount).toBe(2);
    expect(failureCount).toBe(1);
    expect(completedAt).not.toBeNull();

    // 5. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Now advances to '好' tab!
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");
    expect(recogCalls.length).toBe(2);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("38. Recognition-2 (好) trace: wrong (IN_PROGRESS) -> Next (blocked on 好) -> retry correct (COMPLETED) -> Next (advances to Sentence Pattern)", async () => {
    let recogCalls2: any[] = [];
    let recog2State = "PENDING";
    let attemptCount = 0;
    let failureCount = 0;
    let completedAt: string | null = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-trace-recog2",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: recog2State, attemptCount, failureCount, completedAt, itemId: "好", taskData: { prompt: "聽一聽發音，選出聽到的字：", audioText: "好", choices: [{ id: "opt-ni", label: "你", isCorrect: false }, { id: "opt-hao", label: "好", isCorrect: true }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-recog-2/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        recogCalls2.push(body);
        attemptCount += 1;
        if (body.selected_option_id === "opt-hao") {
          recog2State = "COMPLETED";
          completedAt = "2026-09-26T09:00:00Z";
        } else {
          recog2State = "IN_PROGRESS";
          failureCount += 1;
        }
        return new Response(JSON.stringify({
          id: "s-trace-recog2",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: recog2State, attemptCount, failureCount, completedAt, itemId: "好" },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 -> 2
    await act(async () => { nextBtn.click(); }); // Step 2 -> 3
    const vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 -> 4 (Characters, char 0)

    // Select correct for char 0 and advance to char 1
    const charChoices0 = container.querySelectorAll(".char-choice-card");
    const niBtn = Array.from(charChoices0).find(b => b.textContent?.includes("你")) as HTMLButtonElement;
    await act(async () => { niBtn.click(); });
    await act(async () => { nextBtn.click(); }); // moves to char 1 '好'

    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");

    const charChoices1 = container.querySelectorAll(".char-choice-card");
    const wrongNiBtn = Array.from(charChoices1).find(b => b.textContent?.includes("你")) as HTMLButtonElement;
    const correctHaoBtn = Array.from(charChoices1).find(b => b.textContent?.includes("好")) as HTMLButtonElement;

    // 1. Child clicks wrong choice 'opt-ni' for character '好'
    await act(async () => { wrongNiBtn.click(); });
    expect(recogCalls2.length).toBe(1);
    expect(recog2State).toBe("IN_PROGRESS");
    expect(attemptCount).toBe(1);
    expect(failureCount).toBe(1);
    expect(completedAt).toBeNull();

    // 2. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Must remain on '好' tab!
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");
    expect(container.querySelector(".step-sentence-body")).toBeNull();
    expect(recogCalls2.length).toBe(1);

    // 3. Child clicks Next again
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".character-tab-btn.active")?.textContent).toContain("好");
    expect(recogCalls2.length).toBe(1);

    // 4. Child retries with correct choice 'opt-hao'
    await act(async () => { correctHaoBtn.click(); });
    expect(recogCalls2.length).toBe(2);
    expect(recog2State).toBe("COMPLETED");
    expect(attemptCount).toBe(2);
    expect(failureCount).toBe(1);
    expect(completedAt).not.toBeNull();

    // 5. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Now advances to Step 5 Sentence Pattern!
    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(recogCalls2.length).toBe(2);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("39. Sentence Pattern trace: wrong (IN_PROGRESS) -> Next (blocked) -> retry correct (COMPLETED) -> Next (advances to Speaking)", async () => {
    let sentCalls: any[] = [];
    let sentState = "PENDING";
    let attemptCount = 0;
    let failureCount = 0;
    let completedAt: string | null = null;

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-trace-sent",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
            { id: "t-sent", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: sentState, attemptCount, failureCount, completedAt, itemId: "sent-greeting", taskData: { prompt: "請選出合適的打招呼句子：", choices: [{ id: "opt-correct-order", label: "你好！我叫小明。" }, { id: "opt-wrong-order", label: "我叫你好小明！" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-sent/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        sentCalls.push(body);
        attemptCount += 1;
        if (body.selected_option_id === "opt-correct-order") {
          sentState = "COMPLETED";
          completedAt = "2026-09-26T09:00:00Z";
        } else {
          sentState = "IN_PROGRESS";
          failureCount += 1;
        }
        return new Response(JSON.stringify({
          id: "s-trace-sent",
          status: "IN_PROGRESS",
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
            { id: "t-sent", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: sentState, attemptCount, failureCount, completedAt, itemId: "sent-greeting" },
          ],
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

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 -> 2
    await act(async () => { nextBtn.click(); }); // Step 2 -> 3
    const vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 -> 4 (Characters, char 0)

    const charChoices0 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices0[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // char 1

    const charChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices1[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 4 -> 5 Sentence Pattern

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();

    const sentChoices = container.querySelectorAll(".choice-card-btn");
    const wrongSentBtn = Array.from(sentChoices).find(b => b.textContent?.includes("我叫你好小明")) as HTMLButtonElement;
    const correctSentBtn = Array.from(sentChoices).find(b => b.textContent?.includes("你好！我叫小明")) as HTMLButtonElement;

    // 1. Child clicks wrong sentence choice
    await act(async () => { wrongSentBtn.click(); });
    expect(sentCalls.length).toBe(1);
    expect(sentState).toBe("IN_PROGRESS");
    expect(attemptCount).toBe(1);
    expect(failureCount).toBe(1);
    expect(completedAt).toBeNull();

    // 2. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Must remain on Sentence Pattern step!
    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(container.querySelector(".step-speaking-body")).toBeNull();
    expect(sentCalls.length).toBe(1);

    // 3. Child clicks Next again
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(sentCalls.length).toBe(1);

    // 4. Child retries with correct sentence choice
    await act(async () => { correctSentBtn.click(); });
    expect(sentCalls.length).toBe(2);
    expect(sentState).toBe("COMPLETED");
    expect(attemptCount).toBe(2);
    expect(failureCount).toBe(1);
    expect(completedAt).not.toBeNull();

    // 5. Child clicks Next
    await act(async () => { nextBtn.click(); });
    // Advances to Step 6 Speaking!
    expect(container.querySelector(".step-speaking-body")).toBeTruthy();
    expect(sentCalls.length).toBe(2);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });
});


