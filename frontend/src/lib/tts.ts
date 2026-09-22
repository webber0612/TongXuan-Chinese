export type TTSLocale = "zh-TW" | "zh-CN";
export type TTSTextKind = "character" | "word" | "sentence" | "passage";

export type TTSPlaybackPayload = {
  provider: string;
  locale: TTSLocale;
  voice_locale: TTSLocale;
  text: string;
  text_kind: TTSTextKind;
  rate: number;
  playback_only: boolean;
  persisted: boolean;
};

export interface TTSProvider {
  speak(payload: TTSPlaybackPayload): void;
  cancel(): void;
}

/** Browser adapter; the learning domain only receives a transient playback payload. */
export class BrowserSpeechSynthesisProvider implements TTSProvider {
  speak(payload: TTSPlaybackPayload): void {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      throw new Error("tts_unavailable");
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(payload.text);
    utterance.lang = payload.voice_locale;
    utterance.rate = payload.rate;
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    window.speechSynthesis.cancel();
  }
}
