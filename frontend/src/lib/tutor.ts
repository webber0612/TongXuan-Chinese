export const TUTOR_MODES = ["explain", "story", "reading-guide", "sentence-hint"] as const;
export type TutorMode = typeof TUTOR_MODES[number];

export function buildTutorPath(childId: number) {
  return `/api/children/${childId}/tutor/respond`;
}

export function tutorModeLabel(mode: TutorMode) {
  return mode === "reading-guide" ? "Reading guide" : mode === "sentence-hint" ? "Sentence hint" : mode[0].toUpperCase() + mode.slice(1);
}
