import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Volume2, Play, Star, ChevronLeft, ChevronRight, X, Check, Key, VolumeX } from "lucide-react";
import type { SpeechSpeed, DailyDayPlan, DisplayLang, PhoneticAssist, ScriptMode } from "./types";
import { ListenButton } from "../learning/ListenButton";
import { LessonRuby } from "../learning/LessonRuby";
import { BOOK1_READINGS } from "../../data/book1";
import { VOICE_PHRASES } from "../../data/voicePhrases";

type Props = {
  quizFinished: boolean; dayPlan: DailyDayPlan; R: (text: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
  onFinishLesson: (stars: number) => void; currentMode: "text" | "char" | "vocab" | "idiom";
  scriptMode: ScriptMode; displayLang: DisplayLang; phoneticAssist: PhoneticAssist;
  onPlaySound: (text: string, speed?: SpeechSpeed, force?: boolean) => void; onExitClass: () => void;
  setCurrentMode: Dispatch<SetStateAction<"text" | "char" | "vocab" | "idiom">>;
  vocabIdx: number; setVocabIdx: Dispatch<SetStateAction<number>>;
  setDictationPraiseToast: Dispatch<SetStateAction<string | null>>;
  isVoiceGuideEnabled: boolean; onToggleVoiceGuide?: () => void;
  showQuiz: boolean; setShowQuiz: Dispatch<SetStateAction<boolean>>; quizIdx: number;
  setQuizIdx: Dispatch<SetStateAction<number>>; selectedAnswers: Record<number, number>;
  setSelectedAnswers: Dispatch<SetStateAction<Record<number, number>>>; setQuizFinished: Dispatch<SetStateAction<boolean>>;
};

export function ClassroomModeScreens({
  quizFinished, dayPlan, R, t, onFinishLesson, currentMode, scriptMode, displayLang, phoneticAssist,
  onPlaySound, onExitClass, setCurrentMode, vocabIdx, setVocabIdx, setDictationPraiseToast,
  isVoiceGuideEnabled, onToggleVoiceGuide, showQuiz, setShowQuiz, quizIdx, setQuizIdx,
  selectedAnswers, setSelectedAnswers, setQuizFinished,
}: Props): ReactNode {
  if (quizFinished) {
    return (
      <div className="classroom-finish-screen">
        <div className="finish-celebration-card">
          <div className="trophy-bounce">🏆</div>
          <h2>{R(`太棒了！${dayPlan.dayName}課程圓滿通關！`)}</h2>
          <p>{R(`小朋友學會了「${dayPlan.themeTitle}」全部生字、生詞與成語！`)}</p>
          <div className="earned-stars-row">
            <Star size={44} className="star-gold" fill="currentColor" />
            <Star size={44} className="star-gold" fill="currentColor" />
            <Star size={44} className="star-gold" fill="currentColor" />
          </div>
          <div className="earned-rewards-pills-row">
            <div className="bonus-score-pill">
              <Star size={18} fill="currentColor" />
              <span>{R("獲得")} <b>+3 {R("顆星")}</b></span>
            </div>
            <div className="bonus-score-pill key-reward-pill">
              <Key size={18} />
              <span>{R("獲得")} <b>+1 {R("支鑰匙")}</b> 🗝️</span>
            </div>
          </div>
          <button
            className="finish-return-btn"
            onClick={() => onFinishLesson(3)}
          >
            {R(t("rewardClaimReturn"))}
          </button>
        </div>
      </div>
    );
  }

  // VOCABULARY MODE
  // LESSON TEXT (課文): read the dialogue and sentences first, then learn the characters in them.
  if (currentMode === "text") {
    const lines = dayPlan.lessonText ?? [];
    const useSimplified = scriptMode === "pinyin";
    const lineText = (line: { text: string; textHans: string }) => (useSimplified ? line.textHans : line.text);
    return (
      <div className="ipad-classroom-full">
        <header className="classroom-topbar">
          <button className="classroom-back-btn" onClick={onExitClass}>
            <X size={24} />
            <span>{R(t("exitClass"))}</span>
          </button>
          <div className="classroom-progress-info">
            <strong>📖 讀課文</strong>
            <span className="char-step-pill">{dayPlan.themeTitle}</span>
          </div>
          <div className="classroom-topbar-actions-right" />
        </header>

        <main className="classroom-stage">
          <section className="tx-lesson-text" aria-label="課文">
            <p className="tx-lesson-text-hint">點一句就能聽。先聽一聽、讀一讀，再去學生字。</p>
            <button type="button" className="tx-lesson-text-all" onClick={() => onPlaySound(lines.map(lineText).join("。"), "listen", true)}>
              <Volume2 size={22} aria-hidden="true" /> 全部聽一次
            </button>
            <ol className="tx-lesson-lines">
              {lines.map((line, index) => (
                <li key={`${index}-${line.text}`} className={`tx-lesson-line ${line.speaker ? `is-speaker-${line.speaker.toLowerCase()}` : "is-sentence"}`}>
                  {line.speaker && <span className="tx-lesson-speaker" aria-hidden="true">{line.speaker}</span>}
                  <button type="button" className="tx-lesson-line-button" onClick={() => onPlaySound(lineText(line), "listen", true)}>
                    <span className="tx-lesson-line-text" lang={useSimplified ? "zh-Hans" : "zh-Hant"}><LessonRuby text={lineText(line)} readings={BOOK1_READINGS} assist={phoneticAssist} /></span>
                    {line.en && displayLang !== "zh-Hant" && displayLang !== "zh-Hans" && <small className="tx-lesson-line-en">{line.en}</small>}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="classroom-footer">
          <span />
          <button className="nav-step-btn next-btn is-calling-soft" onClick={() => setCurrentMode("char")}>
            <span>開始學生字</span>
            <ChevronRight size={24} />
          </button>
        </footer>
      </div>
    );
  }

  if (currentMode === "vocab") {
    const vocabList = dayPlan.vocabulary || [];
    const currV = vocabList[vocabIdx] || vocabList[0];
    return (
      <div className="ipad-classroom-full">
        <header className="classroom-topbar">
          <button className="classroom-back-btn" onClick={() => setCurrentMode("char")}>
            <ChevronLeft size={24} />
            <span>返回生字主線</span>
          </button>

          <div className="classroom-progress-info">
            <strong>📚 {R(dayPlan.dayName)}：生詞認讀造句</strong>
            <span className="char-step-pill">
              詞彙 {vocabIdx + 1} / {vocabList.length}
            </span>
          </div>

          <div className="classroom-topbar-actions-right">
            {onToggleVoiceGuide && (
              <button
                type="button"
                className={`classroom-sound-toggle-btn ${isVoiceGuideEnabled ? "is-active" : "is-muted"}`}
                onClick={onToggleVoiceGuide}
                title={isVoiceGuideEnabled ? "語音說明已開啟（點擊靜音）" : "語音說明已關閉（點擊開啟）"}
              >
                {isVoiceGuideEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{isVoiceGuideEnabled ? "導讀 開" : "導讀 關"}</span>
              </button>
            )}
            <button className="classroom-back-btn" onClick={onExitClass}>
              <X size={24} />
              <span>{R(t("exitClass"))}</span>
            </button>
          </div>
        </header>

        <main className="classroom-stage">
          <div className="stage-step-card animate-fade">
            <span className="stage-step-badge">📚 生詞認讀與生活造句</span>

            <div className="vocab-mega-hero-box">
              <span className="vocab-mega-icon">{currV.icon}</span>
              <h2 className="vocab-mega-word">{currV.word}</h2>
              <div className="vocab-mega-phonetics">
                <span className="zhuyin-badge">{currV.zhuyin}</span>
                <span className="pinyin-badge">{currV.pinyin}</span>
              </div>
            </div>

            <div className="classroom-meaning-card">
              <span className="meaning-icon">💡</span>
              <div>
                <strong>詞義解釋</strong>
                <p>{currV.meaning}</p>
              </div>
            </div>

            <div className="story-snippet-card">
              <span className="example-word-tag">生活造句範例</span>
              <h3 className="story-sentence-text">「{currV.exampleSentence}」</h3>
            </div>

            <button
              className="classroom-touch-sound-btn"
              onClick={() => onPlaySound(`${currV.word}。${currV.zhuyin}。${currV.exampleSentence}`, undefined, true)}
            >
              <Volume2 size={28} />
              <span>播放標準發音與例句</span>
            </button>
          </div>
        </main>

        <footer className="classroom-footer">
          <button
            className="nav-step-btn prev-btn"
            onClick={() => setVocabIdx((prev) => Math.max(0, prev - 1))}
            disabled={vocabIdx === 0}
          >
            <ChevronLeft size={26} />
            <span>上一個生詞</span>
          </button>

          <div className="step-dots-row">
            {vocabList.map((_, idx) => (
              <span
                key={idx}
                className={`step-dot ${idx === vocabIdx ? "active" : ""} ${idx < vocabIdx ? "done" : ""}`}
              />
            ))}
          </div>

          <button
            className="nav-step-btn next-btn"
            onClick={() => {
              if (vocabIdx < vocabList.length - 1) {
                setVocabIdx((prev) => prev + 1);
              } else {
                setDictationPraiseToast("🎉 本日生詞已全部完成認讀！獲得生詞星星！");
                setTimeout(() => {
                  setCurrentMode("char");
                }, 1200);
              }
            }}
          >
            <span>{vocabIdx === vocabList.length - 1 ? "完成生詞學習 🎉" : "下一個生詞"}</span>
            <ChevronRight size={26} />
          </button>
        </footer>
      </div>
    );
  }

  // IDIOM MODE
  if (currentMode === "idiom") {
    const idiom = dayPlan.idiom;
    return (
      <div className="ipad-classroom-full">
        <header className="classroom-topbar">
          <button className="classroom-back-btn" onClick={() => setCurrentMode("char")}>
            <ChevronLeft size={24} />
            <span>返回生字主線</span>
          </button>

          <div className="classroom-progress-info">
            <strong>📖 {R(dayPlan.dayName)}：成語故事閱讀</strong>
          </div>

          <div className="classroom-topbar-actions-right">
            {onToggleVoiceGuide && (
              <button
                type="button"
                className={`classroom-sound-toggle-btn ${isVoiceGuideEnabled ? "is-active" : "is-muted"}`}
                onClick={onToggleVoiceGuide}
                title={isVoiceGuideEnabled ? "語音說明已開啟（點擊靜音）" : "語音說明已關閉（點擊開啟）"}
              >
                {isVoiceGuideEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{isVoiceGuideEnabled ? "導讀 開" : "導讀 關"}</span>
              </button>
            )}
            <button className="classroom-back-btn" onClick={onExitClass}>
              <X size={24} />
              <span>{R(t("exitClass"))}</span>
            </button>
          </div>
        </header>

        <main className="classroom-stage">
          <div className="stage-step-card animate-fade">
            <span className="stage-step-badge">📖 成語典故與情境故事</span>

            <div className="idiom-mega-hero-box">
              <span className="idiom-mega-icon">{idiom.idiomIcon}</span>
              <h2 className="idiom-mega-title">{idiom.idiomTitle}</h2>
              <div className="idiom-mega-phonetics">
                <span className="zhuyin-badge">{idiom.idiomZhuyin}</span>
                <span className="pinyin-badge">{idiom.idiomPinyin}</span>
              </div>
            </div>

            <div className="classroom-meaning-card">
              <span className="meaning-icon">💡</span>
              <div>
                <strong>成語釋義</strong>
                <p>{idiom.idiomMeaning}</p>
              </div>
            </div>

            <div className="story-snippet-card">
              <span className="example-word-tag">故事典故背景</span>
              <p className="story-sentence-text">{idiom.storyContext || "通過這則成語，學習團結與堅持的智慧！"}</p>
            </div>

            <button
              className="classroom-touch-sound-btn"
              onClick={() => onPlaySound(`${idiom.idiomTitle}。${idiom.idiomMeaning}。${idiom.storyContext || ""}`, undefined, true)}
            >
              <Volume2 size={28} />
              <span>播放成語故事朗讀</span>
            </button>
          </div>
        </main>

        <footer className="classroom-footer">
          <button className="nav-step-btn prev-btn" onClick={() => setCurrentMode("char")}>
            <ChevronLeft size={26} />
            <span>返回生字學習</span>
          </button>

          <button
            className="nav-step-btn next-btn"
            onClick={() => {
              setDictationPraiseToast("🎉 成語故事學習完成！獲得成語星星！");
              setTimeout(() => {
                setCurrentMode("char");
              }, 1200);
            }}
          >
            <span>完成成語學習 🎉</span>
            <Check size={26} />
          </button>
        </footer>
      </div>
    );
  }

  // MINI QUIZ SCREEN
  if (showQuiz) {
    const currQ = dayPlan.quizQuestions[quizIdx] || dayPlan.quizQuestions[0];
    const chosen = selectedAnswers[quizIdx];
    const hasAnswered = chosen !== undefined;
    const isCorrect = hasAnswered && currQ.options[chosen]?.isCorrect;

    return (
      <div className="ipad-classroom-full">
        <header className="classroom-topbar">
          <button className="classroom-back-btn" onClick={() => setShowQuiz(false)}>
            <ChevronLeft size={24} />
            <span>返回練字區</span>
          </button>

          <div className="classroom-progress-info">
            <strong>🎯 課後通關測驗</strong>
            <span className="char-step-pill">
              題 {quizIdx + 1} / {dayPlan.quizQuestions.length}
            </span>
          </div>

          <div className="classroom-topbar-actions-right">
            {onToggleVoiceGuide && (
              <button
                type="button"
                className={`classroom-sound-toggle-btn ${isVoiceGuideEnabled ? "is-active" : "is-muted"}`}
                onClick={onToggleVoiceGuide}
                title={isVoiceGuideEnabled ? "語音說明已開啟（點擊靜音）" : "語音說明已關閉（點擊開啟）"}
              >
                {isVoiceGuideEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{isVoiceGuideEnabled ? "導讀 開" : "導讀 關"}</span>
              </button>
            )}
            <button className="classroom-back-btn" onClick={onExitClass}>
              <X size={24} />
              <span>{R(t("exitClass"))}</span>
            </button>
          </div>
        </header>

        <main className="classroom-stage">
          <div className="stage-step-card animate-fade">
            <span className="stage-step-badge">🎯 今日生字通關小測驗</span>

            <div className="quiz-container-full">
              <div className="quiz-question-box">
                <div className="quiz-meta-row">
                  <span className="quiz-q-num">第 {quizIdx + 1} 題 · {currQ.title}</span>
                </div>

                <h3 className="quiz-prompt-text">{currQ.prompt}</h3>
                {currQ.audioText && (
                  <ListenButton key={quizIdx} text={currQ.audioText} onPlay={(text) => onPlaySound(text, "listen", true)} />
                )}

                <div className="quiz-options-grid">
                  {currQ.options.map((opt, optIdx) => {
                    const isThisChosen = chosen === optIdx;
                    let btnClass = "quiz-option-btn";
                    if (hasAnswered) {
                      if (opt.isCorrect) btnClass += " is-correct";
                      else if (isThisChosen) btnClass += " is-wrong";
                    }

                    return (
                      <button
                        key={optIdx}
                        className={btnClass}
                        onClick={() => {
                          if (!hasAnswered) {
                            setSelectedAnswers((prev) => ({ ...prev, [quizIdx]: optIdx }));
                            if (opt.isCorrect) {
                              onPlaySound(VOICE_PHRASES.answerCorrect);
                            } else {
                              onPlaySound(VOICE_PHRASES.answerTryAgain);
                            }
                          }
                        }}
                      >
                        <span className="opt-main-text">{opt.text}</span>
                        {/* In listening questions the pronunciation would give the answer away, so it shows only after answering. */}
                        {opt.subText && (hasAnswered || !currQ.audioText) && <small className="opt-sub-text">{opt.subText}</small>}
                      </button>
                    );
                  })}
                </div>

                {hasAnswered && (
                  <div className={`quiz-feedback-box ${isCorrect ? "correct" : "wrong"}`}>
                    {isCorrect ? (
                      <span>🎉 {currQ.explanation}</span>
                    ) : (
                      <span>💡 {currQ.explanation}</span>
                    )}
                  </div>
                )}

                <div className="quiz-nav-row">
                  {quizIdx < dayPlan.quizQuestions.length - 1 ? (
                    <button
                      className={`quiz-next-q-btn ${hasAnswered ? "is-calling" : ""}`}
                      disabled={!hasAnswered}
                      onClick={() => setQuizIdx((prev) => prev + 1)}
                    >
                      下一題 <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button
                      className={`quiz-finish-btn ${hasAnswered ? "is-calling" : ""}`}
                      disabled={!hasAnswered}
                      onClick={() => setQuizFinished(true)}
                    >
                      完成今日課程 🎉
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
