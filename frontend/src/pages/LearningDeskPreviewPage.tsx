import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, Mic, PenLine, Puzzle, Star, Volume2 } from "lucide-react";
import softLearningArt from "../assets/soft-learning-art.png";

const modules = [
  { label: "認字", title: "看字認一認", detail: "看見「學校」，說出意思，再配對圖片。", icon: BookOpen, tone: "yellow", progress: "3 / 5" },
  { label: "筆畫", title: "跟著筆順寫", detail: "先看示範，再在格子裡完成今天的字。", icon: PenLine, tone: "green", progress: "2 / 5" },
  { label: "發音", title: "聽音選一選", detail: "繁體＋注音、簡體＋拼音都可以練。", icon: Headphones, tone: "blue", progress: "1 / 5" },
  { label: "朗讀", title: "大聲讀出來", detail: "讀字、詞、句子或文章，留下練習紀錄。", icon: Mic, tone: "pink", progress: "0 / 5" },
  { label: "成語", title: "把成語用起來", detail: "今天的成語是「勤能補拙」，試著放進一句話。", icon: Puzzle, tone: "violet", progress: "1 / 3" },
];

export function LearningDeskPreviewPage() {
  const [moduleIndex, setModuleIndex] = useState(0);
  const module = modules[moduleIndex];
  const Icon = module.icon;
  return <main className="learning-desk-preview">
    <header className="desk-preview-header"><button onClick={() => window.location.assign("/preview-2")} aria-label="回到首頁"><ArrowLeft size={18}/></button><div><span>今天的學習桌</span><strong>小安 · 9 月 23 日</strong></div><span className="desk-stars"><Star size={16} fill="currentColor"/> 128</span></header>
    <section className="desk-welcome"><div><span className="desk-overline">同一張桌子，五種練習</span><h1>今天先學會<br/><em>學校</em></h1><p>不用找五個入口，選一個模組開始，完成後自然前往下一站。</p></div><div className="desk-character-art" style={{ backgroundImage: `url(${softLearningArt})` }}><span>學</span><Volume2 size={20}/></div></section>
    <nav className="desk-module-tabs" aria-label="五大學習模組">{modules.map((item, index) => { const ItemIcon = item.icon; return <button key={item.label} className={index === moduleIndex ? `active tone-${item.tone}` : ""} onClick={() => setModuleIndex(index)}><ItemIcon size={18}/><span>{item.label}</span><small>{item.progress}</small></button>; })}</nav>
    <section className={`desk-module-panel tone-${module.tone}`} aria-live="polite"><div className="desk-module-icon"><Icon size={32}/></div><div><span className="desk-overline">{module.label} · 今日任務</span><h2>{module.title}</h2><p>{module.detail}</p><div className="desk-stars" aria-label="目前兩顆星"><Star fill="currentColor"/><Star fill="currentColor"/><Star/><Star/><Star/></div></div><button className="desk-start-action">開始這一題 <ArrowRight size={17}/></button></section>
    <section className="desk-next"><div><span>學習順序</span><strong>完成一項，就解鎖下一項</strong></div><div className="desk-sequence">{modules.map((item, index) => <span key={item.label} className={index < moduleIndex ? "done" : index === moduleIndex ? "now" : ""}>{index < moduleIndex ? <Check size={13}/> : index + 1}</span>)}</div></section>
    <p className="desk-note">學習桌只負責今天的練習；成績、弱點與完整報告請到「學習日曆」查看。</p>
  </main>;
}
