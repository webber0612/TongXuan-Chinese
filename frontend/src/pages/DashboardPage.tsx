import { useEffect, useState } from "react";
import { buildDashboardPath, DASHBOARD_SKILLS, dashboardWindowLabel, DashboardWindow } from "../lib/dashboard";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function DashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [window, setWindow] = useState<DashboardWindow>("7d");
  const [dashboard, setDashboard] = useState<any>(null);
  const [error, setError] = useState("");

  async function refresh(id = childId, selectedWindow = window) {
    if (!id) return;
    try { setError(""); setDashboard(await api<any>(buildDashboardPath(id, selectedWindow))); }
    catch (value) { setError(value instanceof Error ? value.message : "dashboard_failed"); }
  }
  useEffect(() => { void api<Child[]>("/api/children").then((value) => { setChildren(value); if (value[0]) { setChildId(value[0].id); void refresh(value[0].id); } }); }, []);

  return <main><header><p className="eyebrow">PHASE 15 · READ-ONLY FAMILY VIEW</p><h1>Parent Dashboard</h1><p>Event-based summaries only. Viewing this page does not create attempts or change learning state.</p></header>
    <section className="card"><h2>Child and time window</h2><select aria-label="Dashboard child" value={childId ?? ""} onChange={(event) => { const id = Number(event.target.value); setChildId(id); void refresh(id); }}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><select aria-label="Dashboard time window" value={window} onChange={(event) => { const value = event.target.value as DashboardWindow; setWindow(value); void refresh(childId, value); }}><option value="7d">{dashboardWindowLabel("7d")}</option><option value="30d">{dashboardWindowLabel("30d")}</option><option value="all">{dashboardWindowLabel("all")}</option></select><button onClick={() => void refresh()}>Refresh report</button>{dashboard && <small>Events through {dashboard.window.to}; no cumulative-state inference.</small>}{error && <p role="alert">{error}</p>}</section>
    {dashboard && <>
      <section className="grid">{[["Attempts", dashboard.activity.attempts.attempts], ["Correct", dashboard.activity.attempts.independent_correct], ["Incorrect", dashboard.activity.attempts.incorrect], ["Assisted", dashboard.activity.attempts.assisted], ["Active School Queue", dashboard.school_queue.active], ["Due School Queue", dashboard.school_queue.due], ["Review", dashboard.activity.review_count]].map(([label, value]) => <div className="result" key={label as string}><strong>{label}</strong><span>{value}</span></div>)}</section>
      <section className="card"><h2>Skill summary</h2><div className="grid">{DASHBOARD_SKILLS.map((skill) => { const summary = dashboard.skills[skill]; return <div className="result" key={skill}><strong>{skill}</strong><span>{summary.attempts} attempts · {summary.independent_correct} independent correct · {summary.incorrect} incorrect · {summary.assisted} assisted</span><small>{summary.distinct_practiced_items} distinct items · last {summary.last_practiced ?? "never"}</small></div>; })}</div></section>
      <section className="card"><h2>School Queue</h2><p>{dashboard.school_queue.active} active · {dashboard.school_queue.completed} completed · {dashboard.school_queue.due} due</p><ul>{dashboard.school_queue.items.map((item: any) => <li key={item.id}>{item.source} {item.due_date ? `· due ${item.due_date}` : ""} · {item.private_content ? "private" : "shared"} · {item.provenance_status}</li>)}</ul></section>
      <section className="card" id="weekly-tests"><h2>Weekly Tests · score lookup</h2><p>{dashboard.weekly_tests.history.length} test records</p><ul>{dashboard.weekly_tests.history.map((test: any) => <li key={test.id}>{test.created_at} · {test.score ?? "—"}/{test.total} · missed {test.missed_items.length}</li>)}</ul></section>
      <section className="card"><h2>Points & Rewards</h2><p>Balance: {dashboard.points_rewards.balance}</p><ul>{dashboard.points_rewards.ledger.map((entry: any) => <li key={entry.id}>{entry.timestamp} · {entry.reason} · {entry.points_delta}</li>)}</ul></section>
      <section className="card"><h2>Reading Aloud</h2><p>{dashboard.reading_aloud.attempts} attempts · {dashboard.reading_aloud.completed} completed · {dashboard.reading_aloud.aborted} aborted</p><ul>{dashboard.reading_aloud.items.map((item: any) => <li key={item.id}>{item.started_at} · {item.locale} · {item.text_kind} · {item.duration_ms ?? "—"}ms</li>)}</ul></section>
      <section className="card"><h2>OCR Imports</h2><p>{dashboard.ocr.candidates} candidates · {dashboard.ocr.confirmed} confirmed</p><ul>{dashboard.ocr.items.map((item: any) => <li key={item.id}>{item.source_label} · {item.locale}/{item.script} · {item.review_status} · commercial_ready={String(Boolean(item.commercial_ready))}</li>)}</ul></section>
      <section className="card"><h2>Adaptive Learning</h2><p>Read-only on-demand plan at {dashboard.activity.adaptive.as_of}</p><ol>{dashboard.activity.adaptive.items.map((item: any) => <li key={`${item.source}-${item.source_id}`}>{item.text} · {item.source} · {item.skill} · score {item.ranking_score} · {item.reasons.join(", ")}</li>)}</ol></section>
    </>}
  </main>;
}
