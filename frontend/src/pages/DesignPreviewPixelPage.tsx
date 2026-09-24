import { useState } from "react";
import { BookOpen, House, Settings2, Star, Volume2 } from "lucide-react";
import pixelWorldBackground from "../assets/pixel-world-background.png";
import pixelUiSprites from "../assets/pixel-ui-sprites.png";

/** Pixel-world concept page based on the supplied reference render. */
export function DesignPreviewPixelPage() {
  const [started, setStarted] = useState(false);
  return <main className="pixel-world" style={{ backgroundImage: `linear-gradient(rgba(35,132,219,.08),rgba(28,93,142,.2)), url(${pixelWorldBackground})` }}>
    <div className="pixel-sky"><span className="pixel-cloud cloud-one"/><span className="pixel-cloud cloud-two"/><span className="pixel-island island-one"/><span className="pixel-island island-two"/><span className="pixel-island island-three"/></div>
    <header className="pixel-hud"><div className="pixel-brand"><span className="pixel-brand-plate">桐軒中文</span><small>中文冒險樂園</small></div><div className="pixel-status"><span>🔥 連續學習 <b>7天</b></span><span><Star size={18} fill="currentColor"/> 128</span><button aria-label="設定"><Settings2 size={21}/></button></div></header>
    <section className="pixel-hero"><div className="pixel-character" aria-label="中文探險家"><span className="sprite sprite-panda" style={{ backgroundImage: `url(${pixelUiSprites})` }}/></div><div className="pixel-castle"><span className="sprite sprite-home" style={{ backgroundImage: `url(${pixelUiSprites})` }}/><strong>學中文<br/>發現更棒的自己</strong></div><div className="pixel-sign pixel-sign-left">小小一步<br/>更大的世界<br/><b>♥</b></div><div className="pixel-sign pixel-sign-right">探索<br/>學習<br/>成長<br/><b>♥</b></div></section>
    <section className="pixel-actions" aria-label="學習入口"><button className={`pixel-start ${started ? "started" : ""}`} onClick={() => setStarted(true)}><span className="pixel-play">▶</span><strong>{started ? "繼續冒險" : "開始練習"}</strong><span>›</span></button><div className="pixel-mode-grid"><button className="pixel-mode mode-green"><span className="sprite sprite-book" style={{ backgroundImage: `url(${pixelUiSprites})` }}/><strong>認字練習</strong><span>探索字的世界 ›</span></button><button className="pixel-mode mode-blue"><span className="sprite sprite-headphones" style={{ backgroundImage: `url(${pixelUiSprites})` }}/><strong>聽中文</strong><span>聽見新聲音 ›</span></button><button className="pixel-mode mode-pink"><span className="sprite sprite-mic" style={{ backgroundImage: `url(${pixelUiSprites})` }}/><strong>朗讀練習</strong><span>說出你的故事 ›</span></button></div></section>
    <section className="pixel-tip"><Volume2 size={16}/> {started ? "今天的學習卡已準備好，點擊主按鈕開始。" : "完成每日任務，解鎖下一座浮島。"}</section>
    <nav className="pixel-nav"><button className="active"><House/><span>首頁</span></button><button><BookOpen/><span>學習地圖</span></button><button><Star/><span>我的進度</span></button><button><span className="pixel-panda">🐼</span><span>個人中心</span></button></nav>
  </main>;
}
