import { Check, Clock, Play, RotateCcw } from "lucide-react";
import type { CourseLevel } from "../../data/learningPathData";
import bearGuide from "../../assets/moon-bear-guide.webp";
import type { ScriptMode } from "../childPortal/types";
import type { HomeTranslate } from "./homeCopy";
import type { LevelStatus } from "./homeModel";

interface TodayHeroProps {
  learnerName: string;
  level: CourseLevel | null;
  status: LevelStatus;
  isToday: boolean;
  scriptMode: ScriptMode;
  copy: HomeTranslate;
  onStart: () => void;
  onBackToToday: () => void;
}

function glyphFor(scriptMode: ScriptMode, traditional: string, simplified: string): string {
  return scriptMode === "pinyin" ? simplified || traditional : traditional;
}

export function TodayHero({ learnerName, level, status, isToday, scriptMode, copy, onStart, onBackToToday }: TodayHeroProps) {
  if (!level) {
    return (
      <section className="tx-hero" aria-labelledby="tx-hero-title">
        <div className="tx-hero-copy">
          <h1 id="tx-hero-title" className="tx-hero-greeting">{copy("greeting", { name: learnerName })}</h1>
          <p className="tx-hero-done-title"><Check size={22} aria-hidden="true" />{copy("allDoneTitle")}</p>
          <p className="tx-hero-sub">{copy("allDoneBody")}</p>
        </div>
        <HeroMascot copy={copy} />
      </section>
    );
  }

  const isQuiz = level.type !== "lesson";
  const isReplay = status === "completed";
  const actionLabel = isQuiz ? copy("startQuiz") : isReplay ? copy("practiceAgain") : copy("startToday");

  return (
    <section className="tx-hero" aria-labelledby="tx-hero-title">
      <div className="tx-hero-copy">
        <h1 id="tx-hero-title" className="tx-hero-greeting">{copy("greeting", { name: learnerName })}</h1>
        <p className="tx-hero-eyebrow">
          <span className="tx-chip tx-chip-level">{copy("levelN", { n: level.levelNumber })}</span>
          <span>{isToday ? copy("todayLabel") : copy("reviewLabel")}</span>
        </p>
        <h2 className="tx-hero-level-title">{level.themeTitle || level.title}</h2>

        {level.characters.length > 0 && (
          <ul className="tx-hero-glyphs" aria-label={copy("contentsChars")}>
            {level.characters.map((item) => (
              <li key={item.char} className="tx-hero-glyph" lang={scriptMode === "pinyin" ? "zh-Hans" : "zh-Hant"}>
                {glyphFor(scriptMode, item.char, item.charHans)}
              </li>
            ))}
          </ul>
        )}

        <div className="tx-hero-actions">
          <button type="button" className="tx-button-primary" onClick={onStart}>
            {isReplay && !isQuiz ? <RotateCcw size={24} aria-hidden="true" /> : <Play size={24} fill="currentColor" aria-hidden="true" />}
            <span>{actionLabel}</span>
          </button>
          <span className="tx-hero-meta"><Clock size={16} aria-hidden="true" />{copy("minutes", { n: level.estimatedMinutes })}</span>
        </div>

        {!isToday && (
          <button type="button" className="tx-button-quiet" onClick={onBackToToday}>{copy("backToToday")}</button>
        )}
      </div>
      <HeroMascot copy={copy} />
    </section>
  );
}

function HeroMascot({ copy }: { copy: HomeTranslate }) {
  return (
    <div className="tx-hero-mascot">
      <p className="tx-hero-bubble">{copy("mascotTip")}</p>
      {/* Portrait artwork: the frame keeps its 2:3 ratio and contains the image, never stretching it. */}
      <div className="tx-hero-mascot-frame">
        <img src={bearGuide} alt={copy("mascotAlt")} width={320} height={480} />
      </div>
    </div>
  );
}
