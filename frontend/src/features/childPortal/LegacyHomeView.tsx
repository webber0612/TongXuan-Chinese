import {
Volume2,
Sparkles,
Play,
Lock,
Star,ArrowRight,Check,Settings,Layers
} from "lucide-react";
import appLogoIcon from "../../assets/app-logo-icon.png";
import {
TONGXUAN_AUTHORED_DRAFT_LEVELS
} from "../../data/learningPathData";
import {
trackDonationClick,
trackFeedbackClick
} from "../../lib/analytics";
import { officialCoursePath } from "../../data/officialCoursePath";

import { DisplayLang } from "./types";
import { courseLevelToDayPlan } from "./dayPlan";

import type { ChildPortalController } from "./useChildPortalController";

/** Home sections driven by the backend daily queue. Rendered only when a backend is configured. */
export function LegacyHomeView({ c }: { c: ChildPortalController }) {
  const {
    activeChildId,
    activeChildName,
    onOpenCurriculum,
    onOpenCourseZero,
    onStartLearningSession,
    learners,
    setLearners,
    activeLearnerId,
    setActiveLearnerId,
    activeLearner,
    sessionProfileError,
    setSessionProfileError,
    updateActiveLearner,
    selectedLevelNum,
    setSelectedLevelNum,
    quizModalOpen,
    setQuizModalOpen,
    activeQuizTargetLevel,
    setActiveQuizTargetLevel,
    achievementsModalOpen,
    setAchievementsModalOpen,
    scriptMode,
    phoneticAssist,
    handMode,
    learnerPoints,
    learnerLevelsProgress,
    displayLang,
    setDisplayLang,
    isDarkEyeCare,
    setIsDarkEyeCare,
    menuOpen,
    setMenuOpen,
    loginModalOpen,
    setLoginModalOpen,
    parentLockOpen,
    setParentLockOpen,
    chestModalOpen,
    setChestModalOpen,
    inClassroom,
    setInClassroom,
    classroomMode,
    setClassroomMode,
    classroomInitialStep,
    setClassroomInitialStep,
    rewardsShopModalOpen,
    setRewardsShopModalOpen,
    aboutModalOpen,
    setAboutModalOpen,
    aboutInitialTab,
    setAboutInitialTab,
    customPracticePlan,
    setCustomPracticePlan,
    onboardingOpen,
    setOnboardingOpen,
    menuRef,
    t,
    updateScriptMode,
    updatePhoneticAssist,
    updateHandMode,
    R,
    isVoiceGuideEnabled,
    setIsVoiceGuideEnabled,
    toggleVoiceGuide,
    dailyQueue,
    setDailyQueue,
    stageIdFromDailyQueue,
    findLessonAndStage,
    authoritativeLessonId,
    authoritativeStage,
    authoritativeLesson,
    sessionTargetLessonId,
    startLessonAtStep,
    startLearningSession,
    handleOnboardingComplete,
    selectedStageId,
    setSelectedStageId,
    selectedOfficialLessonId,
    setSelectedOfficialLessonId,
    browsingStage,
    browsingStageIndex,
    upcomingLesson,
    isBrowsingDifferentLesson,
    selectedLevel,
    selectedLevelProgress,
    selectedDay,
    launchStageQuiz,
    handleSelectLearner,
    handleDeleteLearner,
    handleAddLearner,
    handleParentGiftPoints,
    activeRecordingLineIdx,
    setActiveRecordingLineIdx,
    linePraiseMessages,
    setLinePraiseMessages,
    handlePlaySingleLine,
    handleToggleRecordLine,
    playSound,
  } = c;
  return (
    <>
      <header className="weekly-header-bar clean-header-bar">
        {/* Left: Brand Logo & Learner Profile */}
        <div className="header-left-cluster">
          <div className="header-brand-logo-pill" title={`${t("brandTitle")} ${t("brandEnSubtitle")}`}>
            <img src={appLogoIcon} alt={`${t("brandTitle")} Logo`} className="header-brand-img" />
            <div className="header-brand-title-box">
              <span className="brand-main-title">{t("brandTitle")}</span>
              <span className="brand-en-subtitle">{t("brandEnSubtitle")}</span>
            </div>
          </div>

          <button
            className="header-learner-pill header-learner-large header-learner-interactive-btn"
            onClick={() => setLoginModalOpen(true)}
            title={t("switchUser")}
            aria-label={t("switchUser")}
          >
            <span className="brand-badge-mini brand-badge-large">{activeLearner.avatar}</span>
            <div className="learner-info">
              <span className="learner-name learner-name-large">☀️ {t("morning")} · {activeLearner.name}</span>
              <span className="learner-sub learner-sub-large">{t("levelProgressSub", { n: selectedLevelNum })}</span>
            </div>
          </button>

          <button
            type="button"
            className="header-gdrive-sync-pill"
            onClick={() => setLoginModalOpen(true)}
            title="Google 雲端硬碟進度同步"
            aria-label="Google 雲端硬碟進度同步"
          >
            <span>☁️</span>
            <span className="header-gdrive-sync-label">雲端同步</span>
          </button>
        </div>

        {/* Right Actions: Pact Reminder, Points Balance, Achievements, Rewards & Settings Menu */}
        <div className="header-right-actions-group">
          {/* Active Pinky Promise Reminder Chip (if active) */}
          {activeLearner.activePinkyPromise && !activeLearner.activePinkyPromise.isCompleted && (
            <div className="header-pact-chip" title={t("pinkyPactChip", { current: activeLearner.activePinkyPromise.currentDays, total: activeLearner.activePinkyPromise.requiredDays })}>
              <span>{t("pinkyPactChip", { current: activeLearner.activePinkyPromise.currentDays, total: activeLearner.activePinkyPromise.requiredDays })}</span>
            </div>
          )}

          {/* Points Balance Pill */}
          <button
            type="button"
            className="header-points-combined-pill"
            onClick={() => setRewardsShopModalOpen(true)}
            title={t("rewardsShop")}
          >
            <span className="pill-coin-part">🪙 <b>{learnerPoints.coins.toLocaleString()}</b></span>
            <span className="pill-sep">|</span>
            <span className="pill-star-part">⭐ <b>{learnerPoints.stars}</b></span>
          </button>

          {/* Achievements Button */}
          <button
            type="button"
            className="feature-action-capsule-btn achievements-btn"
            onClick={() => setAchievementsModalOpen(true)}
            title={t("myAchievements")}
          >
            <span className="btn-icon">🏆</span>
            <span>{t("myAchievements")}</span>
          </button>

          {/* Rewards Store Button */}
          <button
            type="button"
            className="feature-action-capsule-btn rewards-btn"
            onClick={() => setRewardsShopModalOpen(true)}
            title={t("rewardsShop")}
          >
            <span className="btn-icon">🎁</span>
            <span>{t("rewardsShop")}</span>
          </button>

          {/* Settings Menu Button */}
          <div className="header-menu-wrap" ref={menuRef}>
            <button
              className={`menu-trigger-btn ${menuOpen ? "active" : ""}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t("menu")}
              title={t("settings")}
            >
              <Settings size={22} />
              <span className="menu-btn-label">{t("settings")}</span>
            </button>

            {menuOpen && (
              <>
                <div
                  className="menu-click-backdrop"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="menu-popover-panel">
                  <div className="menu-popover-arrow" />

                  <button
                    type="button"
                    className="menu-item-row"
                    onClick={() => { setMenuOpen(false); setOnboardingOpen(true); }}
                  >
                    <span className="menu-item-icon">🚀</span>
                    <span className="menu-item-info"><strong>{displayLang === "en" ? "First-time Setup" : "初次設定導引"}</strong><small>{displayLang === "en" ? "Change learner name, avatar & script" : "重新設定學習角色、頭像與字體"}</small></span>
                    <ArrowRight size={17} />
                  </button>

                  {/* Script Mode (繁體注音 / 簡體拼音 / 雙軌) */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🀄</span>
                      <div>
                        <strong>{t("scriptModeLabel")}</strong>
                        <small>
                          {scriptMode === "zhuyin"
                            ? t("scriptZhuyin")
                            : scriptMode === "pinyin"
                            ? t("scriptPinyin")
                            : t("scriptDual")}
                        </small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${scriptMode === "zhuyin" ? "active" : ""}`}
                        onClick={() => updateScriptMode("zhuyin")}
                        title={t("scriptZhuyin")}
                      >
                        {t("scriptZhuyinShort")}
                      </button>
                      <button
                        className={`seg-btn ${scriptMode === "pinyin" ? "active" : ""}`}
                        onClick={() => updateScriptMode("pinyin")}
                        title={t("scriptPinyin")}
                      >
                        {t("scriptPinyinShort")}
                      </button>
                      <button
                        className={`seg-btn ${scriptMode === "dual" ? "active" : ""}`}
                        onClick={() => updateScriptMode("dual")}
                        title={t("scriptDual")}
                      >
                        {t("scriptDualShort")}
                      </button>
                    </div>
                  </div>

                  {/* Phonetic Assist (顯示 / 隱藏標音) */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🔤</span>
                      <div>
                        <strong>{t("phoneticAssistLabel")}</strong>
                        <small>
                          {phoneticAssist === "zhuyin"
                            ? t("scriptZhuyin")
                            : phoneticAssist === "pinyin"
                            ? t("scriptPinyin")
                            : t("phoneticHide")}
                        </small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${phoneticAssist === "zhuyin" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("zhuyin")}
                        title={t("scriptZhuyin")}
                      >
                        {t("assistZhuyinShort")}
                      </button>
                      <button
                        className={`seg-btn ${phoneticAssist === "pinyin" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("pinyin")}
                        title={t("scriptPinyin")}
                      >
                        {t("assistPinyinShort")}
                      </button>
                      <button
                        className={`seg-btn ${phoneticAssist === "off" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("off")}
                        title={t("phoneticHide")}
                      >
                        {t("assistOffShort")}
                      </button>
                    </div>
                  </div>

                  {/* Handedness Switcher */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">✍️</span>
                      <div>
                        <strong>{t("handModeLabel")}</strong>
                        <small>{handMode === "right" ? t("handRight") : t("handLeft")}</small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${handMode === "right" ? "active" : ""}`}
                        onClick={() => updateHandMode("right")}
                        title={t("handRight")}
                      >
                        {t("handRight")}
                      </button>
                      <button
                        className={`seg-btn ${handMode === "left" ? "active" : ""}`}
                        onClick={() => updateHandMode("left")}
                        title={t("handLeft")}
                      >
                        {t("handLeft")}
                      </button>
                    </div>
                  </div>

                  {/* Eye-Care Mode */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">
                        {isDarkEyeCare ? "🌙" : "☀️"}
                      </span>
                      <div>
                        <strong>{t("eyeCareMode")}</strong>
                        <small>{isDarkEyeCare ? t("eyeCareDark") : t("eyeCareLight")}</small>
                      </div>
                    </div>
                    <button
                      className={`menu-switch-pill ${isDarkEyeCare ? "on" : "off"}`}
                      onClick={() => setIsDarkEyeCare((prev) => !prev)}
                    >
                      {isDarkEyeCare ? t("eyeCareDarkShort") : t("eyeCareLightShort")}
                    </button>
                  </div>

                  {/* Language Select */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🌐</span>
                      <div>
                        <strong>{t("displayLangLabel")}</strong>
                        <small>
                          {displayLang === "zh-Hant"
                            ? "繁體中文"
                            : displayLang === "zh-Hans"
                            ? "简体中文"
                            : displayLang === "en"
                            ? "English"
                            : displayLang === "ja"
                            ? "日本語"
                            : displayLang === "ko"
                            ? "한국어"
                            : "Español"}
                        </small>
                      </div>
                    </div>
                    <div className="lang-mini-select-wrap">
                      <select
                        className="lang-select-pill"
                        value={displayLang}
                        onChange={(e) => {
                          const newLang = e.target.value as DisplayLang;
                          setDisplayLang(newLang);
                          localStorage.setItem("tongxuan_display_lang", newLang);
                        }}
                        aria-label={t("displayLangLabel")}
                      >
                        <option value="zh-Hant">繁體中文</option>
                        <option value="zh-Hans">简体中文</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>

                  {/* Learner Switch */}
                  <div className="menu-item-row">
                    <button
                      className="menu-parent-full-btn menu-switch-user-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        setLoginModalOpen(true);
                      }}
                    >
                      <span>{t("switchUser")}</span>
                    </button>
                  </div>

                  {/* Parent Gate */}
                  <div className="menu-item-row menu-parent-row">
                    <button
                      className="menu-parent-full-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        setParentLockOpen(true);
                      }}
                    >
                      <Lock size={18} />
                      <span>{t("parentZone")}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="child-portal-source-note" role="note" style={{ display: "none" }}>
        <span>{t("draftContentNotice")}</span>
      </div>

      {/* 2. COMPACT SPRINT TRACK: Official Stages & Lessons */}
      <section className="compact-sprint-panel" aria-label="官方教材課程路徑">
        <div className="compact-sprint-header">
          <div className="sprint-stage-switch">
            <button
              type="button"
              className="sprint-stage-arrow-btn"
              disabled={browsingStageIndex <= 0}
              onClick={() => {
                const prevStage = officialCoursePath.stages[Math.max(0, browsingStageIndex - 1)];
                setSelectedStageId(prevStage.id);
                setSelectedOfficialLessonId(prevStage.lessons[0].id);
              }}
              title="上一階段"
            >
              ◀
            </button>
            <span className="sprint-stage-badge">
              {browsingStage.shortTitle}
            </span>
            <button
              type="button"
              className="sprint-stage-arrow-btn"
              disabled={browsingStageIndex >= officialCoursePath.stages.length - 1}
              onClick={() => {
                const nextStage = officialCoursePath.stages[Math.min(officialCoursePath.stages.length - 1, browsingStageIndex + 1)];
                setSelectedStageId(nextStage.id);
                setSelectedOfficialLessonId(nextStage.lessons[0].id);
              }}
              title="下一階段"
            >
              ▶
            </button>
          </div>
          {onOpenCourseZero && (
            <button
              type="button"
              className="course-zero-quick-btn"
              onClick={onOpenCourseZero}
              title="進入 Course 0 聲音實驗室（ㄅㄆㄇㄈ / 拼音 / 聲調）"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "20px",
                border: "1px solid var(--color-border, #e2e8f0)",
                background: "var(--color-surface, #f8fafc)",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-primary, #3b82f6)",
                cursor: "pointer"
              }}
            >
              <Sparkles size={15} />
              <span>Course 0 · 聲音實驗室 (ㄅㄆㄇ/拼音)</span>
            </button>
          )}
        </div>

        <div className="compact-sprint-nodes-track">
          <div className="sprint-track-line" />
          {browsingStage.lessons.map((lesson) => {
            const isCurrent = authoritativeLesson.id === lesson.id;
            const isSelected = selectedOfficialLessonId === lesson.id;
            const isDone = Boolean(dailyQueue?.currentLessonComplete && isCurrent);

            return (
              <button
                key={lesson.id}
                type="button"
                className={`sprint-node-btn ${isDone ? "is-done" : ""} ${
                  isSelected ? "is-selected" : ""
                } ${isCurrent ? "is-current-lesson" : ""}`}
                onClick={() => {
                  setSelectedOfficialLessonId(lesson.id);
                  playSound(`第 ${lesson.number} 課，${lesson.official.title}`);
                }}
              >
                <div className="sprint-node-bubble">
                  {isDone ? (
                    <Check size={20} strokeWidth={3.5} className="sprint-check-icon" />
                  ) : (
                    <span className="sprint-node-num">{lesson.number}</span>
                  )}
                </div>
                <span className="sprint-node-label">第 {lesson.number} 課</span>
                <span className="sprint-node-sublabel">{lesson.official.title}</span>
              </button>
            );
          })}
        </div>

        {/* If browsing a lesson different from today's active lesson, show explicit upcoming lesson card */}
        {isBrowsingDifferentLesson && (
          <div className="upcoming-course-card" data-testid="upcoming-course">
            <div className="upcoming-course-header">
              <div className="upcoming-course-meta">
                <span className="upcoming-course-badge">📖 {t("upcomingLessonBadge")} · {browsingStage.shortTitle} 第 {upcomingLesson.number} 課</span>
                <span className="upcoming-course-status">🔒 即將推出</span>
              </div>
              <h4 className="upcoming-course-title">{R(upcomingLesson.official.title)}</h4>
            </div>
            <p className="upcoming-course-description">{upcomingLesson.tongxuan.handbookSummary.text}</p>
            <div className="upcoming-course-targets">
              {upcomingLesson.tongxuan.practiceTargets.map((target, idx) => (
                <span key={idx} className="upcoming-course-target">✓ {target}</span>
              ))}
            </div>
            <div className="upcoming-course-footer">
              <span className="upcoming-course-notice">
                {t("upcomingLessonNotice")}（目前進行中：《{authoritativeLesson.official.title}》）
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                {onStartLearningSession && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      if (activeChildId) {
                        onStartLearningSession(activeChildId, upcomingLesson.id, "LEARN");
                      }
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "12px",
                      background: "var(--color-primary, #3b82f6)",
                      color: "#fff",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                    <span>立即體驗第 {upcomingLesson.number} 課</span>
                  </button>
                )}
                <button
                  type="button"
                  className="upcoming-course-back"
                  onClick={() => {
                    setSelectedStageId(authoritativeStage.id);
                    setSelectedOfficialLessonId(authoritativeLesson.id);
                  }}
                >
                  {t("backToTodayLesson")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. CENTER MAIN HERO: Authoritative Official Lesson (Pinned to Today's Learning Task) */}
      <main className="weekly-main-hero">
        <div className="daily-story-textbook-panel official-lesson-hero">
          <div className="story-meta-bar">
            <div className="story-badges-group">
              <span className="story-day-tag">{authoritativeStage.shortTitle} · 第 {authoritativeLesson.number} 課</span>
              <span className="story-duration-pill">⏱️ 約 {dailyQueue?.targetMinutes || 18} 分鐘</span>
              <span className="official-source-tag">🏛️ {authoritativeLesson.official.source.book}</span>
            </div>
            <button
              className="story-listen-audio-btn"
              onClick={() =>
                playSound(
                  `${authoritativeLesson.official.title}。${authoritativeLesson.tongxuan.handbookSummary.text}`,
                  "normal",
                  true
                )
              }
              title={t("readAloud")}
            >
              <Volume2 size={22} />
              <span>{t("voiceGuide")}</span>
            </button>
          </div>

          <div
            className="story-art-backdrop-container"
            data-asset-slot="lesson-story-illustration"
            title="[資產插畫槽位] 預留專屬課文情境插畫背景"
          >
            <div className="story-title-section">
              <div className="official-provenance-pill">
                <span className="provenance-dot" />
                <span>{authoritativeLesson.official.source.name} · {t("officialCurriculumBadge")}</span>
              </div>
              {dailyQueue?.currentLessonComplete && (
                <div className="official-mastered-banner">
                  <Check size={18} className="mastered-icon" />
                  <span>{t("lessonMasteredBanner")}</span>
                </div>
              )}
              <h2 className="story-main-title">{R(authoritativeLesson.official.title)}</h2>
              <p className="official-lesson-summary">{authoritativeLesson.tongxuan.handbookSummary.text}</p>
            </div>

            <div className="official-targets-section">
              <div className="targets-header">
                <Sparkles size={16} />
                <strong>{t("practiceTargetsLabel")}</strong>
              </div>
              <div className="targets-list">
                {authoritativeLesson.tongxuan.practiceTargets.map((target, idx) => (
                  <span key={idx} className="target-chip">✓ {target}</span>
                ))}
              </div>
              <div className="domains-badges-row">
                <span className="domains-label-tag">{t("domainsLabel")}：</span>
                {authoritativeLesson.tongxuan.domains.map((domain) => (
                  <span key={domain} className="domain-pill">
                    {t(`${domain}Domain`)}
                  </span>
                ))}
              </div>
            </div>

            {dailyQueue?.currentLessonComplete && dailyQueue?.nextLessonComingSoon && (
              <p className="next-lesson-coming-soon-note">
                {t("nextLessonComingSoon").replace("{title}", dailyQueue.nextAccessibleLesson?.title || "")}
              </p>
            )}

            <div className="hero-primary-cta-row">
              {dailyQueue?.currentLessonComplete ? (
                (dailyQueue.review?.dueCount ?? 0) > 0 ? (
                  <button
                    type="button"
                    className="launch-quiz-cta-btn validated-session-entry"
                    onClick={() => {
                      startLearningSession("REVIEW");
                    }}
                  >
                    <Play size={20} fill="currentColor" />
                    <span>{t("startReviewSession").replace("{n}", String(dailyQueue.review.dueCount))}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="launch-quiz-cta-btn validated-session-entry is-completed-btn"
                    disabled
                  >
                    <Check size={20} />
                    <span>{t("todayGoalCompleted")}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="launch-quiz-cta-btn validated-session-entry"
                  onClick={() => {
                    startLearningSession("LEARN");
                  }}
                >
                  <Play size={20} fill="currentColor" />
                  <span>{t("startValidatedSession")}</span>
                </button>
              )}
              {sessionProfileError && (
                <span className="session-profile-error" role="alert">
                  {t("sessionProfileMissing")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Separated Authored Draft Prototype Section */}
        <section className="authored-draft-practice-section">
          <div className="authored-draft-header">
            <div className="authored-draft-title-group">
              <Layers size={18} />
              <h3>{t("extraPracticeSectionTitle")}</h3>
            </div>
            <p className="authored-draft-note">{t("extraPracticeSectionNote")}</p>
          </div>
          <div className="authored-draft-levels-grid">
            {TONGXUAN_AUTHORED_DRAFT_LEVELS.slice(0, 5).map((lvl) => (
              <button
                key={lvl.levelId}
                type="button"
                className={`authored-draft-level-btn ${selectedLevelNum === lvl.levelNumber ? "is-active-draft" : ""}`}
                onClick={() => {
                  setSelectedLevelNum(lvl.levelNumber);
                  setCustomPracticePlan(courseLevelToDayPlan(lvl));
                }}
              >
                <span className="draft-lvl-num">關卡 {lvl.levelNumber}</span>
                <strong>{lvl.title}</strong>
                <small>{lvl.characters.map((c) => c.char).join(" ")}</small>
              </button>
            ))}
          </div>

          {/* 3 Star Task Cards Grid nested cleanly inside Authored Draft Practice Section */}
          {selectedLevel.type === "lesson" && (
            <div className="authored-draft-cards-container">
              <div className="draft-cards-section-header">
                <span className="draft-cards-badge">
                  {t("draftTasksTitle").replace("{n}", String(selectedLevelNum))}（{selectedDay.themeTitle}）
                </span>
              </div>
              <div className="three-star-cards-grid">
                {/* CARD 1: 生字 */}
                <div
                  className="interactive-star-card star-card-stroke"
                  onClick={() => startLessonAtStep(1, "char")}
                  title="點擊進入生字「聽說讀寫」完整分區練字教室"
                >
                  <div className="star-card-topbar">
                    <div className="star-card-title-group">
                      <span className="star-card-icon-badge">✍️</span>
                      <h3>{t("cardStrokeTitle")}</h3>
                    </div>
                    <div className="star-card-goal-star" title="第 1 顆星：生字聽說讀寫">
                      <Star
                        size={28}
                        className={selectedDay.status === "completed" ? "star-earned-gold" : "star-pending-dark"}
                        fill="currentColor"
                      />
                    </div>
                  </div>

                  <div className="star-card-middle-content">
                    <div className="char-tianzige-grid-6">
                      {selectedDay.characters.map((c) => {
                        const isDiff = c.char !== c.charHans;
                        return (
                          <div key={c.char} className={`char-tianzi-card-mini ${scriptMode === "dual" && isDiff ? "dual-card-mini" : ""}`}>
                            {scriptMode === "zhuyin" ? (
                              <span className="tianzi-glyph-mini">{c.char}</span>
                            ) : scriptMode === "pinyin" ? (
                              <span className="tianzi-glyph-mini">{c.charHans}</span>
                            ) : isDiff ? (
                              <div className="dual-glyphs-mini-row">
                                <span className="tianzi-glyph-mini glyph-trad" title="繁體">{c.char}</span>
                                <span className="dual-vs-sep">/</span>
                                <span className="tianzi-glyph-mini glyph-hans" title="簡體">{c.charHans}</span>
                              </div>
                            ) : (
                              <span className="tianzi-glyph-mini">{c.char}</span>
                            )}

                            <span className="tianzi-phonetic-badge-mini">
                              {scriptMode === "zhuyin"
                                ? `${c.zhuyin}${c.zhuyinTone}`
                                : scriptMode === "pinyin"
                                ? c.pinyin
                                : `${c.zhuyin}${c.zhuyinTone} · ${c.pinyin}`}
                            </span>

                            <span className="tianzi-stroke-pill-mini">
                              {scriptMode === "dual" && isDiff
                                ? `繁${c.strokeCount}/簡${c.strokeCountHans || c.strokeCount}畫`
                                : `${scriptMode === "pinyin" ? (c.strokeCountHans || c.strokeCount) : c.strokeCount} 畫`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="card-sub-hint">
                      {scriptMode === "dual"
                        ? t("cardStrokeDualHint")
                        : t("cardStrokeSingleHint")}
                    </p>
                  </div>
                </div>

                {/* CARD 2: 生詞 */}
                <div
                  className="interactive-star-card star-card-vocab"
                  onClick={() => startLessonAtStep(1, "vocab")}
                  title="點擊進入生詞認讀與造句練習"
                >
                  <div className="star-card-topbar">
                    <div className="star-card-title-group">
                      <span className="star-card-icon-badge">📚</span>
                      <h3>{t("cardVocabTitle")}</h3>
                    </div>
                    <div className="star-card-goal-star" title="第 2 顆星：生詞認讀造句">
                      <Star
                        size={28}
                        className={selectedDay.status === "completed" ? "star-earned-gold" : "star-pending-dark"}
                        fill="currentColor"
                      />
                    </div>
                  </div>

                  <div className="star-card-middle-content">
                    <div className="vocab-grid-6">
                      {(selectedDay.vocabulary || []).map((v) => (
                        <div key={v.word} className="vocab-item-mini">
                          <div className="vocab-top-row">
                            <span className="vocab-icon-mini">{v.icon}</span>
                            <span className="vocab-word-text">{v.word}</span>
                          </div>

                          {scriptMode === "dual" ? (
                            <div className="vocab-phonetic-dual-col">
                              <span className="vocab-phonetic-sub zhuyin-sub">{v.zhuyin}</span>
                              <span className="vocab-phonetic-sub pinyin-sub">{v.pinyin}</span>
                            </div>
                          ) : (
                            <span className="vocab-phonetic-pill">
                              {scriptMode === "zhuyin" ? v.zhuyin : v.pinyin}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="card-sub-hint">
                      {t("cardVocabHint")}
                    </p>
                  </div>
                </div>

                {/* CARD 3: 成語 */}
                <div
                  className="interactive-star-card star-card-idiom"
                  onClick={() => startLessonAtStep(1, "idiom")}
                  title="點擊進入成語故事閱讀與情境理解"
                >
                  <div className="star-card-topbar">
                    <div className="star-card-title-group">
                      <span className="star-card-icon-badge">📖</span>
                      <h3>{t("cardIdiomTitle")}</h3>
                    </div>
                    <div className="star-card-goal-star" title="第 3 顆星：成語故事閱讀">
                      <Star
                        size={28}
                        className={selectedDay.status === "completed" ? "star-earned-gold" : "star-pending-dark"}
                        fill="currentColor"
                      />
                    </div>
                  </div>

                  <div className="star-card-middle-content">
                    <div className="idiom-callout-hero">
                      <span className="idiom-big-icon">{selectedDay.idiom?.idiomIcon || "📖"}</span>
                      <strong className="idiom-title-text">
                        {selectedDay.idiom?.idiomTitle || "成語精選"}
                      </strong>

                      <span className="idiom-pinyin-sub">
                        {scriptMode === "zhuyin"
                          ? selectedDay.idiom?.idiomZhuyin || selectedDay.idiom?.idiomPinyin
                          : scriptMode === "pinyin"
                          ? selectedDay.idiom?.idiomPinyin
                          : `${selectedDay.idiom?.idiomZhuyin || ""} · ${selectedDay.idiom?.idiomPinyin}`}
                      </span>
                    </div>
                    <p className="idiom-meaning-desc">
                      {selectedDay.idiom?.idiomMeaning || t("cardIdiomHint")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Soft Community, Feedback & Sponsor Footer */}
        <footer className="portal-community-footer">
          <div className="portal-sponsor-pill">
            <div className="sponsor-text-group">
              <span className="sponsor-text">
                {t("communityFooterText")}
              </span>
              <button
                type="button"
                className="portal-disclaimer-link-btn"
                onClick={() => {
                  setAboutInitialTab("disclaimer");
                  setAboutModalOpen(true);
                }}
              >
                {t("betaDisclaimerLink")}
              </button>
            </div>
            <div className="sponsor-actions-row">
              <a
                href="mailto:webber0612@gmail.com?subject=【桐軒中文】問題回報與改進建議&body=您好！我在使用桐軒中文時有以下反饋：%0D%0A%0D%0A1. 使用設備（iPad/電腦/手機）：%0D%0A2. 遇到的問題或建議：%0D%0A"
                target="_blank"
                rel="noopener noreferrer"
                className="sponsor-feedback-btn"
                title={t("feedbackBtn")}
                onClick={() => trackFeedbackClick()}
              >
                <span className="btn-feedback-emoji">💬</span>
                <span>{t("feedbackBtn")}</span>
              </a>
              <a
                href="https://buymeacoffee.com/webber0612"
                target="_blank"
                rel="noopener noreferrer"
                className="sponsor-coffee-btn"
                title={t("sponsorBtn")}
                onClick={() => trackDonationClick()}
              >
                <span className="btn-coffee-emoji">☕</span>
                <span>{t("sponsorBtn")}</span>
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
