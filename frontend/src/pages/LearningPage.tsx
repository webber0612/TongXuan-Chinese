import { useEffect, useState } from "react";
import { nextQueueItem, scoreAnswers } from "../lib/learning";

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

  return <main><header><p className="eyebrow">FAST TRACK SPRINT A · PHASE 1–4</p><h1>TongXuan Chinese</h1><p>Recognition、School Queue、Weekly Test 與 Points 的最小家庭流程。</p></header>
    <section className="card"><h2>Child selection</h2><select value={childId ?? ""} onChange={(event) => setChildId(Number(event.target.value))}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><button onClick={seed}>Seed sample curriculum</button><button onClick={start}>Start recognition session</button>{item && <div><h3>Recognize: {item.character}</h3><button onClick={() => answer("correct")}>Correct</button><button onClick={() => answer("incorrect")}>Incorrect</button><button onClick={() => answer("correct", true)}>Hint / assisted</button></div>}</section>
    <section className="card"><h2>Daily Queue / School Queue</h2><button onClick={refreshQueue}>Refresh queue</button><ul>{queue.map((entry) => <li key={`${entry.source}-${entry.id}`}>{entry.character} — {entry.source} — {entry.source_detail}</li>)}</ul><input aria-label="school character" value={schoolCharacter} onChange={(e) => setSchoolCharacter(e.target.value)} placeholder="School character" /><input aria-label="school source" value={schoolSource} onChange={(e) => setSchoolSource(e.target.value)} placeholder="School source/title" /><button onClick={addSchool}>Add private school item</button></section>
    <section className="card"><h2>Weekly Test</h2><button onClick={makeTest}>Generate deterministic test</button>{test?.items?.map((entry: any) => <label key={entry.id}>{entry.character}<input onChange={(e) => setAnswers((current) => ({ ...current, [entry.id]: e.target.value }))} /></label>)}{test && <button onClick={submitTest}>Submit test</button>}</section>
    <section className="card"><h2>Points & Rewards</h2><button onClick={refreshPoints}>Refresh points</button>{points && <><p>Balance: {points.balance}</p><ul>{points.ledger.map((entry: any) => <li key={entry.id}>{entry.reason}: {entry.points_delta}</li>)}</ul>{points.rewards.map((reward: any) => <button key={reward.id} onClick={() => redeem(reward.id)}>Redeem {reward.name} ({reward.cost})</button>)}</>}</section><p role="status">{message}</p></main>;
}
