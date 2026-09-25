import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Check, RefreshCw } from "lucide-react";
import { buildCurriculumPath, progressLabel } from "../lib/curriculum";
import { useLocale } from "../lib/i18n";
import { officialCoursePath, officialCourseSourceNote } from "../data/officialCoursePath";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };
type CurriculumItem = { id: string; content: string; item_type: string; source_name: string; license_name: string; progress: { status: string } };
type CurriculumUnit = { id: string; title: string; sequence: number; items: CurriculumItem[] };
type CurriculumLevel = { id: string; title: string; sequence: number; units: CurriculumUnit[] };
type CurriculumPayload = { as_of: string; progress: { total: number; completed: number; in_progress: number; not_started: number }; levels: CurriculumLevel[] };

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function CurriculumPage({ onOpenCourseZero }: { onOpenCourseZero?: () => void }) {
  const { t } = useLocale();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(id = childId) {
    if (!id) return;
    setLoading(true);
    try {
      setError("");
      setCurriculum(await api<CurriculumPayload>(buildCurriculumPath(id)));
    } catch (value) {
      setError(value instanceof Error ? value.message : "curriculum_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void api<Child[]>("/api/children").then((value) => {
      setChildren(value);
      if (value[0]) {
        setChildId(value[0].id);
        void refresh(value[0].id);
      } else {
        setChildId(null);
        setCurriculum(null);
        setLoading(false);
      }
    }).catch((value) => {
      setError(value instanceof Error ? value.message : "children_failed");
      setLoading(false);
    });
  }, []);

  return <main className="app-page neo-curriculum">
    <header className="neo-page-intro">
      <div className="neo-page-index">02</div>
      <div><p className="neo-overline">{t("library")}</p><h1>{t("curriculumTitle")}</h1><p>{t("curriculumIntro")}</p></div>
    </header>
    <button className="neo-course-zero" aria-labelledby="course-zero-title" onClick={onOpenCourseZero}>
      <span className="neo-course-number">00</span>
      <span><small>START HERE · {officialCoursePath.stages[0].shortTitle}</small><strong id="course-zero-title">{t("courseZeroTitle")}</strong><em>{t("courseZeroDescription")}</em></span>
      <ArrowUpRight />
    </button>
    <section className="neo-path-panel">
      <div className="neo-section-head"><div><p className="neo-overline">OFFICIAL ROUTE</p><h2>{t("officialCourseTitle")}</h2></div><BookOpen /></div>
      <p className="neo-path-note">{officialCourseSourceNote}</p>
      <p className="neo-path-boundary">{officialCoursePath.canonicalHierarchy.map((node) => node.title).join(" → ")} · {t("lessonImportPending")}</p>
      <div className="neo-stage-rail">
        {officialCoursePath.stages.map((stage, index) => <article className="neo-stage" key={stage.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <small>{stage.shortTitle}</small>
            <strong>{stage.title}</strong>
            <p>{stage.description}</p>
            <details>
              <summary>{stage.lessons.length} · {t("sourceRecord")}</summary>
              <ol>
                {stage.lessons.map((lesson) => <li key={lesson.id}>
                  <a href={lesson.official.source.url} target="_blank" rel="noreferrer">{lesson.official.title}</a>
                  <small>{lesson.official.source.book} · {lesson.official.source.lesson}<br />{t("officialObjectivesLabel")}: {lesson.tongxuan.handbookSummary.text}<br />{t("practiceTargetsLabel")}: {lesson.tongxuan.practiceTargets.join("；")} · {t("lessonImportPending")}</small>
                  {lesson.tongxuan.handbookSummary.sourceUrl && <a className="neo-objective-source" href={lesson.tongxuan.handbookSummary.sourceUrl} target="_blank" rel="noreferrer">{t("objectiveSourceLabel")}</a>}
                </li>)}
              </ol>
            </details>
          </div>
          <b>{t("pathConfirmed")} · {t("lessonImportPending")}</b>
        </article>)}
      </div>
    </section>
    <section className="neo-progress-panel">
      <div className="neo-progress-toolbar">
        <label htmlFor="curriculum-child">{t("curriculumChild")}</label>
        <select id="curriculum-child" aria-label="Curriculum child" value={childId ?? ""} disabled={!children.length} onChange={(event) => { const id = Number(event.target.value); setChildId(id); void refresh(id); }}>
          {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
        </select>
        <button onClick={() => void refresh()} disabled={loading || !childId}><RefreshCw size={16}/>{t("refreshCurriculum")}</button>
      </div>
      {loading && <div className="neo-loading" role="status">{t("loading")}</div>}
      {error && <p className="neo-alert" role="alert">{error}</p>}
      {!loading && !error && children.length === 0 && <p className="neo-loading neo-empty" role="status">{t("curriculumNoChildren")}</p>}
      {curriculum && <>
        <div className="neo-stats">
          <span><strong>{curriculum.progress.completed}</strong>{t("completed")}</span>
          <span><strong>{curriculum.progress.in_progress}</strong>{t("inProgress")}</span>
          <span><strong>{curriculum.progress.not_started}</strong>{t("notStarted")}</span>
          <small>{t("asOf")} {curriculum.as_of}</small>
        </div>
        <div className="neo-levels">
          {curriculum.levels.map((level) => <section className="neo-level" key={level.id}>
            <div className="neo-level-tag">L{level.sequence}</div>
            <div><p className="neo-overline">LEVEL {level.sequence}</p><h3>{level.title}</h3>
              {level.units.map((unit) => <article className="neo-unit" key={unit.id}>
                <div><small>UNIT {unit.sequence}</small><strong>{unit.title}</strong></div>
                <ul>{unit.items.map((item) => <li key={item.id}>
                  <span className={item.progress.status === "COMPLETED" ? "neo-check" : "neo-pending"}>{item.progress.status === "COMPLETED" && <Check size={13}/>}</span>
                  <span><strong>{item.content}</strong><small>{progressLabel(item.progress.status)} · {item.source_name} · {item.license_name}</small></span>
                </li>)}</ul>
              </article>)}
            </div>
          </section>)}
        </div>
      </>}
    </section>
  </main>;
}
