import { describe, expect, it } from "vitest";
import { LocalOCRProvider } from "./ocrImport";

describe("LocalOCRProvider", () => {
  it("returns an editable candidate without uploading image bytes", async () => {
    const provider = new LocalOCRProvider();
    const image = { name: "worksheet.jpg", type: "image/jpeg", size: 42 } as File;
    await expect(provider.recognize(image)).resolves.toEqual({ provider_id: "local-deterministic-ocr", text: "" });
  });

  it("reports a missing image clearly", async () => {
    await expect(new LocalOCRProvider().recognize(null as unknown as File)).rejects.toThrow("image_required");
  });
});
