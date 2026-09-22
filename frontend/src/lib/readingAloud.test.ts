import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserMediaRecorderAdapter } from "./readingAloud";

afterEach(() => vi.unstubAllGlobals());

function installRecorder() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  class MockMediaRecorder {
    static instances: MockMediaRecorder[] = [];
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable = (_event: { data: Blob }) => {};
    onstop = () => {};
    onerror = () => {};
    constructor(public stream: unknown) { MockMediaRecorder.instances.push(this); }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable({ data: new Blob(["audio"]) }); this.onstop(); }
  }
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  return { getUserMedia, track, MockMediaRecorder };
}

describe("BrowserMediaRecorderAdapter", () => {
  it("requests permission and supports start/stop/replay/delete without network", async () => {
    const { getUserMedia, track } = installRecorder();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn().mockReturnValue("blob:reading");
    const play = vi.fn();
    class MockAudio {
      onended = () => {};
      onerror = () => {};
      constructor(public url: string) {}
      async play() { play(); this.onended(); }
    }
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Audio", MockAudio);
    const adapter = new BrowserMediaRecorderAdapter();
    await adapter.start();
    const blob = await adapter.stop();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(blob.size).toBeGreaterThan(0);
    expect(adapter.recording).toBe(blob);
    await adapter.replay();
    expect(play).toHaveBeenCalledTimes(1);
    adapter.delete();
    expect(adapter.recording).toBeNull();
    expect(track.stop).toHaveBeenCalled();
  });

  it("reports denied and unavailable microphone clearly", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("MediaRecorder", class {});
    await expect(new BrowserMediaRecorderAdapter().start()).rejects.toThrow("microphone_permission_denied");
    vi.stubGlobal("navigator", {});
    await expect(new BrowserMediaRecorderAdapter().start()).rejects.toThrow("microphone_unavailable");
  });
});
