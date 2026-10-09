import { useState,useEffect,useRef,type ReactNode } from "react";
import { apiFetch } from "../../lib/apiFetch";
import { renderRuby } from "../../lib/chinesePhonetics";
import {
TONGXUAN_AUTHORED_DRAFT_LEVELS,
type CourseLevel,getLearnerLevelsProgress
} from "../../data/learningPathData";
import { officialCoursePath,type OfficialLesson } from "../../data/officialCoursePath";
import { isValidBackendChildId } from "../../lib/profiles";

import { ValidatedDailyQueue,ScriptMode,DisplayLang,PhoneticAssist,HandMode,SpeechSpeed,DailyDayPlan,ChildLearner } from "./types";
import { UI_TEXT } from "./uiText";
import { courseLevelToDayPlan } from "./dayPlan";
import { DEFAULT_LEARNERS } from "./defaultLearners";

import type { RuntimeMode } from "../../lib/runtimeMode";

const API = import.meta.env.VITE_API_BASE ?? "";

export interface ChildPortalProps {
  activeChildId: number | null;
  activeChildName?: string;
  onOpenCurriculum: () => void;
  onOpenCourseZero?: () => void;
  onStartLearningSession?: (childId: number | null, targetLessonId: string | undefined, mode: "LEARN" | "REVIEW") => boolean;
  /** Opens a conversation lesson in the local player; only used without a backend. */
  onOpenDialogueLesson?: (lessonId: string) => void;
  /** Overrides environment detection; tests use it to render the static home. */
  runtime?: RuntimeMode;
}

/** State and handlers for the child portal; the page and its views only render from this. */
export function useChildPortalController({ activeChildId, activeChildName, onOpenCurriculum, onOpenCourseZero, onStartLearningSession }: ChildPortalProps) {
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
  const learnerPoints = activeLearner.points || { coins: 0, stars: 0 };
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

  return {
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
  };
}

export type ChildPortalController = ReturnType<typeof useChildPortalController>;
