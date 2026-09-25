import { useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Check, Headphones, Home, Mic, Settings2, Sparkles, Star, Trophy, UserRound } from "lucide-react";
import softLearningArt from "../assets/soft-learning-art.png";
import referenceCharacterPlaceholder from "../assets/reference-character-placeholder.svg";
import referencePandaPlaceholder from "../assets/reference-panda-placeholder.svg";

type Surface = "home" | "desk" | "calendar";

const homeModules = [
  { label: "認字", description: "認識新字，打好基礎", icon: BookOpen, tone: "cream", crop: "0%", modeIndex: 0 },
  { label: "聽一聽", description: "聽中文，培養語感", icon: Headphones, tone: "sky", crop: "50%", modeIndex: 2 },
  { label: "跟讀", description: "開口練習，更有自信", icon: Mic, tone: "peach", crop: "100%", modeIndex: 3 },
] as const;

const deskModules = [
  { label: "認字", hint: "看字與意思", icon: BookOpen, tone: "cream", crop: "0%" },
  { label: "筆畫", hint: "跟著筆順寫", icon: Check, tone: "mint", crop: "0%" },
  { label: "發音", hint: "聽音與聲調", icon: Headphones, tone: "sky", crop: "50%" },
  { label: "朗讀", hint: "讀出詞語句子", icon: Mic, tone: "peach", crop: "100%" },
  { label: "成語", hint: "把意思用起來", icon: Sparkles, tone: "lilac", crop: "50%" },
] as const;

export function DesignPreviewDirectionsPage() {
  const [surface, setSurface] = useState<Surface>("home");
  const [deskIndex, setDeskIndex] = useState(0);

  return <main className="reference-app">
    <div className="reference-device">
      <header className="reference-appbar"><div className="reference-brand"><span className="reference-brand-mark">文</span><span><b>桐軒中文</b><small>TongXuan Chinese</small></span></div><div className="reference-student" aria-label="目前學習者"><span className="reference-student-avatar">小</span><span><b>小安</b><small>二年級</small></span><ArrowRight size={18}/></div></header>
      {surface === "home" && <ReferenceHome onOpenDesk={(index) => { setDeskIndex(index); setSurface("desk"); }} onOpenCalendar={() => setSurface("calendar")} />}
      {surface === "desk" && <ReferenceDesk selected={deskIndex} setSelected={setDeskIndex} onBack={() => setSurface("home")} />}
      {surface === "calendar" && <ReferenceCalendar onBack={() => setSurface("home")} />}
      <nav className="reference-bottom-nav" aria-label="主要功能"><button className={surface === "home" ? "active" : ""} onClick={() => setSurface("home")}><Home size={23}/><span>首頁</span></button><button className={surface === "desk" ? "active" : ""} onClick={() => setSurface("desk")}><BookOpen size={23}/><span>學習記錄</span></button><button className={surface === "calendar" ? "active" : ""} onClick={() => setSurface("calendar")}><Trophy size={23}/><span>我的成就</span></button><button><Settings2 size={23}/><span>個人設定</span></button></nav>
    </div>
  </main>;
}

function ReferenceHome({ onOpenDesk, onOpenCalendar }: { onOpenDesk: (index: number) => void; onOpenCalendar: () => void }) {
  return <section className="render-home"><div className="reference-hero"><div className="reference-hero-character" style={{ backgroundImage: `url(${referenceCharacterPlaceholder})` }} aria-hidden="true"/><div className="reference-hero-copy"><h1>今天一起學中文！</h1><p>小小的練習・大大的進步 <span>♥</span></p><button onClick={() => onOpenDesk(0)}><span className="play-triangle"/>開始今天的練習<ArrowRight size={22}/></button></div><aside className="reference-progress"><div className="progress-block"><span><Sparkles size={16} fill="currentColor"/> 連續學習</span><strong>5 天</strong><div className="progress-dots"><i/><i/><i/><i/><i className="empty"/><i className="empty"/></div></div><div className="progress-divider"/><button onClick={onOpenCalendar}><Star size={30} fill="currentColor"/><span><small>我的積分</small><b>120</b></span><ArrowRight size={19}/></button></aside><div className="reference-landscape" aria-hidden="true"/></div><div className="reference-module-row">{homeModules.map((item) => { const Icon = item.icon; return <button key={item.label} className={`reference-module tone-${item.tone}`} onClick={() => onOpenDesk(item.modeIndex)}><div className="module-art" style={{ backgroundImage: `url(${softLearningArt})`, backgroundPosition: `${item.crop} center` }}><Icon size={28}/></div><div className="module-copy"><h2>{item.label}</h2><p>{item.description}</p></div><span className="module-arrow"><ArrowRight size={20}/></span></button>; })}</div><button className="reference-cheer" onClick={() => onOpenDesk(3)}><span>加油！<br/>你可以的！</span><span className="cheer-panda" style={{ backgroundImage: `url(${referencePandaPlaceholder})` }} aria-hidden="true"/></button></section>;
}

function ReferenceDesk({ selected, setSelected, onBack }: { selected: number; setSelected: (value: number) => void; onBack: () => void }) { const module = deskModules[selected]; const Icon = module.icon; return <section className="reference-subpage"><button className="reference-back" onClick={onBack}>← 回到首頁</button><div className="reference-subpage-head"><span>學習桌</span><h1>今天要練什麼？</h1><p>選一個小挑戰，完成後得到一顆星。</p></div><div className="reference-desk-tabs">{deskModules.map((item, index) => { const TabIcon = item.icon; return <button key={item.label} className={selected === index ? "active" : ""} onClick={() => setSelected(index)}><TabIcon size={21}/><span>{item.label}</span></button>; })}</div><div className={`reference-desk-task tone-${module.tone}`}><div className="desk-task-art" style={{ backgroundImage: `url(${softLearningArt})`, backgroundPosition: `${module.crop} center` }}><Icon size={28}/></div><div><span>{module.label} · 學校</span><h2>{module.hint}</h2><p>完成這一關，收集今天的星星。</p></div><button>開始 <ArrowRight size={17}/></button></div></section>; }

function ReferenceCalendar({ onBack }: { onBack: () => void }) { const completed = [1, 2, 3, 5, 8, 9, 10, 12, 15, 16, 18, 21, 22]; return <section className="reference-subpage reference-calendar"><button className="reference-back" onClick={onBack}>← 回到首頁</button><div className="reference-subpage-head"><span>我的成就 · 2026 年 9 月</span><h1>每天的努力都有星星</h1><p>看看這個月的學習成果。</p></div><div className="reference-achievement-stats"><span><Star fill="currentColor"/><b>42</b><small>取得星星</small></span><span><Sparkles/><b>86</b><small>Master 字數</small></span><span><Check/><b>78%</b><small>完成率</small></span></div><div className="reference-calendar-body"><div className="reference-month-grid">{Array.from({ length: 30 }, (_, index) => <span key={index} className={completed.includes(index + 1) ? "done" : ""}>{index + 1}{completed.includes(index + 1) && <Star size={10} fill="currentColor"/>}</span>)}</div><aside><strong>複習小提醒</strong><b>筆畫</b><small>學、校、練再複習一次。</small><strong>能力分項</strong><b>認字 86% · 發音 74%</b><small>每種能力分開計算。</small></aside></div></section>; }
