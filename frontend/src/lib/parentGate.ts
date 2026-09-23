export type Reward = { id: string; name: string; cost: number; description?: string };

/** The password is sent to the backend for verification and is never treated as UI-only security. */
export const PARENT_GATE_NOTE = "密碼只送給後端驗證，不會由前端保存或回傳；後端 session 與 child scope 才是安全邊界。";

export function isPasswordEntered(value: string) {
  return value.trim().length > 0;
}
