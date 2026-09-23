import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DisplayLanguage = "zh-Hant" | "zh-Hans" | "en";
export type LearningLocale = "zh-TW" | "zh-CN";
export type AnnotationMode = "AUTO" | "BOPOMOFO" | "PINYIN" | "HIDDEN";

export const DISPLAY_LANGUAGE_KEY = "tongxuan.display-language";
export const LEARNING_LOCALE_KEY = "tongxuan.learning-locale";
export const ANNOTATION_MODE_KEY = "tongxuan.annotation-mode";

const messages = {
  "zh-Hant": {
    today: "今天", practice: "練習", library: "學習地圖", parent: "家長", settings: "設定", mySpace: "我的",
    hello: "嗨，{name}", welcome: "準備好探索今天的中文了嗎？", todayPath: "今天的學習旅程", progress: "今日旅程",
    points: "我的星星", start: "開始練習", hear: "聽發音", nextUp: "接著來認識",
    taskCount: "{count} 個字等你探索", noTasks: "今天的任務準備中", noTasksHint: "家長稍後會為你安排新的中文任務。",
    continue: "繼續學習", chooseLearner: "切換學習者", addLearner: "新增學習者", parentZone: "家長天地",
    displayLanguage: "顯示語言", learningChinese: "正在學習", notation: "輔助文字", beginner: "初學者模式",
    traditional: "繁體中文", simplified: "简体中文", english: "English", bopomofo: "注音", pinyin: "拼音", hide: "隱藏",
    settingsIntro: "調整孩子看見的操作語言與中文學習方式。", familyMembers: "家庭成員", privacy: "隱私與安全",
    parentTitle: "一起看看學習旅程", parentDescription: "查看各項練習紀錄與本週進度。", retry: "再試一次", loading: "正在準備…",
    rewards: "想要的獎勵", seeAll: "看看全部", curriculum: "課程地圖", tutor: "問問老師", close: "關閉", addTitle: "新增一位學習者",
    nameLabel: "孩子的名字", create: "建立個人空間", cancel: "取消", namePlaceholder: "例如：小安", createError: "請輸入學習者名稱。",
    parentRole: "家長管理者", childRole: "學習者", rewardEmpty: "完成旅程後，星星會慢慢累積起來。", skillNote: "每一種能力都會分開記錄，讓進步看得更清楚。",
    childrenError: "家庭成員目前載入失敗。", nameExists: "這個名稱已經存在，請換一個名稱。", createFailed: "建立學習者失敗，請稍後再試。",
    practiceTitle: "一起練習中文", practiceHint: "選一個小活動開始，完成後就能看到自己的進步。", settingsTitle: "讓 App 更適合你",
    curriculumTitle: "中文學習地圖", curriculumIntro: "沿著官方教材，一課一課完成你的中文旅程。", courseZeroTitle: "聲音工具入門", courseZeroDescription: "依官方入門冊，先注音再銜接拼音與聲調，接著進入第一課。", courseZeroFullIntro: "依官方入門冊的順序，先建立注音，再用相同內容銜接漢語拼音，最後進入第一冊第一課。", courseZeroBoundary: "這是學習導覽與介面預覽，不冒充官方課文；正式內容會在來源登錄後匯入。", courseZeroPracticeTitle: "今天先練這兩件事", courseZeroListenTask: "聽一聽中文聲音", courseZeroMatchTask: "把注音和拼音配起來", backToMap: "回到學習地圖", previous: "上一個", nextStep: "下一個", startFirstLesson: "進入第一課", coursePreparing: "準備中", officialCourseTitle: "官方教材路線", officialCourseNote: "課程順序固定來自官方教材：入門冊 → 基礎冊 → 第一冊；精確課文匯入前會先完成來源與授權登錄。", pathConfirmed: "路線已確認", contentImportPending: "內容待匯入", firstLessonTitle: "第一課：你好", firstLessonIntro: "這是官方課程的第一個課文入口。完成入門冊與基礎冊後，再開始正式課文。", lessonImportPending: "課文內容尚未匯入，先保留官方來源與課程位置。", sourceRecord: "來源紀錄", openOfficialSource: "開啟官方教材頁", sourceRecordNote: "只有完成內容來源、授權與版本登錄後，課文才會進入可練習狀態。", lessonPreparing: "課文準備中", curriculumChild: "學習者", refreshCurriculum: "更新進度", completed: "完成", inProgress: "進行中", notStarted: "未開始", asOf: "資料截至",
    privacyText: "每位孩子的學習紀錄分開保存。語言偏好只保存在這台裝置。", diagnostics: "系統狀態", scores: "學習表現", scoresHint: "分技能查看練習紀錄", familySettings: "家庭設定", languagePrivacy: "語言與隱私",
    parentConfirm: "家長確認", redeemTitle: "兌換「{name}」", parentAuth: "請家長確認兌換。密碼會安全地交由系統驗證。", parentPassword: "家長密碼", enterParentPassword: "輸入家長密碼", verifying: "驗證中…", confirmRedeem: "確認兌換", redeemSuccess: "已送出「{name}」兌換。", redeemError: "兌換失敗，請稍後再試。", guideSays: "我們一起來！",
    notationAuto: "自動・依學習模式顯示", traditionalHint: "繁體中文預設搭配注音，可按需要切換。", simplifiedHint: "簡體中文預設搭配拼音，可按需要切換。",
  },
  "zh-Hans": {
    today: "今天", practice: "练习", library: "学习地图", parent: "家长", settings: "设置", mySpace: "我的",
    hello: "嗨，{name}", welcome: "准备好探索今天的中文了吗？", todayPath: "今天的学习旅程", progress: "今日旅程",
    points: "我的星星", start: "开始练习", hear: "听发音", nextUp: "接下来认识",
    taskCount: "{count} 个字等你探索", noTasks: "今天的任务准备中", noTasksHint: "家长稍后会为你安排新的中文任务。",
    continue: "继续学习", chooseLearner: "切换学习者", addLearner: "新增学习者", parentZone: "家长天地",
    displayLanguage: "显示语言", learningChinese: "正在学习", notation: "辅助文字", beginner: "初学者模式",
    traditional: "繁體中文", simplified: "简体中文", english: "English", bopomofo: "注音", pinyin: "拼音", hide: "隐藏",
    settingsIntro: "调整孩子看到的操作语言与中文学习方式。", familyMembers: "家庭成员", privacy: "隐私与安全",
    parentTitle: "一起看看学习旅程", parentDescription: "查看各项练习记录与本周进度。", retry: "再试一次", loading: "正在准备…",
    rewards: "想要的奖励", seeAll: "看看全部", curriculum: "课程地图", tutor: "问问老师", close: "关闭", addTitle: "新增一位学习者",
    nameLabel: "孩子的名字", create: "建立个人空间", cancel: "取消", namePlaceholder: "例如：小安", createError: "请输入学习者名称。",
    parentRole: "家长管理者", childRole: "学习者", rewardEmpty: "完成旅程后，星星会慢慢累积起来。", skillNote: "每一种能力都会分开记录，让进步看得更清楚。",
    childrenError: "家庭成员目前加载失败。", nameExists: "这个名称已经存在，请换一个名称。", createFailed: "创建学习者失败，请稍后再试。",
    practiceTitle: "一起练习中文", practiceHint: "选一个小游戏开始，完成后就能看到自己的进步。", settingsTitle: "让 App 更适合你",
    curriculumTitle: "中文学习地图", curriculumIntro: "沿着官方教材，一课一课完成你的中文旅程。", courseZeroTitle: "声音工具入门", courseZeroDescription: "依官方入门册，先注音再衔接拼音与声调，接着进入第一课。", courseZeroFullIntro: "依官方入门册的顺序，先建立注音，再用相同内容衔接汉语拼音，最后进入第一册第一课。", courseZeroBoundary: "这是学习导览与界面预览，不冒充官方课文；正式内容会在来源登记后汇入。", courseZeroPracticeTitle: "今天先练这两件事", courseZeroListenTask: "听一听中文声音", courseZeroMatchTask: "把注音和拼音配起来", backToMap: "回到学习地图", previous: "上一个", nextStep: "下一个", startFirstLesson: "进入第一课", coursePreparing: "准备中", officialCourseTitle: "官方教材路线", officialCourseNote: "课程顺序固定来自官方教材：入门册 → 基础册 → 第一册；精确课文汇入前会先完成来源与授权登记。", pathConfirmed: "路线已确认", contentImportPending: "内容待汇入", firstLessonTitle: "第一课：你好", firstLessonIntro: "这是官方课程的第一个课文入口。完成入门册与基础册后，再开始正式课文。", lessonImportPending: "课文内容尚未汇入，先保留官方来源与课程位置。", sourceRecord: "来源记录", openOfficialSource: "打开官方教材页", sourceRecordNote: "只有完成内容来源、授权与版本登记后，课文才会进入可练习状态。", lessonPreparing: "课文准备中", curriculumChild: "学习者", refreshCurriculum: "更新进度", completed: "完成", inProgress: "进行中", notStarted: "未开始", asOf: "资料截至",
    privacyText: "每位孩子的学习记录分开保存。语言偏好只保存在这台设备。", diagnostics: "系统状态", scores: "学习表现", scoresHint: "分技能查看练习记录", familySettings: "家庭设置", languagePrivacy: "语言与隐私",
    parentConfirm: "家长确认", redeemTitle: "兑换“{name}”", parentAuth: "请家长确认兑换。密码会安全地交由系统验证。", parentPassword: "家长密码", enterParentPassword: "输入家长密码", verifying: "验证中…", confirmRedeem: "确认兑换", redeemSuccess: "已提交“{name}”兑换。", redeemError: "兑换失败，请稍后再试。", guideSays: "我们一起开始吧！",
    notationAuto: "自动・依学习模式显示", traditionalHint: "繁體中文默认搭配注音，可按需要切换。", simplifiedHint: "简体中文默认搭配拼音，可按需要切换。",
  },
  en: {
    today: "Today", practice: "Practice", library: "Learning path", parent: "Parent", settings: "Settings", mySpace: "My space",
    hello: "Hi, {name}", welcome: "Ready to explore Chinese today?", todayPath: "Today's learning journey", progress: "Today's journey",
    points: "My stars", start: "Start practice", hear: "Hear it", nextUp: "Up next",
    taskCount: "{count} characters to explore", noTasks: "Your next mission is getting ready", noTasksHint: "A parent can add a new Chinese learning activity soon.",
    continue: "Keep learning", chooseLearner: "Switch learner", addLearner: "Add learner", parentZone: "Parent zone",
    displayLanguage: "Display language", learningChinese: "Learning Chinese", notation: "Reading hints", beginner: "Beginner mode",
    traditional: "Traditional Chinese", simplified: "Simplified Chinese", english: "English", bopomofo: "Zhuyin", pinyin: "Pinyin", hide: "Hidden",
    settingsIntro: "Choose the language for the app and the way Chinese appears while learning.", familyMembers: "Family members", privacy: "Privacy & safety",
    parentTitle: "Your family's learning journey", parentDescription: "Review practice events and this week's progress.", retry: "Try again", loading: "Getting things ready…",
    rewards: "My wishes", seeAll: "See all", curriculum: "Learning path", tutor: "Ask a tutor", close: "Close", addTitle: "Add a learner",
    nameLabel: "Learner name", create: "Create learner space", cancel: "Cancel", namePlaceholder: "For example, Alex", createError: "Enter a learner name.",
    parentRole: "Parent manager", childRole: "Learner", rewardEmpty: "Complete learning activities to collect stars.", skillNote: "Each skill is tracked separately so progress stays clear.",
    childrenError: "Family members could not be loaded.", nameExists: "That name is already in use. Choose another one.", createFailed: "Learner could not be created. Try again soon.",
    practiceTitle: "Let's practice Chinese", practiceHint: "Pick one short activity. You'll see your progress as you go.", settingsTitle: "Make the app yours",
    curriculumTitle: "Chinese learning map", curriculumIntro: "Follow the official course, one lesson at a time.", courseZeroTitle: "Sound Lab", courseZeroDescription: "Follow the official starter path: Zhuyin first, then the matching Pinyin bridge.", courseZeroFullIntro: "Build the sound foundation from the official starter path before entering Book 1.", courseZeroBoundary: "This is a guided preview, not official lesson text. Content enters practice only after source review.", courseZeroPracticeTitle: "Today's two small missions", courseZeroListenTask: "Listen to a Chinese sound", courseZeroMatchTask: "Match Zhuyin and Pinyin", backToMap: "Back to learning map", previous: "Previous", nextStep: "Next", startFirstLesson: "Enter lesson one", coursePreparing: "Coming next", officialCourseTitle: "Official course path", officialCourseNote: "The order stays tied to the official materials: Starter → Basic → Book 1. Exact lesson content is imported only after provenance review.", pathConfirmed: "Path confirmed", contentImportPending: "Content pending", firstLessonTitle: "Lesson 1: Hello", firstLessonIntro: "This is the official course entry point. Finish Starter and Basic before the full lesson opens.", lessonImportPending: "Lesson content is not imported yet; the official position and source stay visible.", sourceRecord: "Source record", openOfficialSource: "Open official source", sourceRecordNote: "A lesson becomes practice-ready only after its source, licence, and version are recorded.", lessonPreparing: "Lesson preparing", curriculumChild: "Learner", refreshCurriculum: "Refresh progress", completed: "Completed", inProgress: "In progress", notStarted: "Not started", asOf: "As of",
    privacyText: "Each learner has a separate learning record. Language preferences stay on this device.", diagnostics: "System status", scores: "Learning progress", scoresHint: "Review practice by skill", familySettings: "Family settings", languagePrivacy: "Language & privacy",
    parentConfirm: "Parent confirmation", redeemTitle: "Redeem {name}", parentAuth: "Ask a parent to confirm. The password is verified securely by the app.", parentPassword: "Parent password", enterParentPassword: "Enter parent password", verifying: "Checking…", confirmRedeem: "Confirm redemption", redeemSuccess: "Redemption requested for {name}.", redeemError: "Redemption failed. Try again soon.", guideSays: "Let's learn together!",
    notationAuto: "Auto · based on learning mode", traditionalHint: "Traditional Chinese uses Zhuyin by default. Change this anytime.", simplifiedHint: "Simplified Chinese uses Pinyin by default. Change this anytime.",
  },
} satisfies Record<DisplayLanguage, Record<string, string>>;

function detectedLanguage(): DisplayLanguage {
  const saved = localStorage.getItem(DISPLAY_LANGUAGE_KEY);
  if (saved === "zh-Hant" || saved === "zh-Hans" || saved === "en") return saved;
  const browserLanguage = navigator.language.toLowerCase();
  return browserLanguage.includes("hans") || browserLanguage === "zh-cn" || browserLanguage === "zh-sg" ? "zh-Hans" : browserLanguage.startsWith("zh") ? "zh-Hant" : "en";
}

type LocaleContextValue = { language: DisplayLanguage; setLanguage: (language: DisplayLanguage) => void; t: (key: keyof typeof messages.en, values?: Record<string, string | number>) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DisplayLanguage>(detectedLanguage);
  function setLanguage(next: DisplayLanguage) { localStorage.setItem(DISPLAY_LANGUAGE_KEY, next); setLanguageState(next); }
  useEffect(() => { document.documentElement.lang = language === "zh-Hant" ? "zh-TW" : language === "zh-Hans" ? "zh-CN" : "en"; }, [language]);
  const value = useMemo<LocaleContextValue>(() => ({ language, setLanguage, t: (key, values = {}) => Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), messages[language][key] ?? messages.en[key] ?? key) }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context) return context;
  const language = detectedLanguage();
  return {
    language,
    setLanguage: (next: DisplayLanguage) => localStorage.setItem(DISPLAY_LANGUAGE_KEY, next),
    t: (key: keyof typeof messages.en, values: Record<string, string | number> = {}) => Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), messages[language][key] ?? messages.en[key] ?? key),
  };
}

export function currentLearningLocale(): LearningLocale {
  const saved = localStorage.getItem(LEARNING_LOCALE_KEY);
  return saved === "zh-CN" ? "zh-CN" : "zh-TW";
}

export function currentAnnotationMode(): AnnotationMode {
  const saved = localStorage.getItem(ANNOTATION_MODE_KEY);
  return saved === "BOPOMOFO" || saved === "PINYIN" || saved === "HIDDEN" ? saved : "AUTO";
}
