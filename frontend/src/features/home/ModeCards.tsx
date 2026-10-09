import { ChevronRight } from "lucide-react";
import type { HomeTranslate } from "./homeCopy";

type ModeKey = "chars" | "dialogue" | "vocab";

interface ModeCardsProps {
  copy: HomeTranslate;
  charsDisabled: boolean;
  onOpen: (mode: ModeKey) => void;
}

const MODES: Array<{ key: ModeKey; title: "modeCharsTitle" | "modeDialogueTitle" | "modeVocabTitle"; body: "modeCharsBody" | "modeDialogueBody" | "modeVocabBody" }> = [
  { key: "chars", title: "modeCharsTitle", body: "modeCharsBody" },
  { key: "dialogue", title: "modeDialogueTitle", body: "modeDialogueBody" },
  { key: "vocab", title: "modeVocabTitle", body: "modeVocabBody" },
];

/** Secondary entry points. They recede behind the hero's single primary action. */
export function ModeCards({ copy, charsDisabled, onOpen }: ModeCardsProps) {
  return (
    <section className="tx-modes" aria-labelledby="tx-modes-title">
      <h2 id="tx-modes-title" className="tx-section-title">{copy("modesTitle")}</h2>
      <div className="tx-modes-grid">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className={`tx-mode tx-mode-${mode.key}`}
            disabled={mode.key !== "dialogue" && charsDisabled}
            onClick={() => onOpen(mode.key)}
          >
            {/* Square crop of one tile from the shared illustration sheet; see .tx-mode-art in home.css. */}
            <span className="tx-mode-art" aria-hidden="true" />
            <span className="tx-mode-text">
              <strong>{copy(mode.title)}</strong>
              <small>{copy(mode.body)}</small>
            </span>
            <ChevronRight className="tx-mode-arrow" size={20} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

export type { ModeKey };
