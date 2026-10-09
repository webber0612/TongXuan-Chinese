import { BookOpen } from "lucide-react";
import type { CourseLevel } from "../../data/learningPathData";
import type { ScriptMode } from "../childPortal/types";
import type { HomeTranslate } from "./homeCopy";

interface LevelContentsProps {
  level: CourseLevel;
  scriptMode: ScriptMode;
  copy: HomeTranslate;
  onOpen: (mode: "char" | "vocab" | "idiom") => void;
}

/** Dual mode shows both notations, one per line, so neither wraps mid-syllable. */
function phonetics(scriptMode: ScriptMode, zhuyin: string, pinyin: string): string[] {
  if (scriptMode === "pinyin") return [pinyin];
  if (scriptMode === "zhuyin") return [zhuyin];
  return [zhuyin, pinyin];
}

/** Read-only preview of what the selected level teaches; each group opens its own practice mode. */
export function LevelContents({ level, scriptMode, copy, onOpen }: LevelContentsProps) {
  const useSimplified = scriptMode === "pinyin";
  const contentLang = useSimplified ? "zh-Hans" : "zh-Hant";

  return (
    <section className="tx-contents" aria-labelledby="tx-contents-title">
      <h2 id="tx-contents-title" className="tx-section-title">{copy("contentsTitle")}</h2>
      <div className="tx-contents-grid">
        <button type="button" className="tx-contents-group" onClick={() => onOpen("char")}>
          <span className="tx-contents-label">{copy("contentsChars")}</span>
          <span className="tx-contents-chars">
            {level.characters.map((item) => (
              <span key={item.char} className="tx-contents-char">
                <b lang={contentLang}>{useSimplified ? item.charHans || item.char : item.char}</b>
                <small>{phonetics(scriptMode, `${item.zhuyin}${item.zhuyinTone}`, item.pinyin).map((text) => <span key={text}>{text}</span>)}</small>
              </span>
            ))}
          </span>
        </button>

        {level.vocabulary.length > 0 && (
          <button type="button" className="tx-contents-group" onClick={() => onOpen("vocab")}>
            <span className="tx-contents-label">{copy("contentsVocab")}</span>
            <span className="tx-contents-words">
              {level.vocabulary.map((item) => (
                <span key={item.word} className="tx-contents-word" lang={contentLang}>{item.word}</span>
              ))}
            </span>
          </button>
        )}

        {level.idiom && (
          <button type="button" className="tx-contents-group tx-contents-idiom" onClick={() => onOpen("idiom")}>
            <span className="tx-contents-label"><BookOpen size={16} aria-hidden="true" />{copy("contentsIdiom")}</span>
            <strong lang={contentLang}>{level.idiom.idiomTitle}</strong>
            <small>{level.idiom.idiomMeaning}</small>
          </button>
        )}
      </div>
    </section>
  );
}
