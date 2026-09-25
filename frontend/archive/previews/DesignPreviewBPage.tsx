import { type CSSProperties, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Crown, Headphones, House, Mic, Moon, PenLine, Puzzle, Sparkles, Star, Sun, UserRound } from "lucide-react";
import appLogoSource from "../assets/app-logo-source.png";

type LearningMode = {
  id: string;
  label: string;
  title: string;
  task: string;
  hint: string;
  progress: string;
  progressValue: number;
  stars: number;
  tone: string;
  glyph: string;
  icon: ReactNode;
};

/** Preview-2: a five-mode daily carousel with a visible weekly learning rail. */
export function DesignPreviewBPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [dayIndex, setDayIndex] = useState(2);
  const [modeIndex, setModeIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const pointerStartRef = useRef<number | null>(null);
  const dragDistanceRef = useRef(0);
  const suppressClickRef = useRef(false);

  const days = [
    { date: "9/21", count: "8/15", state: "done", label: "週一", text: "你", hint: "you · nǐ", idiom: "自得其樂", idiomHint: "zì dé qí lè", stars: 3 },
    { date: "9/22", count: "15/15", state: "passed", label: "週二", text: "學", hint: "learn · xué", idiom: "一步登天", idiomHint: "yī bù dēng tiān", stars: 5 },
    { date: "9/23", count: "0/15", state: "today", label: "今天", text: "學校", hint: "school · xuéxiào", idiom: "勤能補拙", idiomHint: "qín néng bǔ zhuō", stars: 1 },
    { date: "9/24", count: "0/15", state: "upcoming", label: "週四", text: "老師", hint: "teacher · lǎoshī", idiom: "循序漸進", idiomHint: "xún xù jiàn jìn", stars: 0 },
    { date: "9/25", count: "0/15", state: "upcoming", label: "週五", text: "朋友", hint: "friend · péngyou", idiom: "同心協力", idiomHint: "tóng xīn xié lì", stars: 0 },
    { date: "9/26", count: "BOSS", state: "boss", label: "考試日", text: "第一關", hint: "5 日學習檢定", idiom: "學以致用", idiomHint: "xué yǐ zhì yòng", stars: 0 },
  ];
  const day = days[dayIndex];
  const modes: LearningMode[] = [
    { id: "recognition", label: "認字", title: `認識「${day.text}」`, task: "看字、聽音，再說出今天的意思。", hint: day.hint, progress: "2/5", progressValue: 40, stars: Math.min(day.stars, 3), tone: "gold", glyph: day.text.slice(0, 1), icon: <BookOpen size={20}/> },
    { id: "writing", label: "筆畫", title: `寫出「${day.text}」`, task: "跟著筆順走一遍，讓手記住這個字。", hint: "筆順 · 書寫練習", progress: "1/5", progressValue: 20, stars: Math.min(day.stars, 2), tone: "mint", glyph: "筆", icon: <PenLine size={20}/> },
    { id: "pronunciation", label: "發音", title: `聽懂「${day.text}」`, task: "聽清楚聲音，選出正確的注音與拼音。", hint: `${day.hint} · 注音 / 拼音`, progress: "3/5", progressValue: 60, stars: Math.min(day.stars, 3), tone: "sky", glyph: "聲", icon: <Headphones size={20}/> },
    { id: "reading", label: "朗讀", title: `讀出「${day.text}」`, task: "開口讀一讀，完成今天的朗讀小挑戰。", hint: "朗讀 · 語氣練習", progress: "1/5", progressValue: 20, stars: Math.min(day.stars, 1), tone: "rose", glyph: "讀", icon: <Mic size={20}/> },
    { id: "idiom", label: "成語", title: day.idiom, task: "讀懂成語意思，再放進一個簡單句子。", hint: day.idiomHint, progress: "0/5", progressValue: 0, stars: 0, tone: "lilac", glyph: "語", icon: <Puzzle size={20}/> },
  ];
  const setDay = (index: number) => { setDayIndex(Math.max(0, Math.min(days.length - 1, index))); setModeIndex(0); };
  const setMode = (index: number) => setModeIndex(Math.max(0, Math.min(modes.length - 1, index)));
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    pointerStartRef.current = event.clientX;
    dragDistanceRef.current = 0;
    suppressClickRef.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setTilt({ x: ((event.clientY - bounds.top) / bounds.height - .5) * -5, y: ((event.clientX - bounds.left) / bounds.width - .5) * 7 });
    if (pointerStartRef.current !== null) {
      const delta = event.clientX - pointerStartRef.current;
      dragDistanceRef.current = Math.abs(delta);
      setDragX(Math.max(-120, Math.min(120, delta)));
    }
  };
  const onPointerUp = () => {
    const delta = dragX;
    if (Math.abs(delta) > 45) {
      suppressClickRef.current = true;
      setMode(modeIndex + (delta < 0 ? 1 : -1));
    }
    setDragX(0);
    pointerStartRef.current = null;
    setDragging(false);
    setTilt({ x: 0, y: 0 });
  };
  const openMode = (index: number) => {
    if (suppressClickRef.current || dragDistanceRef.current > 10) {
      suppressClickRef.current = false;
      dragDistanceRef.current = 0;
      return;
    }
    if (index === modeIndex) window.location.assign("/learning-desk");
    else setMode(index);
  };
  const cardStyle = (index: number) => ({ "--card-offset": `${(index - modeIndex) * 104}%` } as CSSProperties);

  return <main className={`playroom-preview simple-playroom ${darkMode ? "is-dark" : ""}`}>
    <header className="playroom-top reference-inspired-top"><div className="reference-brand"><span className="reference-logo-mark" style={{ backgroundImage: `url(${appLogoSource})` }}/><div><strong>桐軒中文</strong><small>TongXuan Chinese</small></div></div><div className="reference-child-greeting"><span className="playroom-greeting">{day.label} · 第 12 天</span><h1>嗨，小安 <span>✦</span></h1></div><div className="playroom-tools"><button className="reference-streak"><span>🔥</span> 7天</button><span><Star size={15} fill="currentColor"/> 120</span><button className="reference-user-menu" aria-label="切換使用者"><UserRound size={17}/><b>小安</b><ArrowRight size={13}/></button><button aria-label={darkMode ? "切換淺色護眼模式" : "切換深色護眼模式"} onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun size={19}/> : <Moon size={19}/>}</button></div></header>
    <section className="study-timeline" aria-label="本週學習進度"><div className="timeline-heading"><span><CalendarDays size={15}/> 本週學習量</span><button onClick={() => window.location.assign("/learning-calendar")}><CalendarDays size={14}/> 學習日曆</button></div><div className="timeline-rail"><button className="timeline-arrow" aria-label="上一天" disabled={dayIndex === 0} onClick={() => setDay(dayIndex - 1)}><ArrowLeft size={16}/></button><div className="timeline-days">{days.map((item, index) => <button key={item.date} aria-label={`${item.date} ${item.count}`} className={`timeline-day ${item.state} ${index === dayIndex ? "selected" : ""}`} onClick={() => setDay(index)}><span className="timeline-day-label">{item.date}</span><span className="timeline-node">{item.state === "boss" ? <Crown size={16}/> : item.state === "passed" ? <Star size={15} fill="currentColor"/> : <b>{item.count}</b>}</span></button>)}</div><button className="timeline-arrow" aria-label="下一天" disabled={dayIndex === days.length - 1} onClick={() => setDay(dayIndex + 1)}><ArrowRight size={16}/></button></div></section>
    <section className={`playroom-stage card-stage ${day.state === "boss" ? "boss-stage" : ""}`} aria-labelledby="preview-quest-title"><div className="playroom-cloud cloud-a"/><div className="playroom-cloud cloud-b"/><div className="ambient-orbit orbit-one"/><div className="ambient-orbit orbit-two"/><div className="card-stage-head"><span className="playroom-label">{day.state === "boss" ? <><Crown size={14}/> 第 1 關 BOSS 考試</> : <><Sparkles size={14}/> {day.date} 的今日任務</>}</span><span>{day.state === "boss" ? "準備挑戰" : day.count}</span></div><button className="card-arrow card-arrow-left" aria-label="上一個學習模組" disabled={modeIndex === 0} onClick={() => setMode(modeIndex - 1)}><ArrowLeft size={19}/></button><button className="card-arrow card-arrow-right" aria-label="下一個學習模組" disabled={modeIndex === modes.length - 1} onClick={() => setMode(modeIndex + 1)}><ArrowRight size={19}/></button><div className="module-card-track" aria-live="polite">{modes.map((item, index) => { const Icon = item.icon; const distance = Math.abs(index - modeIndex); return <button key={item.id} className={`learning-card module-card ${index === modeIndex ? "is-active" : ""} ${distance === 1 ? "is-neighbor" : distance > 1 ? "is-far" : ""} ${dragging && index === modeIndex ? "is-dragging" : ""}`} style={{ ...cardStyle(index), "--drag-x": `${index === modeIndex ? dragX : 0}px`, "--tilt-x": `${index === modeIndex ? tilt.x : 0}deg`, "--tilt-y": `${index === modeIndex ? tilt.y : 0}deg`, "--tilt-z": `${index === modeIndex ? dragX / 28 : 0}deg` } as CSSProperties} aria-current={index === modeIndex ? "true" : undefined} onPointerDown={index === modeIndex ? onPointerDown : undefined} onPointerMove={index === modeIndex ? onPointerMove : undefined} onPointerUp={index === modeIndex ? onPointerUp : undefined} onPointerCancel={index === modeIndex ? onPointerUp : undefined} onClick={() => openMode(index)}><div className={`module-card-art tone-${item.tone}`}><span className="module-glyph">{item.glyph}</span><span className="module-art-badge">{Icon}</span><span className="module-art-label">{item.label}</span></div><div className="learning-card-copy"><div className="module-card-meta"><span>{item.label} · {day.date}</span><b>{item.progress}</b></div><h2 id={index === modeIndex ? "preview-quest-title" : undefined}>{item.title}</h2><p>{item.task}</p><div className="module-progress-line"><span>今日進度</span><i><b style={{ width: `${item.progressValue}%` }}/></i><strong>{item.progress}</strong></div><div className="card-star-row" aria-label={`${item.stars} 顆星`}>{[0, 1, 2, 3, 4].map((star) => <Star key={star} size={17} fill={star < item.stars ? "currentColor" : "none"}/>)}</div><small>{index === modeIndex ? "點一下開始，左右拖曳切換模組" : "點一下切換到這個模組"}</small></div></button>; })}</div><div className="card-module-dots" aria-label={`目前第 ${modeIndex + 1} 個，共 ${modes.length} 個學習模組`}>{modes.map((item, index) => <button key={item.id} aria-label={`選擇${item.label}`} className={index === modeIndex ? "active" : ""} onClick={() => setMode(index)}/>)}</div><span className="card-drag-hint"><ArrowLeft size={13}/> 左右拖曳切換五大學習模組 <ArrowRight size={13}/></span></section>
    <p className="simple-playroom-hint unified-desk-hint"><BookOpen size={16}/> 每張卡都是今天的一個小任務；完成後會留下進度與星星。</p>
    <nav className="playroom-tabs"><button className="active"><House/><span>今天</span></button><button><Sparkles/><span>練習</span></button><button><BookOpen/><span>課程</span></button><button><UserRound/><span>我的</span></button></nav>
  </main>;
}
