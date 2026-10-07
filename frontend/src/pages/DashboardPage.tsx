import { useEffect, useRef, useState } from "react";
import { buildDashboardPath, buildLearningFlowReportPath, DASHBOARD_SKILLS, dashboardRange, dashboardWindowLabel, DashboardWindow, LearningFlowReport } from "../lib/dashboard";
import { apiFetch } from "../lib/apiFetch";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };

async function api<T>(path: string): Promise<T> {
  const response = await apiFetch(`${API}${path}`);
  if (!response.ok) {
    let detail = "Request failed";
    try {
      const data = await response.json();
      detail = data.detail ?? detail;
    } catch {
      detail = `HTTP ${response.status}`;
    }
    throw new Error(detail);
  }
  return response.json();
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

function displayLabel(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DashboardPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [window, setWindow] = useState<DashboardWindow>("7d");
  const [dashboard, setDashboard] = useState<any>(null);
  const [learningReport, setLearningReport] = useState<LearningFlowReport | null>(null);
  const [error, setError] = useState("");
  const [learningFlowError, setLearningFlowError] = useState("");
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const requestSerial = useRef(0);

  async function refresh(id = childId, selectedWindow = window) {
    if (!id) return;
    const serial = ++requestSerial.current;
    const { fromAt, toAt } = dashboardRange(selectedWindow);
    setReportLoading(true); setError(""); setLearningFlowError(""); setDashboard(null); setLearningReport(null);
    const [activityResult, flowResult] = await Promise.allSettled([
      api<any>(buildDashboardPath(id, selectedWindow, fromAt, toAt)),
      api<LearningFlowReport>(buildLearningFlowReportPath(id, fromAt, toAt)),
    ]);
    if (serial !== requestSerial.current) return;
    if (activityResult.status === "fulfilled") setDashboard(activityResult.value);
    else { setDashboard(null); setError(errorMessage(activityResult.reason, "dashboard_failed")); }
    if (flowResult.status === "fulfilled") setLearningReport(flowResult.value);
    else { setLearningReport(null); setLearningFlowError(errorMessage(flowResult.reason, "learning_report_failed")); }
    setReportLoading(false);
  }
  async function loadChildren() {
    setChildrenLoading(true); setChildrenError("");
    try {
      const value = await api<Child[]>("/api/children");
      setChildren(value);
      if (value[0]) { setChildId(value[0].id); void refresh(value[0].id, window); }
    } catch (value) {
      try {
        const raw = localStorage.getItem("tongxuan_learners_list");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const localList: Child[] = parsed.map((item: any, idx: number) => ({
              id: typeof item.id === "number" ? item.id : idx + 1,
              name: item.name || `學習者 ${idx + 1}`
            }));
            setChildren(localList);
            setChildId(localList[0].id);
            setChildrenError("");
            setChildrenLoading(false);
            return;
          }
        }
      } catch {}
      setChildrenError(value instanceof Error ? value.message : "children_failed");
    }
    finally { setChildrenLoading(false); }
  }
  useEffect(() => { void loadChildren(); return () => { requestSerial.current += 1; }; }, []);

  return <main><header><p className="eyebrow">PHASE 15 · READ-ONLY FAMILY VIEW</p><h1>Parent Dashboard</h1><p>Event-based summaries only. Viewing this page does not create attempts or change learning state.</p></header>
    <section className="card"><h2>Child and time window</h2>{childrenLoading && <p role="status">正在載入孩子名單…</p>}{!childrenLoading && childrenError && <p className="field-error" role="alert">{childrenError} <button className="button button-text" onClick={() => void loadChildren()}>重試</button></p>}{!childrenLoading && !childrenError && children.length === 0 && <div className="empty-state"><div><h3>目前沒有可查看的孩子</h3><p>請先建立家庭成員，再回到這裡查看進度。</p></div><button className="button button-secondary" onClick={() => void loadChildren()}>重新載入</button></div>}{children.length > 0 && <><select aria-label="Dashboard child" value={childId ?? ""} onChange={(event) => { const id = Number(event.target.value); setChildId(id); void refresh(id, window); }}>{children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}</select><select aria-label="Dashboard time window" value={window} onChange={(event) => { const value = event.target.value as DashboardWindow; setWindow(value); void refresh(childId, value); }}><option value="7d">{dashboardWindowLabel("7d")}</option><option value="30d">{dashboardWindowLabel("30d")}</option><option value="all">{dashboardWindowLabel("all")}</option></select><button onClick={() => void refresh()} disabled={reportLoading}>{reportLoading ? "Loading…" : "Refresh report"}</button></>}{reportLoading && <p role="status">正在更新只讀報告…</p>}{dashboard && <small>Events through {dashboard.window.to}; no cumulative-state inference.</small>}{error && <p role="alert">{error}</p>}</section>
    {dashboard && <>
      <section className="grid">{[["Attempts", dashboard.activity.attempts.attempts], ["Correct", dashboard.activity.attempts.independent_correct], ["Incorrect", dashboard.activity.attempts.incorrect], ["Assisted", dashboard.activity.attempts.assisted], ["Active School Queue", dashboard.school_queue.active], ["Due School Queue", dashboard.school_queue.due], ["Review", dashboard.activity.review_count]].map(([label, value]) => <div className="result" key={label as string}><strong>{label}</strong><span>{value}</span></div>)}</section>
      <section className="card"><h2>Skill summary</h2><div className="grid">{DASHBOARD_SKILLS.map((skill) => { const summary = dashboard.skills[skill]; return <div className="result" key={skill}><strong>{skill}</strong><span>{summary.attempts} attempts · {summary.independent_correct} independent correct · {summary.incorrect} incorrect · {summary.assisted} assisted</span><small>{summary.distinct_practiced_items} distinct items · last {summary.last_practiced ?? "never"}</small></div>; })}</div></section>
      <section className="card"><h2>School Queue</h2><p>{dashboard.school_queue.active} active · {dashboard.school_queue.completed} completed · {dashboard.school_queue.due} due</p><ul>{dashboard.school_queue.items.map((item: any) => <li key={item.id}>{item.source} {item.due_date ? `· due ${item.due_date}` : ""} · {item.private_content ? "private" : "shared"} · {item.provenance_status}</li>)}</ul></section>
      <section className="card" id="weekly-tests"><h2>Weekly Practice · activity points</h2><p>{dashboard.weekly_tests.history.length} practice reviews</p><ul>{dashboard.weekly_tests.history.map((test: any) => <li key={test.id}>{test.created_at} · {test.practice_points ?? "—"}/{test.total} activity points · missed {test.missed_items.length}</li>)}</ul></section>
      <section className="card"><h2>Points & Rewards</h2><p>Balance: {dashboard.points_rewards.balance}</p><ul>{dashboard.points_rewards.ledger.map((entry: any) => <li key={entry.id}>{entry.timestamp} · {entry.reason} · {entry.points_delta}</li>)}</ul></section>
      <section className="card"><h2>Reading Aloud</h2><p>{dashboard.reading_aloud.attempts} attempts · {dashboard.reading_aloud.completed} completed · {dashboard.reading_aloud.aborted} aborted</p><ul>{dashboard.reading_aloud.items.map((item: any) => <li key={item.id}>{item.started_at} · {item.locale} · {item.text_kind} · {item.duration_ms ?? "—"}ms</li>)}</ul></section>
      <section className="card"><h2>OCR Imports</h2><p>{dashboard.ocr.candidates} candidates · {dashboard.ocr.confirmed} confirmed</p><ul>{dashboard.ocr.items.map((item: any) => <li key={item.id}>{item.source_label} · {item.locale}/{item.script} · {item.review_status} · commercial_ready={String(Boolean(item.commercial_ready))}</li>)}</ul></section>
      <section className="card"><h2>Adaptive Learning</h2><p>Read-only on-demand plan at {dashboard.activity.adaptive.as_of}</p><ol>{dashboard.activity.adaptive.items.map((item: any) => <li key={`${item.source}-${item.source_id}`}>{item.text} · {item.source} · {item.skill} · score {item.ranking_score} · {item.reasons.join(", ")}</li>)}</ol></section>
    </>}
    {learningReport && <section className="card" aria-labelledby="learning-progress-title">
      <h2 id="learning-progress-title">Learning progress</h2>
      <p>Authoritative learning-flow report through {learningReport.to}.</p>
      <div className="grid">
        <div className="result"><strong>Learning sessions</strong><span>{learningReport.sessions.length}</span></div>
        <div className="result"><strong>Mastery states</strong><span>{learningReport.masteryChanges.length}</span></div>
        <div className="result"><strong>Due reviews</strong><span>{Object.values(learningReport.reviewDueCounts).reduce((total, count) => total + count, 0)}</span></div>
      </div>
      <h3>Recent learning sessions</h3>
      {learningReport.sessions.length === 0 ? <p role="status">No learning sessions in this period.</p> : <>
        {learningReport.sessions.length > 10 && <small>Showing the 10 most recent sessions.</small>}
        <ul>{learningReport.sessions.slice(-10).reverse().map((session) => <li key={session.sessionId}>
          <strong>{displayLabel(session.lessonId)}</strong> · {displayLabel(session.status)} · {session.durationSeconds}s · {session.taskCount} tasks · {session.deferredCount} deferred
          <small>Mastery gate: {session.masteryStatus ? displayLabel(session.masteryStatus) : "Not reached"}</small>
        </li>)}</ul>
      </>}
      <h3>Tasks by type</h3>
      {Object.keys(learningReport.taskCounts).length === 0 ? <p>No learning-flow tasks in this period.</p> : <ul>{Object.entries(learningReport.taskCounts).map(([task, count]) => <li key={task}>{displayLabel(task)} · {count}</li>)}</ul>}
      <h3>Needs practice</h3>
      {Object.keys(learningReport.weakDomains).length === 0 && Object.keys(learningReport.deferredTasks).length === 0 ? <p>No missed or deferred learning-flow tasks in this period.</p> : <ul>
        {Object.entries(learningReport.weakDomains).map(([domain, count]) => <li key={`weak-${domain}`}>{displayLabel(domain)} · {count} incorrect attempts</li>)}
        {Object.entries(learningReport.deferredTasks).map(([reason, count]) => <li key={`deferred-${reason}`}>{displayLabel(reason)} · {count} deferred tasks</li>)}
      </ul>}
      {learningReport.privacy.rawAudioStored === false && <small>Raw audio is not stored.</small>}
    </section>}
    {learningFlowError && <section className="card" aria-labelledby="learning-progress-error-title"><h2 id="learning-progress-error-title">Learning progress</h2><p role="alert">{learningFlowError}</p><button onClick={() => void refresh()} disabled={reportLoading}>Retry learning progress</button></section>}
  </main>;
}
