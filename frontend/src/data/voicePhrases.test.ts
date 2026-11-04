import { describe, expect, it } from "vitest";
import { clipKey } from "../lib/voiceClips";
import { VOICE_PHRASES } from "./voicePhrases";
import feedbackManifest from "../../public/audio/feedback/manifest.json";

const manifest: { clips: Record<string, string> } = feedbackManifest;

describe("voice phrases", () => {
  it("has a recorded clip for every feedback phrase", () => {
    const missing = Object.values(VOICE_PHRASES).filter((text) => !manifest.clips[clipKey(text)]);
    expect(missing).toEqual([]);
  });

  it("contains no digits, so nothing needs a number read aloud", () => {
    expect(Object.values(VOICE_PHRASES).filter((text) => /\d/.test(text))).toEqual([]);
  });
});
