import type { ReactElement } from "react";
import { Volume2 } from "lucide-react";
import type { DailyDayPlan, HanziItem, ScriptMode, SpeechSpeed } from "./types";
import type { WritingVariant } from "../../lib/adaptiveWriting";

type Props = {
 currentChar: HanziItem; scriptMode: ScriptMode; isDiff: boolean; activeVariant: WritingVariant;
 variantLabels: { trad: string; simp: string }; handleSelectVariant: (variant: WritingVariant) => void;
 activeStrokeIndex: number; dayPlan: DailyDayPlan; speechSpeed: SpeechSpeed;
 onPlaySound: (text: string, speed?: SpeechSpeed, force?: boolean) => void;
};

export function CharacterInfoPanel({currentChar,scriptMode,isDiff,activeVariant,variantLabels,handleSelectVariant,activeStrokeIndex,dayPlan,speechSpeed,onPlaySound}: Props): ReactElement {
 return (
    <div className="info-split-panel animate-fade">
      {/* Card 1: Character Hero + Permanent Phonetics */}
      <div className="info-card char-hero-card">
        <div className="info-card-top-header">
          <span className="info-char-icon">{currentChar.illustrationIcon}</span>
          <div className="info-phonetic-badge-box">
            {scriptMode === "zhuyin" ? (
              <span className="zhuyin-text-clean">{currentChar.zhuyin} {currentChar.zhuyinTone}</span>
            ) : scriptMode === "pinyin" ? (
              <span className="pinyin-text-clean">{currentChar.pinyin}</span>
            ) : (
              <span className="dual-text-clean">
                {currentChar.zhuyin}{currentChar.zhuyinTone} · {currentChar.pinyin}
              </span>
            )}
          </div>
        </div>

        <div className="info-char-glyph-row">
          {isDiff ? (
            <div className="dual-info-glyph-duo">
              <button
                type="button"
                className={`info-glyph-text kaiti-standard ${activeVariant === "trad" ? "is-active-variant" : ""}`}
                title={variantLabels.trad}
                onClick={() => handleSelectVariant("trad")}
              >
                {currentChar.char}
              </button>
              <span className="glyph-duo-sep">⇄</span>
              <button
                type="button"
                className={`info-glyph-text kaiti-standard hans ${activeVariant === "hans" ? "is-active-variant" : ""}`}
                title={variantLabels.simp}
                onClick={() => handleSelectVariant("hans")}
              >
                {currentChar.charHans}
              </button>
            </div>
          ) : (
            <div className="single-info-glyph-box">
              <span className="info-glyph-text kaiti-standard is-active-variant">
                {currentChar.char}
              </span>
            </div>
          )}
        </div>

        {/* Radical & Strokes Pill */}
        <div className="info-meta-chips-row">
          <span className="meta-chip">🧩 部首：{currentChar.radical}</span>
          <span className="meta-chip">
            📏 筆畫：{isDiff && activeVariant === "hans" ? (currentChar.strokeCountHans || currentChar.strokeCount) : currentChar.strokeCount} 畫
          </span>
          {isDiff && (
            <span className="meta-chip variant-indicator-chip">
              {activeVariant === "trad" ? variantLabels.trad : variantLabels.simp}
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Stroke Order Flow */}
      {currentChar.strokeOrderSteps && currentChar.strokeOrderSteps.length > 0 && (
        <div className="info-card stroke-steps-card">
          <div className="card-mini-title">
            <span>🔢 筆順分解</span>
          </div>
          <div className="stroke-steps-grid-compact">
            {currentChar.strokeOrderSteps.map((step, idx) => (
              <span
                key={idx}
                className={`stroke-step-tag ${activeStrokeIndex === idx ? "active-stroke" : ""}`}
              >
                <b>{idx + 1}</b> {step}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Card 3: Vocabulary Words */}
      <div className="info-card vocab-card">
        <div className="card-mini-title">
          <span>📚 生活詞彙</span>
        </div>
        <div className="vocab-tags-row">
          <button
            type="button"
            className="vocab-audio-tag-btn"
            onClick={() => onPlaySound(currentChar.exampleWord, speechSpeed, true)}
          >
            <span>{currentChar.exampleWord}</span>
            <Volume2 size={16} />
          </button>
          {dayPlan.vocabulary && dayPlan.vocabulary.slice(0, 2).map((v) => (
            <button
              key={v.word}
              type="button"
              className="vocab-audio-tag-btn"
              onClick={() => onPlaySound(v.word, speechSpeed, true)}
            >
              <span>{v.word}</span>
              <Volume2 size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Card 4: Story Example Sentence */}
      <div className="info-card sentence-card">
        <div className="card-mini-title">
          <span>📖 課文例句</span>
        </div>
        <p className="info-sentence-text">「{currentChar.exampleSentence}」</p>
        <button
          type="button"
          className="sentence-play-micro-btn"
          onClick={() => onPlaySound(currentChar.exampleSentence, speechSpeed, true)}
        >
          <Volume2 size={16} />
          <span>朗讀句子</span>
        </button>
      </div>
    </div>

 );
}
