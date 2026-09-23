export type BuildTarget = "family" | "commercial";

export function buildCommercializationPath(target: BuildTarget = "family") {
  return `/api/admin/commercialization/readiness?build_target=${target}`;
}
