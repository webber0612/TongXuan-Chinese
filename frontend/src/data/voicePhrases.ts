import phraseFile from "../../../shared/voice/feedback-phrases.json";

/**
 * Fixed spoken feedback lines. They are pre-recorded with the book 1 voice
 * (tools/audio/generate_book1_audio.py), so code must speak them through this table
 * instead of building sentences with numbers or names, which could not be recorded.
 */
export type VoicePhraseId = keyof typeof phraseFile.phrases;

export const VOICE_PHRASES: Readonly<Record<VoicePhraseId, string>> = Object.fromEntries(
  Object.entries(phraseFile.phrases).map(([id, phrase]) => [id, phrase.text]),
) as Record<VoicePhraseId, string>;
