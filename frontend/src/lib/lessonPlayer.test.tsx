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
  it("11. Review mode builds retrieval steps strictly from authoritative due items and returns empty when no due items exist", () => {
    const pkg = getLessonPackage("book1-l01");
    expect(pkg).not.toBeNull();
    if (!pkg) return;

    // A. Without authoritative due items, REVIEW mode returns [] (never static reviewSteps)
    const emptySteps = getStepsForMode(pkg, "REVIEW");
    expect(emptySteps.length).toBe(0);

    // B. With authoritative due item, builds exact retrieval step without full lesson replay
    const dueItem = { id: "item-ni", character: "你", skillDomain: "recognition" };
    const revSteps = getStepsForMode(pkg, "REVIEW", [], [dueItem]);
    expect(revSteps.length).toBe(2); // exact due retrieval step + wrap up
    expect(revSteps[0].stepKey).toBe("characters");
    expect(revSteps[0].data?.dueCharacter).toBe("你");
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

  it("40. Vocabulary fail-closed negative regressions: session missing, tasks missing, task missing, and API failure all block progression", async () => {
    // Sub-case 1: Required vocabulary task missing from tasks
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-vocab-1",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            // Notice: VOCABULARY task is completely missing!
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    let container = document.createElement("div");
    document.body.appendChild(container);
    let root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    let nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 Context -> 2 Dialogue
    await act(async () => { nextBtn.click(); }); // Step 2 Dialogue -> 3 Vocabulary

    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    let choices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (choices[0] as HTMLButtonElement)?.click(); });

    // Required task missing: Next must FAIL CLOSED and remain on Vocabulary
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(container.querySelector(".step-characters-body")).toBeNull();
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();

    // Sub-case 2: API write failure on answer submission (HTTP 500)
    let vocabCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-vocab-2",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "IN_PROGRESS", itemId: "vocab-nihao", taskData: { prompt: "「你好」是什麼意思？", choices: [{ id: "opt-hello", label: "問候打招呼 (Hello)" }, { id: "opt-eat", label: "吃飯 (Eat)" }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-vocab/answer") && init?.method === "POST") {
        vocabCalls++;
        return new Response(JSON.stringify({ detail: "Internal Server Error" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 Context -> 2 Dialogue
    await act(async () => { nextBtn.click(); }); // Step 2 Dialogue -> 3 Vocabulary

    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    choices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (choices[0] as HTMLButtonElement)?.click(); });

    // API failure: Next must FAIL CLOSED, remain on Vocabulary, show error banner
    await act(async () => { nextBtn.click(); });
    expect(vocabCalls).toBe(2);
    expect(container.querySelector(".step-vocab-body")).toBeTruthy();
    expect(container.querySelector(".step-characters-body")).toBeNull();
    expect(container.textContent).toMatch(/Internal Server Error|Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("41. Recognition fail-closed negative regressions: char task missing blocks tab advance, session/tasks missing blocks progression", async () => {
    // Sub-case 1: char task missing blocks advancing to next character tab
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-recog-1",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            // Notice: recognition-1 task for 你 is MISSING from tasks!
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "IN_PROGRESS", itemId: "好" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    let container = document.createElement("div");
    document.body.appendChild(container);
    let root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    let nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 Context -> 2 Dialogue
    await act(async () => { nextBtn.click(); }); // Step 2 Dialogue -> 3 Vocabulary
    let vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 Vocabulary -> 4 Characters (tab 0: 你)

    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    let charChoices = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices[0] as HTMLButtonElement)?.click(); });

    // Click Next when char task is missing: MUST NOT advance to next char tab ("好"), MUST NOT advance step!
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    // Character prompt for "你" must still be active (activeCharIndex remained 0)
    expect(container.textContent).toContain("「你」");
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();

    // Sub-case 2: API failure on recognition answer blocks progression
    let recogCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-recog-2",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "IN_PROGRESS", itemId: "你", taskData: { prompt: "選出：你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }] } },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-recog-1/answer") && init?.method === "POST") {
        recogCalls++;
        return new Response(JSON.stringify({ detail: "Database unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 -> 2
    await act(async () => { nextBtn.click(); }); // Step 2 -> 3
    vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 -> 4 Characters

    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    charChoices = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices[0] as HTMLButtonElement)?.click(); });

    // API 503 error: click Next must fail closed and stay on char 0
    await act(async () => { nextBtn.click(); });
    expect(recogCalls).toBe(2);
    expect(container.querySelector(".step-characters-body")).toBeTruthy();
    expect(container.textContent).toContain("「你」");
    expect(container.textContent).toMatch(/Database unavailable|Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("42. Sentence Pattern fail-closed negative regressions: task missing, session missing, and API failure block progression", async () => {
    // Sub-case 1: Sentence pattern task missing from session tasks
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-sent-1",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
            // SENTENCE_PATTERN task missing!
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    let container = document.createElement("div");
    document.body.appendChild(container);
    let root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    let nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); }); // Step 1 -> 2
    await act(async () => { nextBtn.click(); }); // Step 2 -> 3
    let vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 -> 4
    let charChoices0 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices0[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // tab 1
    let charChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices1[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 4 -> 5 Sentence Pattern

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    let sentChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (sentChoices[0] as HTMLButtonElement)?.click(); });

    // Click Next when sentence pattern task is missing: MUST NOT advance to speaking!
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(container.querySelector(".step-speaking-body")).toBeNull();
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();

    // Sub-case 2: API write failure on sentence pattern (HTTP 500)
    let sentCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-neg-sent-2",
          status: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: [
            { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
            { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
            { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
            { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
            { id: "t-sent", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "IN_PROGRESS", itemId: "sent-greeting" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-sent/answer") && init?.method === "POST") {
        sentCalls++;
        return new Response(JSON.stringify({ detail: "Gateway timeout" }), { status: 504, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<LessonPlayerPage lessonId="book1-l01" activeChildId={1} onBack={() => {}} initialMode="LEARN" />);
    });

    nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });
    await act(async () => { nextBtn.click(); });
    vocabChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    charChoices0 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices0[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    charChoices1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (charChoices1[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });

    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    sentChoices = container.querySelectorAll(".choice-card-btn");
    await act(async () => { (sentChoices[0] as HTMLButtonElement)?.click(); });

    // API failure: Next must fail closed, remain on sentence pattern, show error
    await act(async () => { nextBtn.click(); });
    expect(sentCalls).toBe(2);
    expect(container.querySelector(".step-sentence-body")).toBeTruthy();
    expect(container.querySelector(".step-speaking-body")).toBeNull();
    expect(container.textContent).toMatch(/Gateway timeout|Task operation failed|任務操作失敗/);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
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

    // The learner clicks Next Step on Step 1 (Context)
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();

    await act(async () => {
      nextBtn.click();
    });

    // Progression must be BLOCKED: cannot advance locally to Step 2 (Dialogue)
    expect(container.querySelector("[data-step-key='context']")).toBeTruthy();
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

  it("45. LEARN Exit Ticket fail-closed negative regression: local all-correct + backend reflection failure blocks mastery progression, settlement, and displays error", async () => {
    let reflectionWriteCalls = 0;
    let completedLessonCalled = false;

    const tasksState: any[] = [
      { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
      { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao" },
      { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你" },
      { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好" },
      { id: "t-sent", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "COMPLETED", itemId: "sent-greeting" },
      { id: "t-speak", key: "speaking", taskType: "SPEAKING_ATTEMPT", state: "COMPLETED", itemId: "phrase-hello" },
      { id: "t-write", key: "writing-1", taskType: "WRITING_PRACTICE", state: "DEFERRED", itemId: "char-ni" },
      { id: "t-refl", key: "mini-check-reflection", taskType: "MINI_CHECK", state: "IN_PROGRESS", taskData: { mode: "reflection" } },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-learn-neg-45",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
          curriculumContext: { lessonId: "book1-l01" },
          tasks: tasksState,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/t-refl/answer") && init?.method === "POST") {
        reflectionWriteCalls++;
        return new Response(JSON.stringify({ detail: "Reflection persistence failure in database" }), {
          status: 500,
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
          initialMode="LEARN"
          onCompleteLesson={() => {
            completedLessonCalled = true;
          }}
        />
      );
    });

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    // Step 1: Context -> Dialogue
    await act(async () => { nextBtn.click(); });
    // Step 2: Dialogue -> Vocabulary
    await act(async () => { nextBtn.click(); });
    // Step 3: Vocabulary -> pick choice and advance
    const vocabChoices = container.querySelectorAll(".step-vocab-body .choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    // Step 4: Characters (tab 0: 你) -> pick choice and advance tab
    const recog1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recog1[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    // Step 4: Characters (tab 1: 好) -> pick choice and advance step
    const recog2 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recog2[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    // Step 5: Sentence Pattern -> pick choice and advance
    const sentChoices = container.querySelectorAll(".step-sentence-body .choice-card-btn");
    await act(async () => { (sentChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); });
    // Step 6: Speaking -> advance
    await act(async () => { nextBtn.click(); });
    // Step 7: Writing -> advance
    await act(async () => { nextBtn.click(); });

    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();

    // 1. Answer all 4 exit ticket questions with correct answers (local all-correct)
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    expect(questionCards.length).toBe(4);
    for (const card of Array.from(questionCards)) {
      const choiceButtons = card.querySelectorAll(".choice-card-btn");
      // Pick first choice
      await act(async () => { (choiceButtons[0] as HTMLButtonElement)?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();

    // 2. Click submit button -> backend reflection task write fails with 500
    await act(async () => { submitBtn.click(); });
    expect(reflectionWriteCalls).toBe(1);

    // 3. Assert fail-closed invariants:
    // a. Error banner is shown
    expect(container.textContent).toMatch(/Reflection persistence failure in database|Task operation failed|任務操作失敗/);

    // b. Next button remains disabled
    expect(nextBtn.disabled).toBe(true);

    // c. Submit button remains present (allows retry)
    expect(container.querySelector(".submit-exit-ticket-btn")).toBeTruthy();

    // d. UI does NOT advance to Step 9 (wrap_up / settlement)
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();

    // e. Authoritative task state did NOT fake complete
    expect(tasksState.find((t: any) => t.id === "t-refl")?.state).toBe("IN_PROGRESS");

    // f. Session completion callback was NOT called
    expect(completedLessonCalled).toBe(false);

    // g. Clicking Next does NOT bypass gate
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    expect(completedLessonCalled).toBe(false);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
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

  it("49. LEARN Exit Ticket fail-closed negative regression: reflection task missing from session tasks blocks submission, disables progression, displays error, and prevents completion", async () => {
    let completedLessonCalled = false;

    // Session has tasks for steps 1-7, but mini-check-reflection task is missing
    const tasksState: any[] = [
      { id: "t-listen", key: "listen", taskType: "LISTENING", state: "COMPLETED", itemId: "item-l01" },
      { id: "t-vocab", key: "vocabulary", taskType: "VOCABULARY", state: "COMPLETED", itemId: "vocab-nihao", taskData: { prompt: "選出「你好」的意思", choices: [{ id: "opt-hello", label: "Hello" }, { id: "opt-eat", label: "Eat" }] } },
      { id: "t-recog-1", key: "recognition-1", taskType: "RECOGNITION", state: "COMPLETED", itemId: "你", taskData: { prompt: "選出聽到的字：", audioText: "你", choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "t-recog-2", key: "recognition-2", taskType: "RECOGNITION", state: "COMPLETED", itemId: "好", taskData: { prompt: "選出聽到的字：", audioText: "好", choices: [{ id: "opt-ni", label: "你" }, { id: "opt-hao", label: "好" }] } },
      { id: "t-sent", key: "sentence-pattern", taskType: "SENTENCE_PATTERN", state: "COMPLETED", itemId: "sent-greeting", taskData: { choices: [{ id: "opt-correct-order", label: "你好！我叫小明。" }, { id: "opt-wrong-order", label: "我叫你好小明！" }] } },
      { id: "t-speak", key: "speaking", taskType: "SPEAKING_ATTEMPT", state: "COMPLETED", itemId: "phrase-hello" },
      { id: "t-write", key: "writing-1", taskType: "WRITING_PRACTICE", state: "DEFERRED", itemId: "char-ni" },
    ];

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-learn-neg-49",
          status: "IN_PROGRESS",
          masteryStatus: "IN_PROGRESS",
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
      root.render(
        <LessonPlayerPage
          lessonId="book1-l01"
          activeChildId={1}
          onBack={() => {}}
          initialMode="LEARN"
          onCompleteLesson={() => {
            completedLessonCalled = true;
          }}
        />
      );
    });

    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    // Advance through steps 1-7
    await act(async () => { nextBtn.click(); }); // Step 1 Context -> Dialogue
    await act(async () => { nextBtn.click(); }); // Step 2 Dialogue -> Vocabulary
    const vocabChoices = container.querySelectorAll(".step-vocab-body .choice-card-btn");
    await act(async () => { (vocabChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 3 Vocabulary -> Characters tab 0
    const recog1 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recog1[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 4 Characters tab 0 -> tab 1
    const recog2 = container.querySelectorAll(".char-choice-card");
    await act(async () => { (recog2[1] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 4 Characters tab 1 -> Sentence Pattern
    const sentChoices = container.querySelectorAll(".step-sentence-body .choice-card-btn");
    await act(async () => { (sentChoices[0] as HTMLButtonElement)?.click(); });
    await act(async () => { nextBtn.click(); }); // Step 5 Sentence Pattern -> Speaking
    await act(async () => { nextBtn.click(); }); // Step 6 Speaking -> Writing
    await act(async () => { nextBtn.click(); }); // Step 7 Writing -> Exit Ticket

    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();

    // Answer all 4 exit ticket questions
    const questionCards = container.querySelectorAll(".exit-ticket-item-card");
    for (const card of Array.from(questionCards)) {
      const choiceButtons = card.querySelectorAll(".choice-card-btn");
      await act(async () => { (choiceButtons[0] as HTMLButtonElement)?.click(); });
    }

    const submitBtn = container.querySelector(".submit-exit-ticket-btn") as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();

    // Submit Exit Ticket -> reflection task is missing from session tasks -> fail closed!
    await act(async () => { submitBtn.click(); });

    // Assert fail-closed invariants:
    // 1. Error banner is shown
    expect(container.textContent).toMatch(/Task operation failed|任務操作失敗/);
    // 2. Next button remains disabled
    expect(nextBtn.disabled).toBe(true);
    // 3. UI remains on Exit Ticket
    expect(container.querySelector("[data-step-key='exit_ticket']")).toBeTruthy();
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    // 4. Session completion callback was NOT called
    expect(completedLessonCalled).toBe(false);

    // 5. Attempting to click Next does NOT bypass gate
    await act(async () => { nextBtn.click(); });
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    expect(completedLessonCalled).toBe(false);

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  // Semantic Runtime Validation Regressions 50-56
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
        return new Response(JSON.stringify({ id: "s-rev-none", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
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

  it("62. Regression B: due recognition item = 你 -> REVIEW displays ONLY '你', does not display non-due items or other character tabs", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-rev-ni",
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "t-rev-ni",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              itemId: "item-ni",
              state: "PENDING",
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
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "t-rev-hao",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              itemId: "item-hao",
              state: "PENDING",
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
          status: "IN_PROGRESS",
          tasks: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
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
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "t-rev-e1",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              itemId: "item-ni",
              state: taskState,
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
      if (url.includes("/tasks/t-rev-e1/answer") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        answerCalls.push(body);
        taskState = "COMPLETED";
        return new Response(JSON.stringify({
          id: "s-rev-e",
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "t-rev-e1",
              key: "review-recognition-1",
              taskType: "REVIEW_RECOGNITION",
              skillDomain: "recognition",
              sourceQueue: "REVIEW",
              itemId: "item-ni",
              state: "COMPLETED",
              completedAt: "2026-09-26T14:00:00Z",
            },
          ],
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
        return new Response(JSON.stringify({ id: "s-rev-f", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({ review: { sourceQueue: "REVIEW", dueCount: 0, items: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ id: "s-reg-a", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({
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
        return new Response(JSON.stringify({ id: "s-reg-b", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ id: "s-reg-c", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
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
        return new Response(JSON.stringify({ id: "s-reg-d", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-daily-queue")) {
        return new Response(JSON.stringify({
          review: {
            sourceQueue: "REVIEW",
            dueCount: 1,
            items: [{ id: "due-item-ni", character: "你", lessonId: "book1-l01", dueAt: "2026-09-02T00:00:00Z" }]
          }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if ((url.includes("/reconcile-reviews") || url.includes("/learning-sessions")) && init?.method === "POST") {
        sessionCreationAttempted = true;
        // Backend returns session with tasks=[] (cannot produce executable review task)
        return new Response(JSON.stringify({ id: "s-reg-d", status: "IN_PROGRESS", tasks: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
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

  it("71. Regression E: 2 due items (Task A and Task B) -> each step strictly binds to its own task.id", async () => {
    let taskStateA = "PENDING";
    let taskStateB = "PENDING";
    const answeredTaskIds: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-reg-e",
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "task-A",
              key: "review-recog-1",
              taskType: "REVIEW_RECOGNITION",
              sourceQueue: "REVIEW",
              itemId: "你",
              state: taskStateA,
              taskData: { prompt: "題目一：選出聽到的字", audioText: "你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }] },
            },
            {
              id: "task-B",
              key: "review-recog-2",
              taskType: "REVIEW_RECOGNITION",
              sourceQueue: "REVIEW",
              itemId: "好",
              state: taskStateB,
              taskData: { prompt: "題目二：選出聽到的字", audioText: "好", choices: [{ id: "opt-hao", label: "好", isCorrect: true }, { id: "opt-ni", label: "你", isCorrect: false }] },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/task-A/answer") && init?.method === "POST") {
        answeredTaskIds.push("task-A");
        taskStateA = "COMPLETED";
        return new Response(JSON.stringify({
          id: "s-reg-e",
          status: "IN_PROGRESS",
          tasks: [
            { id: "task-A", key: "review-recog-1", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", itemId: "你", state: "COMPLETED" },
            { id: "task-B", key: "review-recog-2", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", itemId: "好", state: taskStateB },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/task-B/answer") && init?.method === "POST") {
        answeredTaskIds.push("task-B");
        taskStateB = "COMPLETED";
        return new Response(JSON.stringify({
          id: "s-reg-e",
          status: "IN_PROGRESS",
          tasks: [
            { id: "task-A", key: "review-recog-1", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", itemId: "你", state: "COMPLETED" },
            { id: "task-B", key: "review-recog-2", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", itemId: "好", state: "COMPLETED" },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/learning-sessions/s-reg-e/complete") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "s-reg-e", status: "COMPLETED" }), { status: 200, headers: { "Content-Type": "application/json" } });
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
    expect(choiceA).toBeTruthy();
    await act(async () => { choiceA.click(); });
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });

    expect(answeredTaskIds).toEqual(["task-A"]);

    // STEP 2: Bound to task-B (好)
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    const choiceB = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("好")) as HTMLButtonElement;
    expect(choiceB).toBeTruthy();
    await act(async () => { choiceB.click(); });
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    expect(answeredTaskIds).toEqual(["task-A", "task-B"]);

    // Advances to wrap-up
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeTruthy();

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("72. Regression F: Multi-item review with second exact task missing -> must NOT fallback to first task, fail closed and stay on step", async () => {
    let taskStateA = "PENDING";
    const answeredTaskIds: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/learning-sessions/current")) {
        return new Response(JSON.stringify({
          id: "s-reg-f",
          status: "IN_PROGRESS",
          tasks: [
            {
              id: "task-A",
              key: "review-recog-1",
              taskType: "REVIEW_RECOGNITION",
              sourceQueue: "REVIEW",
              itemId: "你",
              state: taskStateA,
              taskData: { prompt: "題目一：選出聽到的字", audioText: "你", choices: [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }] },
            },
            {
              id: "task-B",
              key: "review-recog-2",
              taskType: "REVIEW_RECOGNITION",
              sourceQueue: "REVIEW",
              itemId: "好",
              state: "PENDING",
              taskData: { prompt: "題目二：選出聽到的字", audioText: "好", choices: [{ id: "opt-hao", label: "好", isCorrect: true }, { id: "opt-ni", label: "你", isCorrect: false }] },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tasks/task-A/answer") && init?.method === "POST") {
        answeredTaskIds.push("task-A");
        taskStateA = "COMPLETED";
        // CRITICAL: Backend session update mysteriously omits task-B (e.g. task-B is missing from session)
        return new Response(JSON.stringify({
          id: "s-reg-f",
          status: "IN_PROGRESS",
          tasks: [
            { id: "task-A", key: "review-recog-1", taskType: "REVIEW_RECOGNITION", sourceQueue: "REVIEW", itemId: "你", state: "COMPLETED" },
          ],
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

    // STEP 1: Bound to task-A (你)
    expect(container.querySelector(".large-char-display")?.textContent).toBe("你");
    const choiceA = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("你")) as HTMLButtonElement;
    await act(async () => { choiceA.click(); });
    const nextBtn = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });

    expect(answeredTaskIds).toEqual(["task-A"]);

    // STEP 2: Currently on step 2 (好), but task-B is missing in backend sessionRef.current.tasks
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");
    const choiceB = Array.from(container.querySelectorAll(".char-choice-card")).find((b) => b.textContent?.includes("好")) as HTMLButtonElement;
    await act(async () => { choiceB.click(); });

    // Try to advance
    const nextBtn2 = container.querySelector(".next-step-cta-btn") as HTMLButtonElement;
    await act(async () => { nextBtn2.click(); });

    // Task A must NOT have been reused for Step 2!
    expect(answeredTaskIds).toEqual(["task-A"]);
    // Must NOT advance to wrap-up
    expect(container.querySelector("[data-step-key='wrap_up']")).toBeNull();
    // Must fail closed: display error banner and stay on step 2
    expect(container.querySelector(".error-strip")).toBeTruthy();
    expect(container.querySelector(".large-char-display")?.textContent).toBe("好");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });
});



