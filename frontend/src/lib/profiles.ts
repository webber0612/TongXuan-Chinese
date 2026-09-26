export type ProfileRole = "child" | "parent";

export type Profile = {
  key: string;
  name: string;
  role: ProfileRole;
  childId: number | null;
  color: string;
};

export type BackendChild = { id: number; name: string };

export function isValidBackendChildId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function normalizeBackendChildren(value: unknown): BackendChild[] {
  if (!Array.isArray(value)) return [];
  const candidates = value.filter((child): child is BackendChild =>
    typeof child === "object" && child !== null &&
    isValidBackendChildId((child as { id?: unknown }).id) &&
    typeof (child as { name?: unknown }).name === "string" &&
    Boolean((child as { name: string }).name.trim())
  );
  const counts = new Map<number, number>();
  for (const child of candidates) counts.set(child.id, (counts.get(child.id) ?? 0) + 1);
  return candidates.filter((child) => counts.get(child.id) === 1);
}

export function selectedBackendChild(profile: Profile, children: BackendChild[]): BackendChild | null {
  if (profile.role !== "child" || !isValidBackendChildId(profile.childId)) return null;
  const matches = children.filter((child) => child.id === profile.childId);
  return matches.length === 1 ? matches[0] : null;
}

export const PROFILE_STORAGE_KEY = "tongxuan.child-first.profiles";
export const ACTIVE_PROFILE_STORAGE_KEY = "tongxuan.child-first.active-profile";

export const defaultProfiles: Profile[] = [
  { key: "child-a", name: "小學習者 A", role: "child", childId: null, color: "coral" },
  { key: "child-b", name: "小學習者 B", role: "child", childId: null, color: "mint" },
  { key: "parent", name: "家長管理者", role: "parent", childId: null, color: "navy" },
];

export function loadProfiles(storage: Pick<Storage, "getItem"> = localStorage): Profile[] {
  try {
    const saved = storage.getItem(PROFILE_STORAGE_KEY);
    if (!saved) return defaultProfiles;
    const parsed = JSON.parse(saved) as Profile[];
    return Array.isArray(parsed) && parsed.some((profile) => profile.role === "parent") ? parsed : defaultProfiles;
  } catch {
    return defaultProfiles;
  }
}

export function saveProfiles(profiles: Profile[], storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function selectProfile(profiles: Profile[], key: string): Profile {
  // An unresolved local selection is presentation-only. Never turn it into the
  // first backend child, since that would silently select another learner.
  return profiles.find((profile) => profile.key === key) ?? defaultProfiles[0];
}

export function reconcileProfiles(children: BackendChild[], saved: Profile[] = defaultProfiles): Profile[] {
  const parent = saved.find((profile) => profile.role === "parent") ?? defaultProfiles.find((profile) => profile.role === "parent")!;
  return [...children.map((child, index) => {
    const previous = saved.find((profile) => profile.role === "child" && profile.childId === child.id);
    return { key: `child-${child.id}`, name: child.name, role: "child" as const, childId: child.id, color: previous?.color ?? (index % 2 ? "mint" : "coral") };
  }), { ...parent, key: "parent", childId: null }];
}

export function addChildProfile(profiles: Profile[], name: string): Profile[] {
  const cleanName = name.trim();
  if (!cleanName) return profiles;
  const childCount = profiles.filter((profile) => profile.role === "child").length;
  return [...profiles, { key: `child-${Date.now()}`, name: cleanName, role: "child", childId: null, color: childCount % 2 ? "mint" : "coral" }];
}
