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

export type TTSPlaybackHandlers = {
  onEnd?: () => void;
  onError?: () => void;
};

export interface TTSProvider {
  speak(payload: TTSPlaybackPayload, handlers?: TTSPlaybackHandlers): void;
  cancel(): void;
}

/** Browser adapter; the learning domain only receives a transient playback payload. */
export class BrowserSpeechSynthesisProvider implements TTSProvider {
  speak(payload: TTSPlaybackPayload, handlers?: TTSPlaybackHandlers): void {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      throw new Error("tts_unavailable");
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(payload.text);
    utterance.lang = payload.voice_locale;
    utterance.rate = payload.rate;
    utterance.onend = () => handlers?.onEnd?.();
    utterance.onerror = () => handlers?.onError?.();
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
