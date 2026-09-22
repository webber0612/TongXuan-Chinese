import { describe, expect, it } from "vitest";
import { browserCapabilities } from "./diagnostics";
import { HANZI_CHARACTERS } from "../pages/DiagnosticsPage";

describe("Phase 0 browser diagnostics", () => {
  it("returns explicit statuses for browser capabilities", () => {
    const results = browserCapabilities();
    expect(results["TTS zh-TW"]).toBeDefined();
    expect(results.MediaRecorder).toBeDefined();
    expect(results.PWA.status).toBe("MANUAL_VALIDATION_REQUIRED");
  });

  it("covers the four Phase 0 Hanzi Writer characters", () => {
    expect(HANZI_CHARACTERS).toEqual(["學", "学", "國", "国"]);
  });
});
