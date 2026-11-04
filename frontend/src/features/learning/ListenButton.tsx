import { useEffect } from "react";
import { Volume2 } from "lucide-react";

interface ListenButtonProps {
  /** Text to speak; also the key that triggers one automatic play when the question changes. */
  text: string;
  onPlay: (text: string) => void;
  label?: string;
  autoPlay?: boolean;
}

/**
 * The single focal control of a listening question: large, centred, and played once
 * automatically so the child hears the prompt before choosing.
 */
export function ListenButton({ text, onPlay, label = "再聽一次", autoPlay = true }: ListenButtonProps) {
  useEffect(() => {
    if (!autoPlay || !text) return undefined;
    const timer = window.setTimeout(() => onPlay(text), 350);
    return () => window.clearTimeout(timer);
    // Replay only when the question text changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);

  return (
    <div className="tx-listen-stage">
      <button type="button" className="tx-listen-big" onClick={() => onPlay(text)} aria-label={`${label}：播放題目語音`}>
        <Volume2 size={48} strokeWidth={2.4} aria-hidden="true" />
        <span>{label}</span>
      </button>
    </div>
  );
}
