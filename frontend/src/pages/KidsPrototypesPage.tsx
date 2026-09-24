import { useState, useEffect, useRef, type ReactNode } from "react";
import HanziWriter from "hanzi-writer";
import {
  Volume2,
  Sparkles,
  Play,
  Lock,
  Star,
  Flame,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  PenTool,
  Mic,
  Smile,
  X,
  Compass,
  Check,
  Award,
  Calendar,
  Gift,
  Trophy,
  Zap,
  Key,
  Crown,
  Package,
  Moon,
  Sun,
  Settings,
  Menu,
  Languages,
  Eye,
  EyeOff,
  GraduationCap,
  RotateCcw,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Layers,
  Hand,
  VolumeX,
  FastForward,
  Pause
} from "lucide-react";
import { renderRuby, RubyText, getCharPhonetic } from "../lib/chinesePhonetics";
import { OCAC_VOLUMES, type OCACVolume, type OCACLesson } from "../data/ocacTextbooksData";
import { HANZI_5000_CORE, searchHanziLexicon, type HanziEntry } from "../data/hanzi5000Database";
import {
  type RewardItem,
  type RedemptionRecord,
  type RewardCategory,
  getRewardsCatalog,
  saveRewardsCatalog,
  getLearnerPoints,
  saveLearnerPoints,
  getRedemptionHistory,
  redeemRewardItem,
  approveOrClaimTicket,
  getParentPin,
  setParentPin,
  verifyParentPin,
  addRewardItem,
  updateRewardItem,
  deleteRewardItem,
  resetRewardsCatalogToDefault,
  DEFAULT_EXPERT_REWARDS,
  REWARDS_CATALOG
} from "../data/rewardsShopData";
import {
  ALL_COURSE_LEVELS,
  type CourseLevel,
  type LearnerLevelProgress,
  type QuizQuestionItem,
  getLearnerLevelsProgress,
  saveLearnerLevelsProgress,
  completeCourseLevel,
  generateQuizPaper
} from "../data/learningPathData";

export type ScriptMode = "zhuyin" | "pinyin" | "dual";
export type DisplayLang = "zh-Hant" | "zh-Hans" | "en" | "ja" | "ko" | "es";
export type PhoneticAssist = "zhuyin" | "pinyin" | "off";
export type HandMode = "right" | "left";
export type SpeechSpeed = "normal" | "slow";

// Multi-language UI Dictionaries for the Child Portal and Parent Settings
const UI_TEXT: Record<DisplayLang, Record<string, string>> = {
  "zh-Hant": {
    morning: "早安",
    weekN: "第 {n} 週",
    menu: "選單",
    beginnerChipOn: "初學標音 · 開啟",
    beginnerChipOff: "純漢字 · 閱讀",
    beginnerModeLabel: "初學者標音模式 (全字標音)",
    beginnerModeActive: "全螢幕中文字均加上注音/拼音",
    beginnerModeInactive: "純漢字閱讀挑戰模式",
    eyeCareMode: "護眼模式",
    eyeCareDark: "深色低藍光",
    eyeCareLight: "白天模式",
    scriptModeLabel: "學習字體與拼讀",
    scriptZhuyin: "繁體注音",
    scriptPinyin: "簡體拼音",
    scriptDual: "繁+簡雙軌",
    displayLangLabel: "介面顯示語言",
    phoneticLabel: "生字標音顯示",
    phoneticShow: "顯示標音",
    phoneticHide: "隱藏標音 (識字挑戰)",
    switchUser: "👤 切換學習者帳號",
    parentZone: "進入家長管理後台",
    today: "今日",
    lessonDay: "{day} 課程",
    lessonDuration: "⏱️ 約 {min} 分鐘",
    readAloud: "課文朗讀",
    cardStrokeTitle: "生字 · 聽說讀寫",
    cardVocabTitle: "生詞 · 認讀造句",
    cardIdiomTitle: "成語 · 故事閱讀",
    cardStrokeDualHint: "田字格筆順 · 聽說讀寫 5 步全循環",
    cardStrokeSingleHint: "田字格筆順描紅 · 點擊進入全循環練字",
    cardVocabHint: "生活常見高頻詞彙 · 點擊認讀聽發音",
    cardIdiomHint: "成語典故故事與情境生活應用",
    exitClass: "退出教室",
    step1Title: "🌟 第一步：看一看 · 聽音認生字",
    step2Title: "✍️ 第二步：寫一寫 · 筆順描紅練習",
    step3Title: "📝 第三步：記一記 · 記憶默寫挑戰",
    step4Title: "🗣️ 第四步：讀一讀 · 字義組詞造句",
    step5Title: "🎯 第五步：測一測 · 課後通關測驗",
    traceCountLabel: "剩餘練習",
    traceOnceBtn: "✍️ 寫好了",
    traceCountDone: "🎉 10次練習已完成！",
    dictationHint: "憑記憶在田字格內書寫，忘記可點 💡 提示！",
    dictationClear: "清除",
    dictationToggleHint: "提示",
    dictationSubmit: "寫好了",
    dictationPassed: "太棒了！默寫成功！",
    standardSound: "發音",
    speakBtn: "開口說話 (錄音評測)",
    sentencePlay: "播放課文朗讀",
    prevStep: "上一步",
    nextStep: "下一步",
    finishLessonBtn: "完成今日課程 🎉",
    rewardClaimReturn: "領取獎勵並返回",
    traceHint: "請用手指在田字格內跟著筆畫描寫！",
    traceBothTip: "繁體「{t}」{ts}畫 · 簡體「{s}」{ss}畫",
    traceSameTip: "「{c}」為繁簡同體字，共 {n} 畫（部首：{r}）",
    speakInstruction: "請大聲讀出標準發音與聲調！",
    praiseGood: "讀得非常棒！發音很標準！",
    chestTitle: "🎁 週日神秘寶箱",
    chestSub: "每週日打開寶箱，領取神秘大禮物！",
    normalChestTitle: "📦 寶箱 1：通關大寶箱",
    normalChestCond: "本週通關 6 天即可開啟（不需連續）",
    streakChestTitle: "👑 寶箱 2：全勤王者寶箱",
    streakChestCond: "連續 6 天及時通關，週日多開 1 個大寶箱！",
    rewardText: "獎勵：⭐ +10 星 + 🎁 識字徽章",
    rewardStreakText: "獎勵：⭐ 額外 +10 星 + 👑 王者皇冠",
    openChest: "🎁 點擊開箱",
    openKingChest: "👑 點擊打開王者寶箱",
    needKeys: "還差 {n} 支鑰匙",
    needStreak: "連續打卡還差 {n} 天",
    chestFooter: "💡 每天認真學習，週日就能同時抱走 2 個大寶箱 喔！",
    parentGateTitle: "家長管理專區安全鎖",
    parentGateDesc: "為保護小朋友專注學習，請回答算術問題進入家長後台：",
    parentDashboardTitle: "👨‍👩‍👧 家長學習管理後台",
    parentDashboardDesc: "已驗證家長身份。在此配置每日學習量、教材主線與防沉迷時間：",
    parentPlanLabel: "🎯 每日學習量與目標時長",
    parentCurriculumLabel: "📚 僑委會主線教材冊次",
    saveSettings: "儲存學習設定"
  },
  "zh-Hans": {
    morning: "早安",
    weekN: "第 {n} 周",
    menu: "菜单",
    beginnerChipOn: "初学标音 · 开启",
    beginnerChipOff: "纯汉字 · 阅读",
    beginnerModeLabel: "初学者标音模式 (全字标音)",
    beginnerModeActive: "全屏幕中文字均加上注音/拼音",
    beginnerModeInactive: "纯汉字阅读挑战模式",
    eyeCareMode: "护眼模式",
    eyeCareDark: "深色低蓝光",
    eyeCareLight: "白天模式",
    scriptModeLabel: "学习字体与拼读",
    scriptZhuyin: "繁体注音",
    scriptPinyin: "简体拼音",
    scriptDual: "繁+简双轨",
    displayLangLabel: "界面显示语言",
    phoneticLabel: "生字标音显示",
    phoneticShow: "显示标音",
    phoneticHide: "隐藏标音 (识字挑战)",
    switchUser: "👤 切换学习者账号",
    parentZone: "进入家长管理后台",
    today: "今日",
    lessonDay: "{day} 课程",
    lessonDuration: "⏱️ 约 {min} 分钟",
    readAloud: "课文朗读",
    cardStrokeTitle: "生字 · 听说读写",
    cardVocabTitle: "生词 · 认读造句",
    cardIdiomTitle: "成语 · 故事阅读",
    cardStrokeDualHint: "田字格笔顺 · 听说读写 5 步全循环",
    cardStrokeSingleHint: "田字格笔顺描红 · 点击进入全循环练字",
    cardVocabHint: "生活常见高频词汇 · 点击认读听发音",
    cardIdiomHint: "成语典故故事与情境生活应用",
    exitClass: "退出教室",
    step1Title: "🌟 第一步：看一看 · 听音认生字",
    step2Title: "✍️ 第二步：写一写 · 笔顺描红练习",
    step3Title: "📝 第三步：记一记 · 记忆默写挑战",
    step4Title: "🗣️ 第四步：读一读 · 字义组词造句",
    step5Title: "🎯 第五步：测一测 · 课后通关测验",
    traceCountLabel: "剩余练习",
    traceOnceBtn: "✍️ 写好了",
    traceCountDone: "🎉 10次练习已完成！",
    dictationHint: "凭记忆在田字格内书写，忘记可点 💡 提示！",
    dictationClear: "清除",
    dictationToggleHint: "提示",
    dictationSubmit: "写好了",
    dictationPassed: "太棒了！默写成功！",
    standardSound: "发音",
    speakBtn: "开口说话 (录音评测)",
    sentencePlay: "播放课文朗读",
    prevStep: "上一步",
    nextStep: "下一步",
    finishLessonBtn: "完成今日课程 🎉",
    rewardClaimReturn: "领取奖励并返回",
    traceHint: "请用手指在田字格内跟着笔画描写！",
    traceBothTip: "繁体「{t}」{ts}画 · 简体「{s}」{ss}画",
    traceSameTip: "「{c}」为繁简同体字，共 {n} 画（部首：{r}）",
    speakInstruction: "请大声读出标准发音与声调！",
    praiseGood: "读得非常棒！发音很标准！",
    chestTitle: "🎁 周日神秘宝箱",
    chestSub: "每周日打开宝箱，领取神秘大礼物！",
    normalChestTitle: "📦 宝箱 1：通关大宝箱",
    normalChestCond: "本周通关 6 天即可开启（不需连续）",
    streakChestTitle: "👑 宝箱 2：全勤王者宝箱",
    streakChestCond: "连续 6 天及时通关，周日多开 1 个大宝箱！",
    rewardText: "奖励：⭐ +10 星 + 🎁 识字徽章",
    rewardStreakText: "奖励：⭐ 额外 +10 星 + 👑 王者皇冠",
    openChest: "🎁 点击开箱",
    openKingChest: "👑 点击打开王者宝箱",
    needKeys: "还差 {n} 支钥匙",
    needStreak: "连续打卡还差 {n} 天",
    chestFooter: "💡 每天认真学习，周日就能同时抱走 2 个大宝箱 喔！",
    parentGateTitle: "家长管理专区安全锁",
    parentGateDesc: "为保护小朋友专注学习，请回答算术问题进入家长后台：",
    parentDashboardTitle: "👨‍👩‍👧 家长学习管理后台",
    parentDashboardDesc: "已验证家长身份。在此配置每日学习量、教材主线与防沉迷时间：",
    parentPlanLabel: "🎯 每日学习量与目标时长",
    parentCurriculumLabel: "📚 侨委会主线教材册次",
    saveSettings: "保存学习设置"
  },
  "en": {
    morning: "Good Morning",
    weekN: "Week {n}",
    menu: "Menu",
    beginnerChipOn: "Phonetics · ON",
    beginnerChipOff: "Hanzi Only · Reading",
    beginnerModeLabel: "Beginner Phonetic Assist Mode",
    beginnerModeActive: "All characters annotated with Zhuyin/Pinyin",
    beginnerModeInactive: "Character-only reading challenge mode",
    eyeCareTheme: "Eye-Care Theme",
    eyeCareDark: "Dark Low-Blue",
    eyeCareLight: "Daylight Mode",
    scriptModeLabel: "Script & Phonetics",
    scriptZhuyin: "Traditional (Zhuyin)",
    scriptPinyin: "Simplified (Pinyin)",
    scriptDual: "Trad + Sim Dual",
    displayLangLabel: "Display Language",
    phoneticLabel: "Phonetic Notation",
    phoneticShow: "Show Phonetics",
    phoneticHide: "Hide (Reading Challenge)",
    switchUser: "👤 Switch Learner Account",
    parentZone: "Parent Dashboard",
    today: "Today",
    lessonDay: "{day} Lesson",
    lessonDuration: "⏱️ ~{min} mins",
    readAloud: "Read Aloud",
    cardStrokeTitle: "Characters · 5-Step Loop",
    cardVocabTitle: "Vocabulary · Phrases",
    cardIdiomTitle: "Idioms · Story Reading",
    cardStrokeDualHint: "Stroke order · 5-step interactive character classroom",
    cardStrokeSingleHint: "Tianzige tracing · Tap to enter full character loop",
    cardVocabHint: "Daily essential vocabulary · Listen and speak",
    cardIdiomHint: "Classical idioms and real-life context stories",
    exitClass: "Exit Class",
    step1Title: "🌟 Step 1: Look & Recognize",
    step2Title: "✍️ Step 2: Stroke Order & Tracing",
    step3Title: "📝 Step 3: Silent Dictation Challenge",
    step4Title: "🗣️ Step 4: Meaning, Words & Speaking",
    step5Title: "🎯 Step 5: End-of-Lesson Mini Quiz",
    traceCountLabel: "Remaining",
    traceOnceBtn: "✍️ Done",
    traceCountDone: "🎉 10x Completed!",
    dictationHint: "Write from memory! Tap 💡 Hint if stuck.",
    dictationClear: "Clear",
    dictationToggleHint: "Hint",
    dictationSubmit: "Done",
    dictationPassed: "Awesome! Dictation passed!",
    standardSound: "Audio",
    speakBtn: "Voice Test",
    sentencePlay: "Play Story Sentence",
    prevStep: "Back",
    nextStep: "Next",
    finishLessonBtn: "Complete Today's Lesson 🎉",
    rewardClaimReturn: "Claim Rewards & Finish",
    traceHint: "Trace the strokes inside the grid with your finger!",
    traceBothTip: "Trad「{t}」{ts} strokes · Sim「{s}」{ss} strokes",
    traceSameTip: "「{c}」is identical in Trad & Sim, {n} strokes (Radical: {r})",
    speakInstruction: "Read aloud with accurate tone!",
    praiseGood: "Excellent reading! Very accurate pronunciation!",
    chestTitle: "🎁 Sunday Mystery Chests",
    chestSub: "Open chests every Sunday for exciting rewards!",
    normalChestTitle: "📦 Chest 1: Completion Chest",
    normalChestCond: "Pass 6 days this week (no streak required)",
    streakChestTitle: "👑 Chest 2: King Streak Chest",
    streakChestCond: "6-day daily streak earns an extra chest on Sunday!",
    rewardText: "Reward: ⭐ +10 Stars + 🎁 Badge",
    rewardStreakText: "Reward: ⭐ Extra +10 Stars + 👑 King Crown",
    openChest: "🎁 Open Chest",
    openKingChest: "👑 Open King Chest",
    needKeys: "{n} keys remaining",
    needStreak: "{n} days streak remaining",
    chestFooter: "💡 Study diligently every day to take home BOTH chests on Sunday!",
    parentGateTitle: "Parent Security Gate",
    parentGateDesc: "Answer the math question to enter the parent area:",
    parentDashboardTitle: "👨‍👩‍👧 Parent Management Dashboard",
    parentDashboardDesc: "Parent verified. Configure daily workload, textbook, and screen limits:",
    parentPlanLabel: "🎯 Daily Pace & Target Time",
    parentCurriculumLabel: "📚 Official Textbook Curriculum",
    saveSettings: "Save Settings"
  },
  "ja": {
    morning: "おはよう",
    weekN: "第 {n} 週",
    menu: "メニュー",
    beginnerChipOn: "ふりがな補助 · ON",
    beginnerChipOff: "漢字のみ · 読解",
    beginnerModeLabel: "初心者ふりがなモード",
    beginnerModeActive: "全画面の漢字に注音・ピンインを表示",
    beginnerModeInactive: "漢字のみの読解チャレンジ",
    eyeCareMode: "アイケアモード",
    eyeCareDark: "ダーク・低ブルーライト",
    eyeCareLight: "デイライト",
    scriptModeLabel: "文字と発音表記",
    scriptZhuyin: "繁体字（注音）",
    scriptPinyin: "簡体字（ピンイン）",
    scriptDual: "繁＋簡両方",
    displayLangLabel: "表示言語",
    phoneticLabel: "ふりがな・発音表示",
    phoneticShow: "表示する",
    phoneticHide: "隠す (漢字挑戦)",
    switchUser: "👤 学習者を切り替え",
    parentZone: "保護者ダッシュボード",
    today: "今日",
    lessonDay: "{day} レッスン",
    lessonDuration: "⏱️ 毎日約 {min} 分（{count} 文字）",
    readAloud: "本文朗読",
    cardStrokeTitle: "生字 · 読み書き",
    cardVocabTitle: "単語 · 語彙",
    cardIdiomTitle: "成語 · お話",
    cardStrokeDualHint: "田字格筆順 · 5ステップ全循環学習",
    cardStrokeSingleHint: "田字格なぞり書き · タップして練習",
    cardVocabHint: "生活頻出語彙 · 発音を聞いて練習",
    cardIdiomHint: "成語の由来とお話の理解",
    exitClass: "教室を出る",
    step1Title: "🌟 ステップ 1: 見て覚える",
    step2Title: "✍️ ステップ 2: なぞり書き練習",
    step3Title: "📝 ステップ 3: 記憶書き取りテスト",
    step4Title: "🗣️ ステップ 4: 語彙と発音テスト",
    step5Title: "🎯 ステップ 5: レッスン確認テスト",
    traceCountLabel: "残り回数",
    traceOnceBtn: "✍️ 完了",
    traceCountDone: "🎉 10回完了！",
    dictationHint: "記憶を頼りに書こう！困ったら 💡 ヒント。",
    dictationClear: "消去",
    dictationToggleHint: "ヒント",
    dictationSubmit: "提出",
    dictationPassed: "素晴らしい！書き取り成功！",
    standardSound: "音声",
    speakBtn: "録音テスト",
    sentencePlay: "例文を再生",
    prevStep: "前へ",
    nextStep: "次へ",
    finishLessonBtn: "今日のレッスン完了 🎉",
    rewardClaimReturn: "報酬を受け取って戻る",
    traceHint: "指で田字格の漢字をなぞってみましょう！",
    traceBothTip: "繁体字「{t}」{ts}画 · 簡体字「{s}」{ss}画",
    traceSameTip: "「{c}」は繁簡同形（{n}画、部首：{r}）",
    speakInstruction: "声に出して標準発音を練習しましょう！",
    praiseGood: "素晴らしい発音です！",
    chestTitle: "🎁 日曜日の宝箱",
    chestSub: "毎週日曜日に宝箱を開けてプレゼントをもらおう！",
    normalChestTitle: "📦 宝箱 1：通関宝箱",
    normalChestCond: "今週6日間クリアで開放",
    streakChestTitle: "👑 宝箱 2：連続王者宝箱",
    streakChestCond: "6日間連続学習で追加宝箱！",
    rewardText: "報酬：⭐ +10 星 + 🎁 バッジ",
    rewardStreakText: "報酬：⭐ 追加 +10 星 + 👑 王冠",
    openChest: "🎁 宝箱を開ける",
    openKingChest: "👑 王者宝箱を開ける",
    needKeys: "あと {n} 本の鍵",
    needStreak: "あと {n} 日連続",
    chestFooter: "💡 毎日学習して、日曜日に2つの宝箱をゲットしよう！",
    parentGateTitle: "保護者専用ゲート",
    parentGateDesc: "計算問題に答えて保護者設定へ：",
    parentDashboardTitle: "👨‍👩‍👧 保護者管理ダッシュボード",
    parentDashboardDesc: "毎日の学習量・教材を設定：",
    parentPlanLabel: "🎯 毎日の学習時間",
    parentCurriculumLabel: "📚 教材コース",
    saveSettings: "設定を保存"
  },
  "ko": {
    morning: "좋은 아침",
    weekN: "{n} 주차",
    menu: "메뉴",
    beginnerChipOn: "초보자 발음 표기 · 켜짐",
    beginnerChipOff: "순수 한자 · 읽기",
    beginnerModeLabel: "초보자 발음 보조 모드 (전체 한자 표기)",
    beginnerModeActive: "화면의 모든 한자에 주음/병음 발음 표기",
    beginnerModeInactive: "순수 한자 읽기 도전 모드",
    eyeCareMode: "눈 보호 모드",
    eyeCareDark: "다크 모드",
    eyeCareLight: "라이트 모드",
    scriptModeLabel: "글자 및 발음 표기",
    scriptZhuyin: "번체자 (주음)",
    scriptPinyin: "간체자 (병음)",
    scriptDual: "번체+간체 듀얼",
    displayLangLabel: "표시 언어",
    phoneticLabel: "발음 표기 표시",
    phoneticShow: "표기 켜기",
    phoneticHide: "숨기기 (한자 도전)",
    switchUser: "👤 학습자 계정 전환",
    parentZone: "학부모 관리 설정",
    today: "오늘",
    lessonDay: "{day} 수업",
    lessonDuration: "⏱️ 하루 약 {min}분 ({count}개 핵심 한자)",
    readAloud: "본문 듣기",
    cardStrokeTitle: "한자 · 읽고 쓰기",
    cardVocabTitle: "어휘 · 문장 만들기",
    cardIdiomTitle: "고사성어 · 이야기",
    cardStrokeDualHint: "십자 격자 획순 · 5단계 한자 완성 루프",
    cardStrokeSingleHint: "격자 획순 쓰기 연습 · 탭하여 시작",
    cardVocabHint: "일상 필수 어휘 · 발음 듣기",
    cardIdiomHint: "고사성어 이야기와 실생활 활용",
    exitClass: "수업 종료",
    step1Title: "🌟 1단계: 글자 모양 익히기",
    step2Title: "✍️ 2단계: 획순 따라 쓰기",
    step3Title: "📝 3단계: 기억 쓰기 도전",
    step4Title: "🗣️ 4단계: 단어 및 발음 연습",
    step5Title: "🎯 5단계: 수업 확인 퀴즈",
    traceCountLabel: "남은 횟수",
    traceOnceBtn: "✍️ 완료",
    traceCountDone: "🎉 10회 완료!",
    dictationHint: "기억해서 써보세요! 막히면 💡 힌트.",
    dictationClear: "지우기",
    dictationToggleHint: "힌트",
    dictationSubmit: "제출",
    dictationPassed: "훌륭해요! 쓰기 성공!",
    standardSound: "발음",
    speakBtn: "음성 평가",
    sentencePlay: "문장 듣기",
    prevStep: "이전",
    nextStep: "다음",
    finishLessonBtn: "오늘의 학습 완료 🎉",
    rewardClaimReturn: "보상 받고 돌아가기",
    traceHint: "손가락으로 격자 안의 획을 따라 써보세요!",
    traceBothTip: "번체「{t}」{ts}획 · 간체「{s}」{ss}획",
    traceSameTip: "「{c}」은(는) 번체/간체 동일 ({n}획, 부수: {r})",
    speakInstruction: "큰 소리로 표준 성조를 따라 해보세요!",
    praiseGood: "참 잘했어요! 발음이 정확합니다!",
    chestTitle: "🎁 일요일 비밀 보물상자",
    chestSub: "매주 일요일 상자를 열어 보상을 받으세요!",
    normalChestTitle: "📦 상자 1: 주간 완주 상자",
    normalChestCond: "이번 주 6일 학습 시 오픈",
    streakChestTitle: "👑 상자 2: 연속 출석 왕 상자",
    streakChestCond: "6일 연속 학습 시 추가 오픈!",
    rewardText: "보상: ⭐ +10 별 + 🎁 배지",
    rewardStreakText: "보상: ⭐ 추가 +10 별 + 👑 왕관",
    openChest: "🎁 상자 열기",
    openKingChest: "👑 왕 보물상자 열기",
    needKeys: "열쇠 {n}개 남음",
    needStreak: "{n}일 연속 출석 남음",
    chestFooter: "💡 매일 성실히 학습하면 일요일에 상자 2개를 모두 열 수 있어요!",
    parentGateTitle: "학부모 인증 잠금",
    parentGateDesc: "산수 문제를 풀어 학부모 화면으로 이동하세요:",
    parentDashboardTitle: "👨‍👩‍👧 학부모 학습 관리 센터",
    parentDashboardDesc: "하루 학습량, 교재 및 사용 시간 설정:",
    parentPlanLabel: "🎯 일일 학습 목표",
    parentCurriculumLabel: "📚 공식 교재 과정",
    saveSettings: "설정 저장"
  },
  "es": {
    morning: "Buenos días",
    weekN: "Semana {n}",
    menu: "Menú",
    beginnerChipOn: "Modo Principiante · ON",
    beginnerChipOff: "Solo Caracteres · ON",
    beginnerModeLabel: "Modo Principiante (Anotación Fonética)",
    beginnerModeActive: "Muestra notación fonética en todos los caracteres",
    beginnerModeInactive: "Modo de lectura de solo caracteres",
    eyeCareMode: "Modo Cuidado Visual",
    eyeCareDark: "Modo Oscuro",
    eyeCareLight: "Modo Día",
    scriptModeLabel: "Modo de Aprendizaje",
    scriptZhuyin: "Tradicional (Zhuyin)",
    scriptPinyin: "Simplificado (Pinyin)",
    scriptDual: "Trad + Simp Dual",
    displayLangLabel: "Idioma de Interfaz",
    phoneticLabel: "Notación Fonética",
    phoneticShow: "Mostrar Fonética",
    phoneticHide: "Ocultar (Reto de Caracteres)",
    switchUser: "👤 Cambiar de Usuario",
    parentZone: "Panel de Padres",
    today: "Hoy",
    lessonDay: "Lección del {day}",
    lessonDuration: "⏱️ ~{min} min al día ({count} caracteres)",
    readAloud: "Leer Texto",
    cardStrokeTitle: "Caracteres · 5 Pasos",
    cardVocabTitle: "Vocabulario · Frases",
    cardIdiomTitle: "Modismos · Cuentos",
    cardStrokeDualHint: "Cuadrícula · Bucle de 5 pasos para dominar caracteres",
    cardStrokeSingleHint: "Trazado de caracteres · Tocar para practicar",
    cardVocabHint: "Vocabulario común esencial · Escuchar y pronunciar",
    cardIdiomHint: "Cuentos de modismos tradicionales en contexto",
    exitClass: "Salir",
    step1Title: "🌟 Paso 1: Ver y Reconocer",
    step2Title: "✍️ Paso 2: Orden de Trazos y Trazado",
    step3Title: "📝 Paso 3: Reto de Escritura de Memoria",
    step4Title: "🗣️ Paso 4: Significado y Pronunciación",
    step5Title: "🎯 Paso 5: Mini Cuestionario Final",
    traceCountLabel: "Restante",
    traceOnceBtn: "✍️ Listo",
    traceCountDone: "🎉 ¡10x Completado!",
    dictationHint: "¡Escribe de memoria! Toca 💡 Pista.",
    dictationClear: "Borrar",
    dictationToggleHint: "Pista",
    dictationSubmit: "Comprobar",
    dictationPassed: "¡Excelente! ¡Dictado aprobado!",
    standardSound: "Audio",
    speakBtn: "Voz",
    sentencePlay: "Reproducir Oración",
    prevStep: "Atrás",
    nextStep: "Siguiente",
    finishLessonBtn: "¡Completar Lección de Hoy! 🎉",
    rewardClaimReturn: "Reclamar Recompensas",
    traceHint: "¡Traza los caracteres con tu dedo en la cuadrícula!",
    traceBothTip: "Trad「{t}」{ts} trazos · Simp「{s}」{ss} trazos",
    traceSameTip: "「{c}」es idéntico en Trad/Simp, {n} trazos (Radical: {r})",
    speakInstruction: "¡Lee en voz alta con tono estándar!",
    praiseGood: "¡Excelente pronunciación!",
    chestTitle: "🎁 Cofre Misterioso del Domingo",
    chestSub: "¡Abre cofres cada domingo para obtener recompensas!",
    normalChestTitle: "📦 Cofre 1: Misión Semanal",
    normalChestCond: "Completa 6 días de estudio",
    streakChestTitle: "👑 Cofre 2: Corona de Racha",
    streakChestCond: "¡Racha de 6 días para abrir un cofre extra!",
    rewardText: "Recompensa: ⭐ +10 Estrellas + 🎁 Medalla",
    rewardStreakText: "Recompensa: ⭐ +10 Estrellas extra + 👑 Corona",
    openChest: "🎁 Abrir Cofre",
    openKingChest: "👑 Abrir Cofre Real",
    needKeys: "Faltan {n} llaves",
    needStreak: "Faltan {n} días de racha",
    chestFooter: "💡 ¡Aprende cada día y abre ambos cofres el domingo!",
    parentGateTitle: "Control Parental",
    parentGateDesc: "Resuelve el problema matemático para ingresar:",
    parentDashboardTitle: "👨‍👩‍👧 Panel de Gestión Parental",
    parentDashboardDesc: "Configurar carga diaria, libro de texto y tiempo:",
    parentPlanLabel: "🎯 Meta y Duración Diaria",
    parentCurriculumLabel: "📚 Libro de Texto Oficial",
    saveSettings: "Guardar Cambios"
  }
};

export interface DailyIdiomInfo {
  idiomTitle: string;
  idiomZhuyin?: string;
  idiomPinyin: string;
  idiomMeaning: string;
  idiomIcon: string;
  storyContext?: string;
}

export interface VocabularyItem {
  word: string;
  wordHans?: string;
  zhuyin: string;
  pinyin: string;
  meaning: string;
  icon: string;
  exampleSentence: string;
}

export interface QuizQuestion {
  id: string;
  type: "listen-char" | "char-tone" | "img-vocab";
  title: string;
  prompt: string;
  audioText?: string;
  options: {
    text: string;
    subText?: string;
    isCorrect: boolean;
  }[];
  explanation: string;
}

export interface DailyDayPlan {
  dayId: string;
  dayName: string;
  dayEnglish: string;
  isToday: boolean;
  status: "completed" | "current" | "locked";
  starsEarned: number;
  hasKey: boolean;
  themeTitle: string;
  themeSubtitle: string;
  estimatedMinutes: number;
  characters: HanziItem[];
  vocabulary: VocabularyItem[];
  lessonStory: string[];
  idiom: DailyIdiomInfo;
  quizQuestions: QuizQuestion[];
}

export interface HanziItem {
  char: string;
  charHans: string;
  zhuyin: string;
  zhuyinTone: string;
  pinyin: string;
  meaning: string;
  radical: string;
  strokeCount: number;
  strokeCountHans?: number;
  illustrationIcon: string;
  exampleWord: string;
  exampleWordHans?: string;
  exampleSentence: string;
  exampleSentenceHans?: string;
  strokeOrderSteps?: string[];
}

export function courseLevelToDayPlan(level: CourseLevel, progress?: LearnerLevelProgress): DailyDayPlan {
  const isDone = progress?.status === "completed";
  const isCurrent = progress?.status === "current";
  return {
    dayId: level.levelId,
    dayName: level.title,
    dayEnglish: `Level ${level.levelNumber}`,
    isToday: isCurrent,
    status: progress?.status || "locked",
    starsEarned: progress?.starsEarned || 0,
    hasKey: isDone,
    themeTitle: level.themeTitle,
    themeSubtitle: level.themeSubtitle,
    estimatedMinutes: level.estimatedMinutes,
    characters: level.characters,
    vocabulary: level.vocabulary,
    lessonStory: level.lessonStory || [
      `歡迎來到${level.title}！本關卡聚焦於「${level.characters.map((c) => c.char).join("、")}」等生字學習與情境應用。`
    ],
    idiom: level.idiom || {
      idiomTitle: "循序漸進",
      idiomZhuyin: "ㄒㄩㄣˊ ㄒㄩˋ ㄐㄧㄢˋ ㄐㄧㄣˋ",
      idiomPinyin: "xún xù jiàn jìn",
      idiomMeaning: "按一定的順序、步驟逐漸進步與提高。",
      idiomIcon: "📖",
      storyContext: "學習中文就像爬樓梯，一步一步穩紮穩打，就能登上最高峰！"
    },
    quizQuestions: (level.quizQuestions && level.quizQuestions.length > 0)
      ? level.quizQuestions.map((q) => ({
          id: q.id,
          type: (q.type === "cloze-sentence" || q.type === "stroke-count" ? "listen-char" : q.type) as "listen-char" | "char-tone" | "img-vocab",
          title: q.title,
          prompt: q.prompt,
          audioText: q.audioText,
          options: q.options,
          explanation: q.explanation
        }))
      : generateQuizPaper(level).map((q) => ({
          id: q.id,
          type: (q.type === "cloze-sentence" || q.type === "stroke-count" ? "listen-char" : q.type) as "listen-char" | "char-tone" | "img-vocab",
          title: q.title,
          prompt: q.prompt,
          audioText: q.audioText,
          options: q.options,
          explanation: q.explanation
        }))
  };
}

export const CURRENT_WEEK_SCHEDULE: DailyDayPlan[] = [
  {
    dayId: "day-1",
    dayName: "週一",
    dayEnglish: "Mon",
    isToday: false,
    status: "completed",
    starsEarned: 3,
    hasKey: true,
    themeTitle: "日月與星光",
    themeSubtitle: "學會「日、月、天、明、星、光」",
    estimatedMinutes: 30,
    characters: [
      { char: "日", charHans: "日", zhuyin: "ㄖ", zhuyinTone: "ˋ", pinyin: "rì", meaning: "太陽、白天", radical: "日", strokeCount: 4, illustrationIcon: "☀️", exampleWord: "太陽", exampleSentence: "紅紅的日頭升起來了。", strokeOrderSteps: ["丨 (豎)", "𠃍 (橫折)", "一 (橫)", "一 (橫)"] },
      { char: "月", charHans: "月", zhuyin: "ㄩㄝ", zhuyinTone: "ˋ", pinyin: "yuè", meaning: "月亮", radical: "月", strokeCount: 4, illustrationIcon: "🌙", exampleWord: "月光", exampleSentence: "彎彎的月亮像小船。", strokeOrderSteps: ["丿 (撇)", "𠃌 (橫折鉤)", "一 (橫)", "一 (橫)"] },
      { char: "天", charHans: "天", zhuyin: "ㄊㄧㄢ", zhuyinTone: "", pinyin: "tiān", meaning: "天空", radical: "大", strokeCount: 4, illustrationIcon: "🌤️", exampleWord: "藍天", exampleSentence: "藍藍的天空真廣闊。", strokeOrderSteps: ["一 (橫)", "一 (橫)", "丿 (撇)", "㇏ (捺)"] },
      { char: "明", charHans: "明", zhuyin: "ㄇㄧㄥ", zhuyinTone: "ˊ", pinyin: "míng", meaning: "明亮", radical: "日", strokeCount: 8, illustrationIcon: "💡", exampleWord: "明亮", exampleSentence: "夜晚的燈光很明亮。", strokeOrderSteps: ["日 (左)", "月 (右)"] },
      { char: "星", charHans: "星", zhuyin: "ㄒㄧㄥ", zhuyinTone: "", pinyin: "xīng", meaning: "星星", radical: "日", strokeCount: 9, illustrationIcon: "⭐", exampleWord: "星星", exampleSentence: "天上的星星眨眼睛。", strokeOrderSteps: ["日 (上)", "生 (下)"] },
      { char: "光", charHans: "光", zhuyin: "ㄍㄨㄤ", zhuyinTone: "", pinyin: "guāng", meaning: "光明", radical: "儿", strokeCount: 6, illustrationIcon: "✨", exampleWord: "陽光", exampleSentence: "溫暖的陽光灑滿大地。", strokeOrderSteps: ["丨 (豎)", "丶 (點)", "丿 (撇)", "一 (橫)", "丿 (撇)", "乚 (豎彎鉤)"] }
    ],
    vocabulary: [
      { word: "太陽", zhuyin: "ㄊㄞˋ ㄧㄤˊ", pinyin: "tài yáng", meaning: "天空中發光發熱的恆星", icon: "☀️", exampleSentence: "紅紅的太陽從東邊升起。" },
      { word: "月亮", zhuyin: "ㄩㄝˋ ㄌㄧㄤ˙", pinyin: "yuè liang", meaning: "夜空中美麗的衛星", icon: "🌙", exampleSentence: "彎彎的月亮像一隻小船。" },
      { word: "藍天", zhuyin: "ㄌㄢˊ ㄊㄧㄢ", pinyin: "lán tiān", meaning: "蔚藍晴朗的天空", icon: "🌤️", exampleSentence: "小鳥在藍天中快樂飛翔。" },
      { word: "明亮", zhuyin: "ㄇㄧㄥˊ ㄌㄧㄤˋ", pinyin: "míng liàng", meaning: "光線充足、光芒耀眼", icon: "💡", exampleSentence: "教室的窗戶非常明亮。" },
      { word: "星星", zhuyin: "ㄒㄧㄥ ㄒㄧㄥ", pinyin: "xīng xīng", meaning: "夜空閃爍的小星斗", icon: "⭐", exampleSentence: "夜晚的天空佈滿閃爍的星星。" },
      { word: "陽光", zhuyin: "ㄧㄤˊ ㄍㄨㄤ", pinyin: "yáng guāng", meaning: "日光、溫暖的光輝", icon: "✨", exampleSentence: "溫暖的陽光照在草地上。" }
    ],
    lessonStory: [
      "清晨，紅紅的日頭從東方升起，明亮的陽光灑滿大地。",
      "到了夜晚，彎彎的月亮升上天空，月光溫柔如水。",
      "天上的星星一閃一閃，天地之間充滿了美麗的光芒。"
    ],
    idiom: {
      idiomTitle: "如日中天",
      idiomZhuyin: "ㄖㄨˊ ㄖˋ ㄓㄨㄥ ㄊㄧㄢ",
      idiomPinyin: "rú rì zhōng tiān",
      idiomMeaning: "像正午的太陽一樣光芒萬丈，形容氣勢旺盛",
      idiomIcon: "☀️",
      storyContext: "古代用來形容事業發展到了最輝煌熱烈的頂峰時期。"
    },
    quizQuestions: [
      {
        id: "q-1-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "星",
        options: [
          { text: "日", subText: "rì", isCorrect: false },
          { text: "月", subText: "yuè", isCorrect: false },
          { text: "星", subText: "xīng", isCorrect: true },
          { text: "光", subText: "guāng", isCorrect: false }
        ],
        explanation: "發音「xīng / ㄒㄧㄥ」對應的生字是「星」！"
      },
      {
        id: "q-1-2",
        type: "char-tone",
        title: "字音辨析",
        prompt: "「明」字的正確讀音與聲調是？",
        options: [
          { text: "míng", subText: "ㄇㄧㄥˊ (第二聲)", isCorrect: true },
          { text: "mǐng", subText: "ㄇㄧㄥˇ (第三聲)", isCorrect: false },
          { text: "mìng", subText: "ㄇㄧㄥˋ (第四聲)", isCorrect: false }
        ],
        explanation: "「明」為第二聲陽平，讀作 míng / ㄇㄧㄥˊ。"
      },
      {
        id: "q-1-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「☀️」最適合配對哪一個生詞？",
        options: [
          { text: "月亮", subText: "yuè liang", isCorrect: false },
          { text: "太陽", subText: "tài yáng", isCorrect: true },
          { text: "藍天", subText: "lán tiān", isCorrect: false }
        ],
        explanation: "太陽 (☀️) 散發光與熱！"
      }
    ]
  },
  {
    dayId: "day-2",
    dayName: "週二",
    dayEnglish: "Tue",
    isToday: false,
    status: "completed",
    starsEarned: 3,
    hasKey: true,
    themeTitle: "高山與江河",
    themeSubtitle: "學會「山、水、川、河、湖、海」",
    estimatedMinutes: 30,
    characters: [
      { char: "山", charHans: "山", zhuyin: "ㄕㄢ", zhuyinTone: "", pinyin: "shān", meaning: "高山", radical: "山", strokeCount: 3, illustrationIcon: "⛰️", exampleWord: "高山", exampleSentence: "這座高山真雄偉。", strokeOrderSteps: ["丨 (中豎)", "𠄌 (豎折)", "丨 (右豎)"] },
      { char: "水", charHans: "水", zhuyin: "ㄕㄨㄟ", zhuyinTone: "ˇ", pinyin: "shuǐ", meaning: "清水", radical: "水", strokeCount: 4, illustrationIcon: "💧", exampleWord: "清水", exampleSentence: "小溪裡的水真清澈。", strokeOrderSteps: ["亅 (豎鉤)", "㇇ (橫撇)", "丿 (撇)", "㇏ (捺)"] },
      { char: "川", charHans: "川", zhuyin: "ㄔㄨㄢ", zhuyinTone: "", pinyin: "chuān", meaning: "山川、河流", radical: "川", strokeCount: 3, illustrationIcon: "🏞️", exampleWord: "山川", exampleSentence: "祖國的山川真秀美。", strokeOrderSteps: ["丿 (撇)", "丨 (豎)", "丨 (豎)"] },
      { char: "河", charHans: "河", zhuyin: "ㄏㄜ", zhuyinTone: "ˊ", pinyin: "hé", meaning: "河流", radical: "水", strokeCount: 8, illustrationIcon: "🌊", exampleWord: "大河", exampleSentence: "一條大河波浪寬。", strokeOrderSteps: ["氵 (三點水)", "可 (右)"] },
      { char: "湖", charHans: "湖", zhuyin: "ㄏㄨ", zhuyinTone: "ˊ", pinyin: "hú", meaning: "湖泊", radical: "水", strokeCount: 12, illustrationIcon: "🛶", exampleWord: "湖水", exampleSentence: "平靜的湖面像一面鏡子。", strokeOrderSteps: ["氵 (三點水)", "古 (中)", "月 (右)"] },
      { char: "海", charHans: "海", zhuyin: "ㄏㄞ", zhuyinTone: "ˇ", pinyin: "hǎi", meaning: "大海", radical: "水", strokeCount: 10, illustrationIcon: "🌊", exampleWord: "大海", exampleSentence: "大海一望無際。", strokeOrderSteps: ["氵 (三點水)", "每 (右)"] }
    ],
    vocabulary: [
      { word: "高山", zhuyin: "ㄍㄠ ㄕㄢ", pinyin: "gāo shān", meaning: "高聳的山嶺", icon: "⛰️", exampleSentence: "我們一起登上美麗的高山。" },
      { word: "清水", zhuyin: "ㄑㄧㄥ ㄕㄨㄟˇ", pinyin: "qīng shuǐ", meaning: "清澈純淨的水", icon: "💧", exampleSentence: "小魚在清澈的溪水裡游。" },
      { word: "山川", zhuyin: "ㄕㄢ ㄔㄨㄢ", pinyin: "shān chuān", meaning: "高山與河流大地", icon: "🏞️", exampleSentence: "大自然的山川非常壯觀。" },
      { word: "大河", zhuyin: "ㄉㄚˋ ㄏㄜˊ", pinyin: "dà hé", meaning: "寬闊流淌的河流", icon: "🌊", exampleSentence: "大河奔流向東流入大海。" },
      { word: "湖水", zhuyin: "ㄏㄨˊ ㄕㄨㄟˇ", pinyin: "hú shuǐ", meaning: "平靜清涼的湖水", icon: "🛶", exampleSentence: "微風吹拂，湖水泛起陣陣波紋。" },
      { word: "大海", zhuyin: "ㄉㄚˋ ㄏㄞˇ", pinyin: "dà hǎi", meaning: "廣闊無邊的大洋", icon: "🐋", exampleSentence: "海鷗在藍色的大海上盤旋。" }
    ],
    lessonStory: [
      "遠處有一座高高的山，山上有青翠茂密的樹林。",
      "近處有一條清清的小溪，溪水匯成大河，流向壯闊的大海。",
      "高山青，流水長，美麗的自然山川就像一幅畫。"
    ],
    idiom: {
      idiomTitle: "山清水秀",
      idiomZhuyin: "ㄕㄢ ㄑㄧㄥ ㄕㄨㄟˇ ㄒㄧㄡˋ",
      idiomPinyin: "shān qīng shuǐ xiù",
      idiomMeaning: "高山蒼翠，溪水清澈，風景優美宜人",
      idiomIcon: "⛰️",
      storyContext: "常用來讚美自然風光優美如詩如畫的地方。"
    },
    quizQuestions: [
      {
        id: "q-2-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "海",
        options: [
          { text: "河", subText: "hé", isCorrect: false },
          { text: "湖", subText: "hú", isCorrect: false },
          { text: "海", subText: "hǎi", isCorrect: true },
          { text: "川", subText: "chuān", isCorrect: false }
        ],
        explanation: "發音「hǎi / ㄏㄞˇ」對應的生字是「海」！"
      },
      {
        id: "q-2-2",
        type: "char-tone",
        title: "字音辨析",
        prompt: "「山」字的筆畫順序第一筆是？",
        options: [
          { text: "丨 (中間豎)", subText: "先中間", isCorrect: true },
          { text: "𠄌 (豎折)", subText: "先左邊", isCorrect: false },
          { text: "丨 (右邊豎)", subText: "先右邊", isCorrect: false }
        ],
        explanation: "「山」遵循先中間後兩邊的筆順規則，第一筆是中間豎！"
      },
      {
        id: "q-2-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「⛰️」最適合配對哪一個生詞？",
        options: [
          { text: "大海", subText: "dà hǎi", isCorrect: false },
          { text: "高山", subText: "gāo shān", isCorrect: true },
          { text: "清水", subText: "qīng shuǐ", isCorrect: false }
        ],
        explanation: "高山 (⛰️) 巍峨聳立！"
      }
    ]
  },
  {
    dayId: "day-3",
    dayName: "週三",
    dayEnglish: "Wed",
    isToday: true,
    status: "current",
    starsEarned: 0,
    hasKey: false,
    themeTitle: "森林樹木與篝火",
    themeSubtitle: "學會「木、林、森、火、炎、草」",
    estimatedMinutes: 32,
    characters: [
      { char: "木", charHans: "木", zhuyin: "ㄇㄨ", zhuyinTone: "ˋ", pinyin: "mù", meaning: "樹木", radical: "木", strokeCount: 4, illustrationIcon: "🌲", exampleWord: "樹木", exampleSentence: "山上有許多茂密的樹木。", strokeOrderSteps: ["一 (橫)", "丨 (豎)", "丿 (撇)", "㇏ (捺)"] },
      { char: "林", charHans: "林", zhuyin: "ㄌㄧㄣ", zhuyinTone: "ˊ", pinyin: "lín", meaning: "樹林", radical: "木", strokeCount: 8, illustrationIcon: "🌳", exampleWord: "樹林", exampleSentence: "兩棵樹並排成了樹林。", strokeOrderSteps: ["木 (左木旁捺變點)", "木 (右木)"] },
      { char: "森", charHans: "森", zhuyin: "ㄙㄣ", zhuyinTone: "", pinyin: "sēn", meaning: "森林", radical: "木", strokeCount: 12, illustrationIcon: "🌲", exampleWord: "森林", exampleSentence: "三棵樹成了大森林。", strokeOrderSteps: ["木 (上木)", "木 (左下)", "木 (右下)"] },
      { char: "火", charHans: "火", zhuyin: "ㄏㄨㄛ", zhuyinTone: "ˇ", pinyin: "huǒ", meaning: "火焰", radical: "火", strokeCount: 4, illustrationIcon: "🔥", exampleWord: "火光", exampleSentence: "冬天的篝火真溫暖。", strokeOrderSteps: ["丶 (點)", "丿 (短撇)", "丿 (長撇)", "㇏ (捺)"] },
      { char: "炎", charHans: "炎", zhuyin: "ㄧㄢ", zhuyinTone: "ˊ", pinyin: "yán", meaning: "炎熱、火光", radical: "火", strokeCount: 8, illustrationIcon: "☀️", exampleWord: "炎熱", exampleSentence: "夏天的天氣真炎熱。", strokeOrderSteps: ["火 (上火)", "火 (下火)"] },
      { char: "草", charHans: "草", zhuyin: "ㄘㄠ", zhuyinTone: "ˇ", pinyin: "cǎo", meaning: "青草", radical: "艸", strokeCount: 9, illustrationIcon: "🌱", exampleWord: "小草", exampleSentence: "森林邊長滿了青青的小草。", strokeOrderSteps: ["艹 (草字頭)", "日 (中間)", "十 (下方)"] }
    ],
    vocabulary: [
      { word: "樹木", zhuyin: "ㄕㄨˋ ㄇㄨˋ", pinyin: "shù mù", meaning: "自然生長的各種樹", icon: "🌲", exampleSentence: "山坡上種滿了青綠的樹木。" },
      { word: "樹林", zhuyin: "ㄕㄨˋ ㄌㄧㄣˊ", pinyin: "shù lín", meaning: "成片生長的林木", icon: "🌳", exampleSentence: "小鳥在樹林裡快樂地歌唱。" },
      { word: "森林", zhuyin: "ㄙㄣ ㄌㄧㄣˊ", pinyin: "sēn lín", meaning: "大片密集生長樹木的地方", icon: "🌲", exampleSentence: "大森林是許多可愛動物的家。" },
      { word: "火光", zhuyin: "ㄏㄨㄛˇ ㄍㄨㄤ", pinyin: "huǒ guāng", meaning: "火焰散發出的溫暖光芒", icon: "🔥", exampleSentence: "紅紅的火光照亮了露營地。" },
      { word: "炎熱", zhuyin: "ㄧㄢˊ ㄖㄜˋ", pinyin: "yán rè", meaning: "氣候溫度非常高", icon: "☀️", exampleSentence: "炎熱的夏天大家都喜歡吃西瓜。" },
      { word: "小草", zhuyin: "ㄒㄧㄠˇ ㄘㄠˇ", pinyin: "xiǎo cǎo", meaning: "綠色嫩綠的草本植物", icon: "🌱", exampleSentence: "春雨過後，小草從泥土裡探出頭。" }
    ],
    lessonStory: [
      "大山上有茂密的樹木，一棵是木，兩棵成林，三棵成了大森林。",
      "森林小路邊長滿了青青的小草，微風吹來草香陣陣。",
      "天黑了，大家在營地升起溫暖的篝火，紅紅的火光照亮了四周。"
    ],
    idiom: {
      idiomTitle: "獨木不成林",
      idiomZhuyin: "ㄉㄨˊ ㄇㄨˋ ㄅㄨˋ ㄔㄥˊ ㄌㄧㄣˊ",
      idiomPinyin: "dú mù bù chéng lín",
      idiomMeaning: "一棵樹成不了森林，比喻大家團結力量大",
      idiomIcon: "🌲",
      storyContext: "一棵樹不能成為森林，比喻個人的力量有限，大家團結協作才能辦成大事。"
    },
    quizQuestions: [
      {
        id: "q-3-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "森",
        options: [
          { text: "木", subText: "mù / ㄇㄨˋ", isCorrect: false },
          { text: "林", subText: "lín / ㄌㄧㄣˊ", isCorrect: false },
          { text: "森", subText: "sēn / ㄙㄣ", isCorrect: true },
          { text: "火", subText: "huǒ / ㄏㄨㄛˇ", isCorrect: false }
        ],
        explanation: "三個「木」組在一起就是森林的「森 (sēn / ㄙㄣ)」！"
      },
      {
        id: "q-3-2",
        type: "char-tone",
        title: "字音配對",
        prompt: "「炎」字的正確拼讀與聲調是？",
        options: [
          { text: "yán", subText: "ㄧㄢˊ (第二聲)", isCorrect: true },
          { text: "huǒ", subText: "ㄏㄨㄛˇ (第三聲)", isCorrect: false },
          { text: "mù", subText: "ㄇㄨˋ (第四聲)", isCorrect: false }
        ],
        explanation: "兩個「火」上下疊加為「炎」，讀作 yán / ㄧㄢˊ，代表火熱！"
      },
      {
        id: "q-3-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「🔥」最適合配對哪一個生詞？",
        options: [
          { text: "森林", subText: "sēn lín", isCorrect: false },
          { text: "火光", subText: "huǒ guāng", isCorrect: true },
          { text: "小草", subText: "xiǎo cǎo", isCorrect: false }
        ],
        explanation: "火光 (🔥) 散發光亮與熱度！"
      }
    ]
  },
  {
    dayId: "day-4",
    dayName: "週四",
    dayEnglish: "Thu",
    isToday: false,
    status: "locked",
    starsEarned: 0,
    hasKey: false,
    themeTitle: "泥土與田禾花苗",
    themeSubtitle: "學會「土、石、田、禾、苗、花」",
    estimatedMinutes: 30,
    characters: [
      { char: "土", charHans: "土", zhuyin: "ㄊㄨ", zhuyinTone: "ˇ", pinyin: "tǔ", meaning: "泥土", radical: "土", strokeCount: 3, illustrationIcon: "🌱", exampleWord: "泥土", exampleSentence: "小草在泥土裡長大。", strokeOrderSteps: ["一 (橫)", "丨 (豎)", "一 (長橫)"] },
      { char: "石", charHans: "石", zhuyin: "ㄕˊ", zhuyinTone: "ˊ", pinyin: "shí", meaning: "石頭", radical: "石", strokeCount: 5, illustrationIcon: "🪨", exampleWord: "石頭", exampleSentence: "溪邊有許多光滑的石頭。", strokeOrderSteps: ["一 (橫)", "丿 (撇)", "口 (下方)"] },
      { char: "田", charHans: "田", zhuyin: "ㄊㄧㄢ", zhuyinTone: "ˊ", pinyin: "tián", meaning: "田地", radical: "田", strokeCount: 5, illustrationIcon: "🌾", exampleWord: "水田", exampleSentence: "金黃的稻田真美麗。", strokeOrderSteps: ["丨 (豎)", "𠃍 (橫折)", "一 (中橫)", "丨 (中豎)", "一 (封口)"] },
      { char: "禾", charHans: "禾", zhuyin: "ㄏㄜ", zhuyinTone: "ˊ", pinyin: "hé", meaning: "禾苗", radical: "禾", strokeCount: 5, illustrationIcon: "🌾", exampleWord: "禾苗", exampleSentence: "禾苗在雨水滋潤下長大。", strokeOrderSteps: ["丿 (短撇)", "一 (橫)", "丨 (豎)", "丿 (撇)", "㇏ (捺)"] },
      { char: "苗", charHans: "苗", zhuyin: "ㄇㄧㄠ", zhuyinTone: "ˊ", pinyin: "miáo", meaning: "幼苗", radical: "艸", strokeCount: 8, illustrationIcon: "🌱", exampleWord: "樹苗", exampleSentence: "春天我們種下一棵小樹苗。", strokeOrderSteps: ["艹 (草字頭)", "田 (下方)"] },
      { char: "花", charHans: "花", zhuyin: "ㄏㄨㄚ", zhuyinTone: "", pinyin: "huā", meaning: "花朵", radical: "艸", strokeCount: 8, illustrationIcon: "🌸", exampleWord: "花朵", exampleSentence: "美麗的花兒在田間盛開。", strokeOrderSteps: ["艹 (草字頭)", "亻 (左旁)", "匕 (右旁)"] }
    ],
    vocabulary: [
      { word: "泥土", zhuyin: "ㄋㄧˊ ㄊㄨˇ", pinyin: "ní tǔ", meaning: "滋養植物的土壤", icon: "🌱", exampleSentence: "種子在肥沃的泥土裡生根。" },
      { word: "石頭", zhuyin: "ㄕˊ ˙ㄊㄡ", pinyin: "shí tou", meaning: "堅硬的岩石塊", icon: "🪨", exampleSentence: "小溪邊有圓滾滾的石頭。" },
      { word: "水田", zhuyin: "ㄕㄨㄟˇ ㄊㄧㄢˊ", pinyin: "shuǐ tián", meaning: "種植水稻的農田", icon: "🌾", exampleSentence: "農夫在水田裡忙著插秧。" },
      { word: "禾苗", zhuyin: "ㄏㄜˊ ㄇㄧㄠˊ", pinyin: "hé miáo", meaning: "稻穀農作物的幼苗", icon: "🌾", exampleSentence: "綠油油的禾苗隨風搖擺。" },
      { word: "樹苗", zhuyin: "ㄕㄨˋ ㄇㄧㄠˊ", pinyin: "shù miáo", meaning: "剛種植的小小樹木", icon: "🌱", exampleSentence: "我們一起給小樹苗澆水。" },
      { word: "花朵", zhuyin: "ㄏㄨㄚ ㄉㄨㄛˇ", pinyin: "huā duǒ", meaning: "色彩繽紛美麗的花", icon: "🌸", exampleSentence: "花園裡開滿了五彩繽紛的花朵。" }
    ],
    lessonStory: [
      "肥沃的泥土滋養著大地，清澈的小溪邊散落著圓圓的石頭。",
      "農夫在田地裡辛勤耕作，嫩綠的禾苗和樹苗茁壯生長。",
      "到了春天，紅紅黃黃的花兒迎著陽光微笑，大地一片芬芳。"
    ],
    idiom: {
      idiomTitle: "水落石出",
      idiomZhuyin: "ㄕㄨㄟˇ ㄌㄨㄛˋ ㄕˊ ㄔㄨ",
      idiomPinyin: "shuǐ luò shí chū",
      idiomMeaning: "水退下去石頭顯露，比喻事情真相大白",
      idiomIcon: "🪨",
      storyContext: "水退去之後，底下的石頭就看清了，形容真相完全顯現。"
    },
    quizQuestions: [
      {
        id: "q-4-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "花",
        options: [
          { text: "土", subText: "tǔ", isCorrect: false },
          { text: "苗", subText: "miáo", isCorrect: false },
          { text: "花", subText: "huā", isCorrect: true },
          { text: "禾", subText: "hé", isCorrect: false }
        ],
        explanation: "發音「huā / ㄏㄨㄚ」對應的生字是「花」！"
      },
      {
        id: "q-4-2",
        type: "char-tone",
        title: "字音辨析",
        prompt: "「石」字的部首是？",
        options: [
          { text: "石部", subText: "本字為部首", isCorrect: true },
          { text: "口部", subText: "下方的口", isCorrect: false },
          { text: "一部", subText: "上方的橫", isCorrect: false }
        ],
        explanation: "「石」是獨立部首（石部），共 5 畫！"
      },
      {
        id: "q-4-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「🌸」最適合配對哪一個生詞？",
        options: [
          { text: "石頭", subText: "shí tou", isCorrect: false },
          { text: "花朵", subText: "huā duǒ", isCorrect: true },
          { text: "泥土", subText: "ní tǔ", isCorrect: false }
        ],
        explanation: "花朵 (🌸) 芬芳美麗！"
      }
    ]
  },
  {
    dayId: "day-5",
    dayName: "週五",
    dayEnglish: "Fri",
    isToday: false,
    status: "locked",
    starsEarned: 0,
    hasKey: false,
    themeTitle: "大自然風雨雲雪",
    themeSubtitle: "學會「風、雨、雷、電、雲、雪」",
    estimatedMinutes: 35,
    characters: [
      { char: "風", charHans: "风", zhuyin: "ㄈㄥ", zhuyinTone: "", pinyin: "fēng", meaning: "微風", radical: "風", strokeCount: 9, strokeCountHans: 4, illustrationIcon: "💨", exampleWord: "微風", exampleSentence: "春風輕輕吹拂。" },
      { char: "雨", charHans: "雨", zhuyin: "ㄩˇ", zhuyinTone: "ˇ", pinyin: "yǔ", meaning: "雨水", radical: "雨", strokeCount: 8, illustrationIcon: "🌧️", exampleWord: "雨水", exampleSentence: "天上下起了綿綿細雨。" },
      { char: "雷", charHans: "雷", zhuyin: "ㄌㄟ", zhuyinTone: "ˊ", pinyin: "léi", meaning: "雷聲", radical: "雨", strokeCount: 13, illustrationIcon: "⚡", exampleWord: "打雷", exampleSentence: "天空中響起轟隆隆的雷聲。" },
      { char: "電", charHans: "电", zhuyin: "ㄉㄧㄢ", zhuyinTone: "ˋ", pinyin: "diàn", meaning: "閃電", radical: "雨", strokeCount: 13, strokeCountHans: 5, illustrationIcon: "⚡", exampleWord: "閃電", exampleSentence: "亮晶晶的閃電劃過天空。" },
      { char: "雲", charHans: "云", zhuyin: "ㄩㄣ", zhuyinTone: "ˊ", pinyin: "yún", meaning: "白雲", radical: "雨", strokeCount: 12, strokeCountHans: 4, illustrationIcon: "☁️", exampleWord: "白雲", exampleSentence: "藍天飄著朵朵白雲。" },
      { char: "雪", charHans: "雪", zhuyin: "ㄒㄩㄝ", zhuyinTone: "ˇ", pinyin: "xuě", meaning: "雪花", radical: "雨", strokeCount: 11, illustrationIcon: "❄️", exampleWord: "雪花", exampleSentence: "冬天飄下了潔白的雪花。" }
    ],
    vocabulary: [
      { word: "微風", zhuyin: "ㄨㄟ ㄈㄥ", pinyin: "wēi fēng", meaning: "溫和輕柔的風", icon: "💨", exampleSentence: "春天的微風吹拂著臉龐。" },
      { word: "雨水", zhuyin: "ㄩˇ ㄕㄨㄟˇ", pinyin: "yǔ shuǐ", meaning: "從天空落下的雨滴", icon: "🌧️", exampleSentence: "雨水滋潤了乾涸的泥土。" },
      { word: "打雷", zhuyin: "ㄉㄚˇ ㄌㄟˊ", pinyin: "dǎ léi", meaning: "天空中雷聲轟鳴", icon: "⚡", exampleSentence: "天空中打雷了，快要下大雨。" },
      { word: "閃電", zhuyin: "ㄕㄢˇ ㄉㄧㄢˋ", pinyin: "shǎn diàn", meaning: "空中耀眼的電光", icon: "⚡", exampleSentence: "一道金色的閃電劃過雲層。" },
      { word: "白雲", zhuyin: "ㄅㄞˊ ㄩㄣˊ", pinyin: "bái yún", meaning: "藍天中潔白的雲朵", icon: "☁️", exampleSentence: "天上的白雲像柔軟的棉花糖。" },
      { word: "雪花", zhuyin: "ㄒㄩㄝˇ ㄏㄨㄚ", pinyin: "xuě huā", meaning: "晶瑩潔白的六角雪結晶", icon: "❄️", exampleSentence: "冬天飄下了美麗的雪花。" }
    ],
    lessonStory: [
      "微風吹拂，天空中白雲飄飄，變化出各種奇妙的形狀。",
      "忽然響起了隆隆雷聲，閃電劃破天際，降下了滋潤萬物的雨水。",
      "到了寒冷的冬天，潔白的雪花紛紛揚揚，大地穿上了銀白外衣。"
    ],
    idiom: {
      idiomTitle: "風和日麗",
      idiomZhuyin: "ㄈㄥ ㄏㄜˊ ㄖˋ ㄌㄧˋ",
      idiomPinyin: "fēng hé rì lì",
      idiomMeaning: "微風和煦，陽光明媚，形容天氣非常好",
      idiomIcon: "🌈",
      storyContext: "形容微風柔和、陽光普照的好天氣。"
    },
    quizQuestions: [
      {
        id: "q-5-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "雪",
        options: [
          { text: "雷", subText: "léi", isCorrect: false },
          { text: "雲", subText: "yún", isCorrect: false },
          { text: "雪", subText: "xuě", isCorrect: true },
          { text: "雨", subText: "yǔ", isCorrect: false }
        ],
        explanation: "發音「xuě / ㄒㄩㄝˇ」對應的生字是「雪」！"
      },
      {
        id: "q-5-2",
        type: "char-tone",
        title: "繁簡辨析",
        prompt: "「風」字的簡體字寫作？",
        options: [
          { text: "风", subText: "4 畫", isCorrect: true },
          { text: "凡", subText: "3 畫", isCorrect: false },
          { text: "凤", subText: "4 畫 (鳳)", isCorrect: false }
        ],
        explanation: "繁體「風」(9畫) 對應簡體字為「风」(4畫)！"
      },
      {
        id: "q-5-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「❄️」最適合配對哪一個生詞？",
        options: [
          { text: "微風", subText: "wēi fēng", isCorrect: false },
          { text: "雪花", subText: "xuě huā", isCorrect: true },
          { text: "打雷", subText: "dǎ léi", isCorrect: false }
        ],
        explanation: "雪花 (❄️) 純白冰晶！"
      }
    ]
  },
  {
    dayId: "day-6",
    dayName: "週六",
    dayEnglish: "Sat",
    isToday: false,
    status: "locked",
    starsEarned: 0,
    hasKey: false,
    themeTitle: "飛鳥遊魚與動物",
    themeSubtitle: "學會「鳥、魚、馬、羊、牛、蟲」",
    estimatedMinutes: 32,
    characters: [
      { char: "鳥", charHans: "鸟", zhuyin: "ㄋㄧㄠ", zhuyinTone: "ˇ", pinyin: "niǎo", meaning: "飛鳥、小鳥", radical: "鳥", strokeCount: 11, strokeCountHans: 5, illustrationIcon: "🐦", exampleWord: "小鳥", exampleSentence: "樹上有隻可愛的小鳥在唱歌。" },
      { char: "魚", charHans: "鱼", zhuyin: "ㄩˊ", zhuyinTone: "ˊ", pinyin: "yú", meaning: "游魚、金魚", radical: "魚", strokeCount: 11, strokeCountHans: 8, illustrationIcon: "🐟", exampleWord: "小魚", exampleSentence: "清清的水裡有好多小魚。" },
      { char: "馬", charHans: "马", zhuyin: "ㄇㄚ", zhuyinTone: "ˇ", pinyin: "mǎ", meaning: "駿馬", radical: "馬", strokeCount: 10, strokeCountHans: 3, illustrationIcon: "🐎", exampleWord: "駿馬", exampleSentence: "駿馬在草原上快步奔馳。" },
      { char: "羊", charHans: "羊", zhuyin: "ㄧㄤ", zhuyinTone: "ˊ", pinyin: "yáng", meaning: "綿羊", radical: "羊", strokeCount: 6, illustrationIcon: "🐑", exampleWord: "小羊", exampleSentence: "山坡上有可愛的小白羊。" },
      { char: "牛", charHans: "牛", zhuyin: "ㄋㄧㄡ", zhuyinTone: "ˊ", pinyin: "niú", meaning: "黃牛", radical: "牛", strokeCount: 4, illustrationIcon: "🐂", exampleWord: "水牛", exampleSentence: "老黃牛在田地裡吃青草。" },
      { char: "蟲", charHans: "虫", zhuyin: "ㄔㄨㄥ", zhuyinTone: "ˊ", pinyin: "chóng", meaning: "昆蟲", radical: "虫", strokeCount: 18, strokeCountHans: 6, illustrationIcon: "🐛", exampleWord: "昆蟲", exampleSentence: "花叢中有好多小昆蟲。" }
    ],
    vocabulary: [
      { word: "小鳥", zhuyin: "ㄒㄧㄠˇ ㄋㄧㄠˇ", pinyin: "xiǎo niǎo", meaning: "在天空飛翔的鳥兒", icon: "🐦", exampleSentence: "小鳥在枝頭唱著動聽的歌。" },
      { word: "小魚", zhuyin: "ㄒㄧㄠˇ ㄩˊ", pinyin: "xiǎo yú", meaning: "在水中游動的魚兒", icon: "🐟", exampleSentence: "小魚在清澈的溪水裡擺動尾巴。" },
      { word: "駿馬", zhuyin: "ㄐㄩㄣˋ ㄇㄚˇ", pinyin: "jùn mǎ", meaning: "奔跑迅速強健的馬", icon: "🐎", exampleSentence: "駿馬在廣闊的草原上奔馳。" },
      { word: "小羊", zhuyin: "ㄒㄧㄠˇ ㄧㄤˊ", pinyin: "xiǎo yáng", meaning: "溫和可愛的小綿羊", icon: "🐑", exampleSentence: "白白的小羊在山坡上吃草。" },
      { word: "老牛", zhuyin: "ㄌㄠˇ ㄋㄧㄡˊ", pinyin: "lǎo niú", meaning: "勤勞耕田的牛隻", icon: "🐂", exampleSentence: "老牛辛勤地在農田裡耕地。" },
      { word: "昆蟲", zhuyin: "ㄎㄨㄣ ㄔㄨㄥˊ", pinyin: "kūn chóng", meaning: "六隻腳的節肢動物", icon: "🐛", exampleSentence: "花叢裡有好多可愛的小昆蟲。" }
    ],
    lessonStory: [
      "藍藍的天空中有小鳥在快活地飛翔，清澈的溪水中有小魚在歡快地遊動。",
      "草原上有奔馳的駿馬，山坡上有吃草的小羊和勤勞的老牛。",
      "花叢中還有忙碌的小蟲，大自然生機勃勃，動物朋友們真快樂！"
    ],
    idiom: {
      idiomTitle: "鳥語花香",
      idiomZhuyin: "ㄋㄧㄠˇ ㄩˇ ㄏㄨㄚ ㄒㄧㄤ",
      idiomPinyin: "niǎo yǔ huā xiāng",
      idiomMeaning: "鳥兒鳴唱，花兒飄香，形容春天美好的景色",
      idiomIcon: "🌸",
      storyContext: "形容大自然春天生機盎然、環境優美。"
    },
    quizQuestions: [
      {
        id: "q-6-1",
        type: "listen-char",
        title: "聽音選字",
        prompt: "請聽語音，選出正確的生字：",
        audioText: "鳥",
        options: [
          { text: "魚", subText: "yú", isCorrect: false },
          { text: "馬", subText: "mǎ", isCorrect: false },
          { text: "鳥", subText: "niǎo", isCorrect: true },
          { text: "牛", subText: "niú", isCorrect: false }
        ],
        explanation: "發音「niǎo / ㄋㄧㄠˇ」對應的生字是「鳥」！"
      },
      {
        id: "q-6-2",
        type: "char-tone",
        title: "繁簡辨析",
        prompt: "「馬」字的簡體字寫作？",
        options: [
          { text: "马", subText: "3 畫", isCorrect: true },
          { text: "妈", subText: "6 畫 (媽)", isCorrect: false },
          { text: "玛", subText: "7 畫 (瑪)", isCorrect: false }
        ],
        explanation: "繁體「馬」(10畫) 簡化為「马」(3畫)！"
      },
      {
        id: "q-6-3",
        type: "img-vocab",
        title: "看圖選詞",
        prompt: "圖案「🐎」最適合配對哪一個生詞？",
        options: [
          { text: "小鳥", subText: "xiǎo niǎo", isCorrect: false },
          { text: "駿馬", subText: "jùn mǎ", isCorrect: true },
          { text: "老牛", subText: "lǎo niú", isCorrect: false }
        ],
        explanation: "駿馬 (🐎) 奔馳萬里！"
      }
    ]
  },
  {
    dayId: "day-7",
    dayName: "週日",
    dayEnglish: "Sun",
    isToday: false,
    status: "locked",
    starsEarned: 0,
    hasKey: false,
    themeTitle: "🎁 週日神秘大寶箱",
    themeSubtitle: "本週 36 生字通關總結！",
    estimatedMinutes: 20,
    characters: [],
    vocabulary: [
      { word: "大獲全勝", zhuyin: "ㄉㄚˋ ㄏㄨㄛˋ ㄑㄩㄢˊ ㄕㄥˋ", pinyin: "dà huò quán shèng", meaning: "取得完全的勝利", icon: "🏆", exampleSentence: "我們完成了本週所有學習任務！" },
      { word: "日積月累", zhuyin: "ㄖˋ ㄐㄧ ㄩㄝˋ ㄌㄟˇ", pinyin: "rì jī yuè lěi", meaning: "每天累積不斷進步", icon: "📈", exampleSentence: "學習中文需要日積月累的堅持。" },
      { word: "熟能生巧", zhuyin: "ㄕㄡˊ ㄋㄥˊ ㄕㄥ ㄑㄧㄠˇ", pinyin: "shóu néng shēng qiǎo", meaning: "常常練習就會熟練", icon: "🎯", exampleSentence: "多寫幾遍漢字就能熟能生巧。" },
      { word: "滿載而歸", zhuyin: "ㄇㄢˇ ㄗㄞˋ ㄦˊ ㄍㄨㄟ", pinyin: "mǎn zài ér guī", meaning: "獲得滿滿的收穫", icon: "🎁", exampleSentence: "打開寶箱，大家滿載而歸！" }
    ],
    lessonStory: [
      "太棒了！恭喜完成本週 6 天共 36 個生字的學習任務！",
      "收集齊全 6 把通關鑰匙，快來打開週日神秘大寶箱！",
      "領取滿滿的星星與閃亮王者皇冠獎勵吧！"
    ],
    idiom: {
      idiomTitle: "大獲全勝",
      idiomZhuyin: "ㄉㄚˋ ㄏㄨㄛˋ ㄑㄩㄢˊ ㄕㄥˋ",
      idiomPinyin: "dà huò quán shèng",
      idiomMeaning: "完成一整週的學習，獲得豐富獎勵！",
      idiomIcon: "🎁",
      storyContext: "完成整週學習任務，獲得豐碩成果！"
    },
    quizQuestions: []
  }
];

export interface PinkyPromisePact {
  bonusCoins: number;
  requiredDays: number;
  currentDays: number;
  startDate: string;
  isCompleted: boolean;
  rewardClaimed: boolean;
}

export interface ChildLearner {
  id: string;
  name: string;
  avatar: string;
  role?: "learner" | "parent";
  scriptMode: ScriptMode;
  phoneticAssist: PhoneticAssist;
  handMode: HandMode;
  points: { coins: number; stars: number };
  levelsProgress: LearnerLevelProgress[];
  redemptions: RedemptionRecord[];
  totalMinutesLearned: number;
  streakDays: number;
  activePinkyPromise?: PinkyPromisePact | null;
}

const DEFAULT_LEARNERS: ChildLearner[] = [
  {
    id: "learner-1",
    name: "樂樂",
    avatar: "🐯",
    role: "learner",
    scriptMode: "dual",
    phoneticAssist: "zhuyin",
    handMode: "right",
    points: { coins: 180, stars: 16 },
    levelsProgress: getLearnerLevelsProgress(),
    redemptions: getRedemptionHistory(),
    totalMinutesLearned: 75,
    streakDays: 3,
    activePinkyPromise: null
  },
  {
    id: "learner-2",
    name: "萌萌",
    avatar: "🐰",
    role: "learner",
    scriptMode: "pinyin",
    phoneticAssist: "pinyin",
    handMode: "right",
    points: { coins: 120, stars: 9 },
    levelsProgress: getLearnerLevelsProgress(),
    redemptions: [],
    totalMinutesLearned: 45,
    streakDays: 2,
    activePinkyPromise: null
  }
];

export function KidsPrototypesPage() {
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

  const activeLearner = learners.find((l) => l.id === activeLearnerId) || learners[0] || DEFAULT_LEARNERS[0];

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

  const selectedLevel = ALL_COURSE_LEVELS.find((l) => l.levelNumber === selectedLevelNum) || ALL_COURSE_LEVELS[0];
  const selectedLevelProgress = learnerLevelsProgress.find((p) => p.levelNumber === selectedLevelNum) || {
    levelNumber: selectedLevelNum,
    status: selectedLevelNum === 1 ? ("current" as const) : ("locked" as const),
    completedAt: null,
    starsEarned: 0,
    score: null
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
    playSound(`歡迎來到童軒中文，${newLearner.name}！開始我們的華語探索之旅吧！`);
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

  const startLessonAtStep = (step: 1 | 2 | 3 | 4 | 5, mode: "char" | "vocab" | "idiom" = "char") => {
    setCustomPracticePlan(null); // 使用當日主線課程
    setClassroomInitialStep(step);
    setClassroomMode(mode);
    setInClassroom(true);
  };



  if (inClassroom) {
    return (
      <InteractiveClassroom
        dayPlan={customPracticePlan || selectedDay}
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
        {/* Left: Learner Profile */}
        <button
          className="header-learner-pill header-learner-large header-learner-interactive-btn"
          onClick={() => setLoginModalOpen(true)}
          title="點擊切換或管理學習者帳號"
          aria-label="切換學習者帳號"
        >
          <span className="brand-badge-mini brand-badge-large">{activeLearner.avatar}</span>
          <div className="learner-info">
            <span className="learner-name learner-name-large">☀️ {t("morning")} · {activeLearner.name}</span>
            <span className="learner-sub learner-sub-large">🎯 第 {selectedLevelNum} 關 · 挑戰中 🔄</span>
          </div>
        </button>

        {/* Right Actions: Pact Reminder, Points Balance, Achievements, Rewards & Settings Menu */}
        <div className="header-right-actions-group">
          {/* Active Pinky Promise Reminder Chip (if active) */}
          {activeLearner.activePinkyPromise && !activeLearner.activePinkyPromise.isCompleted && (
            <div className="header-pact-chip" title="打勾勾約定進行中">
              <span>🤙 打勾勾約定：{activeLearner.activePinkyPromise.currentDays}/{activeLearner.activePinkyPromise.requiredDays} 天</span>
            </div>
          )}

          {/* Points Balance Pill */}
          <button
            type="button"
            className="header-points-combined-pill"
            onClick={() => setRewardsShopModalOpen(true)}
            title="查看金幣與特權票券夾"
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
            title="開啟我的榮譽成就與量化學習數據"
          >
            <span className="btn-icon">🏆</span>
            <span>我的成就</span>
          </button>

          {/* Rewards Store Button */}
          <button
            type="button"
            className="feature-action-capsule-btn rewards-btn"
            onClick={() => setRewardsShopModalOpen(true)}
            title="開啟獎勵兌換舖與票券夾"
          >
            <span className="btn-icon">🎁</span>
            <span>獎勵兌換舖</span>
          </button>

          {/* Settings Menu Button */}
          <div className="header-menu-wrap" ref={menuRef}>
            <button
              className={`menu-trigger-btn ${menuOpen ? "active" : ""}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t("menu")}
              title="系統設定與家長後台"
            >
              <Settings size={22} />
              <span className="menu-btn-label">設定</span>
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

                  {/* Script Mode (繁體注音 / 簡體拼音 / 雙軌) */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🀄</span>
                      <div>
                        <strong>學習字體與拼讀</strong>
                        <small>
                          {scriptMode === "zhuyin"
                            ? "繁體注音 (ㄅㄆㄇ)"
                            : scriptMode === "pinyin"
                            ? "簡體拼音 (pīnyīn)"
                            : "繁+簡雙軌對照"}
                        </small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${scriptMode === "zhuyin" ? "active" : ""}`}
                        onClick={() => updateScriptMode("zhuyin")}
                        title="繁體注音"
                      >
                        繁體
                      </button>
                      <button
                        className={`seg-btn ${scriptMode === "pinyin" ? "active" : ""}`}
                        onClick={() => updateScriptMode("pinyin")}
                        title="簡體拼音"
                      >
                        簡體
                      </button>
                      <button
                        className={`seg-btn ${scriptMode === "dual" ? "active" : ""}`}
                        onClick={() => updateScriptMode("dual")}
                        title="繁簡雙軌"
                      >
                        繁+簡
                      </button>
                    </div>
                  </div>

                  {/* Phonetic Assist (顯示 / 隱藏標音) */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🔤</span>
                      <div>
                        <strong>閱讀標音輔助</strong>
                        <small>
                          {phoneticAssist === "zhuyin"
                            ? "臺灣注音標音"
                            : phoneticAssist === "pinyin"
                            ? "漢語拼音標音"
                            : "純漢字閱讀挑戰"}
                        </small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${phoneticAssist === "zhuyin" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("zhuyin")}
                        title="注音"
                      >
                        注音
                      </button>
                      <button
                        className={`seg-btn ${phoneticAssist === "pinyin" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("pinyin")}
                        title="拼音"
                      >
                        拼音
                      </button>
                      <button
                        className={`seg-btn ${phoneticAssist === "off" ? "active" : ""}`}
                        onClick={() => updatePhoneticAssist("off")}
                        title="純漢字"
                      >
                        隱藏
                      </button>
                    </div>
                  </div>

                  {/* Handedness Switcher */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">✍️</span>
                      <div>
                        <strong>習慣用手切換</strong>
                        <small>{handMode === "right" ? "右手模式（右側書寫）" : "左手模式（左側書寫）"}</small>
                      </div>
                    </div>
                    <div className="menu-segmented-pill">
                      <button
                        className={`seg-btn ${handMode === "right" ? "active" : ""}`}
                        onClick={() => updateHandMode("right")}
                        title="右手"
                      >
                        ✋ 右手
                      </button>
                      <button
                        className={`seg-btn ${handMode === "left" ? "active" : ""}`}
                        onClick={() => updateHandMode("left")}
                        title="左手"
                      >
                        🤚 左手
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
                        <strong>護眼深色模式</strong>
                        <small>{isDarkEyeCare ? "深色低藍光" : "白天明亮"}</small>
                      </div>
                    </div>
                    <button
                      className={`menu-switch-pill ${isDarkEyeCare ? "on" : "off"}`}
                      onClick={() => setIsDarkEyeCare((prev) => !prev)}
                    >
                      {isDarkEyeCare ? "🌙 開啟" : "☀️ 白天"}
                    </button>
                  </div>

                  {/* Language Select */}
                  <div className="menu-item-row">
                    <div className="menu-item-info">
                      <span className="menu-item-icon">🌐</span>
                      <div>
                        <strong>介面顯示語言</strong>
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
                        aria-label="選擇介面顯示語言"
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
                      <span>👤 切換 / 管理學習者帳號</span>
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
                      <span>進入家長管理後台</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. COMPACT SPRINT TRACK: 5日課程 + 1日測驗 + 1個寶箱 */}
      <section className="compact-sprint-panel">
        <div className="compact-sprint-header">
          <div className="sprint-stage-switch">
            <button
              type="button"
              className="sprint-stage-arrow-btn"
              disabled={(selectedLevel.stageNumber || 1) <= 1}
              onClick={() => {
                const prevStage = Math.max(1, (selectedLevel.stageNumber || 1) - 1);
                setSelectedLevelNum((prevStage - 1) * 5 + 1);
              }}
              title="上一階段"
            >
              ◀
            </button>
            <span className="sprint-stage-badge">
              🚩 第 {selectedLevel.stageNumber || 1} 階段
            </span>
            <button
              type="button"
              className="sprint-stage-arrow-btn"
              disabled={(selectedLevel.stageNumber || 1) >= 5}
              onClick={() => {
                const nextStage = Math.min(5, (selectedLevel.stageNumber || 1) + 1);
                const targetLvl = (nextStage - 1) * 5 + 1;
                const p = learnerLevelsProgress.find((x) => x.levelNumber === targetLvl);
                if (!p || p.status === "locked") {
                  playSound("下一階段尚未解鎖，請先通過本階段的綜合測驗喔！");
                  return;
                }
                setSelectedLevelNum(targetLvl);
              }}
              title="下一階段"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="compact-sprint-nodes-track">
          <div className="sprint-track-line" />

          {/* 5-Day Lessons */}
          {[1, 2, 3, 4, 5].map((dayIdx) => {
            const currentStage = selectedLevel.stageNumber || 1;
            const levelNum = (currentStage - 1) * 5 + Math.min(dayIdx, 4);
            const isDay5Review = dayIdx === 5;
            const lvlObj = ALL_COURSE_LEVELS.find((l) => l.levelNumber === levelNum) || ALL_COURSE_LEVELS[0];
            const progress = learnerLevelsProgress.find((p) => p.levelNumber === levelNum);
            const isDone = isDay5Review
              ? progress?.status === "completed" && (learnerLevelsProgress.find((p) => p.levelNumber === (currentStage - 1) * 5 + 4)?.status === "completed")
              : progress?.status === "completed";
            const isSelected = selectedLevelNum === levelNum && selectedLevel.type === "lesson";
            const isLocked = !progress || progress.status === "locked";

            return (
              <button
                key={`sprint-day-${dayIdx}`}
                type="button"
                className={`sprint-node-btn ${isDone ? "is-done" : ""} ${
                  isSelected ? "is-selected" : ""
                } ${isLocked ? "is-locked" : ""}`}
                onClick={() => {
                  if (isLocked) {
                    playSound("這個關卡還在鎖定中，請先完成前面的課程喔！");
                    return;
                  }
                  setSelectedLevelNum(levelNum);
                  playSound(`第 ${dayIdx} 日課程，${lvlObj.themeTitle}`);
                }}
              >
                <div className="sprint-node-bubble">
                  {isDone ? (
                    <Check size={20} strokeWidth={3.5} className="sprint-check-icon" />
                  ) : isLocked ? (
                    <Lock size={16} />
                  ) : (
                    <span className="sprint-node-num">{dayIdx}</span>
                  )}
                </div>
                <span className="sprint-node-label">第 {dayIdx} 日</span>
                <div className="sprint-mini-stars">
                  <Star
                    size={11}
                    className={isDone && (progress?.starsEarned || 0) >= 1 ? "star-earned" : "star-empty"}
                    fill={isDone && (progress?.starsEarned || 0) >= 1 ? "currentColor" : "none"}
                  />
                  <Star
                    size={11}
                    className={isDone && (progress?.starsEarned || 0) >= 2 ? "star-earned" : "star-empty"}
                    fill={isDone && (progress?.starsEarned || 0) >= 2 ? "currentColor" : "none"}
                  />
                  <Star
                    size={11}
                    className={isDone && (progress?.starsEarned || 0) >= 3 ? "star-earned" : "star-empty"}
                    fill={isDone && (progress?.starsEarned || 0) >= 3 ? "currentColor" : "none"}
                  />
                </div>
              </button>
            );
          })}

          {/* 1-Day Quiz */}
          {(() => {
            const currentStage = selectedLevel.stageNumber || 1;
            const quizLevelNum = currentStage * 5;
            const quizLvlObj = ALL_COURSE_LEVELS.find((l) => l.levelNumber === quizLevelNum) || ALL_COURSE_LEVELS[4];
            const quizProgress = learnerLevelsProgress.find((p) => p.levelNumber === quizLevelNum);
            const isQuizDone = quizProgress?.status === "completed";
            const isQuizSelected = selectedLevelNum === quizLevelNum;
            const isQuizLocked = !quizProgress || quizProgress.status === "locked";

            return (
              <button
                type="button"
                className={`sprint-node-btn sprint-quiz-node ${isQuizDone ? "is-done" : ""} ${
                  isQuizSelected ? "is-selected" : ""
                } ${isQuizLocked ? "is-locked" : ""}`}
                onClick={() => {
                  if (isQuizLocked) {
                    playSound("請先完成前 5 日的課程，才能參加綜合測驗喔！");
                    return;
                  }
                  setSelectedLevelNum(quizLevelNum);
                  launchStageQuiz(quizLvlObj);
                }}
              >
                <div className="sprint-node-bubble sprint-quiz-bubble">
                  {isQuizDone ? (
                    <span className="quiz-done-icon">🏆</span>
                  ) : (
                    <span className="quiz-pending-icon">📝</span>
                  )}
                </div>
                <span className="sprint-node-label sprint-quiz-label">
                  {currentStage === 5 ? "全冊總複習" : "綜合測驗"}
                </span>
                <span className="sprint-quiz-status-pill">
                  {isQuizDone ? "已及格" : "驗收"}
                </span>
              </button>
            );
          })()}

          {/* 1-Day Lucky Chest (Node 7) */}
          {(() => {
            const currentStage = selectedLevel.stageNumber || 1;
            const quizLevelNum = currentStage * 5;
            const quizProgress = learnerLevelsProgress.find((p) => p.levelNumber === quizLevelNum);
            const isChestUnlocked = quizProgress?.status === "completed";

            return (
              <button
                type="button"
                className={`sprint-node-btn sprint-chest-node ${isChestUnlocked ? "is-unlocked" : "is-locked"}`}
                onClick={() => {
                  if (!isChestUnlocked) {
                    playSound("通過第 6 日的綜合測驗後，就能開啟本週驚喜寶箱喔！");
                    return;
                  }
                  setChestModalOpen(true);
                }}
                title={isChestUnlocked ? "🎁 驚喜寶箱（可點擊領取）" : "🔒 驚喜寶箱（通過綜合測驗後解鎖）"}
              >
                <div className="sprint-node-bubble sprint-chest-bubble">
                  <span className="chest-node-emoji">{isChestUnlocked ? "🎁" : "🔒"}</span>
                </div>
              </button>
            );
          })()}
        </div>
      </section>

      {/* 3. CENTER MAIN HERO */}
      <main className="weekly-main-hero">
        {selectedLevel.type === "stage_quiz" || selectedLevel.type === "milestone_exam" ? (
          /* STAGE QUIZ / MILESTONE EXAM HERO HERO BANNER */
          <div className="daily-story-textbook-panel stage-quiz-hero-panel">
            <div className="story-meta-bar">
              <div className="story-badges-group">
                <span className="story-day-tag stage-quiz-tag">
                  {selectedLevel.type === "milestone_exam" ? "👑 全冊總結業驗收" : `📝 第 ${selectedLevel.stageNumber} 階段測驗券`}
                </span>
                <span className="story-duration-pill">
                  ⏱️ 約 {selectedLevel.estimatedMinutes} 分鐘
                </span>
              </div>
              <button
                className="story-listen-audio-btn"
                onClick={() =>
                  playSound(
                    `${selectedLevel.title}。${selectedLevel.themeSubtitle}`,
                    "normal",
                    true
                  )
                }
                title={t("readAloud")}
              >
                <Volume2 size={24} />
                <span>語音導讀</span>
              </button>
            </div>

            <div className="story-title-section">
              <h2 className="story-main-title">{R(selectedLevel.title)}</h2>
              <p className="stage-quiz-subtitle">{selectedLevel.themeSubtitle}</p>
            </div>

            <div className="stage-quiz-scope-box">
              <div className="quiz-scope-pill">
                <span className="scope-icon">🎯</span>
                <span className="scope-text">
                  涵蓋範圍：第 {selectedLevel.quizScope?.[0]} ~ {selectedLevel.quizScope?.[selectedLevel.quizScope.length - 1]} 關全部核心生字、詞彙、筆畫與部首
                </span>
              </div>
              <div className="quiz-highlights-grid">
                <div className="quiz-highlight-item">
                  <span className="highlight-icon">🔊</span>
                  <div>
                    <strong>聽音辨字</strong>
                    <p>辨識標準字音與聲調</p>
                  </div>
                </div>
                <div className="quiz-highlight-item">
                  <span className="highlight-icon">🔤</span>
                  <div>
                    <strong>注音/拼音辨析</strong>
                    <p>聲母韻母與聲調檢核</p>
                  </div>
                </div>
                <div className="quiz-highlight-item">
                  <span className="highlight-icon">🖼️</span>
                  <div>
                    <strong>圖文配對</strong>
                    <p>日常高頻生詞與字義</p>
                  </div>
                </div>
                <div className="quiz-highlight-item">
                  <span className="highlight-icon">📐</span>
                  <div>
                    <strong>筆畫部首</strong>
                    <p>結構筆順與部件規範</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="stage-quiz-cta-footer">
              {selectedLevelProgress.status === "completed" ? (
                <div className="quiz-completed-banner">
                  <span className="completed-badge">🎉 已於 {selectedLevelProgress.completedAt} 通關！得分：{selectedLevelProgress.score ?? 100} 分</span>
                  <button
                    type="button"
                    className="launch-quiz-cta-btn retry-btn"
                    onClick={() => launchStageQuiz(selectedLevel)}
                  >
                    🔄 再次測驗挑戰滿分
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="launch-quiz-cta-btn"
                  onClick={() => launchStageQuiz(selectedLevel)}
                >
                  {selectedLevel.type === "milestone_exam" ? "👑 開始 1~5 階段全冊總複習大考" : "📝 開始階段檢核測驗"}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* STANDARD LESSON HERO */
          <div className="daily-story-textbook-panel">
            <div className="story-meta-bar">
              <div className="story-badges-group">
                <span className="story-day-tag">🚩 第 {selectedLevel.stageNumber || 1} 階段 · {selectedLevel.title}</span>
                <span className="story-duration-pill">
                  ⏱️ 約 {selectedDay.estimatedMinutes} 分鐘
                </span>
              </div>
              <button
                className="story-listen-audio-btn"
                onClick={() =>
                  playSound(
                    `${selectedDay.themeTitle}。` + selectedDay.lessonStory.join(" "),
                    "normal",
                    true
                  )
                }
                title={t("readAloud")}
              >
                <Volume2 size={22} />
                <span>全篇朗讀</span>
              </button>
            </div>

            {/* 標記資產插畫槽位：後續使用 ComfyUI / SD 繪製的水彩情境背景圖替換 */}
            <div
              className="story-art-backdrop-container"
              data-asset-slot="lesson-story-illustration"
              title="[資產插畫槽位] 預留後續 ComfyUI / SD 繪製的專屬課文情境插畫背景"
            >
              <div className="story-title-section">
                <h2 className="story-main-title">{R(selectedDay.themeTitle)}</h2>
              </div>

              <div className="story-paragraphs-box">
                {selectedDay.lessonStory.map((para, idx) => (
                  <div key={idx} className="story-sentence-interactive-card">
                    <p className="story-paragraph-text">{R(para)}</p>
                    <div className="story-sentence-actions-bar">
                      <button
                        type="button"
                        className="sentence-action-btn play-btn"
                        onClick={() => handlePlaySingleLine(para)}
                        title="播放這句話的標準朗讀"
                      >
                        <Volume2 size={16} />
                        <span>播放單句</span>
                      </button>

                      <button
                        type="button"
                        className={`sentence-action-btn record-btn ${activeRecordingLineIdx === idx ? "is-recording" : ""}`}
                        onClick={() => handleToggleRecordLine(idx, para)}
                        title="開口跟讀這句話"
                      >
                        <Mic size={16} />
                        <span>{activeRecordingLineIdx === idx ? "⏹️ 完成跟讀" : "🎙️ 復誦跟讀"}</span>
                      </button>

                      {linePraiseMessages[idx] && (
                        <span className="sentence-praise-pill animate-fade">
                          {linePraiseMessages[idx]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3 Star Task Cards Grid (Show for lesson levels) */}
        {selectedLevel.type === "lesson" && (
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
        )}

        {/* Soft Community, Feedback & Sponsor Footer */}
        <footer className="portal-community-footer">
          <div className="portal-sponsor-pill">
            <div className="sponsor-text-group">
              <span className="sponsor-text">
                ☕ 童軒中文為免費開源專案 · 歡迎回饋使用體驗與建議！
              </span>
              <button
                type="button"
                className="portal-disclaimer-link-btn"
                onClick={() => {
                  setAboutInitialTab("disclaimer");
                  setAboutModalOpen(true);
                }}
              >
                ⚠️ 目前為公開測試版 (Beta) · 點此查看《免責聲明與隱私條款》
              </button>
            </div>
            <div className="sponsor-actions-row">
              <a
                href="mailto:webber0612@gmail.com?subject=【童軒中文】問題回報與改進建議&body=您好！我在使用童軒中文時有以下反饋：%0D%0A%0D%0A1. 使用設備（iPad/電腦/手機）：%0D%0A2. 遇到的問題或建議：%0D%0A"
                target="_blank"
                rel="noopener noreferrer"
                className="sponsor-feedback-btn"
                title="透過 Email 或表單回報問題與建議"
              >
                <span className="btn-feedback-emoji">💬</span>
                <span>問題與建議回報</span>
              </a>
              <a
                href="https://buymeacoffee.com/webber0612"
                target="_blank"
                rel="noopener noreferrer"
                className="sponsor-coffee-btn"
                title="前往 Buy Me a Coffee 支持作者"
              >
                <span className="btn-coffee-emoji">☕</span>
                <span>請作者喝咖啡</span>
              </a>
            </div>
          </div>
        </footer>
      </main>

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
        />
      )}

      {/* 7. About TongXuan & Attribution Modal */}
      {aboutModalOpen && (
        <AboutTongXuanModal
          initialTab={aboutInitialTab}
          onClose={() => {
            setAboutModalOpen(false);
            setAboutInitialTab("about");
          }}
        />
      )}
    </div>
  );
}

/* ========================================================
   FULLSCREEN INTERACTIVE CLASSROOM (分區練字教室)
   - ① 練字區 (標準標楷體字型 + 10次練習遞減 + 提交檢查 + 描線隨次數漸隱 + 筆畫展示播放 + 整合發音膠囊)
   - ② 資訊區 (解釋、部首、筆順、詞彙、造句)
   - 左右撇子功能切換 (右手模式 / 左手模式)
   ======================================================== */
export const getVariantLabels = (lang: DisplayLang) => {
  switch (lang) {
    case "en":
      return { trad: "Trad", simp: "Simp" };
    case "ja":
      return { trad: "繁体", simp: "簡体" };
    case "ko":
      return { trad: "번체", simp: "간체" };
    case "es":
      return { trad: "Trad", simp: "Simp" };
    case "zh-Hans":
      return { trad: "繁体", simp: "简体" };
    case "zh-Hant":
    default:
      return { trad: "繁體", simp: "簡體" };
  }
};

export function InteractiveClassroom({
  dayPlan,
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

  // Practice count tracking & persistence
  const [charPracticeCounts, setCharPracticeCounts] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("tongxuan_practice_counts") || "{}");
    } catch (e) {
      return {};
    }
  });

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

  const currentPracticeKey = currentChar
    ? (isDiff ? `${currentChar.char}_${activeVariant}` : currentChar.char)
    : "";

  // Remaining practice countdown (starts at 10 - completed count, clamped to [0, 10])
  const [remainingPractice, setRemainingPractice] = useState<number>(() => {
    const initKey = currentChar
      ? (isDiff ? `${currentChar.char}_${scriptMode === "pinyin" ? "hans" : "trad"}` : currentChar.char)
      : "";
    const done = charPracticeCounts[initKey] || 0;
    return Math.max(0, 10 - done);
  });
  
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
    if (onUpdateHandMode) onUpdateHandMode(next);
  };

  const hanziContainerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const childInkCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // 描線漸進式淡出階梯（前 4 遍逐步隱藏，第 5 遍起全默寫）：
  // 第 1 遍 (剩 10): 1.00 (清晰實心)
  // 第 2 遍 (剩 9):  0.75
  // 第 3 遍 (剩 8):  0.50
  // 第 4 遍 (剩 7):  0.25
  // 第 5~10 遍 (剩 6~0): 0.00 (完全消失，空白田字格純靠記憶默寫)
  const getOutlineOpacity = (count: number, forceHint: boolean) => {
    if (forceHint) return 1.0;
    const opacities: Record<number, number> = {
      10: 1.0,
      9: 0.75,
      8: 0.5,
      7: 0.25,
      6: 0.0,
      5: 0.0,
      4: 0.0,
      3: 0.0,
      2: 0.0,
      1: 0.0,
      0: 0.0,
    };
    return opacities[count] !== undefined ? opacities[count] : 0.0;
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

  const recordPracticeSuccess = () => {
    setCharPracticeCounts((prev) => {
      const nextCount = (prev[currentPracticeKey] || 0) + 1;
      const updated = { ...prev, [currentPracticeKey]: nextCount };
      try {
        localStorage.setItem("tongxuan_practice_counts", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
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
          recordPracticeSuccess();

          setRemainingPractice((prev) => {
            const nextCount = Math.max(0, prev - 1);
            if (nextCount === 0) {
              const otherVariant = activeVariant === "trad" ? "hans" : "trad";
              const otherKey = isDiff ? `${currentChar.char}_${otherVariant}` : currentChar.char;
              const otherCount = charPracticeCounts[otherKey] || 0;
              const otherDone = otherCount >= 10;

              if (isDiff && !otherDone) {
                const currLabel = activeVariant === "trad" ? variantLabels.trad : variantLabels.simp;
                const nextLabel = activeVariant === "trad" ? variantLabels.simp : variantLabels.trad;
                setDictationPraiseToast(`🎉 ${currLabel} 10 遍達成！請點擊 ${nextLabel} 繼續練習通關！`);
              } else {
                setDictationPraiseToast("🎉 10 遍練習全部達成！原創筆跡已打勾標記！");
              }
            } else {
              const praises = [
                "100% 孩子原創筆跡！寫得真工整！",
                "太厲害了！筆順精準！",
                "落點扎實！描線逐漸變淡囉！",
                "記憶力超強！純靠記憶默寫！"
              ];
              const chosen = praises[Math.floor(Math.random() * praises.length)];
              setDictationPraiseToast(`✨ ${chosen} 剩餘 ${nextCount} 遍`);
            }
            setTimeout(() => {
              setDictationPraiseToast(null);
              clearChildInkCanvas();
              if (writerRef.current) {
                writerRef.current.cancelQuiz();
                writerRef.current.hideCharacter();
                const nextOpacity = getOutlineOpacity(nextCount, showDictationHint);
                applyOutlineOpacity(writerRef.current, nextOpacity);
                startInteractiveQuiz(writerRef.current, nextOpacity);
              }
            }, 1600);
            return nextCount;
          });
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
    const newKey = `${currentChar.char}_${variant}`;
    const done = charPracticeCounts[newKey] || 0;
    const newRem = Math.max(0, 10 - done);
    setRemainingPractice(newRem);
    clearChildInkCanvas();
  };

  // Initialize authentic 標楷體 / 楷體 HanziWriter engine with real stroke order checking
  useEffect(() => {
    if (!hanziContainerRef.current) return;
    hanziContainerRef.current.innerHTML = "";
    clearChildInkCanvas();

    const outlineOpacity = getOutlineOpacity(remainingPractice, showDictationHint);
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
  }, [currentCharIdx, charToRender, activeVariant, showDictationHint]);

  const clearCanvas = () => {
    clearChildInkCanvas();
    if (writerRef.current) {
      writerRef.current.cancelQuiz();
      writerRef.current.hideCharacter();
      const outlineOpacity = getOutlineOpacity(remainingPractice, showDictationHint);
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
          const outlineOpacity = getOutlineOpacity(remainingPractice, showDictationHint);
          startInteractiveQuiz(writer, outlineOpacity);
        },
      });
    } catch (err) {
      setIsPlayingStrokes(false);
      const outlineOpacity = getOutlineOpacity(remainingPractice, showDictationHint);
      startInteractiveQuiz(writer, outlineOpacity);
    }
  };

  const handleNextChar = () => {
    // Check if current distinct character has completed both variants
    if (isDiff) {
      const isTradDone = (charPracticeCounts[`${currentChar.char}_trad`] || 0) >= 10;
      const isHansDone = (charPracticeCounts[`${currentChar.char}_hans`] || 0) >= 10;

      if (!isTradDone && activeVariant === "hans") {
        handleSelectVariant("trad");
        setDictationPraiseToast(`💡 請完成 ${variantLabels.trad} 10 遍練習以通關！`);
        setTimeout(() => setDictationPraiseToast(null), 1800);
        return;
      }
      if (!isHansDone && activeVariant === "trad") {
        handleSelectVariant("hans");
        setDictationPraiseToast(`💡 請完成 ${variantLabels.simp} 10 遍練習以通關！`);
        setTimeout(() => setDictationPraiseToast(null), 1800);
        return;
      }
    }

    if (currentCharIdx < totalChars - 1) {
      const nextIdx = currentCharIdx + 1;
      const nextChar = characters[nextIdx];
      const nextIsDiff = nextChar.char !== nextChar.charHans;
      const nextTradDone = (charPracticeCounts[`${nextChar.char}_trad`] || 0) >= 10;
      const nextHansDone = (charPracticeCounts[`${nextChar.char}_hans`] || 0) >= 10;

      let nextVariant: "trad" | "hans" = scriptMode === "pinyin" ? "hans" : "trad";
      if (nextIsDiff) {
        if (nextTradDone && !nextHansDone) nextVariant = "hans";
        else if (nextHansDone && !nextTradDone) nextVariant = "trad";
      }

      const nextKey = nextIsDiff ? `${nextChar.char}_${nextVariant}` : nextChar.char;
      const done = charPracticeCounts[nextKey] || 0;

      setCurrentCharIdx(nextIdx);
      setActiveVariant(nextVariant);
      setRemainingPractice(Math.max(0, 10 - done));
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
      const prevTradDone = (charPracticeCounts[`${prevChar.char}_trad`] || 0) >= 10;
      const prevHansDone = (charPracticeCounts[`${prevChar.char}_hans`] || 0) >= 10;

      let prevVariant: "trad" | "hans" = scriptMode === "pinyin" ? "hans" : "trad";
      if (prevIsDiff) {
        if (prevTradDone && !prevHansDone) prevVariant = "hans";
        else if (prevHansDone && !prevTradDone) prevVariant = "trad";
      }

      const prevKey = prevIsDiff ? `${prevChar.char}_${prevVariant}` : prevChar.char;
      const done = charPracticeCounts[prevKey] || 0;

      setCurrentCharIdx(prevIdx);
      setActiveVariant(prevVariant);
      setRemainingPractice(Math.max(0, 10 - done));
      setShowDictationHint(false);
      clearCanvas();
    }
  };

  // Shadow opacity calculation: gradually fades as remainingPractice decreases from 10 to 0
  const shadowOpacity = showDictationHint
    ? 0.38
    : Math.max(0, (remainingPractice - 1) / 9 * 0.36);

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
  const tradCount = isDiff
    ? (charPracticeCounts[`${currentChar.char}_trad`] || 0)
    : (charPracticeCounts[currentChar.char] || 0);
  const hansCount = isDiff
    ? (charPracticeCounts[`${currentChar.char}_hans`] || 0)
    : (charPracticeCounts[currentChar.char] || 0);
  const tradDone = tradCount >= 10;
  const hansDone = hansCount >= 10;

  const WritingPanel = (
    <div className="writing-split-panel animate-fade">
      {/* 1. TOP BAR: CLEAR TOOL (LEFT) + PROGRESS INDICATOR (RIGHT) */}
      <div className="writing-topbar-row">
        {/* Left Tool: 🧹 Clear Canvas */}
        <div className="writing-tools-left">
          <button
            type="button"
            className="tool-circle-btn"
            onClick={clearCanvas}
            title="清除畫布重寫"
          >
            <RotateCcw size={20} />
          </button>
        </div>

        {/* Right: Practice Progress Indicator Pill */}
        <div className="writing-topbar-right">
          <div className={`practice-status-pill ${remainingPractice === 0 ? "is-finished" : ""}`}>
            <span className="practice-pill-icon">🎯</span>
            <span className="practice-pill-text">
              {remainingPractice === 0 ? "練習完成 🎉" : "練習目標"}
            </span>
            {remainingPractice > 0 ? (
              <span className="practice-count-badge" title="剩餘練習遍數">
                剩 {remainingPractice} 遍
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
              ? (charPracticeCounts[`${c.char}_trad`] || 0) >= 10 && (charPracticeCounts[`${c.char}_hans`] || 0) >= 10
              : (charPracticeCounts[c.char] || 0) >= 10;
            const isSelected = i === currentCharIdx;

            return (
              <button
                key={c.char}
                className={`pill-dot ${isSelected ? "active" : ""} ${isCompleted ? "is-char-completed" : ""}`}
                onClick={() => {
                  const nextVariant = scriptMode === "pinyin" ? "hans" : "trad";
                  const nextKey = cIsDiff ? `${c.char}_${nextVariant}` : c.char;
                  const done = charPracticeCounts[nextKey] || 0;

                  setCurrentCharIdx(i);
                  setActiveVariant(nextVariant);
                  setRemainingPractice(Math.max(0, 10 - done));
                  clearCanvas();
                }}
                title={`${c.char}${cIsDiff ? ` / ${c.charHans}` : ""} ${isCompleted ? "（已完成 10 遍練習 ✓）" : ""}`}
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

/* ========================================================
   週日寶箱與鑰匙說明彈窗
   ======================================================== */
function SundayChestsModal({
  keysEarned,
  streakDays,
  beginnerMode,
  R,
  t,
  onClose,
  onTestOpenChest
}: {
  keysEarned: number;
  streakDays: number;
  beginnerMode: boolean;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
  onClose: () => void;
  onTestOpenChest: (type: "normal" | "streak") => void;
}) {
  const normalChestUnlocked = keysEarned >= 6;
  const streakChestUnlocked = streakDays >= 6;

  return (
    <div className="modal-backdrop">
      <div className="sunday-chests-modal-card">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-chests-header">
          <Gift size={48} className="chest-gift-icon" />
          <h2>{R(t("chestTitle"))}</h2>
          <p className="modal-chests-sub">{R(t("chestSub"))}</p>
        </div>

        <div className="chests-duo-container">
          <div className={`chest-card ${normalChestUnlocked ? "unlocked" : "locked"}`}>
            <div className="chest-icon-wrapper">
              <Package size={52} className="chest-big-svg" />
              {normalChestUnlocked && <Sparkles size={24} className="sparkle-gold" />}
            </div>

            <div className="chest-card-info">
              <h3>{R(t("normalChestTitle"))}</h3>
              <p className="chest-condition">
                {R(t("normalChestCond"))}
              </p>

              <div className="chest-progress-bar-wrap">
                <div className="keys-progress-fill" style={{ width: `${(keysEarned / 6) * 100}%` }} />
                <span className="keys-progress-label">
                  <Key size={14} /> 🗝️ {keysEarned} / 6
                </span>
              </div>

              <div className="chest-reward-tag">
                <span>{R(t("rewardText"))}</span>
              </div>
            </div>

            <button
              className="open-chest-action-btn"
              disabled={!normalChestUnlocked}
              onClick={() => onTestOpenChest("normal")}
            >
              {normalChestUnlocked ? R(t("openChest")) : R(t("needKeys", { n: 6 - keysEarned }))}
            </button>
          </div>

          <div className={`chest-card ${streakChestUnlocked ? "unlocked golden" : "locked streak-locked"}`}>
            <div className="chest-crown-badge">
              <Crown size={16} /> <b>{R("連續全勤加贈")}</b>
            </div>

            <div className="chest-icon-wrapper streak-chest-wrap">
              <Crown size={52} className="crown-big-svg" />
              {streakChestUnlocked && <Sparkles size={24} className="sparkle-gold" />}
            </div>

            <div className="chest-card-info">
              <h3>{R(t("streakChestTitle"))}</h3>
              <p className="chest-condition">
                {R(t("streakChestCond"))}
              </p>

              <div className="chest-progress-bar-wrap streak-bar">
                <div className="keys-progress-fill streak-fill" style={{ width: `${(Math.min(streakDays, 6) / 6) * 100}%` }} />
                <span className="keys-progress-label">
                  <Flame size={14} /> {R("連續")} <b>{streakDays}</b> / 6 {R("天")}
                </span>
              </div>

              <div className="chest-reward-tag gold-tag">
                <span>{R(t("rewardStreakText"))}</span>
              </div>
            </div>

            <button
              className="open-chest-action-btn gold-btn"
              disabled={!streakChestUnlocked}
              onClick={() => onTestOpenChest("streak")}
            >
              {streakChestUnlocked ? R(t("openKingChest")) : R(t("needStreak", { n: 6 - Math.min(streakDays, 6) }))}
            </button>
          </div>
        </div>

        <p className="chests-footer-hint">
          {R(t("chestFooter"))}
        </p>
      </div>
    </div>
  );
}

/* ========================================================
   家長鎖驗證與管理後台
   ======================================================== */
/* ========================================================
   家長鎖驗證與管理後台 (Parent Gate & Management Center)
   ======================================================== */
function ParentLockModal({
  displayLang,
  setDisplayLang,
  phoneticAssist,
  updatePhoneticAssist,
  activeLearner,
  onGiftPoints,
  R,
  t,
  onClose,
  onUnlock
}: {
  displayLang: DisplayLang;
  setDisplayLang: (lang: DisplayLang) => void;
  phoneticAssist: PhoneticAssist;
  updatePhoneticAssist: (val: PhoneticAssist) => void;
  activeLearner?: ChildLearner;
  onGiftPoints?: (coins: number, stars: number, note: string) => void;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [authMode, setAuthMode] = useState<"pin" | "math">("pin");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Math challenge fallback
  const mathCorrect = 9;

  // Parent Dashboard tabs: learning settings, gift points, monitor, rewards & ledger, security PIN
  const [activeTab, setActiveTab] = useState<"learning" | "gift" | "monitor" | "rewards" | "security">("learning");
  const [curriculumBook, setCurriculumBook] = useState("僑委會《學華語向前走》第一冊");
  const [dailyPlanMode, setDailyPlanMode] = useState<"standard" | "boost" | "light">("standard");

  // Parent Gift Points Form state
  const [giftCoins, setGiftCoins] = useState(50);
  const [giftStars, setGiftStars] = useState(3);
  const [giftNote, setGiftNote] = useState("今天主動認真完成練字與朗讀，非常棒！");

  // Rewards Ledger & Catalog states
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>(() => getRedemptionHistory());
  const [catalog, setCatalog] = useState<RewardItem[]>(() => getRewardsCatalog());
  const [rewardsSubTab, setRewardsSubTab] = useState<"ledger" | "catalog">("catalog");
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RewardItem | null>(null);
  
  // Reward Form states
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("🎁");
  const [formDesc, setFormDesc] = useState("");
  const [formCoins, setFormCoins] = useState(100);
  const [formStars, setFormStars] = useState(5);
  const [formCategory, setFormCategory] = useState<RewardCategory>("privilege");
  const [formRequiresApproval, setFormRequiresApproval] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security PIN settings state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinToast, setPinToast] = useState<string | null>(null);

  const handlePinDigit = (num: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + num;
      setPinInput(next);
      setPinError(null);
      if (next.length === 4) {
        if (verifyParentPin(next)) {
          setUnlocked(true);
          onUnlock();
        } else {
          setPinError("PIN 碼錯誤，請重新輸入（預設為 8888）");
          setTimeout(() => {
            setPinInput("");
          }, 600);
        }
      }
    }
  };

  const handlePinBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handlePinClear = () => {
    setPinInput("");
    setPinError(null);
  };

  // Toggle item in catalog
  const handleToggleReward = (id: string) => {
    const updated = catalog.map((item) => {
      if (item.id === id) {
        return { ...item, enabled: item.enabled === false ? true : false };
      }
      return item;
    });
    setCatalog(updated);
    saveRewardsCatalog(updated);
  };

  // Approve & claim child ticket
  const handleClaimTicket = (recordId: string) => {
    const updated = approveOrClaimTicket(recordId, "claimed");
    setRedemptions(updated);
    setToastMessage("✓ 已成功核銷此特權票券！孩子已可享用該項特權。");
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open modal for Adding a new reward (or grand prize like XBOX / Bicycle)
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormIcon("🎁");
    setFormDesc("");
    setFormCoins(100);
    setFormStars(5);
    setFormCategory("privilege");
    setFormRequiresApproval(true);
    setShowRewardModal(true);
  };

  // Open modal for Editing an existing reward
  const handleOpenEditModal = (item: RewardItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormIcon(item.icon);
    setFormDesc(item.description);
    setFormCoins(item.costCoins);
    setFormStars(item.costStars);
    setFormCategory(item.category);
    setFormRequiresApproval(item.requiresParentApproval);
    setShowRewardModal(true);
  };

  // Save reward (Add or Update)
  const handleSaveReward = () => {
    if (!formName.trim()) {
      alert("請輸入獎勵品名稱！");
      return;
    }
    const coinVal = Math.max(1, Number(formCoins) || 10);
    const starVal = Math.max(0, Number(formStars) || 0);

    if (editingItem) {
      // Update existing item
      const updated: RewardItem = {
        ...editingItem,
        name: formName.trim(),
        icon: formIcon.trim() || "🎁",
        description: formDesc.trim() || "家長自訂獎勵項目",
        category: formCategory,
        costCoins: coinVal,
        costStars: starVal,
        requiresParentApproval: formRequiresApproval
      };
      const newCatalog = updateRewardItem(updated);
      setCatalog(newCatalog);
      setShowRewardModal(false);
      setToastMessage(`✓ 已成功更新獎勵：「${updated.name}」！`);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      // Add new custom item
      const newItem: RewardItem = {
        id: `custom-reward-${Date.now()}`,
        name: formName.trim(),
        icon: formIcon.trim() || "🎁",
        description: formDesc.trim() || "家長為孩子量身約定之獎勵",
        category: formCategory,
        costCoins: coinVal,
        costStars: starVal,
        stock: 999,
        requiresParentApproval: formRequiresApproval,
        isExpertRecommended: false,
        enabled: true
      };
      const newCatalog = addRewardItem(newItem);
      setCatalog(newCatalog);
      setShowRewardModal(false);
      setToastMessage(`✓ 已成功新增獎勵：「${newItem.name}」！`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Delete reward
  const handleDeleteReward = (item: RewardItem) => {
    const confirmDel = window.confirm(
      `確定要徹底拿掉「${item.name}」嗎？\n刪除後該項目將不再出現在孩子的商城中。`
    );
    if (confirmDel) {
      const newCatalog = deleteRewardItem(item.id);
      setCatalog(newCatalog);
      setToastMessage(`🗑️ 已成功刪除「${item.name}」！`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Reset to default templates
  const handleResetDefaults = () => {
    const confirmReset = window.confirm(
      "確定要將獎勵庫恢復為教育專家預設範本嗎？\n所有自訂項目與修改將被重設為預設清單。"
    );
    if (confirmReset) {
      const defaultCatalog = resetRewardsCatalogToDefault();
      setCatalog(defaultCatalog);
      setToastMessage("🔄 已成功恢復為教育專家預設獎勵範本！");
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Change PIN
  const handleChangePin = () => {
    if (!verifyParentPin(currentPin)) {
      setPinToast("❌ 原 PIN 碼不正確！");
      setTimeout(() => setPinToast(null), 3000);
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinToast("❌ 新 PIN 碼必須為 4 位數字！");
      setTimeout(() => setPinToast(null), 3000);
      return;
    }
    if (newPin !== confirmPin) {
      setPinToast("❌ 兩次輸入的新 PIN 碼不一致！");
      setTimeout(() => setPinToast(null), 3000);
      return;
    }
    const success = setParentPin(newPin);
    if (success) {
      setPinToast("🎉 家長安全 PIN 碼已成功更新！");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setPinToast(null), 3500);
    }
  };

  const pendingCount = redemptions.filter((r) => r.status === "pending").length;

  if (unlocked) {
    const completedLevelsCount = activeLearner?.levelsProgress?.filter((p) => p.status === "completed").length || 0;
    const currentLevelNum = activeLearner?.levelsProgress?.find((p) => p.status === "current")?.levelNumber || 1;

    return (
      <div className="modal-backdrop">
        <div className="parent-gate-card parent-dashboard-card wide animate-fade">
          <button className="modal-close-x" onClick={onClose} aria-label="關閉後台">
            <X size={20} />
          </button>

          <div className="parent-dashboard-header">
            <div className="parent-dash-badge">👨‍👩‍👧</div>
            <div>
              <h2>童軒中文 · 家長管理與學習監督後台</h2>
              <p className="gate-desc">
                在此設定每日學習步調、贈送點數獎勵、監督孩子學習進度，並管理特權獎勵品庫。
              </p>
            </div>
          </div>

          {/* Top Tabs */}
          <div className="parent-tabs-bar">
            <button
              className={`parent-tab-item ${activeTab === "learning" ? "active" : ""}`}
              onClick={() => setActiveTab("learning")}
            >
              🎒 學習步調
            </button>
            <button
              className={`parent-tab-item ${activeTab === "gift" ? "active" : ""}`}
              onClick={() => setActiveTab("gift")}
            >
              🎁 贈送點數
            </button>
            <button
              className={`parent-tab-item ${activeTab === "monitor" ? "active" : ""}`}
              onClick={() => setActiveTab("monitor")}
            >
              📊 進度監督
            </button>
            <button
              className={`parent-tab-item ${activeTab === "rewards" ? "active" : ""}`}
              onClick={() => setActiveTab("rewards")}
            >
              🛍️ 獎勵庫管理
              {pendingCount > 0 && <span className="parent-tab-badge">{pendingCount} 待審批</span>}
            </button>
            <button
              className={`parent-tab-item ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              🔒 安全 PIN 碼
            </button>
          </div>

          {toastMessage && (
            <div className="parent-toast-alert animate-fade">
              {toastMessage}
            </div>
          )}

          {/* TAB 1: 學習與標音設定 */}
          {activeTab === "learning" && (
            <div className="parent-tab-content-panel animate-fade">
              <div className="parent-setting-group">
                <label className="parent-setting-label">🎒 輔助標音配置 (注音 / 拼音 / 隱藏)</label>
                <div className="parent-dual-controls-row">
                  <button
                    type="button"
                    className={`parent-phonetic-btn ${phoneticAssist === "zhuyin" ? "active" : ""}`}
                    onClick={() => updatePhoneticAssist("zhuyin")}
                  >
                    🇹🇼 臺灣注音 (ㄅㄆㄇ)
                  </button>
                  <button
                    type="button"
                    className={`parent-phonetic-btn ${phoneticAssist === "pinyin" ? "active" : ""}`}
                    onClick={() => updatePhoneticAssist("pinyin")}
                  >
                    🔤 漢語拼音 (pīnyīn)
                  </button>
                  <button
                    type="button"
                    className={`parent-phonetic-btn ${phoneticAssist === "off" ? "active" : ""}`}
                    onClick={() => updatePhoneticAssist("off")}
                  >
                    📖 隱藏 (純漢字)
                  </button>
                </div>
              </div>

              <div className="parent-setting-group">
                <label className="parent-setting-label">🌐 介面多國顯示語言</label>
                <div className="lang-select-grid">
                  {(
                    [
                      ["zh-Hant", "繁體中文"],
                      ["zh-Hans", "简体中文"],
                      ["en", "English"],
                      ["ja", "日本語"],
                      ["ko", "한국어"],
                      ["es", "Español"]
                    ] as const
                  ).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      className={`lang-select-pill ${displayLang === code ? "active" : ""}`}
                      onClick={() => setDisplayLang(code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="parent-setting-group">
                <label className="parent-setting-label">🎯 每日學習目標與建議時長</label>
                <div className="parent-plan-options">
                  <button
                    type="button"
                    className={`plan-option-btn ${dailyPlanMode === "standard" ? "active" : ""}`}
                    onClick={() => setDailyPlanMode("standard")}
                  >
                    <span className="plan-badge">標準進度</span>
                    <strong>每日 1 關</strong>
                    <small>⏱️ 約 25~30 分鐘（6 生字主線）</small>
                  </button>
                  <button
                    type="button"
                    className={`plan-option-btn ${dailyPlanMode === "boost" ? "active" : ""}`}
                    onClick={() => setDailyPlanMode("boost")}
                  >
                    <span className="plan-badge boost">強化進階</span>
                    <strong>每日 2 關</strong>
                    <small>⏱️ 約 45~50 分鐘（生字+複習）</small>
                  </button>
                  <button
                    type="button"
                    className={`plan-option-btn ${dailyPlanMode === "light" ? "active" : ""}`}
                    onClick={() => setDailyPlanMode("light")}
                  >
                    <span className="plan-badge light">輕鬆啟蒙</span>
                    <strong>每日微習慣</strong>
                    <small>⏱️ 約 15 分鐘（單純練字）</small>
                  </button>
                </div>
              </div>

              <button
                className="save-parent-settings-btn"
                onClick={() => {
                  alert("學習設定已成功儲存！");
                  onClose();
                }}
              >
                {t("saveSettings")}
              </button>
            </div>
          )}

          {/* TAB 2: 贈送點數給孩子 */}
          {activeTab === "gift" && (
            <div className="parent-tab-content-panel animate-fade">
              <div className="parent-gift-points-panel">
                <div className="gift-panel-header">
                  <span className="gift-big-icon">🎁</span>
                  <div>
                    <h3>贈送獎勵點數給「{activeLearner?.name || "孩子"}」</h3>
                    <p>當孩子在日常生活中表現優異（如主動做家事、準時練字、自律堅持），家長可隨時贈送金幣與星星！</p>
                  </div>
                </div>

                <div className="gift-inputs-grid">
                  <div className="gift-input-card">
                    <label>贈送金幣數量 🪙：</label>
                    <div className="quick-gift-pills">
                      {[20, 50, 100, 200, 500].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`gift-pill ${giftCoins === num ? "active" : ""}`}
                          onClick={() => setGiftCoins(num)}
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      className="gift-custom-num"
                      value={giftCoins}
                      onChange={(e) => setGiftCoins(Math.max(0, Number(e.target.value)))}
                      min="0"
                      max="99999"
                    />
                  </div>

                  <div className="gift-input-card">
                    <label>贈送學習星星 ⭐：</label>
                    <div className="quick-gift-pills">
                      {[1, 2, 3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className={`gift-pill ${giftStars === num ? "active" : ""}`}
                          onClick={() => setGiftStars(num)}
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      className="gift-custom-num"
                      value={giftStars}
                      onChange={(e) => setGiftStars(Math.max(0, Number(e.target.value)))}
                      min="0"
                      max="999"
                    />
                  </div>
                </div>

                <div className="gift-note-section">
                  <label>鼓勵評語 / 讚賞事蹟：</label>
                  <div className="quick-praise-chips">
                    {["🌟 主動自律練字", "💯 默寫全對太棒了", "🧹 幫忙做家事很乖", "📖 課文朗讀超標準", "💪 連續打卡不間斷"].map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="praise-chip-btn"
                        onClick={() => setGiftNote(note)}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="gift-note-input"
                    value={giftNote}
                    onChange={(e) => setGiftNote(e.target.value)}
                    placeholder="輸入給孩子的鼓勵話語..."
                  />
                </div>

                <button
                  type="button"
                  className="confirm-gift-btn"
                  onClick={() => {
                    if (onGiftPoints) {
                      onGiftPoints(giftCoins, giftStars, giftNote);
                    }
                  }}
                >
                  🎉 立即贈送 🪙 {giftCoins} 金幣 + ⭐ {giftStars} 星星 給 {activeLearner?.name}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: 學習進度監督 */}
          {activeTab === "monitor" && (
            <div className="parent-tab-content-panel animate-fade">
              <div className="parent-monitor-panel">
                <div className="monitor-learner-header">
                  <span className="monitor-avatar">{activeLearner?.avatar || "🐯"}</span>
                  <div className="monitor-learner-info">
                    <h3>{activeLearner?.name || "學習者"} · 學習大數據看板</h3>
                    <p>🎯 目前正在挑戰：<b>第 {currentLevelNum} 關</b> · 已順利通關：<b>{completedLevelsCount} / 25 關</b></p>
                  </div>
                </div>

                <div className="monitor-kpi-grid">
                  <div className="monitor-kpi-card">
                    <span className="kpi-icon">⏱️</span>
                    <strong className="kpi-value">{activeLearner?.totalMinutesLearned || 0}</strong>
                    <span className="kpi-label">累計學習分鐘數</span>
                  </div>
                  <div className="monitor-kpi-card">
                    <span className="kpi-icon">🀄</span>
                    <strong className="kpi-value">{completedLevelsCount * 6}</strong>
                    <span className="kpi-label">精熟掌握漢字</span>
                  </div>
                  <div className="monitor-kpi-card">
                    <span className="kpi-icon">🔥</span>
                    <strong className="kpi-value">{activeLearner?.streakDays || 0}</strong>
                    <span className="kpi-label">連續學習天數</span>
                  </div>
                  <div className="monitor-kpi-card">
                    <span className="kpi-icon">🪙</span>
                    <strong className="kpi-value">{activeLearner?.points?.coins || 0}</strong>
                    <span className="kpi-label">可用特權金幣</span>
                  </div>
                </div>

                {/* Pinky Promise Monitor */}
                <div className="monitor-pact-box">
                  <h4>🤙 當前學習打勾勾約定</h4>
                  {activeLearner?.activePinkyPromise ? (
                    <div className="pact-active-card">
                      <p>
                        <b>約定目標：</b>連續 3 天每日通關 1 關，通關後領取 <b>🪙 {activeLearner.activePinkyPromise.bonusCoins}</b> 金幣翻倍大紅包！
                      </p>
                      <div className="pact-progress-bar-wrap">
                        <span>進度：{activeLearner.activePinkyPromise.currentDays} / {activeLearner.activePinkyPromise.requiredDays} 天</span>
                        <div className="pact-progress-track">
                          <div
                            className="pact-progress-fill"
                            style={{ width: `${(activeLearner.activePinkyPromise.currentDays / activeLearner.activePinkyPromise.requiredDays) * 100}%` }}
                          />
                        </div>
                      </div>
                      {activeLearner.activePinkyPromise.isCompleted && (
                        <span className="pact-done-tag">🎉 3天約定已圓滿達成！獎勵已自動發放！</span>
                      )}
                    </div>
                  ) : (
                    <p className="pact-empty-desc">孩子通過每 5 關的階段測驗後，可開啟幸運寶箱並自願立下「3 天打勾勾約定」喔！</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 獎勵品管理與特權核銷帳本 */}
          {activeTab === "rewards" && (
            <div className="parent-tab-content-panel animate-fade">
              <div className="parent-sub-tabs-row">
                <button
                  className={`parent-sub-tab-btn ${rewardsSubTab === "ledger" ? "active" : ""}`}
                  onClick={() => setRewardsSubTab("ledger")}
                >
                  🎟️ 孩子特權核銷審批 ({redemptions.length})
                </button>
                <button
                  className={`parent-sub-tab-btn ${rewardsSubTab === "catalog" ? "active" : ""}`}
                  onClick={() => setRewardsSubTab("catalog")}
                >
                  🛍️ 獎勵品庫與自訂心願 ({catalog.length})
                </button>
              </div>

              {rewardsSubTab === "ledger" ? (
                <div className="parent-ledger-section">
                  <p className="parent-section-lead">
                    📋 孩子在商城兌換特權後會生成特權票券，家長可在此審批並點擊「核銷」記錄已履約完成：
                  </p>

                  {redemptions.length === 0 ? (
                    <div className="empty-ledger-box">
                      <span>🎟️</span>
                      <p>目前尚無特權兌換記錄。孩子完成學習累積積分後即可在商城兌換！</p>
                    </div>
                  ) : (
                    <div className="parent-tickets-list">
                      {redemptions.map((rec) => (
                        <div key={rec.id} className={`parent-ticket-row ${rec.status}`}>
                          <div className="ticket-icon-col">
                            <span className="big-ticket-emoji">{rec.itemIcon}</span>
                          </div>
                          <div className="ticket-main-col">
                            <div className="ticket-name-row">
                              <strong>{rec.itemName}</strong>
                              <span className="ticket-code-badge">{rec.ticketCode}</span>
                            </div>
                            <div className="ticket-meta-info">
                              <span>⏱️ 兌換時間：{rec.redeemedAt}</span>
                              <span className="ticket-cost-info">🪙 {rec.costCoins} 金幣 / ⭐ {rec.costStars || 0} 星星</span>
                            </div>
                          </div>
                          <div className="ticket-action-col">
                            {rec.status === "pending" ? (
                              <button
                                className="approve-claim-ticket-btn"
                                onClick={() => handleClaimTicket(rec.id)}
                              >
                                ✓ 核准並核銷此券
                              </button>
                            ) : (
                              <span className="claimed-status-pill">✓ 已核銷履約</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="parent-catalog-section">
                  <div className="catalog-header-action-row">
                    <div>
                      <p className="parent-section-lead" style={{ margin: 0 }}>
                        🎓 獎勵品庫與自訂管理：家長可自由修改金額、拿掉禁止項目、或自訂 3 萬分換 XBOX 等實體大獎：
                      </p>
                    </div>
                    <div className="catalog-top-actions">
                      <button
                        type="button"
                        className="reset-defaults-btn"
                        onClick={handleResetDefaults}
                        title="恢復為專家推薦之 10 項預設範本"
                      >
                        🔄 恢復預設範本
                      </button>
                      <button
                        type="button"
                        className="add-custom-wish-btn"
                        onClick={handleOpenAddModal}
                      >
                        ➕ 新增獎勵 / 實體大獎
                      </button>
                    </div>
                  </div>

                  <div className="parent-catalog-list">
                    {catalog.map((item) => (
                      <div key={item.id} className={`parent-catalog-item-row ${item.enabled !== false ? "enabled" : "disabled"}`}>
                        <span className="cat-item-icon">{item.icon}</span>
                        <div className="cat-item-info">
                          <div className="cat-title-row">
                            <strong>{item.name}</strong>
                            <span className={`category-tag-chip ${item.category}`}>
                              {item.category === "physical"
                                ? "🎁 實體大獎"
                                : item.category === "food"
                                ? "🍜 美食"
                                : item.category === "time"
                                ? "📺 時光"
                                : item.category === "adventure"
                                ? "⛺ 探險"
                                : item.category === "privilege"
                                ? "🍽️ 特權"
                                : "🌟 心願"}
                            </span>
                            {item.isExpertRecommended && (
                              <span className="expert-tag">🎓 專家範本</span>
                            )}
                          </div>
                          <p className="cat-item-desc">{item.description}</p>
                          <div className="cat-cost-chips">
                            <span className="cost-pill coin">🪙 {item.costCoins.toLocaleString()} 金幣</span>
                            <span className="cost-pill star">⭐ {item.costStars} 星星</span>
                            {item.requiresParentApproval && (
                              <span className="cost-pill approval">🔒 需家長審批</span>
                            )}
                          </div>
                        </div>
                        <div className="cat-item-actions-group">
                          <button
                            type="button"
                            className="item-edit-btn"
                            onClick={() => handleOpenEditModal(item)}
                            title="編輯此獎勵名稱、點數或內容"
                          >
                            ✏️ 編輯
                          </button>
                          <button
                            type="button"
                            className="item-delete-btn"
                            onClick={() => handleDeleteReward(item)}
                            title="徹底從商城拿掉此項目"
                          >
                            🗑️ 刪除
                          </button>
                          <button
                            type="button"
                            className={`toggle-enable-btn ${item.enabled !== false ? "is-on" : "is-off"}`}
                            onClick={() => handleToggleReward(item.id)}
                            title={item.enabled !== false ? "點擊停用此獎勵" : "點擊啟用此獎勵"}
                          >
                            {item.enabled !== false ? "已啟用" : "已停用"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add / Edit Reward Dialog */}
              {showRewardModal && (
                <div className="sub-modal-backdrop animate-fade">
                  <div className="add-reward-subcard">
                    <button className="modal-close-x" onClick={() => setShowRewardModal(false)}>
                      <X size={18} />
                    </button>
                    <h3>{editingItem ? "✏️ 編輯獎勵項目" : "➕ 新增獎勵或實體大獎"}</h3>
                    <p className="subcard-lead">
                      {editingItem
                        ? "修改此獎勵項目的名稱、所需積分、說明或審批規則"
                        : "自訂家庭專屬特權或大目標（如吃披薩、買漫畫、3萬積分換 XBOX 等）"}
                    </p>

                    <div className="form-group-row">
                      <label>獎勵名稱：</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="例：🎮 XBOX Series X 主機 × 1 或 🍽️ 晚餐指定券"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>

                    <div className="form-group-cols">
                      <div className="form-col">
                        <label>圖標 Emoji：</label>
                        <input
                          type="text"
                          className="form-input icon-input"
                          value={formIcon}
                          onChange={(e) => setFormIcon(e.target.value)}
                        />
                      </div>
                      <div className="form-col">
                        <label>獎勵類別：</label>
                        <select
                          className="form-input select-input"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as RewardCategory)}
                        >
                          <option value="privilege">🍽️ 生活特權 (晚餐做主/免家事)</option>
                          <option value="food">🍜 美食點心 (泡麵/甜點/大餐)</option>
                          <option value="time">📺 自由時光 (電視/平板/電玩)</option>
                          <option value="adventure">⛺ 戶外探險 (露營/公園/旅行)</option>
                          <option value="physical">🎁 實體大獎 (XBOX/腳踏車/玩具)</option>
                          <option value="wish">🌟 專屬心願 (家庭特別約定)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group-row">
                      <label>特權 / 大獎詳細說明：</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="例：累積 30,000 金幣達成年度大目標！由爸媽購買 XBOX 主機一台！"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                      />
                    </div>

                    <div className="form-group-cols">
                      <div className="form-col">
                        <label>所需金幣 🪙 (可設任意點數如 30000)：</label>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          max="999999"
                          value={formCoins}
                          onChange={(e) => setFormCoins(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-col">
                        <label>所需星星 ⭐：</label>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          max="9999"
                          value={formStars}
                          onChange={(e) => setFormStars(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="form-group-row checkbox-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formRequiresApproval}
                          onChange={(e) => setFormRequiresApproval(e.target.checked)}
                        />
                        <span>🔒 需向家長出示並由家長後台審批核銷</span>
                      </label>
                    </div>

                    <div className="form-actions-row">
                      <button className="cancel-sub-btn" onClick={() => setShowRewardModal(false)}>
                        取消
                      </button>
                      <button className="confirm-add-reward-btn" onClick={handleSaveReward}>
                        ✓ {editingItem ? "儲存修改" : "確定新增"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 安全 PIN 碼設定 */}
          {activeTab === "security" && (
            <div className="parent-tab-content-panel animate-fade">
              <div className="security-pin-panel">
                <div className="pin-shield-header">
                  <Key size={32} />
                  <h3>家長安全密碼 (PIN 碼) 管理</h3>
                </div>
                <p className="pin-panel-desc">
                  為防止孩子誤觸家長設定或自行核銷獎勵，請妥善設定 4 位數字 PIN 碼（預設為 8888）。
                </p>

                {pinToast && (
                  <div className="pin-toast-msg animate-fade">
                    {pinToast}
                  </div>
                )}

                <div className="pin-form-box">
                  <div className="pin-field-group">
                    <label>原 4 位 PIN 碼：</label>
                    <input
                      type="password"
                      maxLength={4}
                      className="pin-text-input"
                      placeholder="請輸入目前密碼"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <div className="pin-field-group">
                    <label>設定新 4 位 PIN 碼：</label>
                    <input
                      type="password"
                      maxLength={4}
                      className="pin-text-input"
                      placeholder="4 位純數字"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <div className="pin-field-group">
                    <label>再次確認新 PIN 碼：</label>
                    <input
                      type="password"
                      maxLength={4}
                      className="pin-text-input"
                      placeholder="再次輸入新密碼"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <button className="update-pin-btn" onClick={handleChangePin}>
                    🔒 儲存並更新安全密碼
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LOCKED STATE: PIN Pad or Math Fallback
  return (
    <div className="modal-backdrop">
      <div className="parent-gate-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        <div className="gate-icon-shield">
          <ShieldAlert size={36} />
        </div>

        <h2>{authMode === "pin" ? "👨‍👩‍👧 請輸入家長 PIN 碼" : t("parentGateTitle")}</h2>
        <p className="gate-desc">
          {authMode === "pin"
            ? "進入家長管理後台或審批獎勵（預設 PIN 碼為 8888）"
            : t("parentGateDesc")}
        </p>

        {authMode === "pin" ? (
          <div className="parent-pin-pad-container">
            {/* PIN Dots Indicator */}
            <div className="pin-dots-row">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`pin-dot ${pinInput.length > idx ? "filled" : ""}`}
                />
              ))}
            </div>

            {pinError && <div className="pin-error-alert animate-fade">{pinError}</div>}

            {/* Numeric Keypad */}
            <div className="pin-keypad-grid">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="pin-key-btn"
                  onClick={() => handlePinDigit(digit)}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                className="pin-key-btn action-key"
                onClick={handlePinClear}
              >
                C
              </button>
              <button
                type="button"
                className="pin-key-btn"
                onClick={() => handlePinDigit("0")}
              >
                0
              </button>
              <button
                type="button"
                className="pin-key-btn action-key"
                onClick={handlePinBackspace}
                aria-label="退格"
              >
                ⌫
              </button>
            </div>

            <div className="pin-switch-mode-row">
              <button
                type="button"
                className="switch-to-math-btn"
                onClick={() => setAuthMode("math")}
              >
                忘記密碼？使用家長算術驗證
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="math-question-box">
              <span className="math-text">4 + 5 = ?</span>
            </div>

            <div className="gate-options-row">
              {[7, 8, 9, 10].map((ans) => (
                <button
                  key={ans}
                  className="gate-option-btn"
                  onClick={() => {
                    if (ans === mathCorrect) {
                      setUnlocked(true);
                      onUnlock();
                    } else {
                      alert("回答不正確，請家長親自確認！");
                    }
                  }}
                >
                  {ans}
                </button>
              ))}
            </div>

            <div className="pin-switch-mode-row">
              <button
                type="button"
                className="switch-to-math-btn"
                onClick={() => setAuthMode("pin")}
              >
                返回 PIN 碼輸入
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   學習者切換與登入彈窗
   ======================================================== */
function LearnerLoginModal({
  learners,
  activeLearnerId,
  beginnerMode,
  R,
  onSelectLearner,
  onAddLearner,
  onDeleteLearner,
  onClose
}: {
  learners: ChildLearner[];
  activeLearnerId: string;
  beginnerMode: boolean;
  R: (text: string, customScriptMode?: ScriptMode, customClass?: string) => ReactNode;
  onSelectLearner: (id: string) => void;
  onAddLearner: (learner: ChildLearner) => void;
  onDeleteLearner: (id: string) => void;
  onClose: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🐯");
  const [newScript, setNewScript] = useState<ScriptMode>("dual");
  const [newPhonetic, setNewPhonetic] = useState<PhoneticAssist>("zhuyin");
  const [newHand, setNewHand] = useState<HandMode>("right");

  const avatarOptions = ["🐯", "🐰", "🐼", "🦁", "🐨", "🦊", "🐱", "🐶", "🦄", "🦖"];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newL: ChildLearner = {
      id: `learner-${Date.now()}`,
      name: newName.trim(),
      avatar: newAvatar,
      role: "learner",
      scriptMode: newScript,
      phoneticAssist: newPhonetic,
      handMode: newHand,
      points: { coins: 100, stars: 0 },
      levelsProgress: getLearnerLevelsProgress(),
      redemptions: [],
      totalMinutesLearned: 0,
      streakDays: 0,
      activePinkyPromise: null
    };
    onAddLearner(newL);
  };

  return (
    <div className="modal-backdrop">
      <div className="learner-login-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        <div className="login-modal-header">
          <div className="login-modal-badge">
            <GraduationCap size={32} />
          </div>
          <h2>{R("選擇或管理學習者帳號")}</h2>
          <p className="login-modal-sub">{R("登入專屬檔案，同步保存你的打卡星星、金幣與學習進度！")}</p>
        </div>

        {!isAdding ? (
          <>
            <div className="learner-profiles-select-grid">
              {learners.map((l) => {
                const isActive = l.id === activeLearnerId;
                const curLvl = l.levelsProgress?.find((p) => p.status === "current")?.levelNumber || 1;
                const completedCount = l.levelsProgress?.filter((p) => p.status === "completed").length || 0;

                return (
                  <div
                    key={l.id}
                    className={`learner-select-tile ${isActive ? "is-active" : ""}`}
                    onClick={() => onSelectLearner(l.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="learner-tile-top-row">
                      <span className="learner-tile-avatar">{l.avatar}</span>
                      {learners.length > 1 && (
                        <button
                          type="button"
                          className="learner-tile-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLearner(l.id);
                          }}
                          title="刪除此學習者"
                          aria-label="刪除學習者"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <span className="learner-tile-name">{l.name}</span>
                    <span className="learner-tile-grade">
                      🎯 第 {curLvl} 關 · 已通關 {completedCount} 關
                    </span>

                    <div className="learner-tile-stats-row">
                      <span>🪙 {l.points?.coins || 0}</span>
                      <span>⭐ {l.points?.stars || 0}</span>
                      <span>⏱️ {l.totalMinutesLearned || 0}分</span>
                    </div>

                    {isActive && <span className="learner-tile-active-badge">當前使用中</span>}
                  </div>
                );
              })}

              <button
                type="button"
                className="learner-select-tile add-new-tile"
                onClick={() => setIsAdding(true)}
              >
                <span className="add-tile-plus">+</span>
                <span className="learner-tile-name">新增學習者</span>
                <small>建立全新學習檔案</small>
              </button>
            </div>
          </>
        ) : (
          <form className="add-learner-form" onSubmit={handleCreate}>
            <div className="form-item">
              <label>小朋友姓名 / 暱稱：</label>
              <input
                type="text"
                className="learner-name-input"
                placeholder="例如：安安、小寶、Leo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={10}
                required
                autoFocus
              />
            </div>

            <div className="form-item">
              <label>選擇可愛代表動物：</label>
              <div className="avatar-palette">
                {avatarOptions.map((av) => (
                  <button
                    key={av}
                    type="button"
                    className={`avatar-choice-btn ${newAvatar === av ? "selected" : ""}`}
                    onClick={() => setNewAvatar(av)}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-item">
              <label>字體與拼讀偏好：</label>
              <div className="form-radio-pill-group">
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "dual" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("dual");
                    setNewPhonetic("zhuyin");
                  }}
                >
                  ✨ 繁簡雙軌
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "zhuyin" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("zhuyin");
                    setNewPhonetic("zhuyin");
                  }}
                >
                  🇹🇼 繁體注音
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newScript === "pinyin" ? "active" : ""}`}
                  onClick={() => {
                    setNewScript("pinyin");
                    setNewPhonetic("pinyin");
                  }}
                >
                  🔤 簡體拼音
                </button>
              </div>
            </div>

            <div className="form-item">
              <label>書寫習慣用手：</label>
              <div className="form-radio-pill-group">
                <button
                  type="button"
                  className={`radio-pill-btn ${newHand === "right" ? "active" : ""}`}
                  onClick={() => setNewHand("right")}
                >
                  ✋ 右手書寫
                </button>
                <button
                  type="button"
                  className={`radio-pill-btn ${newHand === "left" ? "active" : ""}`}
                  onClick={() => setNewHand("left")}
                >
                  🤚 左手書寫
                </button>
              </div>
            </div>

            <div className="form-actions-row">
              <button
                type="button"
                className="form-cancel-btn"
                onClick={() => setIsAdding(false)}
              >
                取消返回
              </button>
              <button
                type="submit"
                className="form-submit-btn"
                disabled={!newName.trim()}
              >
                🚀 立即開啟專屬學習檔案
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   1. 第一次進入的使用者歡迎畫面與新手啟航引導
   ======================================================== */
function WelcomeOnboardingModal({
  displayLang = "zh-Hant",
  setDisplayLang,
  onClose,
  onComplete,
  R
}: {
  displayLang?: DisplayLang;
  setDisplayLang?: (lang: DisplayLang) => void;
  onClose: () => void;
  onComplete: (config: {
    name: string;
    avatar: string;
    scriptMode: ScriptMode;
    volumeNum: number;
    dailyMinutes: number;
  }) => void;
  R?: (text: string) => ReactNode;
}) {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>("小明");
  const [avatar, setAvatar] = useState<string>("🐼");
  const [selectedScript, setSelectedScript] = useState<ScriptMode>("dual");
  const [selectedVolume, setSelectedVolume] = useState<number>(1);
  const [dailyMinutes, setDailyMinutes] = useState<number>(25);

  const avatars = ["🐼", "🐯", "🐰", "🦁", "🐨", "🦊", "🐶", "🦄"];

  const handleFinish = () => {
    localStorage.setItem("tongxuan_onboarded", "true");
    onComplete({
      name: name.trim() || "小明",
      avatar,
      scriptMode: selectedScript,
      volumeNum: selectedVolume,
      dailyMinutes
    });
  };

  // Multilingual text dictionary for Onboarding
  const i18nTexts: Record<string, Record<string, string>> = {
    "zh-Hant": {
      langLabel: "介面語言：",
      step1: "學習角色",
      step2: "字體偏好",
      step3: "教材起點",
      step4: "學習目標",
      heroTitle: "歡迎來到 童軒中文！",
      heroDesc: "為寶貝建立專屬學習身分，開啟溫暖有趣的漢字探索之旅！",
      nameLabel: "小朋友的暱稱或姓名",
      namePlaceholder: "例如：安安、小明、亮亮",
      avatarLabel: "挑選一隻最喜歡的學習夥伴頭像",
      step2Title: "選擇偏好的學習字體與標音",
      step2Desc: "童軒深度支援繁簡雙軌！簡中用戶可透過雙軌對照輕鬆掌握繁體字形與筆畫。",
      dualTag: "✨ 推薦雙軌",
      dualTitle: "繁體注音 + 簡體拼音（雙軌模式）",
      dualDesc: "同步掌握繁體字形結構之美與簡體常用規範。簡中用戶能藉由對照快速認寫繁體！",
      twTag: "🇹🇼 臺灣正體",
      twTitle: "繁體中文 + 注音符號（ㄅㄆㄇ）",
      twDesc: "標準教育部標楷體筆順與注音標音，奠定最扎實的正體字書寫基礎。",
      cnTag: "🔤 規範漢字",
      cnTitle: "簡體中文 + 漢語拼音（pīnyīn）",
      cnDesc: "國際通用漢語拼音輔助發音，簡化筆畫快速開展識字與閱讀。",
      step3Title: "選擇華語分級教材起點",
      step3Desc: "完整收錄 1 至 10 冊標準分級教材，從初學啟蒙到高階深讀，循序漸進！",
      step4Title: "設定每天的小小學習目標",
      step4Desc: "養成溫和規律的每天練習微習慣，週日即可開箱領取神秘大禮物！",
      goal15Title: "輕鬆啟蒙",
      goal15Desc: "每日 15 分鐘 · 4 個核心生字聽說讀寫",
      goal15Tag: "建立微習慣",
      goal25Title: "標準循序（推薦）",
      goal25Desc: "每日 25 分鐘 · 6 個核心生字 + 生活造句朗讀",
      goal25Tag: "多數家長推薦",
      goal35Title: "進階飛躍",
      goal35Desc: "每日 35 分鐘 · 生字 + 詞彙造句 + 成語深度閱讀",
      goal35Tag: "深度沉浸",
      nextBtnScript: "下一步：選擇學習字體",
      nextBtnVol: "下一步：選擇教材冊次",
      nextBtnGoal: "下一步：設定學習目標",
      finishBtn: "🚀 完成設定 · 開啟學習之旅！",
      backBtn: "上一步"
    },
    "zh-Hans": {
      langLabel: "界面语言：",
      step1: "学习角色",
      step2: "字体偏好",
      step3: "教材起点",
      step4: "学习目标",
      heroTitle: "欢迎来到 童轩中文！",
      heroDesc: "为宝贝建立专属学习身分，开启温暖有趣的汉字探索之旅！",
      nameLabel: "小朋友的昵称或姓名",
      namePlaceholder: "例如：安安、小明、亮亮",
      avatarLabel: "挑选一只最喜欢的学习伙伴头像",
      step2Title: "选择偏好的学习字体与标音",
      step2Desc: "童轩深度支持繁简双轨！简中用户可通过双轨对照轻松掌握繁体字形与笔画。",
      dualTag: "✨ 推荐双轨",
      dualTitle: "繁体注音 + 简体拼音（双轨模式）",
      dualDesc: "同步掌握繁体字形结构之美与简体常用规范。简中用户能借由对照快速认写繁体！",
      twTag: "🇹🇼 台湾正体",
      twTitle: "繁体中文 + 注音符号（ㄅㄆㄇ）",
      twDesc: "标准教育部标楷体笔顺与注音标音，奠定最扎实的正体字书写基础。",
      cnTag: "🔤 规范汉字",
      cnTitle: "简体中文 + 汉语拼音（pīnyīn）",
      cnDesc: "国际通用汉语拼音辅助发音，简化笔画快速开展识字与阅读。",
      step3Title: "选择华语分级教材起点",
      step3Desc: "完整收录 1 至 10 册标准分级教材，从初学启蒙到高阶深读，循序渐进！",
      step4Title: "设定每天的小小学习目标",
      step4Desc: "养成温和规律的每天练习微习惯，周日即可开箱领取神秘大礼物！",
      goal15Title: "轻松启蒙",
      goal15Desc: "每日 15 分钟 · 4 个核心生字听说读写",
      goal15Tag: "建立微习惯",
      goal25Title: "标准循序（推荐）",
      goal25Desc: "每日 25 分钟 · 6 个核心生字 + 生活造句朗读",
      goal25Tag: "多数家长推荐",
      goal35Title: "进阶飞跃",
      goal35Desc: "每日 35 分钟 · 生字 + 词汇造句 + 成语深度阅读",
      goal35Tag: "深度沉浸",
      nextBtnScript: "下一步：选择学习字体",
      nextBtnVol: "下一步：选择教材册次",
      nextBtnGoal: "下一步：设定学习目标",
      finishBtn: "🚀 完成设定 · 开启学习之旅！",
      backBtn: "上一步"
    },
    "en": {
      langLabel: "Language:",
      step1: "Profile",
      step2: "Script",
      step3: "Level",
      step4: "Goal",
      heroTitle: "Welcome to TongXuan Chinese!",
      heroDesc: "Create a personalized learner profile and start a warm, engaging Chinese adventure!",
      nameLabel: "Child's Nickname or Name",
      namePlaceholder: "e.g. Leo, Anna, Max",
      avatarLabel: "Pick a favorite learning avatar buddy",
      step2Title: "Choose Preferred Script & Phonetics",
      step2Desc: "TongXuan supports Traditional, Simplified & Dual-Track. Perfect for Simplified users to learn Traditional!",
      dualTag: "✨ Dual-Track",
      dualTitle: "Traditional + Simplified Dual-Track",
      dualDesc: "Master traditional character aesthetics alongside simplified usage. Ideal for learning traditional characters!",
      twTag: "🇹🇼 Traditional",
      twTitle: "Traditional Chinese + Zhuyin (ㄅㄆㄇ)",
      twDesc: "Standard Kaiti stroke orders and Zhuyin for solid traditional character writing foundations.",
      cnTag: "🔤 Simplified",
      cnTitle: "Simplified Chinese + Pinyin (pīnyīn)",
      cnDesc: "Global standard Pinyin with simplified strokes for fast vocabulary acquisition and reading.",
      step3Title: "Choose Starting Curriculum Level",
      step3Desc: "10 progressive curriculum volumes from preschool foundation to advanced reading.",
      step4Title: "Set Daily Learning Goal",
      step4Desc: "Build a consistent daily micro-habit to unlock Sunday mystery treasure chests!",
      goal15Title: "Gentle Start",
      goal15Desc: "15 mins daily · 4 core characters listen, speak & write",
      goal15Tag: "Micro-Habit",
      goal25Title: "Standard (Recommended)",
      goal25Desc: "25 mins daily · 6 core characters + story reading",
      goal25Tag: "Most Popular",
      goal35Title: "Advanced Immersion",
      goal35Desc: "35 mins daily · Characters + phrases + idiom stories",
      goal35Tag: "Deep Study",
      nextBtnScript: "Next: Choose Script Mode",
      nextBtnVol: "Next: Choose Level",
      nextBtnGoal: "Next: Set Daily Goal",
      finishBtn: "🚀 Complete Setup · Start Learning!",
      backBtn: "Back"
    }
  };

  const L = (key: string) => {
    return i18nTexts[displayLang]?.[key] || i18nTexts["zh-Hant"][key] || key;
  };

  const stepsData = [
    { num: 1, title: L("step1"), icon: "👤" },
    { num: 2, title: L("step2"), icon: "🔤" },
    { num: 3, title: L("step3"), icon: "📚" },
    { num: 4, title: L("step4"), icon: "🎯" }
  ];

  return (
    <div className="modal-backdrop">
      <div className="onboarding-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        {/* Header Display Language Switcher */}
        <div className="onboard-top-lang-bar">
          <span className="lang-bar-label">{L("langLabel")}</span>
          <div className="onboard-lang-pills">
            <button
              type="button"
              className={`onboard-lang-btn ${displayLang === "zh-Hant" ? "active" : ""}`}
              onClick={() => setDisplayLang && setDisplayLang("zh-Hant")}
            >
              🇹🇼 繁體中文
            </button>
            <button
              type="button"
              className={`onboard-lang-btn ${displayLang === "zh-Hans" ? "active" : ""}`}
              onClick={() => setDisplayLang && setDisplayLang("zh-Hans")}
            >
              🇨🇳 简体中文
            </button>
            <button
              type="button"
              className={`onboard-lang-btn ${displayLang === "en" ? "active" : ""}`}
              onClick={() => setDisplayLang && setDisplayLang("en")}
            >
              🇺🇸 English
            </button>
          </div>
        </div>

        {/* Top Step Progress Bar with Connected Line */}
        <div className="onboard-stepper-container">
          <div className="onboard-stepper-track">
            <div
              className="onboard-stepper-progress-fill"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
          <div className="onboard-stepper-steps-row">
            {stepsData.map((s) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div
                  key={s.num}
                  className={`onboard-step-node ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                >
                  <div className="step-circle-badge">
                    {isCompleted ? "✓" : s.num}
                  </div>
                  <span className="step-label-text">{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 1: 歡迎與建立學習夥伴 */}
        {step === 1 && (
          <div className="onboard-step-content animate-fade">
            <div className="onboard-hero-center">
              <div className="avatar-hero-display-wrap">
                <span className="avatar-hero-glyph">{avatar}</span>
                <span className="avatar-sparkle-badge">✨</span>
              </div>
              <h2 className="onboard-main-title">{L("heroTitle")}</h2>
              <p className="onboard-sub-desc">{L("heroDesc")}</p>
            </div>

            <div className="onboard-form-card">
              {/* Name Input */}
              <div className="onboard-field-group">
                <label className="onboard-field-label">
                  <span className="label-icon">📛</span>
                  <span>{L("nameLabel")}</span>
                </label>
                <div className="onboard-input-shell">
                  <input
                    type="text"
                    className="onboard-custom-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={L("namePlaceholder")}
                    maxLength={10}
                    autoFocus
                  />
                  <span className="input-char-counter">{name.length}/10</span>
                </div>
              </div>

              {/* Avatar Selector */}
              <div className="onboard-field-group">
                <label className="onboard-field-label">
                  <span className="label-icon">🎨</span>
                  <span>{L("avatarLabel")}</span>
                </label>
                <div className="avatar-palette-grid">
                  {avatars.map((av) => (
                    <button
                      key={av}
                      type="button"
                      className={`avatar-palette-bubble ${avatar === av ? "is-selected" : ""}`}
                      onClick={() => setAvatar(av)}
                      title={`選擇 ${av}`}
                    >
                      <span className="avatar-emoji">{av}</span>
                      {avatar === av && <span className="avatar-check-dot">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="onboard-bottom-actions">
              <button
                type="button"
                className="onboard-primary-btn"
                onClick={() => setStep(2)}
              >
                <span>{L("nextBtnScript")}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 選擇學習字體模式 */}
        {step === 2 && (
          <div className="onboard-step-content animate-fade">
            <div className="onboard-hero-center">
              <div className="step-icon-badge-round">🔤</div>
              <h2 className="onboard-main-title">{L("step2Title")}</h2>
              <p className="onboard-sub-desc">{L("step2Desc")}</p>
            </div>

            <div className="script-selection-stack">
              {/* Option 1: Dual Track */}
              <div
                className={`script-option-card ${selectedScript === "dual" ? "is-active" : ""}`}
                onClick={() => setSelectedScript("dual")}
              >
                <div className="script-card-left">
                  <div className="script-card-tag recommend-tag">{L("dualTag")}</div>
                  <h3 className="script-card-heading">{L("dualTitle")}</h3>
                  <p className="script-card-explain">{L("dualDesc")}</p>
                </div>
                <div className="script-radio-indicator">
                  <span className="radio-dot">{selectedScript === "dual" ? "✓" : ""}</span>
                </div>
              </div>

              {/* Option 2: Traditional */}
              <div
                className={`script-option-card ${selectedScript === "zhuyin" ? "is-active" : ""}`}
                onClick={() => setSelectedScript("zhuyin")}
              >
                <div className="script-card-left">
                  <div className="script-card-tag tw-tag">{L("twTag")}</div>
                  <h3 className="script-card-heading">{L("twTitle")}</h3>
                  <p className="script-card-explain">{L("twDesc")}</p>
                </div>
                <div className="script-radio-indicator">
                  <span className="radio-dot">{selectedScript === "zhuyin" ? "✓" : ""}</span>
                </div>
              </div>

              {/* Option 3: Simplified */}
              <div
                className={`script-option-card ${selectedScript === "pinyin" ? "is-active" : ""}`}
                onClick={() => setSelectedScript("pinyin")}
              >
                <div className="script-card-left">
                  <div className="script-card-tag cn-tag">{L("cnTag")}</div>
                  <h3 className="script-card-heading">{L("cnTitle")}</h3>
                  <p className="script-card-explain">{L("cnDesc")}</p>
                </div>
                <div className="script-radio-indicator">
                  <span className="radio-dot">{selectedScript === "pinyin" ? "✓" : ""}</span>
                </div>
              </div>
            </div>

            <div className="onboard-bottom-actions dual-actions">
              <button
                type="button"
                className="onboard-ghost-btn"
                onClick={() => setStep(1)}
              >
                {L("backBtn")}
              </button>
              <button
                type="button"
                className="onboard-primary-btn"
                onClick={() => setStep(3)}
              >
                <span>{L("nextBtnVol")}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 選擇華語分級教材起點 */}
        {step === 3 && (
          <div className="onboard-step-content animate-fade">
            <div className="onboard-hero-center">
              <div className="step-icon-badge-round">📚</div>
              <h2 className="onboard-main-title">{L("step3Title")}</h2>
              <p className="onboard-sub-desc">{L("step3Desc")}</p>
            </div>

            <div className="volumes-selector-grid">
              {OCAC_VOLUMES.map((vol) => {
                const isSelected = selectedVolume === vol.volume;
                return (
                  <div
                    key={vol.volume}
                    className={`volume-tile-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedVolume(vol.volume)}
                    style={{
                      borderColor: isSelected ? vol.colorTheme : undefined
                    }}
                  >
                    <span className="volume-tile-icon">{vol.badgeIcon}</span>
                    <div className="volume-tile-meta">
                      <strong className="volume-tile-title">第 {vol.volume} 冊</strong>
                      <span className="volume-tile-grade">
                        {vol.gradeName.split("·")[1] || vol.gradeName}
                      </span>
                    </div>
                    {isSelected && <span className="volume-selected-mark">✓</span>}
                  </div>
                );
              })}
            </div>

            <div className="onboard-bottom-actions dual-actions">
              <button
                type="button"
                className="onboard-ghost-btn"
                onClick={() => setStep(2)}
              >
                {L("backBtn")}
              </button>
              <button
                type="button"
                className="onboard-primary-btn"
                onClick={() => setStep(4)}
              >
                <span>{L("nextBtnGoal")}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: 設定每日學習目標 */}
        {step === 4 && (
          <div className="onboard-step-content animate-fade">
            <div className="onboard-hero-center">
              <div className="step-icon-badge-round">🎯</div>
              <h2 className="onboard-main-title">{L("step4Title")}</h2>
              <p className="onboard-sub-desc">{L("step4Desc")}</p>
            </div>

            <div className="goals-options-stack">
              {[
                {
                  min: 15,
                  label: L("goal15Title"),
                  desc: L("goal15Desc"),
                  icon: "🌱",
                  tag: L("goal15Tag")
                },
                {
                  min: 25,
                  label: L("goal25Title"),
                  desc: L("goal25Desc"),
                  icon: "⭐",
                  tag: L("goal25Tag")
                },
                {
                  min: 35,
                  label: L("goal35Title"),
                  desc: L("goal35Desc"),
                  icon: "🚀",
                  tag: L("goal35Tag")
                }
              ].map((g) => {
                const isSelected = dailyMinutes === g.min;
                return (
                  <div
                    key={g.min}
                    className={`goal-plan-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setDailyMinutes(g.min)}
                  >
                    <span className="goal-plan-icon">{g.icon}</span>
                    <div className="goal-plan-body">
                      <div className="goal-plan-heading-row">
                        <h3 className="goal-plan-title">{g.label}</h3>
                        <span className="goal-plan-tag">{g.tag}</span>
                      </div>
                      <p className="goal-plan-desc">{g.desc}</p>
                    </div>
                    <div className="goal-plan-check">
                      <span className="radio-dot">{isSelected ? "✓" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="onboard-bottom-actions dual-actions">
              <button
                type="button"
                className="onboard-ghost-btn"
                onClick={() => setStep(3)}
              >
                {L("backBtn")}
              </button>
              <button
                type="button"
                className="onboard-primary-btn launch-finish-btn"
                onClick={handleFinish}
              >
                <span>{L("finishBtn")}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   2. 華語分級主線 · 1~10 冊完整教材庫與課次導航
   ======================================================== */
function OCACCurriculumHubModal({
  selectedVolumeNum,
  onSelectLesson,
  onClose,
  R
}: {
  selectedVolumeNum: number;
  onSelectLesson: (vol: OCACVolume, lesson: OCACLesson) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const [activeVol, setActiveVol] = useState<number>(selectedVolumeNum);
  const currVol = OCAC_VOLUMES.find((v) => v.volume === activeVol) || OCAC_VOLUMES[0];

  return (
    <div className="modal-backdrop">
      <div className="curriculum-hub-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="curriculum-hub-header">
          <div className="hub-badge-icon">📚</div>
          <div>
            <h2>華語分級主線 · 1~10 冊完整教材庫</h2>
            <p className="hub-sub">涵蓋啟蒙第一冊至高階第十冊，點擊課次即可直接進入該課練字與閱讀！</p>
          </div>
        </div>

        {/* 10 Volume Tabs */}
        <div className="volume-tabs-scroller">
          {OCAC_VOLUMES.map((v) => (
            <button
              key={v.volume}
              className={`vol-tab-btn ${v.volume === activeVol ? "active" : ""}`}
              onClick={() => setActiveVol(v.volume)}
              style={{
                borderBottomColor: v.volume === activeVol ? v.colorTheme : "transparent"
              }}
            >
              <span className="vol-tab-icon">{v.badgeIcon}</span>
              <span className="vol-tab-title">第 {v.volume} 冊</span>
            </button>
          ))}
        </div>

        {/* Volume Detail Hero */}
        <div className="volume-detail-hero" style={{ borderLeftColor: currVol.colorTheme }}>
          <div className="vol-hero-main">
            <h3>{currVol.gradeName}</h3>
            <span className="vol-target-chip">🎯 {currVol.targetAudience}</span>
            <span className="vol-chars-count-chip">🀄 共 {currVol.totalChars} 生字</span>
          </div>
          <p className="vol-desc-text">{currVol.description}</p>
        </div>

        {/* Lessons Grid in this Volume */}
        <div className="volume-lessons-list">
          {currVol.lessons.length > 0 ? (
            currVol.lessons.map((lesson) => (
              <div key={lesson.lessonId} className="curriculum-lesson-card">
                <div className="lesson-card-header">
                  <span className="lesson-num-badge">第 {lesson.lessonNumber} 課</span>
                  <h4>{lesson.title}</h4>
                  <span className="lesson-theme-pill">{lesson.theme}</span>
                </div>

                <p className="lesson-subtitle-desc">{lesson.subtitle}</p>

                {/* Character preview pills */}
                <div className="lesson-chars-preview-row">
                  {lesson.characters.map((c) => (
                    <span key={c.char} className="preview-char-pill">
                      <b>{c.char}</b>
                      <small>{c.pinyin}</small>
                    </span>
                  ))}
                </div>

                <div className="lesson-action-bottom">
                  <button
                    className="launch-lesson-btn"
                    onClick={() => onSelectLesson(currVol, lesson)}
                  >
                    <span>✍️ 進入本課生字與閱讀</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-vol-state">
              <span>📖</span>
              <p>第 {currVol.volume} 冊課次內容已就緒，可點選「5000 漢字字庫」檢索該級別對應生字並立即練習！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   3. 5000 常用漢字字庫檢索與即時田字格練字發音
   ======================================================== */
function Hanzi5000LexiconModal({
  onPracticeChar,
  onClose,
  R
}: {
  onPracticeChar: (hanzi: HanziEntry) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | undefined>(undefined);
  const [selectedRadical, setSelectedRadical] = useState<string>("");

  const radicalsList = ["全部", "人", "口", "手", "日", "月", "木", "水", "火", "土", "石", "田", "禾", "艸", "雨", "鳥", "魚", "馬", "羊", "牛", "虫", "心", "言", "大"];

  const filteredEntries = searchHanziLexicon(searchQuery, {
    level: selectedLevel,
    radical: selectedRadical && selectedRadical !== "全部" ? selectedRadical : undefined
  });

  return (
    <div className="modal-backdrop">
      <div className="hanzi-lexicon-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="lexicon-modal-header">
          <div className="lexicon-icon-badge">🔍</div>
          <div>
            <h2>5000 常用漢字字庫檢索與即時練字</h2>
            <p className="lexicon-sub">教育部國字標準字體庫 · 支援繁簡檢索、拼音注音、部首筆畫與即時田字格練字！</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="lexicon-search-bar-row">
          <input
            type="text"
            className="lexicon-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="輸入漢字、拼音 (如: feng)、注音 (如: ㄈㄥ)、部首或英文意思搜尋..."
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        {/* Level Filters & Radical Filter */}
        <div className="lexicon-filter-pills-row">
          <span className="filter-label">冊次分級：</span>
          <button
            className={`filter-pill ${selectedLevel === undefined ? "active" : ""}`}
            onClick={() => setSelectedLevel(undefined)}
          >
            全部等級 (Lv.1~10)
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
            <button
              key={lvl}
              className={`filter-pill ${selectedLevel === lvl ? "active" : ""}`}
              onClick={() => setSelectedLevel(lvl)}
            >
              Lv.{lvl}
            </button>
          ))}
        </div>

        <div className="lexicon-radical-chips-row">
          <span className="filter-label">常用部首：</span>
          {radicalsList.map((rad) => (
            <button
              key={rad}
              className={`radical-chip-btn ${selectedRadical === rad || (!selectedRadical && rad === "全部") ? "active" : ""}`}
              onClick={() => setSelectedRadical(rad === "全部" ? "" : rad)}
            >
              {rad}
            </button>
          ))}
        </div>

        {/* Results Counter */}
        <div className="lexicon-results-info-bar">
          <span>找到 <b>{filteredEntries.length}</b> 個符合條件的標準生字</span>
          <small>點擊任意漢字，即可立即開啟 10 遍田字格漸退描線與筆順落點檢查！</small>
        </div>

        {/* Character Cards Grid */}
        <div className="lexicon-cards-grid">
          {filteredEntries.map((hanzi) => (
            <div key={hanzi.id} className="hanzi-entry-card">
              <div className="hanzi-entry-top">
                <span className="hanzi-main-glyph kaiti-standard">{hanzi.char}</span>
                {hanzi.char !== hanzi.charHans && (
                  <span className="hanzi-hans-pill" title="簡體字">
                    簡: {hanzi.charHans}
                  </span>
                )}
                <span className="hanzi-level-badge">Lv.{hanzi.level}</span>
              </div>

              <div className="hanzi-entry-phonetics">
                <span className="hanzi-zhuyin-text">{hanzi.zhuyin}</span>
                <span className="hanzi-pinyin-text">{hanzi.pinyin}</span>
              </div>

              <div className="hanzi-entry-meta">
                <span>🧩 部首：{hanzi.radical}</span>
                <span>📏 筆畫：{hanzi.strokes} 畫</span>
              </div>

              <p className="hanzi-meaning-text">💡 {hanzi.meaning} ({hanzi.meaningEn})</p>

              <div className="hanzi-common-words-tags">
                {hanzi.commonWords.map((w) => (
                  <span key={w} className="common-word-tag">{w}</span>
                ))}
              </div>

              <button
                className="practice-this-char-btn"
                onClick={() => onPracticeChar(hanzi)}
              >
                <span>✍️ 進入田字格練字</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================
   4. 積分金幣結算與禮物獎勵商城 (Rewards Shop & Privilege Passbook)
   ======================================================== */
function RewardsStoreModal({
  points,
  redemptions,
  onUpdatePoints,
  onUpdateRedemptions,
  onClose,
  R
}: {
  points: { coins: number; stars: number };
  redemptions: RedemptionRecord[];
  onUpdatePoints: (newPts: { coins: number; stars: number }) => void;
  onUpdateRedemptions: (newHistory: RedemptionRecord[]) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"shop" | "passbook">("shop");
  const [passbookSubTab, setPassbookSubTab] = useState<"pending" | "claimed">("pending");
  const [catalog] = useState<RewardItem[]>(() =>
    getRewardsCatalog().filter((item) => item.enabled !== false)
  );
  const [history, setHistory] = useState<RedemptionRecord[]>(() => redemptions || getRedemptionHistory());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Parent PIN Verification Dialog state
  const [pinDialogTargetRecord, setPinDialogTargetRecord] = useState<RedemptionRecord | null>(null);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const handleRedeem = (item: RewardItem) => {
    const res = redeemRewardItem(item, points);
    if (res.success) {
      onUpdatePoints(res.newPoints);
      const newHist = getRedemptionHistory();
      setHistory(newHist);
      onUpdateRedemptions(newHist);
      setToastMessage(`🎉 成功兌換【${item.name}】！票券已自動存入「我的票券夾」！`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage(`⚠️ ${res.message}`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleClaimWithPin = () => {
    if (!pinDialogTargetRecord) return;
    if (verifyParentPin(inputPin)) {
      const updated = approveOrClaimTicket(pinDialogTargetRecord.id, "claimed");
      setHistory(updated);
      onUpdateRedemptions(updated);
      setPinDialogTargetRecord(null);
      setInputPin("");
      setPinError(null);
      setToastMessage(`🎉 已成功核銷【${pinDialogTargetRecord.itemName}】！兌換完畢！`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setPinError("❌ PIN 碼錯誤，請家長確認後重新輸入（預設 8888）");
      setTimeout(() => setInputPin(""), 600);
    }
  };

  const pendingList = history.filter((r) => r.status === "pending");
  const claimedList = history.filter((r) => r.status === "claimed");
  const totalPendingTickets = pendingList.reduce((sum, r) => sum + (r.quantity || 1), 0);

  return (
    <div className="modal-backdrop">
      <div className="rewards-store-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉兌換舖">
          <X size={20} />
        </button>

        {/* Header with Balance */}
        <div className="rewards-header-row">
          <div className="rewards-title-group">
            <span className="rewards-icon-badge">🎁</span>
            <div>
              <h2>獎勵兌換舖</h2>
              <p className="rewards-sub">累積學習星星與金幣，跟爸爸媽媽一起設定與兌換生活小約定。</p>
            </div>
          </div>

          <div className="rewards-balance-box">
            <div className="balance-item-chip gold-coin-chip" title="可消耗金幣">
              <span className="coin-icon">🪙</span>
              <span className="balance-val">{points.coins.toLocaleString()}</span>
              <small>金幣 (可兌換)</small>
            </div>
            <div className="balance-item-chip star-chip" title="學習累積星星（榮譽門檻）">
              <span className="star-icon">⭐</span>
              <span className="balance-val">{points.stars}</span>
              <small>星星 (解鎖門檻)</small>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="rewards-tabs-row">
          <button
            className={`rewards-tab-btn ${activeTab === "shop" ? "active" : ""}`}
            onClick={() => setActiveTab("shop")}
          >
            🛍️ 獎勵品清單
          </button>
          <button
            className={`rewards-tab-btn ${activeTab === "passbook" ? "active" : ""}`}
            onClick={() => setActiveTab("passbook")}
          >
            🎟️ 我的票券夾 ({totalPendingTickets})
            {totalPendingTickets > 0 && (
              <span className="passbook-pending-badge">{totalPendingTickets} 張待使用</span>
            )}
          </button>
        </div>

        {toastMessage && (
          <div className="rewards-toast-pill animate-fade">
            {toastMessage}
          </div>
        )}

        {activeTab === "shop" ? (
          <div className="rewards-shop-scroll-container">
            <div className="rewards-catalog-grid">
              {catalog.map((item) => {
                const canAfford = points.coins >= item.costCoins && points.stars >= item.costStars;
                return (
                  <div key={item.id} className={`reward-item-card ${canAfford ? "can-afford" : "locked"}`}>
                    <div className="reward-item-top-row">
                      <span className="reward-big-emoji">{item.icon}</span>
                    </div>

                    <div className="reward-card-info">
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                    </div>

                    <div className="reward-pricing-bottom">
                      <div className="cost-tag-group">
                        <span className="cost-tag coin-cost">🪙 {item.costCoins.toLocaleString()} 金幣</span>
                        <span className="cost-tag star-cost">⭐ 滿 {item.costStars} 星解鎖</span>
                      </div>

                      <button
                        className="redeem-btn"
                        disabled={!canAfford}
                        onClick={() => handleRedeem(item)}
                      >
                        {canAfford
                          ? "🎁 立即兌換"
                          : points.coins < item.costCoins
                          ? "🪙 金幣不足"
                          : "⭐ 星數未達門檻"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* PASSBOOK VOUCHER WALLET WITH SUB-TABS & PARENT PIN CLAIMING */
          <div className="rewards-passbook-section passbook-scroller">
            <div className="passbook-guidance-banner">
              <span>💡</span>
              <p>
                <b>使用方法：</b> 成功兌換的生活約定票券會存放在「我的票券夾」。想使用約定時，請爸爸媽媽輸入 4 位 PIN 碼核銷即可！
              </p>
            </div>

            {/* Passbook Sub-Tabs: Pending vs Claimed */}
            <div className="passbook-subtabs-row">
              <button
                type="button"
                className={`passbook-subtab-btn ${passbookSubTab === "pending" ? "active" : ""}`}
                onClick={() => setPassbookSubTab("pending")}
              >
                🎟️ 待使用的約定票券 ({totalPendingTickets})
              </button>
              <button
                type="button"
                className={`passbook-subtab-btn ${passbookSubTab === "claimed" ? "active" : ""}`}
                onClick={() => setPassbookSubTab("claimed")}
              >
                📜 已核銷使用紀錄 ({claimedList.length})
              </button>
            </div>

            {passbookSubTab === "pending" ? (
              pendingList.length === 0 ? (
                <div className="empty-passbook-state">
                  <span>🎟️</span>
                  <p>目前沒有待使用的約定票券喔！快去挑選喜歡的生活獎勵吧！</p>
                </div>
              ) : (
                <div className="ticket-vouchers-grid">
                  {pendingList.map((record) => (
                    <div key={record.id} className="ticket-voucher-card pending">
                      {/* Left Perforated Stub */}
                      <div className="ticket-voucher-stub">
                        <span className="ticket-stub-icon">{record.itemIcon}</span>
                        <span className="ticket-stub-code">{record.ticketCode}</span>
                        <div className="ticket-barcode-sim">
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>

                      {/* Right Main Body */}
                      <div className="ticket-voucher-body">
                        <div className="ticket-body-top">
                          <div className="ticket-title-group">
                            <div className="ticket-name-row">
                              <strong>{record.itemName}</strong>
                              {(record.quantity || 1) > 1 && (
                                <span className="ticket-quantity-pill">× {record.quantity} 張</span>
                              )}
                            </div>
                            <span className="ticket-time-tag">⏱️ 兌換時間：{record.redeemedAt}</span>
                          </div>
                          <div className="ticket-status-pill pending">⏳ 待爸媽核銷</div>
                        </div>

                        <div className="ticket-body-footer">
                          <div className="ticket-cost-used">
                            <span>已扣金幣：🪙 {record.costCoins.toLocaleString()}</span>
                          </div>
                          <button
                            type="button"
                            className="claim-ticket-pin-btn"
                            onClick={() => {
                              setPinDialogTargetRecord(record);
                              setInputPin("");
                              setPinError(null);
                            }}
                          >
                            👨‍👩‍👧 請父母輸入 PIN 碼核銷{(record.quantity || 1) > 1 ? " (1張)" : ""}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              claimedList.length === 0 ? (
                <div className="empty-passbook-state">
                  <span>📜</span>
                  <p>尚無已核銷的約定紀錄。兌換並經父母核銷後會記錄在此！</p>
                </div>
              ) : (
                <div className="ticket-vouchers-grid">
                  {claimedList.map((record) => (
                    <div key={record.id} className="ticket-voucher-card claimed">
                      {/* Left Perforated Stub */}
                      <div className="ticket-voucher-stub">
                        <span className="ticket-stub-icon">{record.itemIcon}</span>
                        <span className="ticket-stub-code">{record.ticketCode}</span>
                        <div className="ticket-barcode-sim">
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>

                      {/* Right Main Body */}
                      <div className="ticket-voucher-body">
                        <div className="ticket-body-top">
                          <div className="ticket-title-group">
                            <strong>{record.itemName}</strong>
                            <span className="ticket-time-tag">⏱️ 核銷時間：{record.redeemedAt}</span>
                          </div>
                          <div className="ticket-status-pill claimed">✅ 已核銷履約</div>
                        </div>

                        <div className="ticket-body-footer">
                          <div className="ticket-cost-used">
                            <span>已扣金幣：🪙 {record.costCoins.toLocaleString()}</span>
                          </div>
                          <span className="ticket-used-hint">🎉 已於生活中兌現完畢！</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Sub-Modal: Parent PIN Code Verification to Claim Ticket */}
        {pinDialogTargetRecord && (
          <div className="sub-modal-backdrop animate-fade">
            <div className="pin-verify-card">
              <button
                className="modal-close-x"
                onClick={() => setPinDialogTargetRecord(null)}
                aria-label="取消"
              >
                <X size={18} />
              </button>
              <div className="pin-verify-icon">🔒</div>
              <h3>家長安全核銷確認</h3>
              <p className="pin-verify-desc">
                孩子申請兌現生活約定：<b>【{pinDialogTargetRecord.itemName}】</b>
                {(pinDialogTargetRecord.quantity || 1) > 1 && (
                  <span className="pin-batch-note">
                    （目前持有 × {pinDialogTargetRecord.quantity} 張，本次核銷 1 張，核銷後剩餘 {pinDialogTargetRecord.quantity! - 1} 張）
                  </span>
                )}
                <br />
                請家長輸入 4 位 PIN 碼以確認履約核銷（預設 8888）：
              </p>

              {pinError && <div className="pin-error-alert">{pinError}</div>}

              <div className="pin-dots-row">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`pin-dot ${inputPin.length > idx ? "filled" : ""}`}
                  />
                ))}
              </div>

              <div className="pin-keypad-grid-compact">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="pin-key-btn"
                    onClick={() => {
                      if (inputPin.length < 4) setInputPin((prev) => prev + d);
                    }}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className="pin-key-btn action-key"
                  onClick={() => setInputPin("")}
                >
                  C
                </button>
                <button
                  type="button"
                  className="pin-key-btn"
                  onClick={() => {
                    if (inputPin.length < 4) setInputPin((prev) => prev + "0");
                  }}
                >
                  0
                </button>
                <button
                  type="button"
                  className="pin-key-btn action-key"
                  onClick={() => setInputPin((prev) => prev.slice(0, -1))}
                >
                  ⌫
                </button>
              </div>

              <div className="pin-verify-actions">
                <button
                  type="button"
                  className="cancel-pin-btn"
                  onClick={() => setPinDialogTargetRecord(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="confirm-pin-claim-btn"
                  disabled={inputPin.length !== 4}
                  onClick={handleClaimWithPin}
                >
                  ✓ 確認核銷此券
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   5. 關於童軒中文、版權宣告與檢定進階路線 (About & Roadmap)
   ======================================================== */
function AboutTongXuanModal({
  initialTab = "about",
  onClose
}: {
  initialTab?: "about" | "roadmap" | "legal" | "disclaimer";
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"about" | "roadmap" | "legal" | "disclaimer">(initialTab);

  return (
    <div className="modal-backdrop">
      <div className="about-tongxuan-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="about-modal-header">
          <div className="about-brand-badge">☀️</div>
          <div>
            <h2>童軒中文 · 關於、藍圖與使用條款</h2>
            <p className="about-sub-lead">
              專為海外兒童與初學者量身打造 · 溫暖、趣味、系統化的華語全景學習平臺
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="about-tabs-row">
          <button
            className={`about-tab-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            🌟 理念與特色
          </button>
          <button
            className={`about-tab-btn ${activeTab === "roadmap" ? "active" : ""}`}
            onClick={() => setActiveTab("roadmap")}
          >
            🗺️ 全景進階路線與檢定目標
          </button>
          <button
            className={`about-tab-btn ${activeTab === "legal" ? "active" : ""}`}
            onClick={() => setActiveTab("legal")}
          >
            ⚖️ 教材出處與版權聲明
          </button>
          <button
            className={`about-tab-btn ${activeTab === "disclaimer" ? "active" : ""}`}
            onClick={() => setActiveTab("disclaimer")}
          >
            📜 測試版與免責聲明
          </button>
        </div>

        {/* TAB 1: 理念與特色 */}
        {activeTab === "about" && (
          <div className="about-tab-pane animate-fade">
            <div className="about-feature-cards-grid">
              <div className="about-feature-box">
                <span className="feat-icon">✍️</span>
                <h4>田字格 10 遍遞減筆順引擎</h4>
                <p>遵循標準標楷體字形，以 100% ➔ 0% 漸隱提示與即時落點判定，陪伴孩子從臨摹到自信默寫。</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">🇹🇼🔤</span>
                <h4>繁簡注拼雙軌並進</h4>
                <p>同步支援臺灣注音符號（ㄅㄆㄇ）與國際漢語拼音（pīnyīn），繁簡同字或異字自動對照，無縫切換。</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">📚</span>
                <h4>1~10 冊完整分級體系</h4>
                <p>整合 5,000 標準常用漢字庫與 10 冊循序漸進教材，涵蓋字、詞、句、故事到成語閱讀全循環。</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">🎁</span>
                <h4>正向激勵與護眼承諾</h4>
                <p>無噪音式手遊誘導，透過星星打卡與週日開箱微習慣，並提供低藍光深色護眼模式呵護視力。</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 全景進階路線與檢定目標 (ROADMAP) */}
        {activeTab === "roadmap" && (
          <div className="about-tab-pane animate-fade">
            <div className="roadmap-timeline-stack">
              {/* Stage 0 */}
              <div className="roadmap-stage-card stage-0">
                <div className="stage-left-badge">
                  <span className="stage-num-tag">STAGE 0</span>
                  <span className="stage-age">Pre-K ~ 幼兒園</span>
                </div>
                <div className="stage-body">
                  <h4>🌱 啟蒙奠基：拼讀與象形認字</h4>
                  <p>注音符號 / 漢語拼音入門、象形字起源、基礎筆畫與生活高頻 100~300 字。</p>
                  <div className="exam-target-chips">
                    <span className="exam-chip">🎯 兒童華檢 CCCC 萌芽級</span>
                    <span className="exam-chip">🎯 YCT 1 級</span>
                  </div>
                </div>
              </div>

              {/* Stage 1 */}
              <div className="roadmap-stage-card stage-1">
                <div className="stage-left-badge">
                  <span className="stage-num-tag">STAGE 1</span>
                  <span className="stage-age">小學 1~2 年級</span>
                </div>
                <div className="stage-body">
                  <h4>📖 基礎字詞：教材第 1~3 冊（300~800 字）</h4>
                  <p>日常生活會話、看圖說話、標準田字格筆順書寫、基礎短句拼讀與朗讀評測。</p>
                  <div className="exam-target-chips">
                    <span className="exam-chip">🎯 兒童華檢 CCCC 成長級</span>
                    <span className="exam-chip">🎯 TOCFL Novice (入門級)</span>
                    <span className="exam-chip">🎯 YCT 2 級</span>
                  </div>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="roadmap-stage-card stage-2">
                <div className="stage-left-badge">
                  <span className="stage-num-tag">STAGE 2</span>
                  <span className="stage-age">小學 3~4 年級</span>
                </div>
                <div className="stage-body">
                  <h4>🚀 獨立閱讀：教材第 4~6 冊（800~1,800 字）</h4>
                  <p>寓言童話、成語故事典故、段落敘事寫作、繁簡異體對照精熟與流利朗讀。</p>
                  <div className="exam-target-chips">
                    <span className="exam-chip">🎯 兒童華檢 CCCC 茁壯級</span>
                    <span className="exam-chip">🎯 TOCFL Band A (A1~A2 基礎級)</span>
                    <span className="exam-chip">🎯 YCT 3~4 級 / HSK 2~3 級</span>
                  </div>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="roadmap-stage-card stage-3">
                <div className="stage-left-badge">
                  <span className="stage-num-tag">STAGE 3</span>
                  <span className="stage-age">小學 5~6 年級</span>
                </div>
                <div className="stage-body">
                  <h4>🌳 文化深讀：教材第 7~10 冊（1,800~3,200 字）</h4>
                  <p>歷史地理、社會文化、說明文與邏輯表達、成語深讀與主題式寫作。</p>
                  <div className="exam-target-chips">
                    <span className="exam-chip">🎯 TOCFL Band B1 (進階級)</span>
                    <span className="exam-chip">🎯 HSK 4 級</span>
                  </div>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="roadmap-stage-card stage-4">
                <div className="stage-left-badge">
                  <span className="stage-num-tag">STAGE 4</span>
                  <span className="stage-age">中學 7~12 年級</span>
                </div>
                <div className="stage-body">
                  <h4>🎓 學術中文與高階檢定專題（3,200~5,000+ 字）</h4>
                  <p>文言文閱讀、時事評論、AP Chinese & Culture 專題備考、IB Chinese 文學解析。</p>
                  <div className="exam-target-chips">
                    <span className="exam-chip gold">⭐ AP Chinese (滿分 5 分目標)</span>
                    <span className="exam-chip gold">⭐ IB Chinese A / B</span>
                    <span className="exam-chip">🎯 TOCFL Band B2~C1 (高階/流利級)</span>
                    <span className="exam-chip">🎯 HSK 5~6 級</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 教材出處與版權聲明 (Legal Attribution) */}
        {activeTab === "legal" && (
          <div className="about-tab-pane animate-fade">
            <div className="legal-notice-box">
              <h3>⚖️ 著作權出處與資源授權聲明</h3>
              <ul className="legal-points-list">
                <li>
                  <strong>標準分級教材課綱：</strong>
                  本系統分級課程大綱、課次進度與核心生字選編，參考中華民國僑務委員會（OCAC）《學華語向前走》（Let's Learn Chinese）標準教材架構。
                </li>
                <li>
                  <strong>國字字體與筆順規範：</strong>
                  漢字標準筆順、部首歸類與標楷體字形，遵照中華民國教育部《國字標準字體筆順學習網》與常用國字標準字體規範。
                </li>
                <li>
                  <strong>注音符號與漢語拼音：</strong>
                  注音符號依據教育部國語注音符號規範；漢語拼音遵循 ISO 7098 及現代標準漢語拼音規則。
                </li>
                <li>
                  <strong>開放教育推廣宗旨：</strong>
                  所有官方教材與教育推廣素材之智慧財產權均屬原編纂機關或權利人所有。本系統依非營利教育推廣與輔助自學之精神，研發互動演算法與數位介面，致力於提供全球華語學習者優質溫暖的學習環境。
                </li>
              </ul>
              <div className="legal-footer-note">
                <span>© 2026 童軒中文 (TongXuan Chinese) · 陪伴每一位孩子探索漢字之美</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 測試版免責聲明與隱私條款 */}
        {activeTab === "disclaimer" && (
          <div className="about-tab-pane animate-fade">
            <div className="legal-notice-box">
              <h3>📜 公開測試版 (Beta) 免責聲明與隱私條款</h3>
              <ul className="legal-points-list">
                <li>
                  <strong>⚠️ 公開測試版與進度保存風險：</strong>
                  本專案目前處於公開 Beta 測試與持續改版階段。當系統升級、發布新功能或您清除瀏覽器快取時，儲存於您設備本地的學習進度（如金幣、星星、答錯記錄、兌換券）<strong>可能隨時被重置或調整</strong>。本系統不保證歷史資料的永久保存。
                </li>
                <li>
                  <strong>🔒 純本地運算與非託管隱私聲明：</strong>
                  本系統採 Local-First 純前端本地架構，<strong>伺服器端不設有使用者資料庫，亦不負責託管、備份或恢復任何個人學習記錄或隱私數據</strong>。所有數據 100% 僅儲存於您當前的瀏覽器沙盒中，更換設備或清除快取後將無法由開發者端找回。
                </li>
                <li>
                  <strong>📚 非正式教育機構與學習成效免責：</strong>
                  本系統為個人開發之自主自學輔助工具，非教育部或官方認證之正式學校機構。本系統不對任何使用者的識字速度、發音標準度、考試成績或特定學習結果提供任何形式之保證。
                </li>
                <li>
                  <strong>☕ 開源與贊助性質：</strong>
                  本專案程式碼採 MIT 授權開源發布。請作者喝咖啡（Sponsor）屬於個人自願贊助與鼓勵性質，不構成任何商業契約、付費訂閱服務或專屬客服義務。
                </li>
              </ul>
              <div className="legal-footer-note">
                <span>童軒中文恪守兒少隱私安全規範 · 感謝所有測試家長與教育工作者的理解與支持</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================
   6. 階段檢核測驗券 & 全冊大驗收互動考場 (Stage Quiz & Milestone Exam Modal)
   - 幸運開箱抽 100~200 金幣
   - 「🤙 學習打勾勾約定」3 天連續打卡獎勵翻倍機制
   ======================================================== */
function StageQuizExamModal({
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
    generateQuizPaper(targetLevel, ALL_COURSE_LEVELS)
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

/* ========================================================
   7. 我的成就與量化學習數據彈窗 (Learner Achievements Modal)
   - 累計時長、認識生字、詞彙、成語量化
   - 榮譽徽章牆 (初學啟航、妙筆生花、答題王者、全勤之星、榮譽狀元)
   ======================================================== */
function LearnerAchievementsModal({
  learner,
  onClose,
  R
}: {
  learner: ChildLearner;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const completedLevels = learner.levelsProgress?.filter((p) => p.status === "completed") || [];
  const completedCount = completedLevels.length;
  const currentLevelNum = learner.levelsProgress?.find((p) => p.status === "current")?.levelNumber || 1;
  const totalChars = completedCount * 6;
  const totalVocab = completedCount * 6;
  const totalIdioms = completedCount;
  const totalMinutes = learner.totalMinutesLearned || 0;
  const streak = learner.streakDays || 0;

  // Badges Definitions with unlock conditions
  const badges = [
    {
      id: "b1",
      icon: "🌅",
      name: "初學啟航",
      desc: "成功完成第 1 關生字練字與閱讀",
      isUnlocked: completedCount >= 1
    },
    {
      id: "b2",
      icon: "✍️",
      name: "妙筆生花",
      desc: "累計完成 5 關田字格標準筆順書寫",
      isUnlocked: completedCount >= 5
    },
    {
      id: "b3",
      icon: "📝",
      name: "闖關小達人",
      desc: "成功通過第 1 次階段檢核測驗",
      isUnlocked: completedCount >= 5
    },
    {
      id: "b4",
      icon: "🔥",
      name: "全勤之星",
      desc: "連續 3 天堅持登入並及時通關",
      isUnlocked: streak >= 3
    },
    {
      id: "b5",
      icon: "🤙",
      name: "守信少年",
      desc: "立下並圓滿達成「3 天打勾勾約定」",
      isUnlocked: learner.activePinkyPromise?.isCompleted === true || completedCount >= 10
    },
    {
      id: "b6",
      icon: "🎁",
      name: "願望成真",
      desc: "在商城成功兌換並核銷特權獎勵",
      isUnlocked: (learner.redemptions || []).some((r) => r.status === "claimed")
    },
    {
      id: "b7",
      icon: "👑",
      name: "榮譽小狀元",
      desc: "順利通關第 25 關全冊總複習大驗收",
      isUnlocked: completedCount >= 25
    }
  ];

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  return (
    <div className="modal-backdrop">
      <div className="achievements-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="關閉">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="achievements-modal-header">
          <div className="achieve-hero-badge">
            <span className="achieve-avatar">{learner.avatar}</span>
            <span className="achieve-sparkle">🏆</span>
          </div>
          <div className="achieve-header-info">
            <h2>{learner.name} · 我的榮譽成就</h2>
            <p>累積每一天的微小堅持，看見量化的飛躍成長！</p>
          </div>
        </div>

        {/* Quantitative Metrics Grid */}
        <div className="achieve-metrics-grid">
          <div className="metric-item-card">
            <span className="metric-icon">⏱️</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalMinutes}</strong>
              <span className="metric-unit">分鐘</span>
            </div>
            <span className="metric-label">累計學習時長</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🀄</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalChars}</strong>
              <span className="metric-unit">個</span>
            </div>
            <span className="metric-label">精熟掌握漢字</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">📚</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalVocab}</strong>
              <span className="metric-unit">個</span>
            </div>
            <span className="metric-label">常用生活詞彙</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">📖</span>
            <div className="metric-text-group">
              <strong className="metric-num">{totalIdioms}</strong>
              <span className="metric-unit">則</span>
            </div>
            <span className="metric-label">成語故事典故</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🎯</span>
            <div className="metric-text-group">
              <strong className="metric-num">{completedCount}</strong>
              <span className="metric-unit">/ 25 關</span>
            </div>
            <span className="metric-label">已通關主線關卡</span>
          </div>

          <div className="metric-item-card">
            <span className="metric-icon">🔥</span>
            <div className="metric-text-group">
              <strong className="metric-num">{streak}</strong>
              <span className="metric-unit">天</span>
            </div>
            <span className="metric-label">連續自律學習</span>
          </div>
        </div>

        {/* Badges Wall Section */}
        <div className="achieve-badges-section">
          <div className="badges-header-row">
            <span className="badges-title">🎖️ 榮譽徽章牆（已解鎖 {unlockedCount} / {badges.length}）</span>
          </div>

          <div className="badges-wall-grid">
            {badges.map((b) => (
              <div key={b.id} className={`badge-card-item ${b.isUnlocked ? "unlocked" : "locked"}`}>
                <div className="badge-icon-bubble">
                  {b.isUnlocked ? b.icon : "🔒"}
                </div>
                <strong className="badge-name">{b.name}</strong>
                <p className="badge-desc">{b.desc}</p>
                <span className={`badge-status-tag ${b.isUnlocked ? "unlocked" : "locked"}`}>
                  {b.isUnlocked ? "✓ 已獲得" : "待達成"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="achieve-footer-action">
          <button type="button" className="achieve-done-btn" onClick={onClose}>
            🎉 繼續加油學習！
          </button>
        </div>
      </div>
    </div>
  );
}


