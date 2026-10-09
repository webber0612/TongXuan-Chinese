import { useState,useEffect,useRef,type ReactNode } from "react";
import HanziWriter from "hanzi-writer";
import {
EMPTY_WRITING_PROGRESS,
getWritingPlan,
isWritingMastered,
recordIndependentWritingFailure,
recordWritingSuccess,
writingProgressKey,
writingSuccessCount,
type WritingPhase,
type WritingProgress,
type WritingVariant,
} from "../../lib/adaptiveWriting";
import {
Volume2,Play,Star,ChevronLeft,
ChevronRight,X,Check,Key,RotateCcw,Hand,
VolumeX,Pause
} from "lucide-react";

import { ScriptMode,DisplayLang,PhoneticAssist,HandMode,SpeechSpeed,DailyDayPlan,HanziItem } from "./types";
import { getVariantLabels } from "./variantLabels";
export function InteractiveClassroom({
  dayPlan,
  learnerId,
  scriptMode,
  displayLang,
  showPhonetics,
  phoneticAssist,
  mode = "char",
  handMode = "right",
  onUpdateHandMode,
  isVoiceGuideEnabled = false,
  onToggleVoiceGuide,
  R,
  t,
  initialStep = 1,
  onPlaySound,
  onFinishLesson,
  onExitClass
}: {
  dayPlan: DailyDayPlan;
  learnerId: string;
  scriptMode: ScriptMode;
  displayLang: DisplayLang;
  showPhonetics: boolean;
  phoneticAssist: PhoneticAssist;
  mode?: "char" | "vocab" | "idiom";
  handMode?: HandMode;
  onUpdateHandMode?: (mode: HandMode) => void;
  isVoiceGuideEnabled?: boolean;
  onToggleVoiceGuide?: () => void;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
  initialStep?: 1 | 2 | 3 | 4 | 5;
  onPlaySound: (text: string, speed?: SpeechSpeed, force?: boolean) => void;
  onFinishLesson: (stars: number) => void;
  onExitClass: () => void;
}) {
  const [currentMode, setCurrentMode] = useState<"char" | "vocab" | "idiom">(mode);
  const [currentHandMode, setCurrentHandMode] = useState<HandMode>(handMode);
  
  // Character navigation index
  const [currentCharIdx, setCurrentCharIdx] = useState(0);

  // Practice state is scoped by learner, character, and script variant.
  const [writingProgress, setWritingProgress] = useState<Record<string, WritingProgress>>(() => {
    try {
      return JSON.parse(localStorage.getItem("tongxuan_writing_progress_v2") || "{}");
    } catch (e) {
      return {};
    }
  });
  const writingProgressRef = useRef(writingProgress);
  writingProgressRef.current = writingProgress;
  const [masteryChecksThisVisit, setMasteryChecksThisVisit] = useState<Record<string, boolean>>({});

  // Multilingual Trad / Simp Labels
  const variantLabels = getVariantLabels(displayLang);

  // Simplified / Traditional Variant Mode for distinct characters ("trad" vs "hans")
  const [activeVariant, setActiveVariant] = useState<"trad" | "hans">(() => {
    return scriptMode === "pinyin" ? "hans" : "trad";
  });

  const characters = dayPlan.characters;
  const currentChar = characters[currentCharIdx] || characters[0];
  const totalChars = characters.length;
  const isDiff = currentChar ? currentChar.char !== currentChar.charHans : false;

  const practiceKeyFor = (character: HanziItem, variant: WritingVariant = "trad") =>
    writingProgressKey(learnerId, character.char, character.char !== character.charHans ? variant : "trad");
  const progressFor = (character: HanziItem, variant: WritingVariant = "trad") =>
    writingProgress[practiceKeyFor(character, variant)] || EMPTY_WRITING_PROGRESS;
  const practiceDoneFor = (character: HanziItem, variant: WritingVariant = "trad") => {
    const progress = progressFor(character, variant);
    return progress.mastered || isWritingMastered(progress);
  };

  const currentPracticeKey = currentChar ? practiceKeyFor(currentChar, activeVariant) : "";
  const currentProgress = currentChar ? progressFor(currentChar, activeVariant) : EMPTY_WRITING_PROGRESS;
  const currentPlan = getWritingPlan(currentProgress, Boolean(masteryChecksThisVisit[currentPracticeKey]));
  const [remainingPractice, setRemainingPractice] = useState<number>(currentPlan.remaining);
  
  // Speech speed: "normal" (🐇 兔子) / "slow" (🐢 烏龜)
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>("normal");

  // Dictation Canvas State with Palm Rejection
  const [showDictationHint, setShowDictationHint] = useState(false);
  const [dictationPraiseToast, setDictationPraiseToast] = useState<string | null>(null);

  // Stroke Order Animation Play state
  const [isPlayingStrokes, setIsPlayingStrokes] = useState(false);
  const [activeStrokeIndex, setActiveStrokeIndex] = useState<number>(-1);

  // Mini Quiz State
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);

  // Vocabulary Mode Carousel State
  const [vocabIdx, setVocabIdx] = useState(0);

  const toggleHandMode = () => {
    const next = currentHandMode === "right" ? "left" : "right";
    setCurrentHandMode(next);
    localStorage.setItem("tongxuan_hand_mode", next);
    if (onUpdateHandMode) onUpdateHandMode(next);
  };

  const hanziContainerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const childInkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const attemptMistakeRef = useRef(false);

  const charToRender = isDiff
    ? (activeVariant === "hans" ? currentChar.charHans : currentChar.char)
    : (scriptMode === "pinyin" ? currentChar.charHans : currentChar.char);

  const clearChildInkCanvas = () => {
    if (childInkCanvasRef.current) {
      const ctx = childInkCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, childInkCanvasRef.current.width, childInkCanvasRef.current.height);
      }
    }
  };

  // Hints fade by practice phase and are hidden for independent writing.
  const getOutlineOpacity = (phase: WritingPhase, forceHint: boolean) => {
    if (forceHint) return 1.0;
    if (phase === "guided") return 0.9;
    if (phase === "reduced_hint") return 0.35;
    return 0;
  };

  const applyOutlineOpacity = (writer: HanziWriter, opacity: number) => {
    if (!writer) return;
    if (opacity <= 0.005) {
      writer.hideOutline();
    } else {
      writer.showOutline();
      const colorStr = `rgba(217, 119, 6, ${opacity.toFixed(2)})`;
      writer.updateColor("outlineColor", colorStr);
    }
  };

  const updateWritingProgress = (key: string, update: (current: WritingProgress) => WritingProgress) => {
    const current = writingProgressRef.current[key] || EMPTY_WRITING_PROGRESS;
    const next = { ...writingProgressRef.current, [key]: update(current) };
    writingProgressRef.current = next;
    setWritingProgress(next);
    try {
      localStorage.setItem("tongxuan_writing_progress_v2", JSON.stringify(next));
    } catch (e) {}
    return next[key];
  };

  const recordPracticeSuccess = () => {
    const next = updateWritingProgress(currentPracticeKey, (state) => recordWritingSuccess(state, currentPlan.phase));
    if (next.mastered) {
      setMasteryChecksThisVisit((previous) => ({ ...previous, [currentPracticeKey]: true }));
    }
    return next;
  };

  const recordIndependentFailure = () => {
    const next = updateWritingProgress(currentPracticeKey, recordIndependentWritingFailure);
    setRemainingPractice(getWritingPlan(next, Boolean(masteryChecksThisVisit[currentPracticeKey])).remaining);
  };

  const startInteractiveQuiz = (writer: HanziWriter, outlineOpacity: number) => {
    try {
      applyOutlineOpacity(writer, outlineOpacity);

      writer.quiz({
        showHintAfterMisses: 3,
        leniency: 0.65, // 嚴格比對筆跡起筆、軌跡與落點
        acceptBackwardsStrokes: false, // 嚴格禁止反向筆畫
        highlightOnComplete: false, // 不使用電腦字型高亮覆蓋孩子筆跡
        onMistake: (strokeData) => {
          if (!attemptMistakeRef.current) {
            attemptMistakeRef.current = true;
            if (currentPlan.phase === "independent") recordIndependentFailure();
          }
          // 落筆或筆順錯誤時立即閃爍提示下一筆
          try {
            writer.highlightStroke(strokeData.strokeNum);
          } catch (e) {
            console.warn("highlight stroke error:", e);
          }

          if (strokeData.isBackwards) {
            setDictationPraiseToast("筆畫方向反了喔！已閃爍提示筆勢 ✍️");
          } else {
            setDictationPraiseToast(`第 ${strokeData.strokeNum + 1} 筆落點偏離，已閃爍提示下一筆 💡`);
          }
          setTimeout(() => setDictationPraiseToast(null), 1600);
        },
        onCorrectStroke: (strokeData) => {
          // 保留並繪製兒童真實筆跡到專屬畫布上，不拿電腦字型取代
          if (childInkCanvasRef.current && strokeData.drawnPath?.pathString) {
            const ctx = childInkCanvasRef.current.getContext("2d");
            if (ctx) {
              ctx.strokeStyle = "#1e3a8a";
              ctx.lineWidth = 14;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              try {
                const path = new Path2D(strokeData.drawnPath.pathString);
                ctx.stroke(path);
              } catch (e) {}
            }
          }
          // 確保 HanziWriter 隱藏電腦標準字型，完整展現孩子真實筆跡
          writer.hideCharacter();

          setDictationPraiseToast(`第 ${strokeData.strokeNum + 1} 筆正確！✨`);
          setTimeout(() => setDictationPraiseToast(null), 900);
        },
        onComplete: (_summary) => {
          // 保持孩子真實筆跡在畫布上
          writer.hideCharacter();
          const nextProgress = recordPracticeSuccess();
          attemptMistakeRef.current = false;
          const nextPlan = getWritingPlan(nextProgress, nextProgress.mastered || Boolean(masteryChecksThisVisit[currentPracticeKey]));
          setRemainingPractice(nextPlan.remaining);
          if (nextProgress.mastered && isDiff) {
            const otherVariant: WritingVariant = activeVariant === "trad" ? "hans" : "trad";
            if (!practiceDoneFor(currentChar, otherVariant)) {
              const currLabel = activeVariant === "trad" ? variantLabels.trad : variantLabels.simp;
              const nextLabel = activeVariant === "trad" ? variantLabels.simp : variantLabels.trad;
              setDictationPraiseToast(`🎉 ${currLabel} 字形已熟練！接著練 ${nextLabel} 字形。`);
            } else {
              setDictationPraiseToast("🎉 兩種字形都已熟練！");
            }
          } else if (nextProgress.mastered) {
            setDictationPraiseToast("🎉 這個字已熟練！可以繼續下一個字。");
          } else {
            const phaseLabel = nextPlan.phase === "guided" ? "跟著提示" : nextPlan.phase === "reduced_hint" ? "減少提示" : "獨立書寫";
            setDictationPraiseToast(`✨ ${phaseLabel} · 本階段還要 ${nextPlan.remaining} 次`);
          }
          setTimeout(() => {
            setDictationPraiseToast(null);
            clearChildInkCanvas();
            if (writerRef.current) {
              writerRef.current.cancelQuiz();
              writerRef.current.hideCharacter();
              const nextOpacity = getOutlineOpacity(nextPlan.phase, showDictationHint);
              applyOutlineOpacity(writerRef.current, nextOpacity);
              startInteractiveQuiz(writerRef.current, nextOpacity);
            }
          }, 1600);
        },
      });
    } catch (err) {
      console.warn("Quiz start:", err);
    }
  };

  // Switch Variant (繁體 vs 簡體) - Only enabled when isDiff is true
  const handleSelectVariant = (variant: "trad" | "hans") => {
    if (!isDiff) return; // 繁簡同字禁止切換
    setActiveVariant(variant);
    const key = practiceKeyFor(currentChar, variant);
    const plan = getWritingPlan(progressFor(currentChar, variant), Boolean(masteryChecksThisVisit[key]));
    setRemainingPractice(plan.remaining);
    attemptMistakeRef.current = false;
    clearChildInkCanvas();
  };

  // Initialize authentic 標楷體 / 楷體 HanziWriter engine with real stroke order checking
  useEffect(() => {
    if (!hanziContainerRef.current) return;
    hanziContainerRef.current.innerHTML = "";
    clearChildInkCanvas();

    const outlineOpacity = getOutlineOpacity(currentPlan.phase, showDictationHint);
    const outlineColorStr = `rgba(217, 119, 6, ${outlineOpacity.toFixed(3)})`;

    try {
      const writer = HanziWriter.create(hanziContainerRef.current, charToRender, {
        width: 310,
        height: 310,
        padding: 24,
        showOutline: outlineOpacity > 0.005,
        strokeAnimationSpeed: 1.25,
        strokeHighlightSpeed: 2.4,
        delayBetweenStrokes: 180,
        strokeColor: "#2563eb",
        outlineColor: outlineColorStr,
        highlightColor: "#f59e0b",
        drawingColor: "#1e3a8a",
        drawingWidth: 14,
        showCharacter: false,
      });
      writerRef.current = writer;

      // Start real-time stroke order checking quiz mode with strict tolerance
      startInteractiveQuiz(writer, outlineOpacity);
    } catch (err) {
      console.warn("HanziWriter initialization error:", err);
    }

    return () => {
      try {
        writerRef.current?.cancelQuiz();
      } catch (e) {}
    };
  }, [currentCharIdx, charToRender, activeVariant, showDictationHint, currentPlan.phase]);

  const clearCanvas = () => {
    attemptMistakeRef.current = false;
    clearChildInkCanvas();
    if (writerRef.current) {
      writerRef.current.cancelQuiz();
      writerRef.current.hideCharacter();
      const outlineOpacity = getOutlineOpacity(currentPlan.phase, showDictationHint);
      applyOutlineOpacity(writerRef.current, outlineOpacity);
      startInteractiveQuiz(writerRef.current, outlineOpacity);
    }
    setDictationPraiseToast("請依標準筆順開始書寫 ✍️");
    setTimeout(() => setDictationPraiseToast(null), 1200);
  };

  const handlePlayCurrentCharSound = (overrideSpeed?: SpeechSpeed) => {
    const speed = overrideSpeed || speechSpeed;
    onPlaySound(
      `${currentChar.char}。${currentChar.zhuyin}${currentChar.zhuyinTone}。${currentChar.exampleWord}`,
      speed,
      true
    );
  };

  // Stroke Order Animation: Demonstrates full character, then hides filled character for child to write
  const handlePlayStrokeAnimation = () => {
    if (isPlayingStrokes || !writerRef.current) return;
    clearChildInkCanvas();
    setIsPlayingStrokes(true);
    const writer = writerRef.current;
    writer.cancelQuiz();
    writer.hideCharacter();

    try {
      writer.animateCharacter({
        onComplete: () => {
          setIsPlayingStrokes(false);
          setActiveStrokeIndex(-1);
          // Hides filled demonstration character and returns to child handwriting mode
          writer.hideCharacter();
          const outlineOpacity = getOutlineOpacity(currentPlan.phase, showDictationHint);
          startInteractiveQuiz(writer, outlineOpacity);
        },
      });
    } catch (err) {
      setIsPlayingStrokes(false);
      const outlineOpacity = getOutlineOpacity(currentPlan.phase, showDictationHint);
      startInteractiveQuiz(writer, outlineOpacity);
    }
  };

  const handleNextChar = () => {
    // Check if current distinct character has completed both variants
    if (isDiff) {
      const isTradDone = practiceDoneFor(currentChar, "trad");
      const isHansDone = practiceDoneFor(currentChar, "hans");

      if (!isTradDone && activeVariant === "hans") {
        handleSelectVariant("trad");
        setDictationPraiseToast(`💡 請先完成 ${variantLabels.trad} 字形的階段練習。`);
        setTimeout(() => setDictationPraiseToast(null), 1800);
        return;
      }
      if (!isHansDone && activeVariant === "trad") {
        handleSelectVariant("hans");
        setDictationPraiseToast(`💡 請先完成 ${variantLabels.simp} 字形的階段練習。`);
        setTimeout(() => setDictationPraiseToast(null), 1800);
        return;
      }
    }

    if (currentCharIdx < totalChars - 1) {
      const nextIdx = currentCharIdx + 1;
      const nextChar = characters[nextIdx];
      const nextIsDiff = nextChar.char !== nextChar.charHans;
      const nextTradDone = practiceDoneFor(nextChar, "trad");
      const nextHansDone = practiceDoneFor(nextChar, "hans");

      let nextVariant: "trad" | "hans" = scriptMode === "pinyin" ? "hans" : "trad";
      if (nextIsDiff) {
        if (nextTradDone && !nextHansDone) nextVariant = "hans";
        else if (nextHansDone && !nextTradDone) nextVariant = "trad";
      }

      const nextKey = practiceKeyFor(nextChar, nextVariant);
      const nextPlan = getWritingPlan(progressFor(nextChar, nextVariant), Boolean(masteryChecksThisVisit[nextKey]));

      setCurrentCharIdx(nextIdx);
      setActiveVariant(nextVariant);
      setRemainingPractice(nextPlan.remaining);
      setShowDictationHint(false);
      clearCanvas();
    } else {
      setShowQuiz(true);
    }
  };

  const handlePrevChar = () => {
    if (currentCharIdx > 0) {
      const prevIdx = currentCharIdx - 1;
      const prevChar = characters[prevIdx];
      const prevIsDiff = prevChar.char !== prevChar.charHans;
      const prevTradDone = practiceDoneFor(prevChar, "trad");
      const prevHansDone = practiceDoneFor(prevChar, "hans");

      let prevVariant: "trad" | "hans" = scriptMode === "pinyin" ? "hans" : "trad";
      if (prevIsDiff) {
        if (prevTradDone && !prevHansDone) prevVariant = "hans";
        else if (prevHansDone && !prevTradDone) prevVariant = "trad";
      }

      const prevKey = practiceKeyFor(prevChar, prevVariant);
      const prevPlan = getWritingPlan(progressFor(prevChar, prevVariant), Boolean(masteryChecksThisVisit[prevKey]));

      setCurrentCharIdx(prevIdx);
      setActiveVariant(prevVariant);
      setRemainingPractice(prevPlan.remaining);
      setShowDictationHint(false);
      clearCanvas();
    }
  };

  // Keep the canvas shadow aligned with the current hint phase.
  const shadowOpacity = showDictationHint
    ? 0.38
    : currentPlan.phase === "guided" ? 0.32 : currentPlan.phase === "reduced_hint" ? 0.16 : 0;

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
                  {currQ.audioText && (
                    <button
                      className="quiz-sound-btn"
                      onClick={() => onPlaySound(currQ.audioText || "", undefined, true)}
                      title="聽題目發音"
                    >
                      <Volume2 size={20} />
                      <span>播放語音</span>
                    </button>
                  )}
                </div>

                <h3 className="quiz-prompt-text">{currQ.prompt}</h3>

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
                              onPlaySound("答對了！太聰明了！");
                            } else {
                              onPlaySound("再想想看喔！");
                            }
                          }
                        }}
                      >
                        <span className="opt-main-text">{opt.text}</span>
                        {opt.subText && <small className="opt-sub-text">{opt.subText}</small>}
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
                      className="quiz-next-q-btn"
                      disabled={!hasAnswered}
                      onClick={() => setQuizIdx((prev) => prev + 1)}
                    >
                      下一題 <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button
                      className="quiz-finish-btn"
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

  // ========================================================
  // CHARACTER SPLIT VIEW: ① 練字區 vs ② 資訊區
  // ========================================================
  const tradProgress = progressFor(currentChar, "trad");
  const hansProgress = progressFor(currentChar, "hans");
  const tradCount = writingSuccessCount(tradProgress);
  const hansCount = writingSuccessCount(hansProgress);
  const tradDone = practiceDoneFor(currentChar, "trad");
  const hansDone = practiceDoneFor(currentChar, "hans");

  const WritingPanel = (
    <div className="writing-split-panel animate-fade">
      {/* 1. TOP BAR: CLEAR TOOL (LEFT) + PROGRESS INDICATOR (RIGHT) */}
      <div className="writing-topbar-row">
        {/* Left Tool: 🧹 Clear Canvas & ✋ Hand Mode Switcher */}
        <div className="writing-tools-left" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="tool-circle-btn"
            onClick={clearCanvas}
            title="清除畫布重寫"
          >
            <RotateCcw size={20} />
          </button>
          <button
            type="button"
            className="handedness-toggle-btn"
            onClick={toggleHandMode}
            title={currentHandMode === "right" ? "目前為右手模式（練字在右），點擊切換為左手" : "目前為左手模式（練字在左），點擊切換為右手"}
            style={{ padding: "4px 10px", fontSize: "0.8rem" }}
          >
            <Hand size={16} />
            <span>{currentHandMode === "right" ? "✋ 右手 (換手)" : "🤚 左手 (換手)"}</span>
          </button>
        </div>

        {/* Right: Practice Progress Indicator Pill */}
        <div className="writing-topbar-right">
          <div className={`practice-status-pill ${remainingPractice === 0 ? "is-finished" : ""}`}>
            <span className="practice-pill-icon">🎯</span>
            <span className="practice-pill-text">
              {remainingPractice === 0 ? "練習完成 🎉" : currentPlan.phase === "guided" ? "跟著提示練習" : currentPlan.phase === "reduced_hint" ? "減少提示練習" : "獨立書寫練習"}
            </span>
            {remainingPractice > 0 ? (
              <span className="practice-count-badge" title="本階段尚需完成的練習次數">
                本階段剩 {remainingPractice} 次
              </span>
            ) : (
              <span className="practice-count-badge" style={{ background: "#10b981" }}>
                ✓ 達成
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. CENTER: HUGE TIANZIGE CANVAS WITH BIAUKAI / KAITI FONT & PALM REJECTION */}
      <div className="writing-canvas-viewport">
        <div className="touch-tianzi-canvas-mega">
          {/* Tianzige Cross & Diagonal Dashed Lines */}
          <div className="tianzi-grid-lines">
            <div className="grid-center-h" />
            <div className="grid-center-v" />
            <div className="grid-diag-1" />
            <div className="grid-diag-2" />
          </div>

          {/* HanziWriter Authentic 標楷體 Vector Stroke & Interactive Quiz Layer */}
          <div
            ref={hanziContainerRef}
            className="hanzi-writer-svg-layer"
          />

          {/* Child Authentic Handwriting Canvas Overlay */}
          <canvas
            ref={childInkCanvasRef}
            className="child-authentic-ink-canvas"
            width={310}
            height={310}
          />

          {/* Praise Toast Overlay */}
          {dictationPraiseToast && (
            <div className="writing-toast-pill animate-fade">
              {dictationPraiseToast}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM BAR: PLAY STROKE ORDER (LEFT) + UNIFIED SPEAKER/SPEED CAPSULE (RIGHT) */}
      <div className="writing-bottombar-row">
        {/* Left: Play Stroke Order Animation Button */}
        <div className="writing-action-left">
          <button
            type="button"
            className={`play-stroke-order-btn ${isPlayingStrokes ? "is-playing" : ""}`}
            onClick={handlePlayStrokeAnimation}
            title="播放筆畫順序引導"
          >
            {isPlayingStrokes ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
            <span>{isPlayingStrokes ? "播放中..." : "筆畫展示"}</span>
          </button>
        </div>

        {/* Right: UNIFIED SPEAKER + SPEED SWITCHER CAPSULE */}
        <div className="writing-sound-right">
          <div className="unified-sound-speed-capsule" role="group" aria-label="發音與速度切換膠囊">
            {/* Speaker Button on the Left */}
            <button
              type="button"
              className="capsule-speaker-side-btn"
              onClick={() => handlePlayCurrentCharSound(speechSpeed)}
              title="點擊聽標準發音"
            >
              <Volume2 size={22} />
            </button>

            <div className="capsule-divider" />

            {/* Rabbit / Turtle Speed Toggle on the Right */}
            <div className="capsule-speed-toggle-side">
              <button
                type="button"
                className={`speed-option-btn ${speechSpeed === "slow" ? "active" : ""}`}
                onClick={() => setSpeechSpeed("slow")}
                title="烏龜慢速 (0.5x)"
              >
                🐢 慢速
              </button>
              <button
                type="button"
                className={`speed-option-btn ${speechSpeed === "normal" ? "active" : ""}`}
                onClick={() => setSpeechSpeed("normal")}
                title="兔子正常 (1.0x)"
              >
                🐇 正常
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const InfoPanel = (
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

  return (
    <div className="ipad-classroom-full">
      {/* Top Header */}
      <header className="classroom-topbar">
        <button className="classroom-back-btn" onClick={onExitClass} title="退出教室">
          <X size={24} />
          <span>{R(t("exitClass"))}</span>
        </button>

        {/* Character Navigation Tabs with Practice Completion Checkmarks */}
        <div className="classroom-pills-row">
          {characters.map((c, i) => {
            const cIsDiff = c.char !== c.charHans;
            const isCompleted = cIsDiff
              ? practiceDoneFor(c, "trad") && practiceDoneFor(c, "hans")
              : practiceDoneFor(c, "trad");
            const isSelected = i === currentCharIdx;

            return (
              <button
                key={c.char}
                className={`pill-dot ${isSelected ? "active" : ""} ${isCompleted ? "is-char-completed" : ""}`}
                onClick={() => {
                  const nextVariant = scriptMode === "pinyin" ? "hans" : "trad";
                  const nextKey = practiceKeyFor(c, nextVariant);
                  const nextPlan = getWritingPlan(progressFor(c, nextVariant), Boolean(masteryChecksThisVisit[nextKey]));

                  setCurrentCharIdx(i);
                  setActiveVariant(nextVariant);
                  setRemainingPractice(nextPlan.remaining);
                  clearCanvas();
                }}
                title={`${c.char}${cIsDiff ? ` / ${c.charHans}` : ""} ${isCompleted ? "（已熟練 ✓）" : ""}`}
              >
                <span className="pill-char-glyph">
                  {scriptMode === "pinyin" ? c.charHans : c.char}
                </span>
                {isCompleted && <span className="pill-check-icon">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="classroom-topbar-actions-right">
          {/* Voice Guide Quick Toggle */}
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

          {/* Handedness Switcher Button */}
          <button
            className="handedness-toggle-btn"
            onClick={toggleHandMode}
            title={currentHandMode === "right" ? "目前為右手模式（練字在右），點擊切換為左手" : "目前為左手模式（練字在左），點擊切換為右手"}
          >
            <Hand size={18} />
            <span>{currentHandMode === "right" ? "✋ 右手" : "🤚 左手"}</span>
          </button>
        </div>
      </header>

      {/* Main Split-Screen Stage */}
      <main className="classroom-stage-split">
        <div className={`classroom-split-layout ${currentHandMode === "left" ? "layout-left-hand" : "layout-right-hand"}`}>
          {currentHandMode === "left" ? (
            <>
              {WritingPanel}
              {InfoPanel}
            </>
          ) : (
            <>
              {InfoPanel}
              {WritingPanel}
            </>
          )}
        </div>
      </main>

      {/* Bottom Navigation Footer */}
      <footer className="classroom-footer">
        <button
          className="nav-step-btn prev-btn"
          onClick={handlePrevChar}
          disabled={currentCharIdx === 0}
        >
          <ChevronLeft size={26} />
          <span>上一個生字</span>
        </button>

        <span className="char-progress-counter-tag">
          生字 <b>{currentCharIdx + 1}</b> / {totalChars}
        </span>

        <button className="nav-step-btn next-btn" onClick={handleNextChar}>
          <span>{currentCharIdx === totalChars - 1 ? "前往課後測驗 🎯" : "下一個生字"}</span>
          <ChevronRight size={26} />
        </button>
      </footer>
    </div>
  );
}

