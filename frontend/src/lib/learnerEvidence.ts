import { apiFetch } from "./apiFetch";

export type EvidenceScript = "TRADITIONAL" | "SIMPLIFIED" | "SCRIPT_INDEPENDENT";
export type EvidenceOutcome = "CORRECT" | "INCORRECT" | "PARTIAL" | "NOT_ASSESSED";
export type EvidenceAssistance = "INDEPENDENT" | "ASSISTED" | "UNKNOWN";
export type EvidenceState = "NOT_ASSESSED" | "OBSERVED";
export type EvidenceDimension =
  | "HEAR" | "RECALL" | "READ" | "INPUT" | "HANDWRITING" | "SPEAK"
  | "ORTHOGRAPHIC_RECOGNITION" | "PHONETIC_NOTATION" | "PRONUNCIATION";
export type EvidenceInputMethod = "ZHUYIN" | "PINYIN" | "VOICE" | "OTHER_KEYBOARD" | "NONE";
export type OrthographicInputMethod = Extract<EvidenceInputMethod, "ZHUYIN" | "PINYIN" | "OTHER_KEYBOARD">;
export type HandwritingExpectation = "WRITE_CORE" | "WRITE_FAMILIAR" | "READ_INPUT" | "EXPOSURE_ONLY";

export type EvidenceProfileFact = {
  state: EvidenceState;
  latestEvidenceAt: string | null;
  latestOutcome: EvidenceOutcome | null;
  evidenceCount: number;
  independentCorrectCount: number;
  assistedCount: number;
  incorrectCount: number;
  partialCount: number;
  notAssessedCount: number;
  aggregationVersion: number;
};

export type LearnerEvidenceSummary = {
  childId: number;
  modelVersion: number;
  isMasteryJudgment: false;
  dimensions: Array<{
    dimension: EvidenceDimension;
    script: EvidenceScript;
    state: EvidenceState;
    targetCount: number;
    evidenceCount: number;
    independentCorrectCount: number;
    assistedCount: number;
    incorrectCount: number;
    partialCount: number;
    notAssessedCount: number;
  }>;
  eventFacts: {
    totalEvidenceCount: number;
    activeRecallObservationCount: number;
    delayedCorrectRetrievalCount: number;
    delayedIndependentCorrectRetrievalCount: number;
    incorrectOrPartialCount: number;
  };
};

export type OrthographicProfileItem = {
  target: { id: string; kind: string; conceptId: string | null; script: EvidenceScript; displayForm: string | null; handwritingExpectation: HandwritingExpectation | null };
  traditional: Record<"recognition" | "reading" | "handwriting", EvidenceProfileFact> & {
    inputByMethod: Partial<Record<OrthographicInputMethod, EvidenceProfileFact>>;
  };
  simplified: Record<"recognition" | "reading" | "handwriting", EvidenceProfileFact> & {
    inputByMethod: Partial<Record<OrthographicInputMethod, EvidenceProfileFact>>;
  };
};

export type OrthographicProfile = {
  childId: number;
  profileVersion: number;
  isMasteryJudgment: false;
  items: OrthographicProfileItem[];
};

export type LearnerEvidenceEvent = {
  id: string;
  dimension: EvidenceDimension;
  script: EvidenceScript;
  outcome: EvidenceOutcome;
  assistance: EvidenceAssistance;
  score: number | null;
  scorer: string | null;
  scorerVersion: string | null;
  cueType: "IMAGE" | "CONCEPT" | "NATIVE_LANGUAGE" | "CONTEXT_CLOZE" | "AUDIO" | "CHINESE_TEXT" | "NONE";
  answerExposed: boolean;
  inputMethod: EvidenceInputMethod;
  retrievalTiming: "IMMEDIATE" | "DELAYED" | "UNKNOWN";
  priorExposureAt: string | null;
  reviewDueAt: string | null;
  source: { type: string; ref: string; taskId: string | null; sessionId: string | null; lessonId: string | null };
  occurredAt: string;
  evidenceSchemaVersion: number;
};

export type TargetEvidence = {
  childId: number;
  target: { id: string; kind: string; conceptId: string | null; script: EvidenceScript; displayForm: string | null; handwritingExpectation: HandwritingExpectation | null };
  profile: Array<EvidenceProfileFact & { dimension: EvidenceDimension; script: EvidenceScript; inputMethod: EvidenceInputMethod }>;
  events: LearnerEvidenceEvent[];
  isMasteryJudgment: false;
};

export type PlacementLevel = "NOT_ASSESSED" | "STARTER" | "BASIC" | "BOOK_1";
export type PlacementProfileV2 = {
  profileVersion: 2;
  childId: number;
  legacyAggregate: { profileVersion: number; mainCurriculumStart: string; domains: Record<string, { level: string }> };
  domains: Record<"listening" | "speaking" | "traditional_recognition" | "simplified_recognition" | "traditional_writing" | "simplified_writing", { level: PlacementLevel }>;
  assessmentMethod: "NOT_ASSESSED" | "PARENT_OBSERVATION" | "DIAGNOSTIC";
  assessedBy: string | null;
  updatedAt: string | null;
  orthographicEvidence: OrthographicProfile;
};

async function readJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(`learner_evidence_request_failed:${response.status}`);
  return response.json() as Promise<T>;
}

function childPath(childId: number): string {
  if (!Number.isSafeInteger(childId) || childId <= 0) throw new Error("invalid_child_id");
  return `/api/children/${childId}`;
}

/** Read-only evidence API. Evidence is written only by authoritative backend attempt flows. */
export function getLearnerEvidenceSummary(childId: number): Promise<LearnerEvidenceSummary> {
  return readJson(`${childPath(childId)}/learner-evidence/summary`);
}

export function getOrthographicProfile(childId: number): Promise<OrthographicProfile> {
  return readJson(`${childPath(childId)}/learner-evidence/orthographic-profile`);
}

export function getTargetEvidence(childId: number, targetId: string): Promise<TargetEvidence> {
  return readJson(`${childPath(childId)}/learner-evidence/targets/${encodeURIComponent(targetId)}`);
}

export function getPlacementProfileV2(childId: number): Promise<PlacementProfileV2> {
  return readJson(`${childPath(childId)}/placement-profile/v2`);
}

export async function savePlacementProfileV2(
  childId: number,
  domains: Partial<Record<keyof PlacementProfileV2["domains"], PlacementLevel>>,
  assessmentMethod: Exclude<PlacementProfileV2["assessmentMethod"], "NOT_ASSESSED">,
): Promise<PlacementProfileV2> {
  const response = await apiFetch(`${childPath(childId)}/placement-profile/v2`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains, assessment_method: assessmentMethod }),
  });
  if (!response.ok) throw new Error(`placement_profile_v2_request_failed:${response.status}`);
  return response.json() as Promise<PlacementProfileV2>;
}
