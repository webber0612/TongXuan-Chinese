export type WritingVariant = "trad" | "hans";
export type WritingPhase = "guided" | "reduced_hint" | "independent";

export type WritingProgress = {
  guidedSuccesses: number;
  reducedHintSuccesses: number;
  independentSuccesses: number;
  independentFailures: number;
  mastered: boolean;
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
};

export function writingProgressKey(learnerId: string, character: string, variant: WritingVariant): string {
  return `${learnerId}::${character}::${variant}`;
}

export function isWritingMastered(progress: WritingProgress): boolean {
  return progress.guidedSuccesses >= 2
    && progress.reducedHintSuccesses >= 1
    && progress.independentSuccesses >= 1 + progress.independentFailures;
}

export function getWritingPlan(progress: WritingProgress, maintenanceCompletedThisVisit = false): WritingPlan {
  if (progress.mastered) return { phase: "independent", remaining: maintenanceCompletedThisVisit ? 0 : 1 };
  if (progress.guidedSuccesses < 2) return { phase: "guided", remaining: 2 - progress.guidedSuccesses };
  if (progress.reducedHintSuccesses < 1) return { phase: "reduced_hint", remaining: 1 - progress.reducedHintSuccesses };
  const independentTarget = 1 + progress.independentFailures;
  if (progress.independentSuccesses < independentTarget) {
    return { phase: "independent", remaining: independentTarget - progress.independentSuccesses };
  }
  return { phase: "independent", remaining: 0 };
}

export function recordWritingSuccess(progress: WritingProgress, phase: WritingPhase): WritingProgress {
  const next = { ...progress };
  if (phase === "guided") next.guidedSuccesses += 1;
  else if (phase === "reduced_hint") next.reducedHintSuccesses += 1;
  else next.independentSuccesses += 1;
  next.mastered = isWritingMastered(next);
  return next;
}

export function recordIndependentWritingFailure(progress: WritingProgress): WritingProgress {
  const next = { ...progress, independentFailures: progress.independentFailures + 1, mastered: false };
  return next;
}

export function writingSuccessCount(progress: WritingProgress): number {
  return progress.guidedSuccesses + progress.reducedHintSuccesses + progress.independentSuccesses;
}
