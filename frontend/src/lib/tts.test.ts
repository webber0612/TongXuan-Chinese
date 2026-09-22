import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserSpeechSynthesisProvider, type TTSPlaybackPayload } from "./tts";

const payload = (locale: "zh-TW" | "zh-CN"): TTSPlaybackPayload => ({
  provider: "browser-speech-synthesis",
  locale,
  voice_locale: locale,
  text: locale === "zh-TW" ? "學" : "学",
  text_kind: "character",
  rate: 0.8,
  playback_only: true,
  persisted: false,
});

afterEach(() => vi.unstubAllGlobals());

describe("BrowserSpeechSynthesisProvider", () => {
  it.each(["zh-TW", "zh-CN"] as const)("passes text, locale, rate, and cancels existing speech for %s", (locale) => {
    const cancel = vi.fn();
    const speak = vi.fn();
    class MockUtterance {
      lang = "";
      rate = 1;
      constructor(public text: string) {}
    }
    vi.stubGlobal("window", { speechSynthesis: { cancel, speak }, SpeechSynthesisUtterance: MockUtterance });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    new BrowserSpeechSynthesisProvider().speak(payload(locale));

    const utterance = speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe(payload(locale).text);
    expect(utterance.lang).toBe(locale);
    expect(utterance.rate).toBe(0.8);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(speak.mock.invocationCallOrder[0]);
  });

  it("reports tts_unavailable when Web Speech API is absent", () => {
    vi.stubGlobal("window", {});
    expect(() => new BrowserSpeechSynthesisProvider().speak(payload("zh-TW"))).toThrow("tts_unavailable");
  });
});
