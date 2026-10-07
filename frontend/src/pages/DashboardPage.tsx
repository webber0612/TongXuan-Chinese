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
    if (!API && import.meta.env.MODE !== "test") {
      setReportLoading(false);
      return;
    }
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
      if (API || import.meta.env.MODE === "test") {
        const value = await api<Child[]>("/api/children");
        setChildren(value);
        if (value[0]) { setChildId(value[0].id); void refresh(value[0].id, window); }
        return;
      }
      throw new Error("offline");
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
      if (API || import.meta.env.MODE === "test") {
        setChildrenError(value instanceof Error ? value.message : "children_failed");
      }
    }
    finally { setChildrenLoading(false); }
  }
  useEffect(() => { void loadChildren(); return () => { requestSerial.current += 1; }; }, []);

  return (
    <main className="parent-dashboard-main">
      <header className="parent-dashboard-header-card">
        <div className="parent-header-badge-row">
          <span className="badge-pill">📊 學習歷程數據看板</span>
          <span className="badge-meta-pill">唯讀監控模式</span>
        </div>
        <h1>學習歷程報告 · 數據看板</h1>
        <p className="parent-header-desc">
          即時彙整孩子在各學習維度的作答成效、精熟軌跡與練習點數記錄。此專區為唯讀報告，不會影響孩子的連勝紀錄。（Parent Dashboard）
        </p>
      </header>

      <section className="card parent-filter-card">
        <div className="filter-card-header">
          <h2>Child and time window</h2>
          <small>請選擇欲檢視的孩子與統計時段</small>
        </div>

        {childrenLoading && <p role="status" className="filter-status-msg">正在載入孩子名單…</p>}
        {!childrenLoading && childrenError && (
          <p className="field-error filter-status-msg" role="alert">
            {childrenError}{" "}
            <button className="button button-text" onClick={() => void loadChildren()}>
              重試
            </button>
          </p>
        )}
        {!childrenLoading && !childrenError && children.length === 0 && (
          <div className="empty-state">
            <div>
              <h3>目前沒有可查看的孩子</h3>
              <p>請先建立家庭成員，再回到這裡查看進度。</p>
            </div>
            <button className="button button-secondary" onClick={() => void loadChildren()}>
              重新載入
            </button>
          </div>
        )}

        {children.length > 0 && (
          <div className="parent-controls-toolbar">
            <div className="select-group">
              <label htmlFor="dashboard-child-select">🧒 學習者：</label>
              <select
                id="dashboard-child-select"
                aria-label="Dashboard child"
                className="parent-select-control"
                value={childId ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  setChildId(id);
                  void refresh(id, window);
                }}
              >
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-group">
              <label htmlFor="dashboard-window-select">📅 區間：</label>
              <select
                id="dashboard-window-select"
                aria-label="Dashboard time window"
                className="parent-select-control"
                value={window}
                onChange={(event) => {
                  const value = event.target.value as DashboardWindow;
                  setWindow(value);
                  void refresh(childId, value);
                }}
              >
                <option value="7d">{dashboardWindowLabel("7d")}</option>
                <option value="30d">{dashboardWindowLabel("30d")}</option>
                <option value="all">{dashboardWindowLabel("all")}</option>
              </select>
            </div>

            <button
              className="button button-primary refresh-report-btn"
              onClick={() => void refresh()}
              disabled={reportLoading}
            >
              {reportLoading ? "Loading…" : "Refresh report"}
            </button>
          </div>
        )}

        {reportLoading && <p role="status" className="filter-status-msg">正在更新只讀報告…</p>}
        {dashboard && (
          <div className="dashboard-meta-footer">
            <small>Events through {dashboard.window.to}; no cumulative-state inference.</small>
          </div>
        )}
        {error && <p role="alert" className="field-error">{error}</p>}
      </section>

      {dashboard && (
        <>
          <section className="grid parent-stats-kpi-grid">
            {[
              ["Attempts", dashboard.activity.attempts.attempts, "🎯", "作答總次數"],
              ["Correct", dashboard.activity.attempts.independent_correct, "✅", "獨立正確答對"],
              ["Incorrect", dashboard.activity.attempts.incorrect, "❌", "需加強複習"],
              ["Assisted", dashboard.activity.attempts.assisted, "💡", "獲得提示作答"],
              ["Active School Queue", dashboard.school_queue.active, "🎒", "學校進行中作業"],
              ["Due School Queue", dashboard.school_queue.due, "⏰", "學校待交作業"],
              ["Review", dashboard.activity.review_count, "🔄", "待螺旋複習次數"],
            ].map(([label, value, icon, zhLabel]) => (
              <div className="result stat-kpi-tile" key={label as string}>
                <div className="tile-top-row">
                  <span className="tile-icon">{icon}</span>
                  <strong>{label}</strong>
                </div>
                <span>{value}</span>
                <small>{zhLabel}</small>
              </div>
            ))}
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">🀄</span>
              <div>
                <h2>Skill summary</h2>
                <small>九大中文核心能力評估指標</small>
              </div>
            </div>
            <div className="grid skills-summary-grid">
              {DASHBOARD_SKILLS.map((skill) => {
                const summary = dashboard.skills[skill];
                return (
                  <div className="result skill-kpi-item" key={skill}>
                    <div className="skill-item-header">
                      <strong>{skill}</strong>
                    </div>
                    <span className="skill-item-stats">
                      {summary.attempts} attempts · {summary.independent_correct} independent correct ·{" "}
                      {summary.incorrect} incorrect · {summary.assisted} assisted
                    </span>
                    <small className="skill-item-footer">
                      {summary.distinct_practiced_items} distinct items · last {summary.last_practiced ?? "never"}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">🏫</span>
              <div>
                <h2>School Queue</h2>
                <p>
                  {dashboard.school_queue.active} active · {dashboard.school_queue.completed} completed ·{" "}
                  {dashboard.school_queue.due} due
                </p>
              </div>
            </div>
            <ul className="parent-data-list">
              {dashboard.school_queue.items.map((item: any) => (
                <li key={item.id} className="parent-list-item">
                  <span className="list-item-bullet">📌</span>
                  <span>
                    {item.source} {item.due_date ? `· due ${item.due_date}` : ""} ·{" "}
                    {item.private_content ? "private" : "shared"} · {item.provenance_status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card parent-warm-card" id="weekly-tests">
            <div className="card-section-heading">
              <span className="heading-icon">⭐</span>
              <div>
                <h2>Weekly Practice · activity points</h2>
                <p>{dashboard.weekly_tests.history.length} practice reviews</p>
              </div>
            </div>
            <ul className="parent-data-list">
              {dashboard.weekly_tests.history.map((test: any) => (
                <li key={test.id} className="parent-list-item">
                  <span className="list-item-bullet">📝</span>
                  <span>
                    {test.created_at} · {test.practice_points ?? "—"}/{test.total} activity points · missed{" "}
                    {test.missed_items.length}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">🪙</span>
              <div>
                <h2>Points & Rewards</h2>
                <p>Balance: {dashboard.points_rewards.balance}</p>
              </div>
            </div>
            <ul className="parent-data-list">
              {dashboard.points_rewards.ledger.map((entry: any) => (
                <li key={entry.id} className="parent-list-item">
                  <span className="list-item-bullet">🎁</span>
                  <span>
                    {entry.timestamp} · {entry.reason} · {entry.points_delta}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">🎙️</span>
              <div>
                <h2>Reading Aloud</h2>
                <p>
                  {dashboard.reading_aloud.attempts} attempts · {dashboard.reading_aloud.completed} completed ·{" "}
                  {dashboard.reading_aloud.aborted} aborted
                </p>
              </div>
            </div>
            <ul className="parent-data-list">
              {dashboard.reading_aloud.items.map((item: any) => (
                <li key={item.id} className="parent-list-item">
                  <span className="list-item-bullet">🔊</span>
                  <span>
                    {item.started_at} · {item.locale} · {item.text_kind} · {item.duration_ms ?? "—"}ms
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">📸</span>
              <div>
                <h2>OCR Imports</h2>
                <p>
                  {dashboard.ocr.candidates} candidates · {dashboard.ocr.confirmed} confirmed
                </p>
              </div>
            </div>
            <ul className="parent-data-list">
              {dashboard.ocr.items.map((item: any) => (
                <li key={item.id} className="parent-list-item">
                  <span className="list-item-bullet">📄</span>
                  <span>
                    {item.source_label} · {item.locale}/{item.script} · {item.review_status} · commercial_ready=
                    {String(Boolean(item.commercial_ready))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card parent-warm-card">
            <div className="card-section-heading">
              <span className="heading-icon">🧠</span>
              <div>
                <h2>Adaptive Learning</h2>
                <p>Read-only on-demand plan at {dashboard.activity.adaptive.as_of}</p>
              </div>
            </div>
            <ol className="parent-data-ordered-list">
              {dashboard.activity.adaptive.items.map((item: any) => (
                <li key={`${item.source}-${item.source_id}`} className="parent-ordered-item">
                  <span>
                    {item.text} · {item.source} · {item.skill} · score {item.ranking_score} ·{" "}
                    {item.reasons.join(", ")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {learningReport && (
        <section className="card parent-warm-card" aria-labelledby="learning-progress-title">
          <div className="card-section-heading">
            <span className="heading-icon">📈</span>
            <div>
              <h2 id="learning-progress-title">Learning progress</h2>
              <p>Authoritative learning-flow report through {learningReport.to}.</p>
            </div>
          </div>
          <div className="grid parent-flow-report-grid">
            <div className="result stat-kpi-tile">
              <strong>Learning sessions</strong>
              <span>{learningReport.sessions.length}</span>
            </div>
            <div className="result stat-kpi-tile">
              <strong>Mastery states</strong>
              <span>{learningReport.masteryChanges.length}</span>
            </div>
            <div className="result stat-kpi-tile">
              <strong>Due reviews</strong>
              <span>{Object.values(learningReport.reviewDueCounts).reduce((total, count) => total + count, 0)}</span>
            </div>
          </div>

          <div className="report-sub-block">
            <h3>Recent learning sessions</h3>
            {learningReport.sessions.length === 0 ? (
              <p role="status" className="empty-sub-msg">No learning sessions in this period.</p>
            ) : (
              <>
                {learningReport.sessions.length > 10 && <small>Showing the 10 most recent sessions.</small>}
                <ul className="parent-data-list">
                  {learningReport.sessions.slice(-10).reverse().map((session) => (
                    <li key={session.sessionId} className="parent-list-item session-list-item">
                      <div>
                        <strong>{displayLabel(session.lessonId)}</strong> · {displayLabel(session.status)} ·{" "}
                        {session.durationSeconds}s · {session.taskCount} tasks · {session.deferredCount} deferred
                      </div>
                      <small>Mastery gate: {session.masteryStatus ? displayLabel(session.masteryStatus) : "Not reached"}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="report-sub-block">
            <h3>Tasks by type</h3>
            {Object.keys(learningReport.taskCounts).length === 0 ? (
              <p className="empty-sub-msg">No learning-flow tasks in this period.</p>
            ) : (
              <ul className="parent-data-list">
                {Object.entries(learningReport.taskCounts).map(([task, count]) => (
                  <li key={task} className="parent-list-item">
                    {displayLabel(task)} · {count}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="report-sub-block">
            <h3>Needs practice</h3>
            {Object.keys(learningReport.weakDomains).length === 0 && Object.keys(learningReport.deferredTasks).length === 0 ? (
              <p className="empty-sub-msg">No missed or deferred learning-flow tasks in this period.</p>
            ) : (
              <ul className="parent-data-list">
                {Object.entries(learningReport.weakDomains).map(([domain, count]) => (
                  <li key={`weak-${domain}`} className="parent-list-item weak-item">
                    {displayLabel(domain)} · {count} incorrect attempts
                  </li>
                ))}
                {Object.entries(learningReport.deferredTasks).map(([reason, count]) => (
                  <li key={`deferred-${reason}`} className="parent-list-item deferred-item">
                    {displayLabel(reason)} · {count} deferred tasks
                  </li>
                ))}
              </ul>
            )}
          </div>

          {learningReport.privacy.rawAudioStored === false && (
            <div className="privacy-badge-note">
              <small>Raw audio is not stored.</small>
            </div>
          )}
        </section>
      )}

      {learningFlowError && (
        <section className="card parent-warm-card error-card" aria-labelledby="learning-progress-error-title">
          <div className="card-section-heading">
            <span className="heading-icon">⚠️</span>
            <div>
              <h2 id="learning-progress-error-title">Learning progress</h2>
              <p role="alert" className="field-error">{learningFlowError}</p>
            </div>
          </div>
          <button className="button button-secondary" onClick={() => void refresh()} disabled={reportLoading}>
            Retry learning progress
          </button>
        </section>
      )}
    </main>
  );
}
