export type CurriculumWindow = "all" | string;

export function buildCurriculumPath(childId: number, asOf?: string) {
  const params = new URLSearchParams();
  if (asOf) params.set("as_of", asOf);
  return `/api/children/${childId}/curriculum${params.toString() ? `?${params}` : ""}`;
}

export function progressLabel(status: string) {
  return status === "COMPLETED" ? "Completed" : status === "IN_PROGRESS" ? "In progress" : "Not started";
}
