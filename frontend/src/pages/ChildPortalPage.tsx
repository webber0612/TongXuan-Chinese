import { useState,useEffect,useRef,type ReactNode } from "react";
import { apiFetch } from "../lib/apiFetch";
import {
Volume2,
Sparkles,
Play,
Lock,
Star,ArrowRight,Check,Settings,Layers
} from "lucide-react";
import { renderRuby } from "../lib/chinesePhonetics";
import appLogoIcon from "../assets/app-logo-icon.png";
import {
TONGXUAN_AUTHORED_DRAFT_LEVELS,
type CourseLevel,getLearnerLevelsProgress,completeCourseLevel
} from "../data/learningPathData";
import {
trackLevelPass,trackDonationClick,
trackFeedbackClick
} from "../lib/analytics";
import { officialCoursePath,type OfficialLesson } from "../data/officialCoursePath";
import { isValidBackendChildId } from "../lib/profiles";

import { ValidatedDailyQueue,ScriptMode,DisplayLang,PhoneticAssist,HandMode,SpeechSpeed,DailyDayPlan,ChildLearner } from "../features/childPortal/types";
import { UI_TEXT } from "../features/childPortal/uiText";
import { courseLevelToDayPlan } from "../features/childPortal/dayPlan";
import { DEFAULT_LEARNERS } from "../features/childPortal/defaultLearners";
import { InteractiveClassroom } from "../features/childPortal/InteractiveClassroom";
import { SundayChestsModal } from "../features/childPortal/modals/SundayChestsModal";
import { ParentLockModal } from "../features/childPortal/modals/ParentLockModal";
import { LearnerLoginModal } from "../features/childPortal/modals/LearnerLoginModal";
import { WelcomeOnboardingModal } from "../features/childPortal/modals/WelcomeOnboardingModal";
import { RewardsStoreModal } from "../features/childPortal/modals/RewardsStoreModal";
import { AboutTongXuanModal } from "../features/childPortal/modals/AboutTongXuanModal";
import { StageQuizExamModal } from "../features/childPortal/modals/StageQuizExamModal";
import { LearnerAchievementsModal } from "../features/childPortal/modals/LearnerAchievementsModal";
const API = import.meta.env.VITE_API_BASE ?? "";

export function ChildPortalPage({
  activeChildId,
  activeChildName,
  onOpenCurriculum,
  onOpenCourseZero,
  onStartLearningSession
}: {
  activeChildId: number | null;
  activeChildName?: string;
  onOpenCurriculum: () => void;
  onOpenCourseZero?: () => void;
  onStartLearningSession?: (childId: number | null, targetLessonId: string | undefined, mode: "LEARN" | "REVIEW") => boolean;
}) {
  // Learner Profiles Storage
  const [learners, setLearners] = useState<ChildLearner[]>(() => {
    const saved = localStorage.getItem("tongxuan_learners_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_LEARNERS;
  });

  const [activeLearnerId, setActiveLearnerId] = useState<string>(() => {
    const saved = localStorage.getItem("tongxuan_active_learner_id");
    return saved || "learner-1";
  });

  const activeLearner = (activeChildName ? learners.find((l) => l.name.trim().toLowerCase() === activeChildName.trim().toLowerCase()) : null) || learners.find((l) => l.id === activeLearnerId) || learners[0] || DEFAULT_LEARNERS[0];
  const [sessionProfileError, setSessionProfileError] = useState(false);

  // Helper to update active learner data and persist
  const updateActiveLearner = (updater: Partial<ChildLearner> | ((prev: ChildLearner) => ChildLearner)) => {
    setLearners((prev) => {
      const updated = prev.map((l) => {
        if (l.id === activeLearnerId) {
          return typeof updater === "function" ? updater(l) : { ...l, ...updater };
        }
        return l;
      });
      localStorage.setItem("tongxuan_learners_list", JSON.stringify(updated));
      return updated;
    });
  };

  // 關卡編號 (預設為當前未鎖定的關卡)
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(() => {
    const cur = (activeLearner.levelsProgress || []).find((p) => p.status === "current");
    return cur ? cur.levelNumber : 1;
  });

  // 階段測驗券 / 榮譽大考 Modal 狀態
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [activeQuizTargetLevel, setActiveQuizTargetLevel] = useState<CourseLevel | null>(null);
  const [achievementsModalOpen, setAchievementsModalOpen] = useState(false);

  const scriptMode: ScriptMode = activeLearner.scriptMode || "dual";
  const phoneticAssist: PhoneticAssist = activeLearner.phoneticAssist || "zhuyin";
  const handMode: HandMode = activeLearner.handMode || "right";
  const learnerPoints = activeLearner.points || { coins: 180, stars: 16 };
  const learnerLevelsProgress = activeLearner.levelsProgress || getLearnerLevelsProgress();

  const [displayLang, setDisplayLang] = useState<DisplayLang>(() => {
    const saved = localStorage.getItem("tongxuan_display_lang");
    if (saved && (saved === "zh-Hant" || saved === "zh-Hans" || saved === "en" || saved === "ja" || saved === "ko" || saved === "es")) {
      return saved as DisplayLang;
    }
    return "zh-Hant";
  });

  const [isDarkEyeCare, setIsDarkEyeCare] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [parentLockOpen, setParentLockOpen] = useState(false);
  const [chestModalOpen, setChestModalOpen] = useState(false);
  const [inClassroom, setInClassroom] = useState(false);
  const [classroomMode, setClassroomMode] = useState<"char" | "vocab" | "idiom">("char");
  const [classroomInitialStep, setClassroomInitialStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [rewardsShopModalOpen, setRewardsShopModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [aboutInitialTab, setAboutInitialTab] = useState<"about" | "roadmap" | "legal" | "disclaimer">("about");
  const [customPracticePlan, setCustomPracticePlan] = useState<DailyDayPlan | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (import.meta.env.MODE === "test") return false;
    return !localStorage.getItem("tongxuan_onboarded");
  });

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [menuOpen]);

  // Global Eye-Care Dark Mode Background Sync
  useEffect(() => {
    if (isDarkEyeCare) {
      document.documentElement.classList.add("is-dark-eyecare-global");
      document.body.classList.add("is-dark-eyecare-global");
    } else {
      document.documentElement.classList.remove("is-dark-eyecare-global");
      document.body.classList.remove("is-dark-eyecare-global");
    }
    return () => {
      document.documentElement.classList.remove("is-dark-eyecare-global");
      document.body.classList.remove("is-dark-eyecare-global");
    };
  }, [isDarkEyeCare]);

  // UI Translation Helper
  const t = (key: string, values?: Record<string, string | number>) => {
    let str = UI_TEXT[displayLang]?.[key] || UI_TEXT["zh-Hant"][key] || key;
    if (values) {
      Object.entries(values).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return str;
  };

  const updateScriptMode = (mode: ScriptMode) => {
    updateActiveLearner({ scriptMode: mode });
  };

  const updatePhoneticAssist = (mode: PhoneticAssist) => {
    updateActiveLearner({ phoneticAssist: mode });
  };

  const updateHandMode = (mode: HandMode) => {
    updateActiveLearner({ handMode: mode });
  };

  // Chinese Ruby Annotation Helper
  const R = (text: string, customScriptMode?: ScriptMode, customClass?: string): ReactNode => {
    if (phoneticAssist === "off") {
      return <span className={customClass}>{text}</span>;
    }
    const mode = phoneticAssist === "pinyin" ? "pinyin" : "zhuyin";
    return renderRuby(text, true, customScriptMode || mode, customClass);
  };

  // 背景語音導讀開關
  const [isVoiceGuideEnabled, setIsVoiceGuideEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("tongxuan_voice_guide");
    return saved === "true";
  });

  const toggleVoiceGuide = () => {
    setIsVoiceGuideEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("tongxuan_voice_guide", next ? "true" : "false");
      return next;
    });
  };

  const [dailyQueue, setDailyQueue] = useState<ValidatedDailyQueue | null>(null);

  const stageIdFromDailyQueue = (queue: ValidatedDailyQueue | null): string => {
    if (!queue) return "starter";
    const currentId = queue.newLesson?.lessonId || queue.completedLesson?.lessonId;
    if (currentId?.startsWith("book1") || queue.placementStart === "BOOK_1") return "book-1";
    if (currentId?.startsWith("basic") || queue.placementStart === "BASIC") return "basic";
    return "starter";
  };

  const findLessonAndStage = (id: string): { stage: (typeof officialCoursePath.stages)[0]; lesson: OfficialLesson } => {
    for (const st of officialCoursePath.stages) {
      const ls = st.lessons.find((l) => l.id === id);
      if (ls) return { stage: st, lesson: ls };
    }
    return { stage: officialCoursePath.stages[0], lesson: officialCoursePath.stages[0].lessons[0] };
  };

  const authoritativeLessonId =
    dailyQueue?.newLesson?.lessonId ||
    dailyQueue?.completedLesson?.lessonId ||
    (dailyQueue?.placementStart === "BOOK_1"
      ? "book1-l01"
      : dailyQueue?.placementStart === "BASIC"
      ? "basic-l01"
      : "starter-l01");

  const { stage: authoritativeStage, lesson: authoritativeLesson } = findLessonAndStage(authoritativeLessonId);
  const sessionTargetLessonId = dailyQueue?.newLesson?.lessonId || dailyQueue?.completedLesson?.lessonId ||
    (dailyQueue?.placementStart === "BOOK_1" ? "book1-l01" : dailyQueue?.placementStart === "BASIC" ? "basic-l01" : dailyQueue?.placementStart === "STARTER" ? "starter-l01" : undefined);

  function startLessonAtStep(step: 1 | 2 | 3 | 4 | 5, mode: "char" | "vocab" | "idiom" = "char") {
    setCustomPracticePlan(null);
    setClassroomInitialStep(step);
    setClassroomMode(mode);
    setInClassroom(true);
  }

  const startLearningSession = (mode: "LEARN" | "REVIEW") => {
    if (!onStartLearningSession || !isValidBackendChildId(activeChildId) || dailyQueue?.childId !== activeChildId || !sessionTargetLessonId) {
      setSessionProfileError(true);
      return;
    }
    setSessionProfileError(!onStartLearningSession(activeChildId, sessionTargetLessonId, mode));
  };

  const handleOnboardingComplete = (config: {
    name: string;
    avatar: string;
    scriptMode: ScriptMode;
    handMode?: HandMode;
    displayLang: DisplayLang;
  }) => {
    localStorage.setItem("tongxuan_onboarded", "true");
    localStorage.setItem("tongxuan_display_lang", config.displayLang);
    if (config.handMode) {
      localStorage.setItem("tongxuan_hand_mode", config.handMode);
    }
    setDisplayLang(config.displayLang);
    updateActiveLearner({
      name: config.name,
      avatar: config.avatar,
      scriptMode: config.scriptMode,
      ...(config.handMode ? { handMode: config.handMode } : {})
    });
    setOnboardingOpen(false);
    if (onStartLearningSession && isValidBackendChildId(activeChildId) && dailyQueue?.childId === activeChildId && sessionTargetLessonId) {
      startLearningSession("LEARN");
    } else {
      startLessonAtStep(1, "char");
    }
  };

  const [selectedStageId, setSelectedStageId] = useState<string>("starter");
  const [selectedOfficialLessonId, setSelectedOfficialLessonId] = useState<string>("starter-l01");

  useEffect(() => {
    let cancelled = false;
    const targetChildId = activeChildId;
    setDailyQueue(null);
    if (!isValidBackendChildId(targetChildId)) {
      return () => { cancelled = true; };
    }

    apiFetch(`${API}/api/children/${targetChildId}/learning-daily-queue`)
      .then((res) => (res.ok ? res.json() as Promise<unknown> : null))
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null &&
            "childId" in data && data.childId === targetChildId) {
          const queueData = data as ValidatedDailyQueue;
          setDailyQueue(queueData);
          const authId = queueData.newLesson?.lessonId || queueData.completedLesson?.lessonId || (queueData.placementStart === "BOOK_1" ? "book1-l01" : queueData.placementStart === "BASIC" ? "basic-l01" : "starter-l01");
          const found = findLessonAndStage(authId);
          setSelectedStageId(found.stage.id);
          setSelectedOfficialLessonId(found.lesson.id);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChildId]);

  const browsingStage = officialCoursePath.stages.find((s) => s.id === selectedStageId) || authoritativeStage;
  const browsingStageIndex = officialCoursePath.stages.findIndex((s) => s.id === browsingStage.id);
  const upcomingLesson = browsingStage.lessons.find((l) => l.id === selectedOfficialLessonId) || browsingStage.lessons[0];
  const isBrowsingDifferentLesson = upcomingLesson.id !== authoritativeLesson.id;

  const selectedLevel = TONGXUAN_AUTHORED_DRAFT_LEVELS.find((l) => l.levelNumber === selectedLevelNum) || TONGXUAN_AUTHORED_DRAFT_LEVELS[0];
  const selectedLevelProgress = learnerLevelsProgress.find((p) => p.levelNumber === selectedLevelNum) || {
    levelNumber: selectedLevelNum,
    status: selectedLevelNum === 1 ? ("current" as const) : ("locked" as const),
    completedAt: null,
    starsEarned: 0,
    score: null,
    masteryStatus: selectedLevelNum === 1 ? ("IN_PROGRESS" as const) : ("NOT_STARTED" as const),
    softUnlocked: selectedLevelNum === 1
  };

  const selectedDay: DailyDayPlan = courseLevelToDayPlan(selectedLevel, selectedLevelProgress);

  const launchStageQuiz = (level: CourseLevel) => {
    setActiveQuizTargetLevel(level);
    setQuizModalOpen(true);
  };

  const handleSelectLearner = (id: string) => {
    setActiveLearnerId(id);
    localStorage.setItem("tongxuan_active_learner_id", id);
    setLoginModalOpen(false);
    const chosen = learners.find((l) => l.id === id);
    if (chosen) {
      const curLvl = (chosen.levelsProgress || []).find((p) => p.status === "current");
      if (curLvl) setSelectedLevelNum(curLvl.levelNumber);
      playSound(`${t("morning")}，${chosen.name}！歡迎回來學習！`);
    }
  };

  const handleDeleteLearner = (id: string) => {
    if (learners.length <= 1) {
      alert("系統中至少需要保留一位學習者帳號喔！");
      return;
    }
    const target = learners.find((l) => l.id === id);
    if (!target) return;
    if (confirm(`確定要刪除學習者「${target.name}」的紀錄嗎？刪除後無法恢復。`)) {
      const nextList = learners.filter((l) => l.id !== id);
      setLearners(nextList);
      localStorage.setItem("tongxuan_learners_list", JSON.stringify(nextList));
      if (activeLearnerId === id) {
        const nextActiveId = nextList[0].id;
        setActiveLearnerId(nextActiveId);
        localStorage.setItem("tongxuan_active_learner_id", nextActiveId);
      }
    }
  };

  const handleAddLearner = (newLearner: ChildLearner) => {
    const updated = [...learners, newLearner];
    setLearners(updated);
    setActiveLearnerId(newLearner.id);
    localStorage.setItem("tongxuan_learners_list", JSON.stringify(updated));
    localStorage.setItem("tongxuan_active_learner_id", newLearner.id);
    setSelectedLevelNum(1);
    setLoginModalOpen(false);
    playSound(`歡迎來到桐軒中文，${newLearner.name}！開始我們的華語探索之旅吧！`);
  };

  // 家長在後台贈送點數給孩子
  const handleParentGiftPoints = (coins: number, stars: number, note: string) => {
    updateActiveLearner((prev) => ({
      ...prev,
      points: {
        coins: prev.points.coins + coins,
        stars: prev.points.stars + stars
      }
    }));
    alert(`🎉 成功贈送 🪙 ${coins} 金幣 與 ⭐ ${stars} 星星 給「${activeLearner.name}」！\n附言：${note}`);
  };

  // Story line audio playback & kid repeat recording state
  const [activeRecordingLineIdx, setActiveRecordingLineIdx] = useState<number | null>(null);
  const [linePraiseMessages, setLinePraiseMessages] = useState<Record<number, string>>({});

  const handlePlaySingleLine = (text: string) => {
    playSound(text, "normal", true);
  };

  const handleToggleRecordLine = (lineIdx: number, targetText: string) => {
    try {
      if (activeRecordingLineIdx === lineIdx) {
        setActiveRecordingLineIdx(null);
        setLinePraiseMessages((prev) => ({
          ...prev,
          [lineIdx]: "🌟 復誦完成！大聲念得非常棒！🪙 +2 金幣"
        }));
        updateActiveLearner((prev) => ({
          ...prev,
          points: { ...prev.points, coins: prev.points.coins + 2 }
        }));
        playSound("念得真棒！發音很標準！", "normal", true);
      } else {
        setActiveRecordingLineIdx(lineIdx);
        setLinePraiseMessages((prev) => ({
          ...prev,
          [lineIdx]: "🎙️ 正在聆聽小朋友朗讀... 讀完請再按一次結束！"
        }));

        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const rec = new SpeechRec();
            rec.lang = scriptMode === "pinyin" ? "zh-CN" : "zh-TW";
            rec.continuous = false;
            rec.interimResults = false;
            rec.onresult = (evt: any) => {
              try {
                const transcript = evt?.results?.[0]?.[0]?.transcript || targetText;
                setActiveRecordingLineIdx(null);
                setLinePraiseMessages((prev) => ({
                  ...prev,
                  [lineIdx]: `🌟 讀得太棒了：「${transcript}」！🪙 +2 金幣`
                }));
                updateActiveLearner((prev) => ({
                  ...prev,
                  points: { ...prev.points, coins: prev.points.coins + 2 }
                }));
                playSound("讀得太棒了！非常有精神！", "normal", true);
              } catch (e) {}
            };
            rec.onerror = () => {
              // Graceful error fallback
            };
            rec.onend = () => {
              // Ensure recording state resets smoothly
            };
            rec.start();
          } catch (e) {}
        }

        // Automatic fallback timer for child engagement (4 seconds)
        setTimeout(() => {
          setActiveRecordingLineIdx((curr) => {
            if (curr === lineIdx) {
              setLinePraiseMessages((prev) => ({
                ...prev,
                [lineIdx]: "🌟 復誦完成！大聲朗讀很清晰！🪙 +2 金幣"
              }));
              updateActiveLearner((prev) => ({
                ...prev,
                points: { ...prev.points, coins: prev.points.coins + 2 }
              }));
              playSound("讀得太棒了！非常有精神！", "normal", true);
              return null;
            }
            return curr;
          });
        }, 4000);
      }
    } catch (err) {
      console.error("Speech repeat error:", err);
      setActiveRecordingLineIdx(null);
    }
  };

  const playSound = (text: string, speed: SpeechSpeed = "normal", force = false) => {
    if (!isVoiceGuideEnabled && !force) {
      return;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = scriptMode === "zhuyin" ? "zh-TW" : scriptMode === "pinyin" ? "zh-CN" : "zh-TW";
      utter.rate = speed === "slow" ? 0.58 : 0.92;
      utter.pitch = 1.08;
      window.speechSynthesis.speak(utter);
    }
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
          // 完成關卡並自動解鎖下一關
          const { updatedProgress, unlockedNext } = completeCourseLevel(selectedLevelNum, earnedStars);
          trackLevelPass(selectedLevelNum, selectedDay?.themeTitle, earnedStars);

          updateActiveLearner((prev) => {
            let nextPact = prev.activePinkyPromise ? { ...prev.activePinkyPromise } : null;
            let bonusCoins = 0;
            if (nextPact && !nextPact.isCompleted) {
              nextPact.currentDays = Math.min(nextPact.requiredDays, nextPact.currentDays + 1);
              if (nextPact.currentDays >= nextPact.requiredDays) {
                nextPact.isCompleted = true;
                bonusCoins = nextPact.bonusCoins;
              }
            }

            return {
              ...prev,
              totalMinutesLearned: (prev.totalMinutesLearned || 0) + (selectedDay.estimatedMinutes || 25),
              streakDays: (prev.streakDays || 0) + 1,
              levelsProgress: updatedProgress,
              points: {
                coins: prev.points.coins + 10 + bonusCoins,
                stars: prev.points.stars + earnedStars
              },
              activePinkyPromise: nextPact
            };
          });

          setInClassroom(false);

          if (unlockedNext && selectedLevelNum < 25) {
            setSelectedLevelNum(selectedLevelNum + 1);
          }
        }}
        onExitClass={() => setInClassroom(false)}
      />
    );
  }

  return (
    <div className={`ipad-weekly-portal ${isDarkEyeCare ? "is-dark-eyecare" : ""}`}>
      {/* 1. TOP APP BAR (Clean, Focused, Distraction-Free) */}
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
            // 記錄通關並自動解鎖下一關
            const { updatedProgress, unlockedNext } = completeCourseLevel(
              activeQuizTargetLevel.levelNumber,
              earnedStars,
              score
            );
            trackLevelPass(activeQuizTargetLevel.levelNumber, activeQuizTargetLevel.title, earnedStars, score);

            updateActiveLearner((prev) => {
              return {
                ...prev,
                totalMinutesLearned: (prev.totalMinutesLearned || 0) + (activeQuizTargetLevel.estimatedMinutes || 20),
                streakDays: (prev.streakDays || 0) + 1,
                levelsProgress: updatedProgress,
                points: {
                  coins: prev.points.coins + coins,
                  stars: prev.points.stars + earnedStars
                },
                activePinkyPromise: acceptedPact !== undefined ? acceptedPact : prev.activePinkyPromise
              };
            });

            setQuizModalOpen(false);

            if (unlockedNext && activeQuizTargetLevel.levelNumber < 25) {
              setSelectedLevelNum(activeQuizTargetLevel.levelNumber + 1);
            }
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

