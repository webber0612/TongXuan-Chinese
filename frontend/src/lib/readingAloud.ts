export type ReadingAloudLocale = "zh-TW" | "zh-CN";
export type ReadingAloudTextKind = "character" | "word" | "sentence" | "passage";

export interface ReadingAloudRecorder {
  start(): Promise<void>;
  stop(): Promise<Blob>;
  replay(): Promise<void>;
  delete(): void;
  readonly recording: Blob | null;
}

/** Browser-only adapter. The learning domain receives lifecycle results, never MediaRecorder/Blob globals. */
export class BrowserMediaRecorderAdapter implements ReadingAloudRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private audioUrl: string | null = null;
  private _recording: Blob | null = null;

  get recording(): Blob | null { return this._recording; }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("microphone_unavailable");
    if (this.recorder && this.recorder.state !== "inactive") throw new Error("recording_already_started");
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { throw new Error("microphone_permission_denied"); }
    this.chunks = [];
    this._recording = null;
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
    this.recorder.start();
  }

  stop(): Promise<Blob> {
    if (!this.recorder || this.recorder.state === "inactive") return Promise.reject(new Error("recording_not_started"));
    return new Promise((resolve, reject) => {
      const recorder = this.recorder!;
      recorder.onerror = () => reject(new Error("recording_failed"));
      recorder.onstop = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this._recording = new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
        resolve(this._recording);
      };
      recorder.stop();
    });
  }

  async replay(): Promise<void> {
    if (!this._recording) throw new Error("recording_not_available");
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = URL.createObjectURL(this._recording);
    const audio = new Audio(this.audioUrl);
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("recording_replay_failed"));
      void audio.play().catch(() => reject(new Error("recording_replay_failed")));
    });
    if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
  }

  delete(): void {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    this._recording = null;
    this.chunks = [];
    this.recorder = null;
  }
}
