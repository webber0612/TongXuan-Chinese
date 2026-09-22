import { describe, expect, it } from "vitest";
import { buildOCRConfirmPayload, LocalOCRProvider, resetOCRLocalState } from "./ocrImport";

describe("LocalOCRProvider", () => {
  it("returns an editable candidate without uploading image bytes", async () => {
    const provider = new LocalOCRProvider();
    const image = { name: "worksheet.jpg", type: "image/jpeg", size: 42 } as File;
    await expect(provider.recognize(image)).resolves.toEqual({ provider_id: "local-deterministic-ocr", text: "" });
  });

  it("reports a missing image clearly", async () => {
    await expect(new LocalOCRProvider().recognize(null as unknown as File)).rejects.toThrow("image_required");
  });

  it("submits edited text and metadata only, never image bytes", () => {
    const original = "原始候選";
    const edited = "家長修正版";
    const request = buildOCRConfirmPayload(edited, "zh-TW", "TRADITIONAL");
    expect(request).toEqual({ confirmed_text: edited, locale: "zh-TW", script: "TRADITIONAL" });
    expect(request.confirmed_text).not.toBe(original);
    expect(request).not.toHaveProperty("image");
    expect(request).not.toHaveProperty("file");
    expect(request).not.toHaveProperty("blob");
    expect(request).not.toHaveProperty("base64");
  });

  it("reset clears local image, candidate, and import state", () => {
    expect(resetOCRLocalState()).toEqual({ image: null, candidate: "", importId: null });
  });
});
