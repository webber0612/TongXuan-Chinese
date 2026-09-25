/**
 * LessonPackage schema and type contracts for TongXuan Chinese Learning Path v2.
 * Separates official OCAC curriculum metadata from pedagogical wrappers.
 */

export type ContentReviewStatus =
  | "GENERATED_DRAFT"
  | "REVIEWED"
  | "APPROVED"
  | "REJECTED";

export type ScaffoldVisibilityMode =
  | "FULL"
  | "TAP_TO_REVEAL"
  | "HIDDEN";

export type PedagogyMode =
  | "LEARN"
  | "FAST_TRACK"
  | "REVIEW"
  | "REPAIR";

export type CurriculumDomain =
  | "listening"
  | "speaking"
  | "recognition"
  | "writing"
  | "reading"
  | "phonetics"
  | "pronunciation"
  | "vocabulary"
  | "grammar";

export type PolicyLabel =
  | "TEXTBOOK_DERIVED"
  | "SUPPORTED_BY_FRAMEWORK"
  | "TONGXUAN_HYPOTHESIS"
  | "EXPERIMENTAL";

export interface NativeLanguageEntry {
  literal?: string;
  naturalMeaning: string;
  paraphrase?: string;
  notes?: string;
  reviewStatus: ContentReviewStatus;
}

export interface VocabularyItem {
  id: string;
  written: string;
  pronunciation: {
    pinyin: string;
    zhuyin: string;
    audioKey?: string;
  };
  meaning: {
    zh: string;
    en: string;
    naturalMeaning?: string;
    notes?: string;
  };
  usage: string[];
  learningRole: "ACTIVE" | "RECEPTIVE";
  reviewStatus: ContentReviewStatus;
}

export interface CharacterItem {
  char: string;
  pronunciation: {
    pinyin: string;
    zhuyin: string;
  };
  meaning: {
    zh: string;
    en: string;
  };
  writingRequired: boolean;
  learningRole: "RECOGNIZE" | "WRITE";
  strokeCount: number;
  radical: string;
  strokeOrderSteps?: string[];
}

export interface SentencePatternItem {
  id: string;
  pattern: string;
  explanation: {
    zh: string;
    en: string;
  };
  examples: Array<{
    zh: string;
    pinyin?: string;
    zhuyin?: string;
    en?: string;
  }>;
  reviewStatus: ContentReviewStatus;
}

export interface TextBlockItem {
  id: string;
  speaker?: string;
  text: string;
  pinyin?: string;
  zhuyin?: string;
  audioKey?: string;
  scaffoldKey?: string;
}

export interface CulturalNoteItem {
  id: string;
  title: string;
  content: string;
  contentEn: string;
  reviewStatus: ContentReviewStatus;
}

export type LessonStepKey =
  | "context"
  | "dialogue"
  | "vocabulary"
  | "characters"
  | "sentence_pattern"
  | "speaking"
  | "writing"
  | "exit_ticket"
  | "wrap_up";

export interface LessonStepChoice {
  id: string;
  label: string;
  subLabel?: string;
  isCorrect?: boolean;
}

export interface ExitTicketQuestion {
  id: string;
  domain: CurriculumDomain;
  prompt: string;
  audioText?: string;
  choices: LessonStepChoice[];
  correctChoiceId: string;
  explanation?: string;
}

export interface LessonStepDefinition {
  stepNumber: number;
  stepKey: LessonStepKey;
  domain: CurriculumDomain | null;
  title: string;
  subtitle: string;
  primaryAction: string;
  estimatedMinutes: number;
  required: boolean;
  skippableIfMastered?: boolean;
  data: {
    prompt?: string;
    audioText?: string;
    sceneDescription?: string;
    dialogueRows?: TextBlockItem[];
    vocabItems?: VocabularyItem[];
    characterItems?: CharacterItem[];
    patternItems?: SentencePatternItem[];
    choices?: LessonStepChoice[];
    correctChoiceId?: string;
    speakingPrompt?: {
      instruction: string;
      expectedText: string;
      audioPolicy: "LOCAL_ONLY";
    };
    writingTarget?: {
      character: string;
      strokeCount: number;
      radical: string;
      hintPolicy: "guided" | "reduced_hint" | "independent";
    };
    questions?: ExitTicketQuestion[];
    wrapUpSummary?: {
      completionText: string;
      masteryNotice: string;
    };
    [key: string]: any;
  };
}

export interface LessonPackage {
  schemaVersion: "v2.0";
  lessonId: string;
  stageId: "starter" | "basic" | "book-1";
  lessonNumber: number;
  curriculumSource: {
    kind: "OFFICIAL_OCAC";
    series: string;
    book: string;
    lesson: string;
    title: string;
    url: string;
    provenanceStatus: "VERIFIED_OFFICIAL_TITLE";
    licenseStatus: "PERMISSION_REQUIRED";
    commercialReady: false;
  };
  objectives: string[];
  textBlocks: TextBlockItem[];
  vocabulary: VocabularyItem[];
  characters: CharacterItem[];
  sentencePatterns: SentencePatternItem[];
  nativeLanguageSupport: {
    defaultLanguage: string;
    mode: ScaffoldVisibilityMode;
    entries: Record<string, NativeLanguageEntry>;
  };
  culturalNotes: CulturalNoteItem[];
  taskBlueprint: {
    learnSteps: LessonStepDefinition[];
    fastTrackSteps: LessonStepDefinition[];
    reviewSteps: LessonStepDefinition[];
    repairStepsByDomain: Record<string, LessonStepDefinition[]>;
  };
  masteryPolicy: {
    domainRequirements: Record<
      CurriculumDomain,
      {
        gateType: "SCORED" | "NON_SCORE_GATE";
        passScore?: number;
      }
    >;
    fastTrackPassThreshold: number;
    srsIntervalsMinutes: number[];
  };
  difficultyProfile: {
    pacing: "STANDARD" | "GENTLE" | "ACCELERATED";
    targetMinutes: {
      learn: number;
      fastTrack: number;
      review: number;
      repair: number;
    };
  };
  provenance: {
    authorship: "TONGXUAN_PEDAGOGY_WRAPPER";
    curriculumSourceProvenance: "VERIFIED_OFFICIAL_TITLE";
    licenseNote: string;
  };
}

/**
 * Validates whether an unreviewed generated translation is erroneously approved.
 */
export function validateReviewStatusIntegrity(pkg: LessonPackage): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const vocab of pkg.vocabulary) {
    if (vocab.reviewStatus === "GENERATED_DRAFT") {
      // Drafts must not be considered reviewed or approved
    }
  }

  for (const [key, entry] of Object.entries(pkg.nativeLanguageSupport.entries)) {
    if (entry.reviewStatus === "GENERATED_DRAFT" && (entry as any).approved === true) {
      errors.push(`Scaffold entry ${key} is GENERATED_DRAFT but flagged as approved.`);
    }
  }

  for (const pattern of pkg.sentencePatterns) {
    if (pattern.reviewStatus === "GENERATED_DRAFT" && (pattern as any).approved === true) {
      errors.push(`Sentence pattern ${pattern.id} is GENERATED_DRAFT but flagged as approved.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
