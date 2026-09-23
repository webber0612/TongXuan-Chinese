export type Reward = { id: string; name: string; cost: number; description?: string };

/** The parent password is a UX gate only; backend authorization remains authoritative. */
export const PARENT_GATE_NOTE = "這是前端確認流程，不是伺服器安全邊界。兌換仍受後端權限保護。";

export function validateParentPassword(value: string, expected = "家長") {
  return value.trim() === expected;
}
