export type AdaptivePreference = "NONE" | "SCHOOL_QUEUE" | "CURRICULUM" | "REVIEW";

export function buildAdaptiveRequest(asOf: string, limit: number, adaptive: boolean, preference: AdaptivePreference) {
  return { as_of: asOf, limit, adaptive, preference: preference === "NONE" ? null : preference };
}

export function explainAdaptiveReasons(reasons: string[]): string {
  return reasons.join("、");
}
