import { useEffect, useState } from "react";
import { nextQueueItem, scoreAnswers } from "../lib/learning";
import { hanziWriterTraceEvent } from "../lib/writingProvider";
import { BrowserSpeechSynthesisProvider, TTSLocale, TTSTextKind } from "../lib/tts";
import { BrowserMediaRecorderAdapter, ReadingAloudTextKind } from "../lib/readingAloud";
import { buildOCRConfirmPayload, LocalOCRProvider, resetOCRLocalState } from "../lib/ocrImport";
import { buildAdaptiveRequest, explainAdaptiveReasons, AdaptivePreference } from "../lib/adaptive";
import { currentLearningLocale } from "../lib/i18n";

const API = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

const ttsProvider = new BrowserSpeechSynthesisProvider();
const readingAloudRecorder = new BrowserMediaRecorderAdapter();
const ocrProvider = new LocalOCRProvider();

export function LearningPage({ activeChildId }: { activeChildId: number | null }) {
  const [childId, setChildId] = useState<number | null>(activeChildId);
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [item, setItem] = useState<{ id: string; character: string } | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [schoolCharacter, setSchoolCharacter] = useState("");
  const [schoolSource, setSchoolSource] = useState("");
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [points, setPoints] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [sprintB, setSprintB] = useState<any>(null);
  const [pinyinReading, setPinyinReading] = useState<any>(null);
  const [pinyinInput, setPinyinInput] = useState("");
  const [pinyinFeedback, setPinyinFeedback] = useState("");
  const [ttsLocale, setTtsLocale] = useState<TTSLocale>(currentLearningLocale);
  const [ttsRate, setTtsRate] = useState(1);
  const [readingText, setReadingText] = useState("學");
  const [readingKind, setReadingKind] = useState<ReadingAloudTextKind>("character");
  const [readingLocale, setReadingLocale] = useState<TTSLocale>(currentLearningLocale);
  const [readingAttemptId, setReadingAttemptId] = useState<string | null>(null);
  const [readingStartedAt, setReadingStartedAt] = useState<number | null>(null);
  const [readingRecording, setReadingRecording] = useState<Blob | null>(null);
  const [readingSourceType, setReadingSourceType] = useState("TRANSIENT_TEXT");
  const [readingSourceId, setReadingSourceId] = useState<string | null>(null);
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrImportId, setOcrImportId] = useState<string | null>(null);
  const [ocrCandidate, setOcrCandidate] = useState("");
  const [ocrSource, setOcrSource] = useState("");
  const [ocrLocale, setOcrLocale] = useState<TTSLocale>(currentLearningLocale);
  const [ocrScript, setOcrScript] = useState("TRADITIONAL");
  const [adaptivePlan, setAdaptivePlan] = useState<any>(null);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [adaptivePreference, setAdaptivePreference] = useState<AdaptivePreference>("NONE");

  useEffect(() => { setChildId(activeChildId); }, [activeChildId]);
  async function start() { if (!childId) return; const value = await api<{ id: string }>(`/api/recognition/sessions?child_id=${childId}`, { method: "POST" }); setSession(value); await next(value.id); }
  async function next(sessionId = session?.id) { if (childId && sessionId) setItem((await api<{ item: any }>(`/api/recognition/sessions/${sessionId}/next?child_id=${childId}`)).item); }
  async function answer(result: string, assisted = false) { if (!childId || !session || !item) return; await api(`/api/recognition/sessions/${session.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ item_id: item.id, result, assisted }) }); setMessage(`${result}${assisted ? " (assisted)" : ""}`); await next(); }
  async function refreshQueue() { if (childId) setQueue(await api<any[]>(`/api/daily-queue?child_id=${childId}`)); }
  async function addSchool() { if (!childId) return; await api(`/api/school-queue?child_id=${childId}`, { method: "POST", body: JSON.stringify({ character: schoolCharacter, school_source: schoolSource, private_content: true, provenance_status: "PRIVATE_OK" }) }); setSchoolCharacter(""); setSchoolSource(""); await refreshQueue(); }
  async function makeTest() { if (childId) setTest(await api<any>(`/api/weekly-tests?child_id=${childId}`, { method: "POST" })); }
  async function submitTest() { if (childId && test) setMessage(JSON.stringify(await api<any>(`/api/weekly-tests/${test.id}/submit?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answers }) }))); }
  async function refreshPoints() { if (childId) setPoints(await api<any>(`/api/points?child_id=${childId}`)); }
  async function redeem(id: string) { if (childId) { await api(`/api/points/redeem/${id}?child_id=${childId}`, { method: "POST" }); await refreshPoints(); } }
  async function seedB() { if (childId) { const seeded = await api<any>(`/api/sprint-b/seed?child_id=${childId}`, { method: "POST" }); setSprintB(seeded); setPinyinReading(seeded.readings.find((reading: any) => reading.character === "学" && reading.script === "SIMPLIFIED" && reading.notation_system === "PINYIN")); setMessage("Sprint B sample content ready"); } }
  async function practiceWord(id: string, assisted = false) { if (childId) { setSprintB((current: any) => current); await api(`/api/sprint-b/words/${id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ result: "correct", assisted }) }); setMessage(`Word practice${assisted ? " (assisted)" : ""}`); } }
  async function practiceSentence(sentence: any) { if (childId) { await api(`/api/sprint-b/sentences/${sentence.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: sentence.sentence }) }); setMessage("Sentence practice recorded"); } }
  async function practiceWriting() { if (childId) { await api(`/api/sprint-b/writing/attempts?child_id=${childId}&character=學`, { method: "POST", body: JSON.stringify(hanziWriterTraceEvent()) }); setMessage("Hanzi Writer trace recorded; no handwriting quality claim"); } }
  async function submitPinyin() { if (childId && pinyinReading) { const result = await api<any>(`/api/sprint-b/pronunciation/${pinyinReading.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: pinyinInput }) }); setPinyinFeedback(result.correct ? "Correct" : "Try again"); } }
  async function speak(text: string, textKind: TTSTextKind, locale = ttsLocale) { try { const payload = await api<any>("/api/tts/speak", { method: "POST", body: JSON.stringify({ text, text_kind: textKind, locale, rate: ttsRate }) }); ttsProvider.speak(payload); setMessage(`TTS played (${locale}, ${ttsRate}x)`); } catch (error) { setMessage(error instanceof Error ? error.message : "TTS unavailable"); } }
  async function startReadingAloud() {
    if (!childId || !readingText.trim()) return;
    try {
      const attempt = await api<any>(`/api/reading-aloud/attempts/start?child_id=${childId}`, { method: "POST", body: JSON.stringify({ text: readingText, text_kind: readingKind, locale: readingLocale, source_type: readingSourceType, source_id: readingSourceId }) });
      try { await readingAloudRecorder.start(); } catch (error) { await api(`/api/reading-aloud/attempts/${attempt.id}/abort?child_id=${childId}`, { method: "POST", body: "{}" }); throw error; }
      setReadingAttemptId(attempt.id); setReadingStartedAt(Date.now()); setMessage("Microphone recording started");
    } catch (error) { setMessage(error instanceof Error ? error.message : "microphone_unavailable"); }
  }
  async function stopReadingAloud() {
    if (!childId || !readingAttemptId) return;
    try {
      const recording = await readingAloudRecorder.stop();
      setReadingRecording(recording);
      await api(`/api/reading-aloud/attempts/${readingAttemptId}/complete?child_id=${childId}`, { method: "POST", body: JSON.stringify({ duration_ms: readingStartedAt ? Date.now() - readingStartedAt : null }) });
      setMessage("Reading aloud attempt completed; audio remains local only");
    } catch (error) { setMessage(error instanceof Error ? error.message : "recording_failed"); }
  }
  async function replayReadingAloud() { try { await readingAloudRecorder.replay(); setMessage("Replayed local recording"); } catch (error) { setMessage(error instanceof Error ? error.message : "recording_replay_failed"); } }
  function deleteReadingAloud() { readingAloudRecorder.delete(); setReadingRecording(null); setMessage("Local recording deleted; durable attempt metadata retained"); }
  async function runOCR() { if (!childId || !ocrImage || !ocrSource.trim()) { setMessage("Choose an image and source/title first"); return; } try { const candidate = await ocrProvider.recognize(ocrImage); const saved = await api<any>(`/api/ocr/imports/candidate?child_id=${childId}`, { method: "POST", body: JSON.stringify({ image_name: ocrImage.name, source_label: ocrSource, provider_id: candidate.provider_id, candidate_hint: candidate.text }) }); setOcrImportId(saved.id); setOcrCandidate(saved.candidate_text); setMessage("OCR candidate ready for parent review; nothing added to School Queue yet"); } catch (error) { setMessage(error instanceof Error ? error.message : "ocr_unavailable"); } }
  async function confirmOCR() { if (!childId || !ocrImportId) return; try { await api(`/api/ocr/imports/${ocrImportId}/confirm?child_id=${childId}`, { method: "POST", body: JSON.stringify(buildOCRConfirmPayload(ocrCandidate, ocrLocale, ocrScript as "TRADITIONAL" | "SIMPLIFIED")) }); setMessage("Confirmed private School Queue OCR import"); } catch (error) { setMessage(error instanceof Error ? error.message : "ocr_confirmation_failed"); } }
  function resetOCR() { const reset = resetOCRLocalState(); setOcrImage(reset.image); setOcrImportId(reset.importId); setOcrCandidate(reset.candidate); setOcrSource(""); setMessage("OCR image, candidate, and import state reset locally"); }
  async function refreshAdaptive() { if (!childId) return; try { const asOf = new Date().toISOString(); const plan = await api<any>(`/api/adaptive/plan?child_id=${childId}`, { method: "POST", body: JSON.stringify(buildAdaptiveRequest(asOf, 10, adaptiveEnabled, adaptivePreference)) }); setAdaptivePlan(plan); setMessage(`Adaptive plan refreshed at ${plan.as_of}`); } catch (error) { setMessage(error instanceof Error ? error.message : "adaptive_plan_failed"); } }
  async function practicePronunciation(reading: any) { if (childId) await api(`/api/sprint-b/pronunciation/${reading.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: reading.notation, assisted: false }) }); }
  async function practiceGrammar(exercise: any) { if (childId) await api(`/api/sprint-b/grammar/${exercise.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: exercise.answer_rule }) }); }
  async function practiceIdiom(idiom: any) { if (childId) await api(`/api/sprint-b/idioms/${idiom.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: idiom.meaning }) }); }
  async function practiceReading(passage: any) { if (childId) { const result = await api<any>(`/api/sprint-b/reading/passages/${passage.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answers: { [passage.question_id]: passage.answer_rule } }) }); setMessage(`Reading score ${result.score}/${result.total}`); } }

  return <main className="practice-content" aria-label="Chinese practice activities"><header><p className="eyebrow">Practice</p><h1>TongXuan Chinese</h1><p>Choose a short activity to practice Chinese.</p></header>
    <section className="card"><h2>認字小挑戰 · Character challenge</h2><button onClick={start} disabled={!childId}>Start a quick round</button>{item && <div><h3>認一認：{item.character}</h3><button onClick={() => speak(item.character, "character", "zh-TW")}>🔊 Listen</button><button onClick={() => answer("correct")}>Correct</button><button onClick={() => answer("incorrect")}>Incorrect</button><button onClick={() => answer("correct", true)}>Hint / assisted</button></div>}</section>
    <section className="card"><h2>聽中文 · Listen to Chinese</h2><label>Locale <select value={ttsLocale} onChange={(event) => setTtsLocale(event.target.value as TTSLocale)}><option value="zh-TW">繁體中文 · zh-TW</option><option value="zh-CN">简体中文 · zh-CN</option></select></label><label>Speed <input aria-label="TTS speed" type="range" min="0.5" max="2" step="0.1" value={ttsRate} onChange={(event) => setTtsRate(Number(event.target.value))} /> {ttsRate.toFixed(1)}x</label><button onClick={() => ttsProvider.cancel()}>Stop TTS</button><small>TTS only plays transient browser speech; it does not write mastery or scoring state.</small></section>
    <section className="card"><h2>朗讀練習 · Read aloud</h2><p>Listen to a reference, record your reading, replay it locally, then discard it. No pronunciation score is inferred.</p><input aria-label="Reading aloud text" value={readingText} onChange={(event) => setReadingText(event.target.value)} /><select aria-label="Reading aloud kind" value={readingKind} onChange={(event) => setReadingKind(event.target.value as ReadingAloudTextKind)}><option value="character">Character</option><option value="word">Word</option><option value="sentence">Sentence</option><option value="passage">Reading passage</option></select><select aria-label="Reading aloud locale" value={readingLocale} onChange={(event) => setReadingLocale(event.target.value as TTSLocale)}><option value="zh-TW">繁體中文 · zh-TW</option><option value="zh-CN">简体中文 · zh-CN</option></select><select aria-label="Reading aloud source" value={readingSourceId ? `${readingSourceType}:${readingSourceId}` : "TRANSIENT_TEXT"} onChange={(event) => { const [type, id] = event.target.value.split(":"); setReadingSourceType(type); setReadingSourceId(id ?? null); }}><option value="TRANSIENT_TEXT">Typed / transient text</option>{queue.filter((entry) => entry.source === "SCHOOL_QUEUE").map((entry) => <option key={entry.id} value={`SCHOOL_QUEUE:${entry.id}`}>School Queue · {entry.character}</option>)}</select><button onClick={() => speak(readingText, readingKind, readingLocale)}>🔊 Reference listen</button><button onClick={startReadingAloud}>Start recording</button><button onClick={stopReadingAloud}>Stop recording</button><button onClick={replayReadingAloud} disabled={!readingRecording}>Replay recording</button><button onClick={deleteReadingAloud}>Delete/reset recording</button><small>Microphone permission is explicit. Raw audio is transient in this browser session and is never uploaded or saved.</small></section>
    <section className="card"><h2>今天要練習</h2><button onClick={refreshQueue}>Refresh queue</button><ul>{queue.map((entry) => <li key={`${entry.source}-${entry.id}`}>{entry.character} — {entry.source} — {entry.source_detail}</li>)}</ul><input aria-label="school character" value={schoolCharacter} onChange={(e) => setSchoolCharacter(e.target.value)} placeholder="School character" /><input aria-label="school source" value={schoolSource} onChange={(e) => setSchoolSource(e.target.value)} placeholder="School source/title" /><button onClick={addSchool}>Add private school item</button></section>
    <section className="card"><h2>加入學校教材</h2><p>Choose an image locally, review/edit the candidate, then confirm it into private School Queue content. Image bytes are never uploaded by this MVP.</p><input aria-label="OCR image" type="file" accept="image/*" onChange={(event) => setOcrImage(event.target.files?.[0] ?? null)} /><input aria-label="OCR source" value={ocrSource} onChange={(event) => setOcrSource(event.target.value)} placeholder="Source/title" /><button onClick={runOCR}>Run OCR</button><textarea aria-label="OCR candidate text" value={ocrCandidate} onChange={(event) => setOcrCandidate(event.target.value)} placeholder="Editable OCR candidate" /><select aria-label="OCR locale" value={ocrLocale} onChange={(event) => setOcrLocale(event.target.value as TTSLocale)}><option value="zh-TW">繁體中文 · zh-TW</option><option value="zh-CN">简体中文 · zh-CN</option></select><select aria-label="OCR script" value={ocrScript} onChange={(event) => setOcrScript(event.target.value)}><option value="TRADITIONAL">Traditional</option><option value="SIMPLIFIED">Simplified</option></select><button onClick={confirmOCR} disabled={!ocrImportId}>Confirm to private School Queue</button><button onClick={resetOCR}>Cancel/reset</button><small>OCR output is only a candidate until parent confirmation; commercial-ready remains false.</small></section>
    <section className="card"><h2>下一個推薦練習</h2><p>Deterministic practice ordering only; it reads existing state and never rewrites mastery.</p><label><input type="checkbox" checked={adaptiveEnabled} onChange={(event) => setAdaptiveEnabled(event.target.checked)} /> Adaptive ordering</label><label>Preference <select value={adaptivePreference} onChange={(event) => setAdaptivePreference(event.target.value as AdaptivePreference)}><option value="NONE">No preference</option><option value="SCHOOL_QUEUE">Prefer School Queue</option><option value="CURRICULUM">Prefer Curriculum</option><option value="REVIEW">Prefer Review</option></select></label><button onClick={refreshAdaptive}>Refresh adaptive plan</button>{adaptivePlan && <><small>as_of: {adaptivePlan.as_of} · {adaptivePlan.adaptive ? "adaptive" : "deterministic fallback"}</small><ol>{adaptivePlan.items.map((entry: any) => <li key={`${entry.source}-${entry.source_id}`}><strong>{entry.text}</strong> · {entry.source} · {entry.skill} · score {entry.priority_score}<br /><small>{explainAdaptiveReasons(entry.reasons)}</small></li>)}</ol></>}</section>
    <section className="card"><h2>每週小挑戰</h2><button onClick={makeTest}>Generate deterministic test</button>{test?.items?.map((entry: any) => <label key={entry.id}><small>{entry.skill}</small> {entry.prompt ?? entry.character}<input aria-label={`${entry.skill} answer`} onChange={(e) => setAnswers((current) => ({ ...current, [entry.id]: e.target.value }))} /></label>)}{test && <button onClick={submitTest}>Submit test</button>}</section>
    <section className="card"><h2>星星與獎勵</h2><button onClick={refreshPoints}>Refresh points</button>{points && <><p>Balance: {points.balance}</p><ul>{points.ledger.map((entry: any) => <li key={entry.id}>{entry.reason}: {entry.points_delta}</li>)}</ul>{points.rewards.map((reward: any) => <button key={reward.id} onClick={() => redeem(reward.id)}>Redeem {reward.name} ({reward.cost})</button>)}</>}</section>
    <section className="card"><h2>更多中文練習</h2><button onClick={seedB}>Load practice activities</button>{sprintB && <div>
      <h3>Words + Sentences</h3><p>{sprintB.words.length} words / {sprintB.sentences.length} sentences</p>{sprintB.words.map((word: any) => <span key={word.id}><button onClick={() => practiceWord(word.id)}>Practice {word.word}</button><button onClick={() => speak(word.word, "word")}>🔊</button></span>)}{sprintB.sentences.map((sentence: any) => <span key={sentence.id}><button onClick={() => practiceSentence(sentence)}>Practice sentence</button><button onClick={() => speak(sentence.sentence, "sentence")}>🔊</button></span>)}
      <h3>Writing</h3><button onClick={practiceWriting}>Trace 學 (deterministic manual result)</button>
      <h3>Traditional Zhuyin</h3>{sprintB.readings.filter((reading: any) => reading.script === "TRADITIONAL").map((reading: any) => <button key={reading.id} onClick={() => practicePronunciation(reading)}>學 · {reading.notation_system}: {reading.notation}</button>)}
      <h3>Simplified Pinyin</h3>{pinyinReading && <div><p>Prompt ({pinyinReading.script}): <strong>{pinyinReading.character}</strong>{pinyinReading.context && ` · ${pinyinReading.context}`}</p><select aria-label="Pinyin target reading" value={pinyinReading.id} onChange={(event) => setPinyinReading(sprintB.readings.find((reading: any) => reading.id === event.target.value))}>{sprintB.readings.filter((reading: any) => reading.script === "SIMPLIFIED" && reading.notation_system === "PINYIN").map((reading: any) => <option key={reading.id} value={reading.id}>{reading.character} {reading.context || "general"}</option>)}</select><input aria-label="Pinyin answer" value={pinyinInput} onChange={(event) => setPinyinInput(event.target.value)} placeholder="Type pinyin, e.g. xue2" /><button onClick={submitPinyin}>Submit Pinyin</button><span role="status">{pinyinFeedback}</span></div>}
      <h3>Grammar</h3>{sprintB.grammar.map((exercise: any) => <button key={exercise.id} onClick={() => practiceGrammar(exercise)}>Practice {exercise.concept}</button>)}
      <h3>Idioms</h3>{sprintB.idioms.map((idiom: any) => <button key={idiom.id} onClick={() => practiceIdiom(idiom)}>{idiom.id}</button>)}
      <h3>Reading</h3>{sprintB.passages.map((passage: any) => <span key={passage.id}><button onClick={() => practiceReading(passage)}>Read {passage.title}</button><button onClick={() => speak(passage.passage, "passage")}>🔊</button></span>)}
    </div>}</section><p role="status">{message}</p></main>;
}
