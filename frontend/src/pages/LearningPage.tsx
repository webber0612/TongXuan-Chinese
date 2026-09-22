import { useEffect, useState } from "react";
import { nextQueueItem, scoreAnswers } from "../lib/learning";
import { hanziWriterTraceEvent } from "../lib/writingProvider";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function LearningPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
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

  useEffect(() => { void api<Child[]>("/api/children").then((value) => { setChildren(value); if (value[0]) setChildId(value[0].id); }); }, []);
  async function seed() { if (childId) { await api(`/api/children/${childId}/learning-items/seed`, { method: "POST", body: "{}" }); setMessage("Sample recognition items ready"); } }
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
  async function practicePronunciation(reading: any) { if (childId) await api(`/api/sprint-b/pronunciation/${reading.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: reading.notation, assisted: false }) }); }
  async function practiceGrammar(exercise: any) { if (childId) await api(`/api/sprint-b/grammar/${exercise.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: exercise.answer_rule }) }); }
  async function practiceIdiom(idiom: any) { if (childId) await api(`/api/sprint-b/idioms/${idiom.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answer: idiom.meaning }) }); }
  async function practiceReading(passage: any) { if (childId) { const result = await api<any>(`/api/sprint-b/reading/passages/${passage.id}/attempts?child_id=${childId}`, { method: "POST", body: JSON.stringify({ answers: { [passage.question_id]: passage.answer_rule } }) }); setMessage(`Reading score ${result.score}/${result.total}`); } }

  return <main><header><p className="eyebrow">FAST TRACK SPRINT A + B · PHASE 1–10</p><h1>TongXuan Chinese</h1><p>Recognition、Words、Writing、Pronunciation、Grammar、Idioms、Reading 與家庭獎勵流程。</p></header>
    <section className="card"><h2>Child selection</h2><select value={childId ?? ""} onChange={(event) => setChildId(Number(event.target.value))}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><button onClick={seed}>Seed sample curriculum</button><button onClick={start}>Start recognition session</button>{item && <div><h3>Recognize: {item.character}</h3><button onClick={() => answer("correct")}>Correct</button><button onClick={() => answer("incorrect")}>Incorrect</button><button onClick={() => answer("correct", true)}>Hint / assisted</button></div>}</section>
    <section className="card"><h2>Daily Queue / School Queue</h2><button onClick={refreshQueue}>Refresh queue</button><ul>{queue.map((entry) => <li key={`${entry.source}-${entry.id}`}>{entry.character} — {entry.source} — {entry.source_detail}</li>)}</ul><input aria-label="school character" value={schoolCharacter} onChange={(e) => setSchoolCharacter(e.target.value)} placeholder="School character" /><input aria-label="school source" value={schoolSource} onChange={(e) => setSchoolSource(e.target.value)} placeholder="School source/title" /><button onClick={addSchool}>Add private school item</button></section>
    <section className="card"><h2>Weekly Test</h2><button onClick={makeTest}>Generate deterministic test</button>{test?.items?.map((entry: any) => <label key={entry.id}>{entry.character}<input onChange={(e) => setAnswers((current) => ({ ...current, [entry.id]: e.target.value }))} /></label>)}{test && <button onClick={submitTest}>Submit test</button>}</section>
    <section className="card"><h2>Points & Rewards</h2><button onClick={refreshPoints}>Refresh points</button>{points && <><p>Balance: {points.balance}</p><ul>{points.ledger.map((entry: any) => <li key={entry.id}>{entry.reason}: {entry.points_delta}</li>)}</ul>{points.rewards.map((reward: any) => <button key={reward.id} onClick={() => redeem(reward.id)}>Redeem {reward.name} ({reward.cost})</button>)}</>}</section>
    <section className="card"><h2>Fast Track Sprint B · Phase 5–10</h2><button onClick={seedB}>Seed auditable Words → Reading samples</button>{sprintB && <div>
      <h3>Words + Sentences</h3><p>{sprintB.words.length} words / {sprintB.sentences.length} sentences</p>{sprintB.words.map((word: any) => <button key={word.id} onClick={() => practiceWord(word.id)}>Practice {word.word}</button>)}{sprintB.sentences.map((sentence: any) => <button key={sentence.id} onClick={() => practiceSentence(sentence)}>Practice sentence</button>)}
      <h3>Writing</h3><button onClick={practiceWriting}>Trace 學 (deterministic manual result)</button>
      <h3>Traditional Zhuyin</h3>{sprintB.readings.filter((reading: any) => reading.script === "TRADITIONAL").map((reading: any) => <button key={reading.id} onClick={() => practicePronunciation(reading)}>學 · {reading.notation_system}: {reading.notation}</button>)}
      <h3>Simplified Pinyin</h3>{pinyinReading && <div><p>Prompt ({pinyinReading.script}): <strong>{pinyinReading.character}</strong>{pinyinReading.context && ` · ${pinyinReading.context}`}</p><select aria-label="Pinyin target reading" value={pinyinReading.id} onChange={(event) => setPinyinReading(sprintB.readings.find((reading: any) => reading.id === event.target.value))}>{sprintB.readings.filter((reading: any) => reading.script === "SIMPLIFIED" && reading.notation_system === "PINYIN").map((reading: any) => <option key={reading.id} value={reading.id}>{reading.character} {reading.context || "general"}</option>)}</select><input aria-label="Pinyin answer" value={pinyinInput} onChange={(event) => setPinyinInput(event.target.value)} placeholder="Type pinyin, e.g. xue2" /><button onClick={submitPinyin}>Submit Pinyin</button><span role="status">{pinyinFeedback}</span></div>}
      <h3>Grammar</h3>{sprintB.grammar.map((exercise: any) => <button key={exercise.id} onClick={() => practiceGrammar(exercise)}>Practice {exercise.concept}</button>)}
      <h3>Idioms</h3>{sprintB.idioms.map((idiom: any) => <button key={idiom.id} onClick={() => practiceIdiom(idiom)}>{idiom.id}</button>)}
      <h3>Reading</h3>{sprintB.passages.map((passage: any) => <button key={passage.id} onClick={() => practiceReading(passage)}>Read {passage.title}</button>)}
    </div>}</section><p role="status">{message}</p></main>;
}
