import { describe, expect, it } from "vitest";
import { browserCapabilities } from "./diagnostics";

describe("Phase 0 browser diagnostics", () => {
  it("returns explicit statuses for browser capabilities", () => {
    const results = browserCapabilities();
    expect(results["TTS zh-TW"]).toBeDefined();
    expect(results.MediaRecorder).toBeDefined();
    expect(results.PWA.status).toBe("MANUAL_VALIDATION_REQUIRED");
  });
});
