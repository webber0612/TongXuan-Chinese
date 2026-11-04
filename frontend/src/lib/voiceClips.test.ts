import { describe, expect, it } from "vitest";
import { clipKey, clipsFor } from "./voiceClips";

const urls = new Map([
  ["你好", "/a.mp3"],
  ["你好不好", "/b.mp3"],
  ["我好", "/c.mp3"],
  ["你几岁", "/d.mp3"],
]);

describe("voice clips", () => {
  it("ignores punctuation and spacing when matching text", () => {
    expect(clipKey("你好！")).toBe("你好");
    expect(clipKey("一、二、三！")).toBe("一二三");
    expect(clipsFor("你好！", urls)).toEqual(["/a.mp3"]);
  });

  it("finds simplified text through its own key", () => {
    expect(clipsFor("你几岁？", urls)).toEqual(["/d.mp3"]);
  });

  it("plays a passage sentence by sentence when every sentence has a clip", () => {
    expect(clipsFor("你好！。你好不好？。我好。", urls)).toEqual(["/a.mp3", "/b.mp3", "/c.mp3"]);
  });

  it("skips phonetic annotations inside a spoken string", () => {
    expect(clipsFor("你好。ㄋㄧˇ ㄏㄠˇ。你好不好？", urls)).toEqual(["/a.mp3", "/b.mp3"]);
    expect(clipsFor("我好。wǒ hǎo", urls)).toEqual(["/c.mp3"]);
  });

  it("falls back when any sentence has no clip, or before the manifest has loaded", () => {
    expect(clipsFor("你好！。我不好。", urls)).toBeNull();
    expect(clipsFor("謝謝", urls)).toBeNull();
    expect(clipsFor("你好", null)).toBeNull();
  });
});
