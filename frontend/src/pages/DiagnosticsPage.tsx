import { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { browserCapabilities, DiagnosticResult } from "../lib/diagnostics";

const API = import.meta.env.VITE_API_BASE ?? "";
export const HANZI_CHARACTERS = ["學", "学", "國", "国"] as const;

export function DiagnosticsPage() {
  const [results, setResults] = useState<Record<string, DiagnosticResult>>({ ...browserCapabilities() });
  const [conversion, setConversion] = useState("尚未測試");
  const [recording, setRecording] = useState("尚未測試");
  const [selectedCharacter, setSelectedCharacter] = useState<(typeof HANZI_CHARACTERS)[number]>("學");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const writer = HanziWriter.create("hanzi-target", selectedCharacter, { width: 180, height: 180, showOutline: true, strokeAnimationSpeed: 1 });
    writerRef.current = writer;
    setResults((current) => ({ ...current, "Hanzi Writer": { status: "PASS", detail: `${selectedCharacter} rendered` } }));
    return () => { writer.cancelQuiz(); writer.hideCharacter(); };
  }, [selectedCharacter]);

  useEffect(() => () => { if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current); }, []);

  async function runBackend() {
    try {
      const health = await fetch(`${API}/api/health`).then((r) => r.json());
      const sqlite = await fetch(`${API}/api/diagnostics/sqlite`, { method: "POST" }).then((r) => r.json());
      const converted = await fetch(`${API}/api/tools/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "学校环境保护", direction: "s2tw" }) }).then((r) => r.json());
      setConversion(converted.text ?? "FAIL");
      setResults((current) => ({ ...current, Backend: { status: health.status === "ok" ? "PASS" : "FAIL", detail: JSON.stringify(health) }, SQLite: { status: sqlite.status === "ok" && Object.values(sqlite.operations).every(Boolean) ? "PASS" : "FAIL", detail: "CRUD persistence diagnostic" }, OpenCC: { status: converted.text === "學校環境保護" ? "PASS" : "FAIL", detail: converted.text ?? "No result" } }));
    } catch (error) {
      setResults((current) => ({ ...current, Backend: { status: "FAIL", detail: String(error) }, SQLite: { status: "FAIL", detail: "Backend unavailable" }, OpenCC: { status: "FAIL", detail: "Backend unavailable" } }));
    }
  }

  function speak(locale: string, rate: number) {
    const utterance = new SpeechSynthesisUtterance("學校環境保護");
    utterance.lang = locale; utterance.rate = rate; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  }

  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream); mediaRecorder.current = recorder; const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = url;
        setRecordingUrl(url);
        setRecording(`PASS：${new Blob(chunks).size} bytes，可播放或刪除；僅暫存於記憶體`);
      };
      recorder.start(); setRecording("錄音中…再次按下停止");
    } catch { setRecording("MANUAL_VALIDATION_REQUIRED：未取得麥克風權限"); }
  }

  function stopRecording() { if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop(); }

  function playRecording() { if (audioRef.current) void audioRef.current.play(); }

  function deleteRecording() {
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = null;
    setRecordingUrl(null);
    setRecording("已刪除暫存錄音");
  }

  return <main>
    <header><p className="eyebrow">PHASE 0 · TECHNICAL VALIDATION</p><h1>TongXuan Chinese</h1><p>技術診斷頁，不含兒童正式學習流程。</p></header>
    <section className="card"><h2>Diagnostics</h2><button onClick={runBackend}>Run backend / SQLite / OpenCC</button><div className="grid">{Object.entries(results).map(([name, result]) => <div className={`result ${result.status}`} key={name}><strong>{result.status}</strong><span>{name}</span><small>{result.detail}</small></div>)}</div></section>
    <section className="card"><h2>Hanzi Writer PoC</h2><div className="actions">{HANZI_CHARACTERS.map((character) => <button key={character} aria-pressed={selectedCharacter === character} onClick={() => setSelectedCharacter(character)}>{character}</button>)}</div><div id="hanzi-target" aria-label={`Hanzi Writer target ${selectedCharacter}`} /><div className="actions"><button onClick={() => writerRef.current?.animateCharacter()}>Animate</button><button onClick={() => writerRef.current?.pauseAnimation()}>Pause</button><button onClick={() => writerRef.current?.resumeAnimation()}>Resume</button><button onClick={() => writerRef.current?.hideCharacter()}>Reset</button><button onClick={() => writerRef.current?.quiz({ showHintAfterMisses: 1, onMistake: () => setResults((c) => ({ ...c, "Hanzi Writer": { status: "PASS", detail: `${selectedCharacter} quiz mistake callback observed` } })) })}>Quiz</button></div></section>
    <section className="card"><h2>TTS / Recording</h2><div className="actions"><button onClick={() => speak("zh-TW", 0.6)}>🔊 zh-TW 0.6x</button><button onClick={() => speak("zh-CN", 0.8)}>🔊 zh-CN 0.8x</button><button onClick={() => speak("zh-TW", 1)}>🔊 zh-TW 1.0x</button><button onClick={() => window.speechSynthesis.cancel()}>Stop</button></div><div className="actions"><button onClick={record}>Start recording</button><button onClick={stopRecording}>Stop recording</button><button onClick={playRecording} disabled={!recordingUrl}>Play recording</button><button onClick={deleteRecording} disabled={!recordingUrl}>Delete temporary recording</button></div><audio ref={audioRef} controls src={recordingUrl ?? undefined} aria-label="Temporary recording playback" /><p>{recording}</p><p>OpenCC result: {conversion}</p></section>
  </main>;
}
