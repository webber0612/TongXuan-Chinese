export type ProfileRole = "child" | "parent";

export type Profile = {
  key: string;
  name: string;
  role: ProfileRole;
  childId: number | null;
  color: string;
};

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
  return profiles.find((profile) => profile.key === key) ?? profiles[0] ?? defaultProfiles[0];
}

export function addChildProfile(profiles: Profile[], name: string): Profile[] {
  const cleanName = name.trim();
  if (!cleanName) return profiles;
  const childCount = profiles.filter((profile) => profile.role === "child").length;
  return [...profiles, { key: `child-${Date.now()}`, name: cleanName, role: "child", childId: null, color: childCount % 2 ? "mint" : "coral" }];
}
