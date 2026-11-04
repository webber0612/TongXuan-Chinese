import { describe, expect, it } from "vitest";
import { parsePinyin, pinyinWithTone, toneOptions, zhuyinWithTone } from "./tones";

describe("tone variants", () => {
  it("reads the tone and toneless form of a marked syllable", () => {
    expect(parsePinyin("hǎi")).toMatchObject({ base: "hai", tone: 3 });
    expect(parsePinyin("lǜ")).toMatchObject({ base: "lü", tone: 4 });
    expect(parsePinyin("de")).toMatchObject({ base: "de", tone: 0 });
  });

  it("writes the neutral tone without a mark in pinyin and with a leading dot in zhuyin", () => {
    expect(pinyinWithTone("hǎi", 0)).toBe("hai");
    expect(zhuyinWithTone("ㄏㄞˇ", 0)).toBe("˙ㄏㄞ");
    expect(zhuyinWithTone("ㄏㄞˇ", 1)).toBe("ㄏㄞ");
  });

  it("places marks on the standard vowel", () => {
    expect(pinyinWithTone("xiao", 3)).toBe("xiǎo");
    expect(pinyinWithTone("gou", 3)).toBe("gǒu");
    expect(pinyinWithTone("liu", 4)).toBe("liù");
    expect(pinyinWithTone("shui", 3)).toBe("shuǐ");
  });

  it("offers the same syllable in four tones with exactly one correct", () => {
    const options = toneOptions("hǎi", "ㄏㄞˇ");
    expect(options.map((option) => option.pinyin).sort()).toEqual(["hai", "hāi", "hái", "hǎi", "hài"].filter((p) => p !== "hai").sort());
    expect(options.filter((option) => option.correct)).toEqual([{ pinyin: "hǎi", zhuyin: "ㄏㄞˇ", correct: true }]);
    expect(options.some((option) => option.pinyin.includes("輕聲"))).toBe(false);
  });

  it("includes the neutral form when the syllable itself is neutral", () => {
    const options = toneOptions("de", "˙ㄉㄜ");
    expect(options[0]).toEqual({ pinyin: "de", zhuyin: "˙ㄉㄜ", correct: true });
    expect(options).toHaveLength(4);
  });
});
