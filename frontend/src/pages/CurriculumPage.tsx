import { useEffect, useState } from "react";
import { buildCurriculumPath, progressLabel } from "../lib/curriculum";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function CurriculumPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [error, setError] = useState("");

  async function refresh(id = childId) {
    if (!id) return;
    try { setError(""); setCurriculum(await api<any>(buildCurriculumPath(id))); }
    catch (value) { setError(value instanceof Error ? value.message : "curriculum_failed"); }
  }

  useEffect(() => { void api<Child[]>("/api/children").then((value) => { setChildren(value); if (value[0]) { setChildId(value[0].id); void refresh(value[0].id); } }); }, []);

  return <main><header><p className="eyebrow">PHASE 16 · LONG-TERM CURRICULUM</p><h1>Curriculum Progress</h1><p>Shared Level → Unit → Item content with child-scoped progression. Skill mastery remains separate.</p></header>
    <section className="card"><h2>Child</h2><select aria-label="Curriculum child" value={childId ?? ""} onChange={(event) => { const id = Number(event.target.value); setChildId(id); void refresh(id); }}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><button onClick={() => void refresh()}>Refresh curriculum</button>{curriculum && <small>Content visible as of {curriculum.as_of}</small>}{error && <p role="alert">{error}</p>}</section>
    {curriculum && <section className="card"><h2>Progress</h2><p>{curriculum.progress.completed} completed · {curriculum.progress.in_progress} in progress · {curriculum.progress.not_started} not started</p>{curriculum.levels.map((level: any) => <article key={level.id}><h3>{level.title}</h3>{level.units.map((unit: any) => <div key={unit.id}><h4>{unit.title}</h4><ul>{unit.items.map((item: any) => <li key={item.id}><strong>{item.content}</strong> · {progressLabel(item.progress.status)} · {item.source_name} · {item.license_name}</li>)}</ul></div>)}</article>)}</section>}
  </main>;
}
