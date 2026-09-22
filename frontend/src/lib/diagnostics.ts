export type DiagnosticResult = { status: "PASS" | "FAIL" | "MANUAL_VALIDATION_REQUIRED"; detail: string };

export function browserCapabilities(): Record<string, DiagnosticResult> {
  const speech = typeof window !== "undefined" && "speechSynthesis" in window;
  const recorder = typeof window !== "undefined" && "MediaRecorder" in window;
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const microphoneApi = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  return {
    "TTS zh-TW": { status: speech ? "PASS" : "FAIL", detail: speech ? "SpeechSynthesis API available" : "SpeechSynthesis API unavailable" },
    "TTS zh-CN": { status: speech ? "PASS" : "FAIL", detail: speech ? "SpeechSynthesis API available" : "SpeechSynthesis API unavailable" },
    Microphone: { status: microphoneApi ? "MANUAL_VALIDATION_REQUIRED" : "FAIL", detail: "Permission and hardware require real-device validation" },
    MediaRecorder: { status: recorder ? "MANUAL_VALIDATION_REQUIRED" : "FAIL", detail: recorder ? "API available; record/playback requires manual validation" : "MediaRecorder unavailable" },
    Touch: { status: touch ? "PASS" : "MANUAL_VALIDATION_REQUIRED", detail: touch ? `${navigator.maxTouchPoints} touch points reported` : "Desktop environment; validate on iPad" },
    PWA: { status: "MANUAL_VALIDATION_REQUIRED", detail: "Install/Add to Home Screen requires Safari validation" }
  };
}
