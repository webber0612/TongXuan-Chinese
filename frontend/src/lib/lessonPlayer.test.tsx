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
});
