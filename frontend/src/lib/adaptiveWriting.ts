export type WritingVariant = "trad" | "hans";
export type WritingPhase = "guided" | "reduced_hint" | "independent";

export type WritingProgress = {
  guidedSuccesses: number;
  reducedHintSuccesses: number;
  independentSuccesses: number;
  independentFailures: number;
  mastered: boolean;
  /** True after an independent attempt with a mistake, until the next clean independent attempt. */
  retryPending?: boolean;
};

export type WritingPlan = {
  phase: WritingPhase;
  remaining: number;
};

export const EMPTY_WRITING_PROGRESS: WritingProgress = {
  guidedSuccesses: 0,
  reducedHintSuccesses: 0,
  independentSuccesses: 0,
  independentFailures: 0,
  mastered: false,
  retryPending: false,
};

const GUIDED_TARGET = 2;
const REDUCED_HINT_TARGET = 1;

export function writingProgressKey(learnerId: string, character: string, variant: WritingVariant): string {
  return `${learnerId}::${character}::${variant}`;
}

/**
 * Mastery: two guided passes, one with fewer hints, then one independent attempt with no
 * mistakes. A mistake in independent writing only asks for one more clean attempt; it
 * never raises the bar further, so a child cannot get stuck retrying forever.
 */
export function isWritingMastered(progress: WritingProgress): boolean {
  return progress.guidedSuccesses >= GUIDED_TARGET
    && progress.reducedHintSuccesses >= REDUCED_HINT_TARGET
    && progress.independentSuccesses >= 1
    && !progress.retryPending;
}

export function getWritingPlan(progress: WritingProgress, maintenanceCompletedThisVisit = false): WritingPlan {
  if (progress.mastered && !progress.retryPending) return { phase: "independent", remaining: maintenanceCompletedThisVisit ? 0 : 1 };
  if (progress.guidedSuccesses < GUIDED_TARGET) return { phase: "guided", remaining: GUIDED_TARGET - progress.guidedSuccesses };
  if (progress.reducedHintSuccesses < REDUCED_HINT_TARGET) return { phase: "reduced_hint", remaining: REDUCED_HINT_TARGET - progress.reducedHintSuccesses };
  return { phase: "independent", remaining: isWritingMastered(progress) ? 0 : 1 };
}

/** Records a completed attempt. Callers must only call this for independent attempts without mistakes. */
export function recordWritingSuccess(progress: WritingProgress, phase: WritingPhase): WritingProgress {
  const next = { ...progress };
  if (phase === "guided") next.guidedSuccesses += 1;
  else if (phase === "reduced_hint") next.reducedHintSuccesses += 1;
  else {
    next.independentSuccesses += 1;
    next.retryPending = false;
  }
  next.mastered = isWritingMastered(next);
  return next;
}

export function recordIndependentWritingFailure(progress: WritingProgress): WritingProgress {
  return { ...progress, independentFailures: progress.independentFailures + 1, retryPending: true, mastered: false };
}

export function writingSuccessCount(progress: WritingProgress): number {
  return progress.guidedSuccesses + progress.reducedHintSuccesses + progress.independentSuccesses;
}
