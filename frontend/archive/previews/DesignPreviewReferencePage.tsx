import { type ReactNode, useState } from "react";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Gift, Headphones, Mic, Settings2, Star, UserRound } from "lucide-react";

const week = [
  { date: "9/21", amount: "8/15", state: "done" },
  { date: "9/22", amount: "15/15", state: "passed" },
  { date: "9/23", amount: "3/10", state: "today" },
  { date: "9/24", amount: "0/15", state: "future" },
  { date: "9/25", amount: "0/15", state: "future" },
  { date: "9/26", amount: "BOSS", state: "boss" },
];

/** Reference-led soft tablet home concept with timeline and monthly record drawer. */
export function DesignPreviewReferencePage() {
  const [dayIndex, setDayIndex] = useState(2);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const day = week[dayIndex];
  const move = (delta: number) => setDayIndex((value) => Math.max(0, Math.min(week.length - 1, value + delta)));
  return <main className="reference-home">
    <div className="reference-sky-shape"/><header className="reference-header"><div className="reference-profile"><span className="reference-avatar">小</span><div><small>桐軒中文</small><h1>嗨，小桐！</h1><p>一起向前，每天進步吧！</p></div></div><div className="reference-header-actions"><span><span>🔥</span> 7天</span><span><Star size={14} fill="currentColor"/> 128</span><button aria-label="個人中心"><UserRound size={16}/></button><button aria-label="設定"><Settings2 size={16}/></button></div></header>
    <section className="reference-timeline" aria-label="最近學習紀錄"><div className="reference-timeline-title"><span><CalendarDays size={14}/> 本週學習量</span><button onClick={() => setCalendarOpen((value) => !value)}><CalendarDays size={13}/> 月份戰績</button></div><div className="reference-timeline-row"><button aria-label="前一天" disabled={dayIndex === 0} onClick={() => move(-1)}><ChevronLeft size={15}/></button><div className="reference-days">{week.map((item, index) => <button className={`${item.state} ${index === dayIndex ? "selected" : ""}`} key={item.date} onClick={() => setDayIndex(index)}><strong>{item.date}</strong><span>{item.state === "boss" ? "★" : item.amount}</span></button>)}</div><button aria-label="後一天" disabled={dayIndex === week.length - 1} onClick={() => move(1)}><ChevronRight size={15}/></button></div>{calendarOpen && <div className="reference-calendar"><div><strong>2026 年 9 月</strong><small>金星代表完成本日目標</small></div><div className="reference-calendar-grid">{Array.from({ length: 30 }, (_, index) => String(index + 1)).map((date) => <span className={date === "21" || date === "22" ? "cleared" : ""} key={date}>{date}{(date === "21" || date === "22") && <Star size={9} fill="currentColor"/>}</span>)}</div></div>}</section>
    <section className="reference-modes"><ReferenceMode className="mode-recognize" icon={<BookOpen/>} title="認字練習" subtitle="看一看，認一認" detail={`${day.amount} 個字詞待完成`} /><ReferenceMode className="mode-listen" icon={<Headphones/>} title="聽中文" subtitle="聽一聽，說一說" detail="播放今天的學習內容" /><ReferenceMode className="mode-speak" icon={<Mic/>} title="朗讀練習" subtitle="大聲說出來" detail="練習今天的句子" /></section>
    <section className="reference-footer"><div className="reference-progress"><span className="reference-sprout">🌱</span><div><small>學習進度</small><div className="reference-progress-track"><i style={{ width: day.state === "passed" ? "100%" : "30%" }}/></div></div><b>{day.state === "boss" ? "BOSS" : day.amount}</b></div><div className="reference-reward"><Gift size={24}/><div><strong>再完成 2 個字詞</strong><small>就可以解鎖小禮物！</small></div></div></section>
    <nav className="reference-nav"><button className="active"><BookOpen/><span>首頁</span></button><button><CalendarDays/><span>學習地圖</span></button><button><Star/><span>我的進度</span></button><button><UserRound/><span>個人中心</span></button></nav>
  </main>;
}

function ReferenceMode({ className, icon, title, subtitle, detail }: { className: string; icon: ReactNode; title: string; subtitle: string; detail: string }) { return <button className={`reference-mode ${className}`}><span className="reference-mode-icon">{icon}</span><strong>{title}</strong><small>{subtitle}</small><em>{detail}</em><span className="reference-mode-go">›</span></button>; }
