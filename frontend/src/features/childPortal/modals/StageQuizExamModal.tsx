import { useState,type ReactNode } from "react";
import {
Volume2,X
} from "lucide-react";
import {
TONGXUAN_AUTHORED_DRAFT_LEVELS,
type CourseLevel,type QuizQuestionItem,generateQuizPaper
} from "../../../data/learningPathData";

import { ScriptMode,DisplayLang,PhoneticAssist,SpeechSpeed,PinkyPromisePact } from "../types";
/* ========================================================
   6. 階段檢核測驗券 & 全冊大驗收互動考場 (Stage Quiz & Milestone Exam Modal)
   - 幸運開箱抽 100~200 金幣
   - 「🤙 學習打勾勾約定」3 天連續打卡獎勵翻倍機制
   ======================================================== */
export function StageQuizExamModal({
  targetLevel,
  scriptMode,
  displayLang,
  phoneticAssist,
  learnerName,
  R,
  playSound,
  onClose,
  onPassExam
}: {
  targetLevel: CourseLevel;
  scriptMode: ScriptMode;
  displayLang: DisplayLang;
  phoneticAssist: PhoneticAssist;
  learnerName: string;
  R: (text: string) => ReactNode;
  playSound: (text: string, speed?: SpeechSpeed, force?: boolean) => void;
  onClose: () => void;
  onPassExam: (earnedStars: number, score: number, coins: number, pact: PinkyPromisePact | null) => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestionItem[]>(() =>
    generateQuizPaper(targetLevel, TONGXUAN_AUTHORED_DRAFT_LEVELS)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [examScore, setExamScore] = useState(0);

  // Lucky Chest & Pinky Promise States
  const [drawnChestCoins, setDrawnChestCoins] = useState<number | null>(null);
  const [isChestOpened, setIsChestOpened] = useState(false);
  const [showPactDialog, setShowPactDialog] = useState(false);

  const isMilestone = targetLevel.type === "milestone_exam";
  const currentQ = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  const handleSelectOption = (optIdx: number) => {
    if (isSubmitted) return;
    const newAnswers = { ...selectedAnswers, [currentQ.id]: optIdx };
    setSelectedAnswers(newAnswers);
    const chosenOpt = currentQ.options[optIdx];
    if (chosenOpt) {
      playSound(chosenOpt.text, "normal", true);
    }
  };

  const handleSubmitExam = () => {
    let correct = 0;
    questions.forEach((q) => {
      const chosen = selectedAnswers[q.id];
      if (chosen !== undefined && q.options[chosen]?.isCorrect) {
        correct++;
      }
    });
    const finalScore = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 100;
    setExamScore(finalScore);
    setIsSubmitted(true);

    if (finalScore >= 60) {
      // 隨機抽取 100 ~ 200 金幣
      const randomCoins = Math.floor(100 + Math.random() * 101);
      setDrawnChestCoins(randomCoins);
      playSound(`太棒了！測驗成績 ${finalScore} 分！成功通關！快來開啟幸運大寶箱！`, "normal", true);
    } else {
      playSound(`這次考了 ${finalScore} 分，差一點點就過關了，再複習一下試試看吧！`, "normal", true);
    }
  };

  const handleOpenLuckyChest = () => {
    setIsChestOpened(true);
    playSound(`恭喜開箱獲得 ${drawnChestCoins} 金幣！`, "normal", true);
    setShowPactDialog(true);
  };

  const handleAcceptPinkyPromise = () => {
    const stars = examScore >= 90 ? 3 : examScore >= 70 ? 2 : 1;
    const totalCoins = (isMilestone ? 100 : 30) + (drawnChestCoins || 100);
    const pact: PinkyPromisePact = {
      bonusCoins: drawnChestCoins || 100,
      requiredDays: 3,
      currentDays: 0,
      startDate: new Date().toLocaleDateString(),
      isCompleted: false,
      rewardClaimed: false
    };
    playSound("太棒了！我們打勾勾！連續 3 天每天認真完成 1 關，第 3 天完成時獎勵翻倍送給你！", "normal", true);
    onPassExam(stars, examScore, totalCoins, pact);
  };

  const handleDeclinePinkyPromise = () => {
    const stars = examScore >= 90 ? 3 : examScore >= 70 ? 2 : 1;
    const totalCoins = (isMilestone ? 100 : 30) + (drawnChestCoins || 100);
    onPassExam(stars, examScore, totalCoins, null);
  };

  return (
    <div className="modal-backdrop exam-modal-backdrop">
      <div className="stage-quiz-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉考場">
          <X size={20} />
        </button>

        {/* Exam Header */}
        <div className="stage-quiz-header">
          <div className="quiz-header-badge">
            <span className="quiz-header-icon">{isMilestone ? "👑" : "📝"}</span>
            <div>
              <h2 className="quiz-header-title">
                {isMilestone ? "桐軒中文 · 第一冊 1~5 階段全冊總複習大驗收" : targetLevel.title}
              </h2>
              <p className="quiz-header-scope">
                🎯 測驗範圍：第 {targetLevel.quizScope?.[0]} ~ {targetLevel.quizScope?.[targetLevel.quizScope.length - 1]} 關全部核心生字、詞彙、筆畫與部首
              </p>
            </div>
          </div>
          {!isSubmitted && (
            <div className="quiz-progress-pill">
              <span>進度：{answeredCount}/{totalQuestions} 題</span>
              <div className="quiz-progress-bar-track">
                <div
                  className="quiz-progress-bar-fill"
                  style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Exam Body */}
        {!isSubmitted ? (
          <div className="stage-quiz-body">
            {currentQ && (
              <div className="quiz-question-box">
                <div className="question-type-tag-row">
                  <span className="question-type-tag">
                    第 {currentIdx + 1} 題 · {currentQ.title}
                  </span>
                  {currentQ.audioText && (
                    <button
                      type="button"
                      className="quiz-audio-speaker-btn"
                      onClick={() => playSound(currentQ.audioText!, "normal", true)}
                      title="點擊播放發音"
                    >
                      <Volume2 size={20} />
                      <span>播放語音</span>
                    </button>
                  )}
                </div>

                <h3 className="quiz-question-prompt">{R(currentQ.prompt)}</h3>

                <div className="quiz-options-grid-4">
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[currentQ.id] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        className={`quiz-option-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleSelectOption(optIdx)}
                      >
                        <span className="option-letter-badge">
                          {["A", "B", "C", "D"][optIdx]}
                        </span>
                        <div className="option-text-group">
                          <span className="option-main-text">{R(opt.text)}</span>
                          {opt.subText && (
                            <span className="option-sub-text">{opt.subText}</span>
                          )}
                        </div>
                        {isSelected && <span className="option-check-icon">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="quiz-footer-actions">
              <button
                type="button"
                className="quiz-nav-btn prev-btn"
                disabled={currentIdx === 0}
                onClick={() => {
                  setCurrentIdx((prev) => Math.max(0, prev - 1));
                }}
              >
                ⬅️ 上一題
              </button>

              {currentIdx < totalQuestions - 1 ? (
                <button
                  type="button"
                  className="quiz-nav-btn next-btn"
                  onClick={() => {
                    setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1));
                  }}
                >
                  下一題 ➡️
                </button>
              ) : (
                <button
                  type="button"
                  className="quiz-submit-btn"
                  onClick={handleSubmitExam}
                >
                  📝 完成並交卷評分
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Result & Lucky Chest Celebration Screen */
          <div className="stage-quiz-result-view">
            <div className={`quiz-result-card ${examScore >= 60 ? "is-passed" : "is-failed"}`}>
              <div className="result-celebration-emoji">
                {examScore >= 90 ? "🏆" : examScore >= 60 ? "🎉" : "💪"}
              </div>
              <h3 className="result-title">
                {examScore >= 90
                  ? "太優秀了！滿分狀元！"
                  : examScore >= 60
                  ? "恭喜通過階段檢核測驗！"
                  : "再接再厲！複習後再次挑戰！"}
              </h3>

              <div className="result-score-pill">
                <span className="score-val">{examScore}</span>
                <span className="score-unit">分</span>
              </div>

              {/* Lucky Chest Opening Section for Passing Students */}
              {examScore >= 60 && (
                <div className="lucky-chest-card-section animate-fade">
                  {!isChestOpened ? (
                    <div className="lucky-chest-closed-box">
                      <div className="chest-pulsing-icon" onClick={handleOpenLuckyChest}>
                        🎁
                      </div>
                      <h4>🎉 通關專屬：開箱抽取 100~200 幸運大金幣！</h4>
                      <button
                        type="button"
                        className="open-lucky-chest-btn"
                        onClick={handleOpenLuckyChest}
                      >
                        ✨ 點擊立即開箱！
                      </button>
                    </div>
                  ) : (
                    <div className="lucky-chest-opened-box animate-fade">
                      <div className="chest-opened-icon">🌟 🪙 🌟</div>
                      <h4 className="chest-drawn-title">
                        太幸運了！開箱獲得 <b>🪙 +{drawnChestCoins}</b> 金幣！
                      </h4>

                      {/* Pinky Promise Offer Section */}
                      {showPactDialog && (
                        <div className="pinky-promise-callout-box animate-fade">
                          <div className="pact-header-row">
                            <span className="pact-icon">🤙</span>
                            <strong>「學習打勾勾約定」獎勵翻倍挑戰！</strong>
                          </div>
                          <p className="pact-desc">
                            答應爸爸媽媽與老師：<b>連續 3 天</b> 每天認真完成 1 關，第 3 天完成時，系統將額外再多送你 <b>🪙 +{drawnChestCoins} 金幣（翻倍獎勵）</b>！
                          </p>
                          <div className="pact-actions-row">
                            <button
                              type="button"
                              className="accept-pact-btn"
                              onClick={handleAcceptPinkyPromise}
                            >
                              🤙 好！我答應（立下約定）
                            </button>
                            <button
                              type="button"
                              className="decline-pact-btn"
                              onClick={handleDeclinePinkyPromise}
                            >
                              暫時不要（直接領取獎勵）
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Milestone Certificate for Level 25 */}
              {isMilestone && examScore >= 60 && (
                <div className="milestone-diploma-certificate">
                  <div className="certificate-inner-border">
                    <div className="cert-header">
                      <span className="cert-badge">🏅</span>
                      <h4 className="cert-title">桐軒中文 · 第一冊全冊通關 小狀元證書</h4>
                    </div>
                    <p className="cert-recipient">
                      茲證明 <strong>{learnerName}</strong> 同學
                    </p>
                    <p className="cert-body">
                      在 25 個關卡中勤勉自律、表現卓越，圓滿通過《學華語向前走》第一冊全部生字、生詞、部首與成語的總複習大驗收！
                    </p>
                    <div className="cert-footer">
                      <span className="cert-date">📅 頒發日期：{new Date().toLocaleDateString()}</span>
                      <span className="cert-seal">💮 桐軒中文 · 智慧認證</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Questions Accordion */}
              <div className="quiz-review-list">
                <h4 className="review-title">📋 測驗題目解析回顧</h4>
                {questions.map((q, idx) => {
                  const chosen = selectedAnswers[q.id];
                  const isCorrect = chosen !== undefined && q.options[chosen]?.isCorrect;
                  const correctOpt = q.options.find((o) => o.isCorrect);
                  return (
                    <div key={q.id} className={`review-q-item ${isCorrect ? "is-correct" : "is-wrong"}`}>
                      <div className="review-q-header">
                        <span className="review-q-status">{isCorrect ? "✅ 正確" : "❌ 需複習"}</span>
                        <span className="review-q-prompt">第 {idx + 1} 題：{q.prompt}</span>
                      </div>
                      <p className="review-q-ans">
                        <strong>正確解答：</strong>{correctOpt?.text} {correctOpt?.subText ? `(${correctOpt.subText})` : ""} · {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              {examScore < 60 && (
                <div className="result-actions-row">
                  <button
                    type="button"
                    className="result-retry-btn"
                    onClick={() => {
                      setIsSubmitted(false);
                      setCurrentIdx(0);
                      setSelectedAnswers({});
                    }}
                  >
                    🔄 重新測驗挑戰
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

