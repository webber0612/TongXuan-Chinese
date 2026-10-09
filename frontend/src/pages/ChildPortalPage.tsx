import { useEffect, useState } from "react";
import { TONGXUAN_AUTHORED_DRAFT_LEVELS } from "../data/learningPathData";
import { trackDonationClick, trackFeedbackClick, trackLevelPass } from "../lib/analytics";
import { detectRuntimeMode } from "../lib/runtimeMode";
import type { PinkyPromisePact } from "../features/childPortal/types";
import { listDialogueLessons, loadDialogueDone } from "../features/home/dialogueLessons";
import { homeTranslator } from "../features/home/homeCopy";
import { completeLevel, localDayKey, nextStreak } from "../features/home/homeModel";
import { HomeMenu, type MenuDestination } from "../features/home/HomeMenu";
import { HomeScreen } from "../features/home/HomeScreen";
import { InteractiveClassroom } from "../features/childPortal/InteractiveClassroom";
import { SundayChestsModal } from "../features/childPortal/modals/SundayChestsModal";
import { ParentLockModal } from "../features/childPortal/modals/ParentLockModal";
import { LearnerLoginModal } from "../features/childPortal/modals/LearnerLoginModal";
import { WelcomeOnboardingModal } from "../features/childPortal/modals/WelcomeOnboardingModal";
import { RewardsStoreModal } from "../features/childPortal/modals/RewardsStoreModal";
import { AboutTongXuanModal } from "../features/childPortal/modals/AboutTongXuanModal";
import { StageQuizExamModal } from "../features/childPortal/modals/StageQuizExamModal";
import { LearnerAchievementsModal } from "../features/childPortal/modals/LearnerAchievementsModal";

import { useChildPortalController,type ChildPortalProps } from "../features/childPortal/useChildPortalController";
import { LegacyHomeView } from "../features/childPortal/LegacyHomeView";

const DIALOGUE_LESSONS = listDialogueLessons();

export function ChildPortalPage(props: ChildPortalProps) {
  const c = useChildPortalController(props);
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

  const runtime = props.runtime ?? detectRuntimeMode();
  const homeCopy = homeTranslator(displayLang);
  const [dialogueDone, setDialogueDone] = useState<string[]>(() => loadDialogueDone(activeLearnerId));
  useEffect(() => { setDialogueDone(loadDialogueDone(activeLearnerId)); }, [activeLearnerId]);

  /** Records one finished level for the active learner only, then moves the selection to the next level. */
  const recordLevelCompleted = (
    levelNumber: number,
    levelTitle: string | undefined,
    earnedStars: number,
    score: number | null,
    minutes: number,
    coins: number,
    advancesPact: boolean,
    acceptedPact?: PinkyPromisePact | null,
  ) => {
    const today = localDayKey(new Date());
    const result = completeLevel(learnerLevelsProgress, levelNumber, earnedStars, score, today.replace(/-/g, "/"));
    trackLevelPass(levelNumber, levelTitle, earnedStars, score ?? undefined);
    updateActiveLearner((prev) => {
      const pact = prev.activePinkyPromise ? { ...prev.activePinkyPromise } : null;
      let bonusCoins = 0;
      if (advancesPact && pact && !pact.isCompleted) {
        pact.currentDays = Math.min(pact.requiredDays, pact.currentDays + 1);
        if (pact.currentDays >= pact.requiredDays) {
          pact.isCompleted = true;
          bonusCoins = pact.bonusCoins;
        }
      }
      return {
        ...prev,
        totalMinutesLearned: (prev.totalMinutesLearned || 0) + minutes,
        streakDays: nextStreak(prev.streakDays || 0, prev.lastActiveDay, today),
        lastActiveDay: today,
        levelsProgress: result.progress,
        points: { coins: prev.points.coins + coins + bonusCoins, stars: prev.points.stars + earnedStars },
        activePinkyPromise: acceptedPact !== undefined ? acceptedPact : pact,
      };
    });
    if (result.unlockedNext) setSelectedLevelNum(levelNumber + 1);
  };

  const openFromMenu = (destination: MenuDestination) => {
    setMenuOpen(false);
    if (destination === "rewards") setRewardsShopModalOpen(true);
    else if (destination === "achievements") setAchievementsModalOpen(true);
    else if (destination === "switch-learner" || destination === "sync") setLoginModalOpen(true);
    else if (destination === "parent") setParentLockOpen(true);
    else if (destination === "setup") setOnboardingOpen(true);
    else { setAboutInitialTab("about"); setAboutModalOpen(true); }
  };

  if (inClassroom) {
    return (
      <InteractiveClassroom
        dayPlan={customPracticePlan || selectedDay}
        learnerId={activeLearnerId}
        scriptMode={scriptMode}
        displayLang={displayLang}
        showPhonetics={true}
        phoneticAssist={phoneticAssist}
        mode={classroomMode}
        handMode={handMode}
        onUpdateHandMode={updateHandMode}
        isVoiceGuideEnabled={isVoiceGuideEnabled}
        onToggleVoiceGuide={toggleVoiceGuide}
        R={R}
        t={t}
        initialStep={classroomInitialStep}
        onPlaySound={playSound}
        onFinishLesson={(earnedStars) => {
          recordLevelCompleted(selectedLevelNum, selectedDay?.themeTitle, earnedStars, null, selectedDay.estimatedMinutes || 25, 10, true);
          setInClassroom(false);
        }}
        onExitClass={() => setInClassroom(false)}
      />
    );
  }

  return (
    <div className={`${runtime === "static" ? "tx-portal" : "ipad-weekly-portal"} ${isDarkEyeCare ? "is-dark-eyecare" : ""}`}>
      {runtime === "static" ? (
        <HomeScreen
          learner={activeLearner}
          levels={TONGXUAN_AUTHORED_DRAFT_LEVELS}
          today={localDayKey(new Date())}
          displayLang={displayLang}
          scriptMode={scriptMode}
          selectedLevelNumber={selectedLevelNum}
          dialogueLessons={DIALOGUE_LESSONS}
          dialogueDone={dialogueDone}
          isDarkEyeCare={isDarkEyeCare}
          onSelectLevel={(levelNumber) => { setCustomPracticePlan(null); setSelectedLevelNum(levelNumber); }}
          onStartLevel={(level, mode) => { setSelectedLevelNum(level.levelNumber); startLessonAtStep(1, mode); }}
          onStartQuiz={launchStageQuiz}
          onOpenDialogueLesson={(lessonId) => props.onOpenDialogueLesson?.(lessonId)}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenAbout={() => { setAboutInitialTab("disclaimer"); setAboutModalOpen(true); }}
          onFeedback={trackFeedbackClick}
          onSupport={trackDonationClick}
        />
      ) : (
        <LegacyHomeView c={c} />
      )}

      {runtime === "static" && menuOpen && (
        <HomeMenu
          learner={activeLearner}
          scriptMode={scriptMode}
          phoneticAssist={phoneticAssist}
          handMode={handMode}
          displayLang={displayLang}
          isDarkEyeCare={isDarkEyeCare}
          copy={homeCopy}
          t={t}
          onScriptMode={updateScriptMode}
          onPhoneticAssist={updatePhoneticAssist}
          onHandMode={updateHandMode}
          onDisplayLang={(lang) => { setDisplayLang(lang); localStorage.setItem("tongxuan_display_lang", lang); }}
          onToggleEyeCare={() => setIsDarkEyeCare((prev) => !prev)}
          onNavigate={openFromMenu}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* 0. Welcome & First-time Onboarding Modal */}
      {onboardingOpen && (
        <WelcomeOnboardingModal
          displayLang={displayLang}
          setDisplayLang={(lang) => {
            setDisplayLang(lang);
            localStorage.setItem("tongxuan_display_lang", lang);
          }}
          onClose={() => {
            localStorage.setItem("tongxuan_onboarded", "true");
            setOnboardingOpen(false);
          }}
          onComplete={handleOnboardingComplete}
          R={R}
        />
      )}

      {/* 1. Login & Learner Management Switcher Modal */}
      {loginModalOpen && (
        <LearnerLoginModal
          learners={learners}
          activeLearnerId={activeLearnerId}
          beginnerMode={phoneticAssist !== "off"}
          R={R}
          onSelectLearner={handleSelectLearner}
          onAddLearner={handleAddLearner}
          onDeleteLearner={handleDeleteLearner}
          onClose={() => setLoginModalOpen(false)}
          t={t}
        />
      )}

      {/* 2. Sunday Mystery Chests Modal */}
      {chestModalOpen && (
        <SundayChestsModal
          keysEarned={activeLearner.levelsProgress?.filter((p) => p.status === "completed").length || 0}
          streakDays={activeLearner.streakDays || 0}
          beginnerMode={phoneticAssist !== "off"}
          R={R}
          t={t}
          onClose={() => setChestModalOpen(false)}
          onTestOpenChest={(type) => {
            const rewardCoins = type === "normal" ? 100 : 250;
            playSound(
              type === "normal"
                ? `太棒了！打開寶箱，獲得 10 顆星星與 ${rewardCoins} 金幣！`
                : `王者大寶箱打開了！獲得皇冠、10 顆星星與 ${rewardCoins} 金幣！`
            );
            updateActiveLearner((prev) => ({
              ...prev,
              points: {
                coins: prev.points.coins + rewardCoins,
                stars: prev.points.stars + 10
              }
            }));
            alert(
              type === "normal"
                ? `🎁 成功打開常規寶箱！獲得 ⭐ +10 星 + 🪙 +${rewardCoins} 金幣！`
                : `👑 成功打開連續全勤金色王者寶箱！獲得 ⭐ +10 星 + 🪙 +${rewardCoins} 金幣 + 👑 皇冠！`
            );
          }}
        />
      )}

      {/* 3. Parent Gate & Dashboard */}
      {parentLockOpen && (
        <ParentLockModal
          displayLang={displayLang}
          setDisplayLang={(lang) => {
            setDisplayLang(lang);
            localStorage.setItem("tongxuan_display_lang", lang);
          }}
          phoneticAssist={phoneticAssist}
          updatePhoneticAssist={updatePhoneticAssist}
          activeLearner={activeLearner}
          onGiftPoints={handleParentGiftPoints}
          R={R}
          t={t}
          onClose={() => setParentLockOpen(false)}
          onUnlock={() => {
            // Unlocked
          }}
        />
      )}

      {/* 4. Stage Checkpoint Quiz & Milestone Exam Modal with Lucky Chest & Pinky Promise */}
      {quizModalOpen && activeQuizTargetLevel && (
        <StageQuizExamModal
          targetLevel={activeQuizTargetLevel}
          scriptMode={scriptMode}
          displayLang={displayLang}
          phoneticAssist={phoneticAssist}
          learnerName={activeLearner.name}
          R={R}
          playSound={playSound}
          onClose={() => setQuizModalOpen(false)}
          onPassExam={(earnedStars, score, coins, acceptedPact) => {
          recordLevelCompleted(activeQuizTargetLevel.levelNumber, activeQuizTargetLevel.title, earnedStars, score, activeQuizTargetLevel.estimatedMinutes || 20, coins, false, acceptedPact);
          setQuizModalOpen(false);
        }}
        />
      )}

      {/* 5. Learner Achievements Modal (Quantitative breakdown & Badge Wall) */}
      {achievementsModalOpen && (
        <LearnerAchievementsModal
          learner={activeLearner}
          onClose={() => setAchievementsModalOpen(false)}
          R={R}
          t={t}
        />
      )}

      {/* 6. Rewards Store & Privilege Passbook Modal */}
      {rewardsShopModalOpen && (
        <RewardsStoreModal
          points={learnerPoints}
          redemptions={activeLearner.redemptions || []}
          onUpdatePoints={(newPts) => {
            updateActiveLearner({ points: newPts });
          }}
          onUpdateRedemptions={(newRedemptions) => {
            updateActiveLearner({ redemptions: newRedemptions });
          }}
          onClose={() => setRewardsShopModalOpen(false)}
          R={R}
          t={t}
        />
      )}

      {/* 7. About TongXuan & Attribution Modal */}
      {aboutModalOpen && (
        <AboutTongXuanModal
          initialTab={aboutInitialTab}
          t={t}
          onClose={() => {
            setAboutModalOpen(false);
            setAboutInitialTab("about");
          }}
        />
      )}
    </div>
  );
}
