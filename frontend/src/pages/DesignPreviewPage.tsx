import { ArrowRight, BookOpen, ChevronRight, Gift, House, Settings2, Sparkles, Star, UserRound, Volume2 } from "lucide-react";

/** Static visual direction only. It intentionally has no API calls or mutations. */
export function DesignPreviewPage() {
  return <main className="design-preview">
    <aside className="preview-rail"><div className="preview-logo"><span>文</span><strong>TongXuan</strong></div><div className="preview-rail-label">CHILD MODE</div><nav><a className="is-active" href="#today"><House size={18}/>Today</a><a href="#learn"><Sparkles size={18}/>Learn</a><a href="#map"><BookOpen size={18}/>Path</a><a href="#me"><UserRound size={18}/>Me</a></nav><div className="preview-rail-bottom"><button><Settings2 size={17}/>Settings</button><small>Parent area stays<br/>behind a gate.</small></div></aside>
    <section className="preview-canvas"><header className="preview-topbar"><div><span className="preview-breadcrumb">TUESDAY · 12 MINUTES</span><h1>Hi, Mia<span className="preview-period">.</span></h1></div><div className="preview-top-actions"><span className="preview-streak"><Star size={15} fill="currentColor"/> 07</span><button aria-label="Open profile">M</button></div></header>
      <section className="preview-hero" id="today"><div className="preview-hero-copy"><span className="preview-chip"><Sparkles size={14}/> TODAY'S QUEST</span><h2>Meet <strong>學</strong><br/>for the first time.</h2><p>Listen · recognize · write</p><button className="preview-primary">Start quest <ArrowRight size={18}/></button></div><div className="preview-character"><span>學</span><button aria-label="Hear 學"><Volume2 size={20}/></button><i>01</i></div></section>
      <section className="preview-section" id="learn"><div className="preview-section-title"><div><span>KEEP GOING</span><h2>Your little steps</h2></div><button>See all <ChevronRight size={16}/></button></div><div className="preview-steps"><article className="done"><b>01</b><span>Sound warm-up</span><small>completed</small></article><article className="current"><b>02</b><span>Meet 學</span><small>now</small></article><article><b>03</b><span>Write it</span><small>next</small></article></div></section>
      <section className="preview-lower" id="map"><button className="preview-tile tile-blue"><BookOpen size={22}/><span><b>Learning path</b><small>Starter → Lesson 1</small></span><ArrowRight size={17}/></button><button className="preview-tile tile-yellow"><Gift size={22}/><span><b>My wishes</b><small>120 stars saved</small></span><ArrowRight size={17}/></button></section>
      <section className="preview-me" id="me"><span>DESIGN DIRECTION</span><p>A calm game board for daily learning — clear, tactile, and never crowded.</p></section>
    </section>
  </main>;
}
