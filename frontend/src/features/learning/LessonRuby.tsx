import type { PhoneticAssist } from "../childPortal/types";

export interface CharReading {
  zhuyin: string;
  pinyin: string;
}

interface LessonRubyProps {
  text: string;
  readings: ReadonlyMap<string, CharReading>;
  assist: PhoneticAssist;
}

/**
 * Annotates lesson text from the curriculum's own readings, so every taught character
 * gets its phonetic. Characters without a reading (punctuation) keep an invisible
 * annotation so the whole line stays on one baseline.
 */
export function LessonRuby({ text, readings, assist }: LessonRubyProps) {
  if (assist === "off") return <span className="ruby-text-container">{text}</span>;
  return (
    <span className="ruby-text-container">
      {[...text].map((char, index) => {
        const reading = readings.get(char);
        const annotation = reading ? (assist === "pinyin" ? reading.pinyin : reading.zhuyin) : null;
        return (
          <ruby key={`${index}-${char}`} className={`ruby-annotated-char ${annotation ? "" : "ruby-punct-wrap"}`}>
            <rt className={`ruby-rt ${annotation ? "" : "ruby-rt-invisible"}`} aria-hidden={annotation ? undefined : true}>
              {annotation ?? " "}
            </rt>
            <span className={`ruby-base ${annotation ? "" : "ruby-base-punct"}`}>{char}</span>
          </ruby>
        );
      })}
    </span>
  );
}
