/**
 * Tone variants of one syllable, for "which tone is it?" questions.
 *
 * Pinyin marks tones 1–4 on the main vowel and writes the neutral tone with no mark.
 * Zhuyin writes tone 1 with no mark, ˊ ˇ ˋ for tones 2–4, and a leading ˙ for the neutral tone.
 */

const MARKED: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  o: ["ō", "ó", "ǒ", "ò"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

const MARK_TO_BASE = new Map<string, [string, number]>(
  Object.entries(MARKED).flatMap(([base, marks]) => marks.map((mark, index): [string, [string, number]] => [mark, [base, index + 1]])),
);

const ZHUYIN_MARKS = ["", "ˊ", "ˇ", "ˋ"];

export type Tone = 0 | 1 | 2 | 3 | 4;

/** Splits one pinyin syllable into its toneless form, the marked vowel's position, and its tone (0 = neutral). */
export function parsePinyin(syllable: string): { base: string; tone: Tone; markIndex: number } {
  const chars = [...syllable.normalize("NFC")];
  const markIndex = chars.findIndex((char) => MARK_TO_BASE.has(char));
  if (markIndex < 0) return { base: chars.join(""), tone: 0, markIndex: mainVowelIndex(chars.join("")) };
  const [base, tone] = MARK_TO_BASE.get(chars[markIndex])!;
  chars[markIndex] = base;
  return { base: chars.join(""), tone: tone as Tone, markIndex };
}

/** Standard placement: a or e first; o in "ou"; otherwise the last vowel. */
function mainVowelIndex(base: string): number {
  const chars = [...base];
  const a = chars.findIndex((char) => char === "a" || char === "e");
  if (a >= 0) return a;
  const ou = base.indexOf("ou");
  if (ou >= 0) return ou;
  for (let index = chars.length - 1; index >= 0; index -= 1) {
    if ("iouü".includes(chars[index])) return index;
  }
  return -1;
}

export function pinyinWithTone(syllable: string, tone: Tone): string {
  const { base, markIndex } = parsePinyin(syllable);
  if (tone === 0 || markIndex < 0) return base;
  const chars = [...base];
  chars[markIndex] = MARKED[chars[markIndex]]?.[tone - 1] ?? chars[markIndex];
  return chars.join("");
}

export function zhuyinWithTone(zhuyin: string, tone: Tone): string {
  const bare = zhuyin.replace(/[ˊˇˋ˙]/g, "");
  return tone === 0 ? `˙${bare}` : `${bare}${ZHUYIN_MARKS[tone - 1]}`;
}

/** The syllable in all four main tones, correct one first. Neutral-tone syllables add the neutral form. */
export function toneOptions(pinyin: string, zhuyin: string): Array<{ pinyin: string; zhuyin: string; correct: boolean }> {
  const { tone } = parsePinyin(pinyin);
  const tones: Tone[] = tone === 0 ? [0, 1, 2, 3] : [1, 2, 3, 4];
  return tones
    .map((candidate) => ({ pinyin: pinyinWithTone(pinyin, candidate), zhuyin: zhuyinWithTone(zhuyin, candidate), correct: candidate === tone }))
    .sort((a, b) => Number(b.correct) - Number(a.correct));
}
