export const DASHBOARD_SKILLS = ["recognition", "writing", "word", "sentence", "pronunciation", "grammar", "idiom", "reading", "reading_aloud"] as const;
export type DashboardWindow = "7d" | "30d" | "all";

export function buildDashboardPath(childId: number, window: DashboardWindow, fromAt?: string, toAt?: string) {
  const params = new URLSearchParams({ child_id: String(childId), window });
  if (fromAt) params.set("from_at", fromAt);
  if (toAt) params.set("to_at", toAt);
  return `/api/dashboard?${params.toString()}`;
}

export function dashboardWindowLabel(window: DashboardWindow) {
  return window === "7d" ? "Last 7 days" : window === "30d" ? "Last 30 days" : "All time";
}
