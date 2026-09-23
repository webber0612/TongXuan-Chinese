import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole } from "lucide-react";
import { officialCoursePath } from "../data/officialCoursePath";
import { useLocale } from "../lib/i18n";

type FirstLessonPageProps = { onBack: () => void; onOpenPractice: () => void };

export function FirstLessonPage({ onBack, onOpenPractice }: FirstLessonPageProps) {
  const { t } = useLocale();
  const lesson = officialCoursePath.stages[2];
  return <main className="app-page first-lesson-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17}/>{t("backToMap")}</button>
    <header className="lesson-heading">
      <div className="lesson-kicker"><BookOpen size={16}/><span>《學華語向前走》 · BOOK 1A</span></div>
      <h1>{t("firstLessonTitle")}</h1>
      <p>{t("firstLessonIntro")}</p>
    </header>
    <section className="official-lesson-card" aria-labelledby="first-lesson-title">
      <div className="official-lesson-number">01</div>
      <div className="official-lesson-copy">
        <p className="eyebrow">{lesson.shortTitle}</p>
        <h2 id="first-lesson-title">{lesson.title}</h2>
        <p>{lesson.description}</p>
        <div className="source-lock-note"><LockKeyhole size={16}/><span>{t("lessonImportPending")}</span></div>
      </div>
    </section>
    <section className="lesson-source-panel">
      <p className="eyebrow">{t("sourceRecord")}</p>
      <strong>{officialCoursePath.provider}</strong>
      <a href={lesson.sourceUrl} target="_blank" rel="noreferrer">{t("openOfficialSource")}</a>
      <p>{t("sourceRecordNote")}</p>
    </section>
    <div className="lesson-actions">
      <button className="button button-secondary" onClick={onBack}>{t("previous")}</button>
      <button className="button button-primary button-large" onClick={onOpenPractice} disabled>{t("lessonPreparing")}<ArrowRight size={18}/></button>
    </div>
  </main>;
}
