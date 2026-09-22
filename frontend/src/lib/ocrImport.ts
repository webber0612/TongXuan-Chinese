export type OCRCandidate = { provider_id: string; text: string };

export interface OCRProvider {
  recognize(image: File): Promise<OCRCandidate>;
}

/** Local/mockable MVP boundary. It never uploads or serializes image bytes. */
export class LocalOCRProvider implements OCRProvider {
  readonly provider_id = "local-deterministic-ocr";

  async recognize(image: File): Promise<OCRCandidate> {
    if (!image || !image.name) throw new Error("image_required");
    return { provider_id: this.provider_id, text: "" };
  }
}
