import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Headphones, Sparkles } from "lucide-react";
import { useLocale } from "../lib/i18n";
import { officialCoursePath } from "../data/officialCoursePath";

type CourseZeroPageProps = { onBack: () => void; onStartFirstLesson: () => void };

const steps = [
  { symbol: "ㄅ", roman: "b", title: "聽見中文的聲音", copy: "先聽一聽，再把聲音和符號配起來。" },
  { symbol: "ㄅ ㄆ ㄇ", roman: "b · p · m", title: "認識注音符號", copy: "用幾個簡單的符號，記住中文聲音從哪裡開始。" },
  { symbol: "b p m", roman: "ㄅ · ㄆ · ㄇ", title: "認識拼音字母", copy: "同一個聲音，也能用羅馬字母寫下來。" },
  { symbol: "ā á ǎ à", roman: "一聲 · 二聲 · 三聲 · 四聲", title: "聽出聲調", copy: "聲調不同，意思也可能不同；先用耳朵分辨它們。" },
];

export function CourseZeroPage({ onBack, onStartFirstLesson }: CourseZeroPageProps) {
  const { t } = useLocale();
  const [step, setStep] = useState(0);
  const current = steps[step];
  const last = step === steps.length - 1;
  function listen() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.symbol.replaceAll(" ", "、"));
    utterance.lang = "zh-TW";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
  return <main className="app-page course-zero-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17}/>{t("backToMap")}</button>
    <header className="lesson-heading"><div className="lesson-kicker"><Sparkles size={16}/><span>COURSE 0 · {officialCoursePath.stages[0].shortTitle}</span></div><h1>{t("courseZeroTitle")}</h1><p>{t("courseZeroFullIntro")}</p><p className="course-boundary-note">{t("courseZeroBoundary")}</p></header>
    <div className="lesson-progress" aria-label={`${step + 1} / ${steps.length}`}>{steps.map((_, index) => <span key={index} className={index <= step ? "lesson-dot active" : "lesson-dot"}/>)}</div>
    <section className="sound-lesson-card" aria-labelledby="sound-lesson-title"><div className="sound-symbol"><span>{current.symbol}</span><button className="sound-listen" aria-label={t("hear")} onClick={listen}><Headphones size={20}/></button></div><div className="sound-copy"><p className="eyebrow">{step + 1} / {steps.length}</p><h2 id="sound-lesson-title">{current.title}</h2><p>{current.copy}</p><div className="sound-bridge"><span>{current.symbol}</span><ArrowRight size={16}/><span>{current.roman}</span></div></div></section>
    <section className="lesson-checklist"><p className="eyebrow">{t("todayPath")}</p><h2>{t("courseZeroPracticeTitle")}</h2><button className="lesson-task complete"><span><Check size={17}/></span>{t("courseZeroListenTask")}</button><button className="lesson-task"><span>{step + 1}</span>{t("courseZeroMatchTask")}</button></section>
    <div className="lesson-actions"><button className="button button-secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>{t("previous")}</button>{last ? <button className="button button-primary button-large" onClick={onStartFirstLesson}>{t("startFirstLesson")}<ArrowRight size={18}/></button> : <button className="button button-primary button-large" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>{t("nextStep")}<ArrowRight size={18}/></button>}</div>
  </main>;
}
