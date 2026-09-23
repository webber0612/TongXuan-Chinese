import { useEffect, useState } from "react";
import { buildTutorPath, TUTOR_MODES, TutorMode, tutorModeLabel } from "../lib/tutor";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function TutorPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [mode, setMode] = useState<TutorMode>("explain");
  const [sourceId, setSourceId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => { void api<Child[]>("/api/children").then((value) => { setChildren(value); if (value[0]) setChildId(value[0].id); }); }, []);
  async function ask() {
    if (!childId || !prompt.trim()) return;
    try { setError(""); setResult(await api<any>(buildTutorPath(childId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, prompt, source_type: sourceId ? "CURRICULUM_ITEM" : null, source_id: sourceId || null }) })); }
    catch (value) { setError(value instanceof Error ? value.message : "tutor_failed"); }
  }

  return <main><header><p className="eyebrow">PHASE 17 · OPTIONAL AI TUTOR</p><h1>Grounded Tutor</h1><p>Retrieval-first guidance only. The tutor never scores, answers, changes mastery, or changes adaptive ranking.</p></header>
    <section className="card"><h2>Child and source</h2><select aria-label="Tutor child" value={childId ?? ""} onChange={(event) => setChildId(Number(event.target.value))}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><input aria-label="Tutor curriculum item" value={sourceId} onChange={(event) => setSourceId(event.target.value)} placeholder="Curriculum item ID" /><select aria-label="Tutor mode" value={mode} onChange={(event) => setMode(event.target.value as TutorMode)}>{TUTOR_MODES.map((item) => <option key={item} value={item}>{tutorModeLabel(item)}</option>)}</select><input aria-label="Tutor prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask for a grounded explanation" /><button onClick={() => void ask()}>Ask tutor</button>{error && <p role="alert">{error}</p>}</section>
    {result && <section className="card"><h2>{tutorModeLabel(result.mode)}</h2><p>{result.response}</p>{result.source && <small>Source: {result.source.source_name} · {result.source.license_name} · {result.source.provenance_status}</small>}<p>Safety: no correctness decision, answer key, scoring, mastery mutation, or adaptive ranking.</p></section>}
  </main>;
}
