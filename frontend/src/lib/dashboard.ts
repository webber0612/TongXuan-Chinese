export const DASHBOARD_SKILLS = ["recognition", "writing", "word", "sentence", "pronunciation", "grammar", "idiom", "reading", "reading_aloud"] as const;
export type DashboardWindow = "7d" | "30d" | "all";

export type LearningFlowSessionSummary = {
  sessionId: string;
  lessonId: string;
  status: string;
  durationSeconds: number;
  taskCount: number;
  deferredCount: number;
  masteryStatus: string | null;
  rewardPoints: number;
};

export type LearningFlowReport = {
  childId: number;
  from: string;
  to: string;
  sessions: LearningFlowSessionSummary[];
  taskCounts: Record<string, number>;
  weakDomains: Record<string, number>;
  deferredTasks: Record<string, number>;
  masteryChanges: Array<{ sessionId: string; status: string }>;
  reviewDueCounts: Record<string, number>;
  privacy: {
    rawAudioStored: boolean;
    learnerAnswersStored: boolean;
    identifyingTelemetry: boolean;
  };
};

export function dashboardRange(window: DashboardWindow, asOf = new Date()) {
  const toAt = asOf.toISOString();
  const days = window === "7d" ? 7 : window === "30d" ? 30 : null;
  const fromAt = days === null ? undefined : new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { fromAt, toAt };
}

export function buildDashboardPath(childId: number, window: DashboardWindow, fromAt?: string, toAt?: string) {
  const params = new URLSearchParams({ child_id: String(childId), window });
  if (fromAt) params.set("from_at", fromAt);
  if (toAt) params.set("to_at", toAt);
  return `/api/dashboard?${params.toString()}`;
}

export function buildLearningFlowReportPath(childId: number, fromAt?: string, toAt?: string) {
  const params = new URLSearchParams();
  if (fromAt) params.set("from_at", fromAt);
  if (toAt) params.set("to_at", toAt);
  const query = params.toString();
  return `/api/children/${childId}/learning-sessions/report${query ? `?${query}` : ""}`;
}

export function dashboardWindowLabel(window: DashboardWindow) {
  return window === "7d" ? "Last 7 days" : window === "30d" ? "Last 30 days" : "All time";
}
