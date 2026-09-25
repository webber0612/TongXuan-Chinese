import { describe, expect, it } from "vitest";
import { adaptiveWritingTarget } from "./adaptiveWriting";

describe("adaptiveWritingTarget", () => {
  it("starts with a small amount of independent practice", () => {
    expect(adaptiveWritingTarget(0)).toBe(3);
  });

  it("adds one trace after repeated mistakes and caps the target", () => {
    expect(adaptiveWritingTarget(3)).toBe(4);
    expect(adaptiveWritingTarget(30)).toBe(8);
  });

  it("handles invalid or negative mistake counts safely", () => {
    expect(adaptiveWritingTarget(-2)).toBe(3);
    expect(adaptiveWritingTarget(Number.NaN)).toBe(3);
  });
});
