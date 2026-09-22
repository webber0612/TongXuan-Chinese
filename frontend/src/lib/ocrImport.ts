export type OCRCandidate = { provider_id: string; text: string };
export type OCRConfirmPayload = { confirmed_text: string; locale: "zh-TW" | "zh-CN"; script: "TRADITIONAL" | "SIMPLIFIED" };
export type OCRLocalState = { image: File | null; candidate: string; importId: string | null };

export function buildOCRConfirmPayload(editedText: string, locale: OCRConfirmPayload["locale"], script: OCRConfirmPayload["script"]): OCRConfirmPayload {
  return { confirmed_text: editedText, locale, script };
}

export function resetOCRLocalState(): OCRLocalState {
  return { image: null, candidate: "", importId: null };
}

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
