import { Check, Play } from "lucide-react";
import type { DialogueLesson } from "./dialogueLessons";
import type { HomeTranslate } from "./homeCopy";
import { Sheet } from "./Sheet";

interface DialogueSheetProps {
  lessons: DialogueLesson[];
  doneLessonIds: string[];
  copy: HomeTranslate;
  onOpenLesson: (lessonId: string) => void;
  onClose: () => void;
}

export function DialogueSheet({ lessons, doneLessonIds, copy, onOpenLesson, onClose }: DialogueSheetProps) {
  return (
    <Sheet title={copy("dialogueTitle")} description={copy("dialogueBody")} closeLabel={copy("close")} onClose={onClose}>
      <ul className="tx-lesson-list">
        {lessons.map((lesson) => {
          const isDone = doneLessonIds.includes(lesson.lessonId);
          return (
            <li key={lesson.lessonId}>
              <button type="button" className="tx-lesson-row" onClick={() => onOpenLesson(lesson.lessonId)}>
                <span className={`tx-lesson-state ${isDone ? "is-done" : ""}`} aria-hidden="true">
                  {isDone ? <Check size={18} strokeWidth={3} /> : <Play size={16} fill="currentColor" />}
                </span>
                <span className="tx-lesson-text">
                  <small>{lesson.stageTitle ? `${lesson.stageTitle} · ` : ""}{copy("dialogueLesson", { n: lesson.lessonNumber })}</small>
                  <strong lang="zh-Hant">{lesson.title}</strong>
                </span>
                <span className="tx-lesson-action">{isDone ? copy("dialogueDone") : copy("dialogueStart")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
