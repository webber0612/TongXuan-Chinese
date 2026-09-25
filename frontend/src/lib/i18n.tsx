import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DisplayLanguage = "zh-Hant" | "zh-Hans" | "en" | "ja" | "ko" | "es";
export type LearningLocale = "zh-TW" | "zh-CN";
export type AnnotationMode = "AUTO" | "BOPOMOFO" | "PINYIN" | "HIDDEN";

export const DISPLAY_LANGUAGE_KEY = "tongxuan_display_lang";
export const LEARNING_LOCALE_KEY = "tongxuan.learning-locale";
export const ANNOTATION_MODE_KEY = "tongxuan.annotation-mode";

const messages: Record<DisplayLanguage, Record<string, string>> = {
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
    previewArchived: "這個預覽頁已封存", previewArchivedDescription: "舊版預覽已從正式入口移除。請返回今天的學習頁面。",
    practiceTitle: "一起練習中文", practiceHint: "選一個小活動開始，完成後就能看到自己的進步。", settingsTitle: "讓 App 更適合你",
    curriculumTitle: "中文學習地圖", curriculumIntro: "沿著官方教材，一課一課完成你的中文旅程。", courseZeroTitle: "聲音工具入門", courseZeroDescription: "依官方入門冊，先注音再銜接拼音與聲調，接著進入第一課。", courseZeroFullIntro: "依官方入門冊的順序，先建立注音，再用相同內容銜接漢語拼音，最後進入第一冊第一課。", courseZeroBoundary: "這是學習導覽與介面預覽，不冒充官方課文；正式內容會在來源登錄後匯入。", courseZeroPracticeTitle: "今天先練這兩件事", courseZeroListenTask: "聽一聽中文聲音", courseZeroMatchTask: "把注音和拼音配起來", backToMap: "回到學習地圖", previous: "上一個", nextStep: "下一個", startFirstLesson: "進入第一課", coursePreparing: "準備中", officialCourseTitle: "官方教材路線", officialCourseNote: "課程順序固定來自官方教材：入門冊 → 基礎冊 → 第一冊；精確課文匯入前會先完成來源與授權登錄。", pathConfirmed: "路線已確認", contentImportPending: "內容待匯入", firstLessonTitle: "第一課：你好", firstLessonIntro: "這是官方課程的第一個課文入口。完成入門冊與基礎冊後，再開始正式課文。", lessonImportPending: "課文內容尚未匯入，先保留官方來源與課程位置。", sourceRecord: "來源紀錄", openOfficialSource: "開啟官方教材頁", officialObjectivesLabel: "教師手冊目標摘要（本站改寫）", practiceTargetsLabel: "本站練習目標", objectiveSourceLabel: "教師手冊來源", sourceRecordNote: "只有完成內容來源、授權與版本登錄後，課文才會進入可練習狀態。", lessonPreparing: "課文準備中", curriculumChild: "學習者", refreshCurriculum: "更新進度", completed: "完成", inProgress: "進行中", notStarted: "未開始", asOf: "資料截至",
    privacyText: "每位孩子的學習紀錄分開保存。語言偏好只保存在這台裝置。", diagnostics: "系統狀態", scores: "學習表現", scoresHint: "分技能查看練習紀錄", familySettings: "家庭設定", languagePrivacy: "語言與隱私",
    parentConfirm: "家長確認", redeemTitle: "兌換「{name}」", parentAuth: "請家長確認兌換。密碼會安全地交由系統驗證。", parentPassword: "家長密碼", enterParentPassword: "輸入家長密碼", verifying: "驗證中…", confirmRedeem: "確認兌換", redeemSuccess: "已送出「{name}」兌換。", redeemError: "兌換失敗，請稍後再試。", guideSays: "我們一起來！",
    curriculumNoChildren: "目前尚無學習者資料。請先建立學習者，再檢視課程進度。",
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
    previewArchived: "此预览页已封存", previewArchivedDescription: "旧版预览已从正式入口移除。请返回今天的学习页面。",
    practiceTitle: "一起练习中文", practiceHint: "选一个小游戏开始，完成后就能看到自己的进步。", settingsTitle: "让 App 更适合你",
    curriculumTitle: "中文学习地图", curriculumIntro: "沿着官方教材，一课一课完成你的中文旅程。", courseZeroTitle: "声音工具入门", courseZeroDescription: "依官方入门册，先注音再衔接拼音与声调，接着进入第一课。", courseZeroFullIntro: "依官方入门册的顺序，先建立注音，再用相同内容衔接汉语拼音，最后进入第一册第一课。", courseZeroBoundary: "这是学习导览与界面预览，不冒充官方课文；正式内容会在来源登记后汇入。", courseZeroPracticeTitle: "今天先练这两件事", courseZeroListenTask: "听一听中文声音", courseZeroMatchTask: "把注音和拼音配起来", backToMap: "回到学习地图", previous: "上一个", nextStep: "下一个", startFirstLesson: "进入第一课", coursePreparing: "准备中", officialCourseTitle: "官方教材路线", officialCourseNote: "课程顺序固定来自官方教材：入门册 → 基础册 → 第一册；精确课文汇入前会先完成来源与授权登记。", pathConfirmed: "路线已确认", contentImportPending: "内容待汇入", firstLessonTitle: "第一课：你好", firstLessonIntro: "这是官方课程的第一个课文入口。完成入门册与基础册后，再开始正式课文。", lessonImportPending: "课文内容尚未汇入，先保留官方来源与课程位置。", sourceRecord: "来源记录", openOfficialSource: "打开官方教材页", officialObjectivesLabel: "教师手册目标摘要（本站改写）", practiceTargetsLabel: "本站练习目标", objectiveSourceLabel: "教师手册来源", sourceRecordNote: "只有完成内容来源、授权与版本登记后，课文才会进入可练习状态。", lessonPreparing: "课文准备中", curriculumChild: "学习者", refreshCurriculum: "更新进度", completed: "完成", inProgress: "进行中", notStarted: "未开始", asOf: "资料截至",
    privacyText: "每位孩子的学习记录分开保存。语言偏好只保存在这台设备。", diagnostics: "系统状态", scores: "学习表现", scoresHint: "分技能查看练习记录", familySettings: "家庭设置", languagePrivacy: "语言与隐私",
    parentConfirm: "家长确认", redeemTitle: "兑换“{name}”", parentAuth: "请家长确认兑换。密码会安全地交由系统验证。", parentPassword: "家长密码", enterParentPassword: "输入家长密码", verifying: "验证中…", confirmRedeem: "确认兑换", redeemSuccess: "已提交“{name}”兑换。", redeemError: "兑换失败，请稍后再试。", guideSays: "我们一起开始吧！",
    curriculumNoChildren: "目前尚无学习者资料。请先建立学习者，再查看课程进度。",
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
    previewArchived: "This preview is archived", previewArchivedDescription: "The old preview is no longer part of the app. Return to today’s learning page.",
    practiceTitle: "Let's practice Chinese", practiceHint: "Pick one short activity. You'll see your progress as you go.", settingsTitle: "Make the app yours",
    curriculumTitle: "Chinese learning map", curriculumIntro: "Follow the official course, one lesson at a time.", courseZeroTitle: "Sound Lab", courseZeroDescription: "Follow the official starter path: Zhuyin first, then the matching Pinyin bridge.", courseZeroFullIntro: "Build the sound foundation from the official starter path before entering Book 1.", courseZeroBoundary: "This is a guided preview, not official lesson text. Content enters practice only after source review.", courseZeroPracticeTitle: "Today's two small missions", courseZeroListenTask: "Listen to a Chinese sound", courseZeroMatchTask: "Match Zhuyin and Pinyin", backToMap: "Back to learning map", previous: "Previous", nextStep: "Next", startFirstLesson: "Enter lesson one", coursePreparing: "Coming next", officialCourseTitle: "Official course path", officialCourseNote: "The order stays tied to the official materials: Starter → Basic → Book 1. Exact lesson content is imported only after provenance review.", pathConfirmed: "Path confirmed", contentImportPending: "Content pending", firstLessonTitle: "Lesson 1: Hello", firstLessonIntro: "This is the official course entry point. Finish Starter and Basic before the full lesson opens.", lessonImportPending: "Lesson content is not imported yet; the official position and source stay visible.", sourceRecord: "Source record", openOfficialSource: "Open official source", officialObjectivesLabel: "Teacher handbook summary (TongXuan paraphrase)", practiceTargetsLabel: "TongXuan practice targets", objectiveSourceLabel: "Teacher handbook source", sourceRecordNote: "A lesson becomes practice-ready only after its source, licence, and version are recorded.", lessonPreparing: "Lesson preparing", curriculumChild: "Learner", refreshCurriculum: "Refresh progress", completed: "Completed", inProgress: "In progress", notStarted: "Not started", asOf: "As of",
    privacyText: "Each learner has a separate learning record. Language preferences stay on this device.", diagnostics: "System status", scores: "Learning progress", scoresHint: "Review practice by skill", familySettings: "Family settings", languagePrivacy: "Language & privacy",
    parentConfirm: "Parent confirmation", redeemTitle: "Redeem {name}", parentAuth: "Ask a parent to confirm. The password is verified securely by the app.", parentPassword: "Parent password", enterParentPassword: "Enter parent password", verifying: "Checking…", confirmRedeem: "Confirm redemption", redeemSuccess: "Redemption requested for {name}.", redeemError: "Redemption failed. Try again soon.", guideSays: "Let's learn together!",
    curriculumNoChildren: "No learners yet. Create a learner profile to view curriculum progress.",
    notationAuto: "Auto · based on learning mode", traditionalHint: "Traditional Chinese uses Zhuyin by default. Change this anytime.", simplifiedHint: "Simplified Chinese uses Pinyin by default. Change this anytime.",
  },
  ja: {
    today: "今日", practice: "練習", library: "学習マップ", parent: "保護者", settings: "設定", mySpace: "マイページ",
    hello: "こんにちは、{name}", welcome: "今日の中国語学習を始めましょう！", todayPath: "今日の学習ジャーニー", progress: "進捗",
    points: "獲得スター", start: "学習開始", hear: "発音を聞く", nextUp: "次の漢字",
    taskCount: "{count} 個の漢字を学習", noTasks: "ミッション準備中", noTasksHint: "保護者の方が新しい課題を設定します。",
    continue: "続ける", chooseLearner: "学習者を切替", addLearner: "学習者を追加", parentZone: "保護者専用",
    displayLanguage: "表示言語", learningChinese: "学習中", notation: "フリガナ補助", beginner: "初心者モード",
    traditional: "繁体字", simplified: "簡体字", english: "English", bopomofo: "注音", pinyin: "ピンイン", hide: "非表示",
    settingsIntro: "アプリの言語やフリガナ表示を設定します。", familyMembers: "家族メンバー", privacy: "プライバシー",
    parentTitle: "学習のあゆみ", parentDescription: "日々の練習履歴と今週の進捗を確認。", retry: "再試行", loading: "読み込み中…",
    rewards: "ご褒美", seeAll: "すべて見る", curriculum: "カリキュラム", tutor: "先生に質問", close: "閉じる", addTitle: "学習者の新規追加",
    nameLabel: "お子様のお名前", create: "作成", cancel: "キャンセル", namePlaceholder: "例：太郎", createError: "名前を入力してください。",
    parentRole: "保護者", childRole: "学習者", rewardEmpty: "学習を完了するとスターが貯まります。", skillNote: "各技能ごとの成長を記録します。",
    childrenError: "データの読み込みに失敗しました。", nameExists: "その名前は既に使用されています。", createFailed: "作成に失敗しました。",
    previewArchived: "このプレビューはアーカイブ済みです", previewArchivedDescription: "旧プレビューはアプリから外しました。今日の学習ページに戻ってください。",
    practiceTitle: "中国語を練習しよう", practiceHint: "好きなレッスンを選んで楽しく学びましょう。", settingsTitle: "アプリ設定",
    curriculumTitle: "学習ロードマップ", curriculumIntro: "公式教材に沿って段階的に学びます。", courseZeroTitle: "発音入門ラボ", courseZeroDescription: "注音・ピンインと声調の基礎を学びます。", courseZeroFullIntro: "公式教材の順序に沿って、発音の土台を築きます。", courseZeroBoundary: "学習プレビュー画面です。", courseZeroPracticeTitle: "今日の2つのミッション", courseZeroListenTask: "中国語の音を聞く", courseZeroMatchTask: "注音とピンインを合わせる", backToMap: "マップへ戻る", previous: "前へ", nextStep: "次へ", startFirstLesson: "第1課へ進む", coursePreparing: "準備中", officialCourseTitle: "公式カリキュラム", officialCourseNote: "入門冊 → 基礎冊 → 第1冊の体系的コースです。", pathConfirmed: "ルート確認済", contentImportPending: "教材準備中", firstLessonTitle: "第1課：こんにちは", firstLessonIntro: "公式教材の最初のレッスンです。", lessonImportPending: "レッスン準備中", sourceRecord: "出典記録", openOfficialSource: "公式ページを開く", officialObjectivesLabel: "教師用ガイドの要約（TongXuan作成）", practiceTargetsLabel: "アプリの練習目標", objectiveSourceLabel: "教師用ガイドの出典", sourceRecordNote: "ライセンスと教材登録完了後に利用可能になります。", lessonPreparing: "準備中", curriculumChild: "学習者", refreshCurriculum: "更新", completed: "修了", inProgress: "学習中", notStarted: "未着手", asOf: "データ時点",
    privacyText: "学習データはお使いの端末にのみ保存されます。", diagnostics: "システム状態", scores: "学習スコア", scoresHint: "技能別の練習実績", familySettings: "家族設定", languagePrivacy: "言語とプライバシー",
    parentConfirm: "保護者確認", redeemTitle: "「{name}」を交換", parentAuth: "保護者パスコードを入力してください。", parentPassword: "PINコード", enterParentPassword: "PINを入力", verifying: "認証中…", confirmRedeem: "交換する", redeemSuccess: "「{name}」を交換しました。", redeemError: "交換に失敗しました。", guideSays: "一緒に頑張ろう！",
    curriculumNoChildren: "学習者がまだ登録されていません。プロフィールを作成すると進捗を確認できます。",
    notationAuto: "自動（学習モード連動）", traditionalHint: "繁体字は注音を標準表示します。", simplifiedHint: "簡体字はピンインを標準表示します。",
  },
  ko: {
    today: "오늘", practice: "연습", library: "학습 지도", parent: "학부모", settings: "설정", mySpace: "내 공간",
    hello: "안녕, {name}", welcome: "오늘의 중국어 학습을 시작해볼까요?", todayPath: "오늘의 학습 여정", progress: "진도",
    points: "획득한 별", start: "학습 시작", hear: "발음 듣기", nextUp: "다음 한자",
    taskCount: "{count}개 글자 학습", noTasks: "미션 준비 중", noTasksHint: "부모님이 곧 새로운 미션을 배정합니다.",
    continue: "계속 학습", chooseLearner: "학습자 변경", addLearner: "학습자 추가", parentZone: "학부모 영역",
    displayLanguage: "표시 언어", learningChinese: "학습 중", notation: "발음 보조", beginner: "초급 모드",
    traditional: "번체자", simplified: "간체자", english: "English", bopomofo: "주음", pinyin: "병음", hide: "숨김",
    settingsIntro: "앱의 표시 언어와 중국어 표기 방식을 설정합니다.", familyMembers: "가족 구성원", privacy: "개인정보 보호",
    parentTitle: "학습 여정 보기", parentDescription: "연습 기록과 주간 진도를 확인하세요.", retry: "다시 시도", loading: "준비 중…",
    rewards: "원하는 보상", seeAll: "전체 보기", curriculum: "커리큘럼", tutor: "선생님 질문", close: "닫기", addTitle: "새 학습자 등록",
    nameLabel: "아이 이름", create: "생성", cancel: "취소", namePlaceholder: "예: 민수", createError: "이름을 입력해주세요.",
    parentRole: "학부모", childRole: "학습자", rewardEmpty: "학습을 완료하면 별이 쌓입니다.", skillNote: "각 영역별 성취도를 별도로 기록합니다.",
    childrenError: "데이터를 불러오지 못했습니다.", nameExists: "이미 사용 중인 이름입니다.", createFailed: "학습자 생성 실패.",
    previewArchived: "보관된 미리보기입니다", previewArchivedDescription: "이전 미리보기는 앱에서 분리했습니다. 오늘의 학습 페이지로 돌아가세요.",
    practiceTitle: "중국어 연습하기", practiceHint: "원하는 활동을 선택하여 즐겁게 배워보세요.", settingsTitle: "앱 맞춤 설정",
    curriculumTitle: "학습 로드맵", curriculumIntro: "공식 교재에 맞춰 단계별로 학습합니다.", courseZeroTitle: "발음 기초 랩", courseZeroDescription: "주음부호와 한어병음, 성조 기초를 다집니다.", courseZeroFullIntro: "공식 교재 순서에 따라 튼튼한 기초를 쌓습니다.", courseZeroBoundary: "학습 가이드 미리보기 화면입니다.", courseZeroPracticeTitle: "오늘의 2가지 작은 미션", courseZeroListenTask: "중국어 소리 듣기", courseZeroMatchTask: "주음과 병음 짝 맞추기", backToMap: "지도로 돌아가기", previous: "이전", nextStep: "다음", startFirstLesson: "제1과 시작", coursePreparing: "준비 중", officialCourseTitle: "공식 커리큘럼", officialCourseNote: "입문책 → 기초책 → 제1책으로 이어집니다.", pathConfirmed: "경로 확정", contentImportPending: "콘텐츠 준비 중", firstLessonTitle: "제1과: 안녕하세요", firstLessonIntro: "공식 교재의 첫 단원입니다.", lessonImportPending: "단원 준비 중", sourceRecord: "출처 기록", openOfficialSource: "공식 페이지 열기", officialObjectivesLabel: "교사용 안내서 요약(TongXuan 재작성)", practiceTargetsLabel: "앱 연습 목표", objectiveSourceLabel: "교사용 안내서 출처", sourceRecordNote: "정식 등록 후 학습이 활성화됩니다.", lessonPreparing: "준비 중", curriculumChild: "학습자", refreshCurriculum: "새로고침", completed: "완료", inProgress: "학습 중", notStarted: "미시작", asOf: "기준일",
    privacyText: "학습 기록은 기기에만 안전하게 보관됩니다.", diagnostics: "시스템 상태", scores: "학습 성취도", scoresHint: "영역별 연습 기록", familySettings: "가족 설정", languagePrivacy: "언어 및 개인정보",
    parentConfirm: "학부모 확인", redeemTitle: "‘{name}’ 교환", parentAuth: "학부모 PIN 번호를 입력하세요.", parentPassword: "PIN 번호", enterParentPassword: "PIN 입력", verifying: "확인 중…", confirmRedeem: "교환하기", redeemSuccess: "‘{name}’ 교환이 완료되었습니다.", redeemError: "교환 실패. 다시 시도해주세요.", guideSays: "함께 시작해봐요!",
    curriculumNoChildren: "등록된 학습자가 없습니다. 학습자 프로필을 만든 뒤 진도를 확인하세요.",
    notationAuto: "자동 (학습 모드 연동)", traditionalHint: "번체자는 주음부호가 기본 표시됩니다.", simplifiedHint: "간체자는 병음이 기본 표시됩니다.",
  },
  es: {
    today: "Hoy", practice: "Práctica", library: "Mapa de estudio", parent: "Padres", settings: "Ajustes", mySpace: "Mi espacio",
    hello: "Hola, {name}", welcome: "¿Listo para explorar chino hoy?", todayPath: "Ruta de aprendizaje de hoy", progress: "Progreso",
    points: "Mis estrellas", start: "Comenzar", hear: "Escuchar", nextUp: "Siguiente carácter",
    taskCount: "{count} caracteres por aprender", noTasks: "Misión en preparación", noTasksHint: "Un adulto asignará nuevas actividades pronto.",
    continue: "Continuar", chooseLearner: "Cambiar estudiante", addLearner: "Añadir estudiante", parentZone: "Área de padres",
    displayLanguage: "Idioma de interfaz", learningChinese: "Aprendiendo", notation: "Ayuda fonética", beginner: "Modo principiante",
    traditional: "Chino Tradicional", simplified: "Chino Simplificado", english: "English", bopomofo: "Zhuyin", pinyin: "Pinyin", hide: "Oculto",
    settingsIntro: "Ajusta el idioma de la aplicación y la notación de caracteres.", familyMembers: "Familia", privacy: "Privacidad",
    parentTitle: "Progreso familiar", parentDescription: "Revisa los registros de práctica y logros semanales.", retry: "Reintentar", loading: "Cargando…",
    rewards: "Mis premios", seeAll: "Ver todo", curriculum: "Plan de estudios", tutor: "Tutor", close: "Cerrar", addTitle: "Añadir nuevo estudiante",
    nameLabel: "Nombre del niño/a", create: "Crear espacio", cancel: "Cancelar", namePlaceholder: "Ej: Lucas", createError: "Introduce un nombre.",
    parentRole: "Administrador", childRole: "Estudiante", rewardEmpty: "Completa lecciones para acumular estrellas.", skillNote: "Cada habilidad se registra por separado.",
    childrenError: "No se pudieron cargar los datos.", nameExists: "Ese nombre ya existe. Elige otro.", createFailed: "Error al crear.",
    previewArchived: "Esta vista previa está archivada", previewArchivedDescription: "La vista previa anterior ya no forma parte de la app. Vuelve a la página de aprendizaje de hoy.",
    practiceTitle: "Practiquemos chino", practiceHint: "Elige una actividad corta y diviértete aprendiendo.", settingsTitle: "Ajustes de la app",
    curriculumTitle: "Mapa de aprendizaje", curriculumIntro: "Sigue los libros oficiales paso a paso.", courseZeroTitle: "Laboratorio de Sonidos", courseZeroDescription: "Aprende Zhuyin, Pinyin y tonos desde la base.", courseZeroFullIntro: "Construye una base sólida antes del Libro 1.", courseZeroBoundary: "Vista previa del curso.", courseZeroPracticeTitle: "Dos pequeñas misiones de hoy", courseZeroListenTask: "Escucha el sonido chino", courseZeroMatchTask: "Empareja Zhuyin y Pinyin", backToMap: "Volver al mapa", previous: "Anterior", nextStep: "Siguiente", startFirstLesson: "Entrar a la Lección 1", coursePreparing: "Próximamente", officialCourseTitle: "Ruta oficial", officialCourseNote: "Iniciación → Básico → Libro 1.", pathConfirmed: "Ruta confirmada", contentImportPending: "Contenido pendiente", firstLessonTitle: "Lección 1: Hola", firstLessonIntro: "Punto de partida del curso oficial.", lessonImportPending: "Lección en preparación", sourceRecord: "Registro de fuente", openOfficialSource: "Abrir fuente oficial", officialObjectivesLabel: "Resumen del manual docente (paráfrasis de TongXuan)", practiceTargetsLabel: "Objetivos de práctica de TongXuan", objectiveSourceLabel: "Fuente del manual docente", sourceRecordNote: "Disponible tras el registro de licencia.", lessonPreparing: "En preparación", curriculumChild: "Estudiante", refreshCurriculum: "Actualizar", completed: "Completado", inProgress: "En curso", notStarted: "No iniciado", asOf: "Datos a fecha de",
    privacyText: "Los registros se guardan únicamente en este dispositivo.", diagnostics: "Estado del sistema", scores: "Progreso", scoresHint: "Práctica por habilidad", familySettings: "Ajustes familiares", languagePrivacy: "Idioma y privacidad",
    parentConfirm: "Confirmación", redeemTitle: "Canjear «{name}»", parentAuth: "Introduce el código PIN de padres.", parentPassword: "Código PIN", enterParentPassword: "PIN de padres", verifying: "Verificando…", confirmRedeem: "Confirmar canje", redeemSuccess: "«{name}» canjeado con éxito.", redeemError: "Error al canjear.", guideSays: "¡Aprendamos juntos!",
    curriculumNoChildren: "Aún no hay estudiantes. Crea un perfil para consultar el progreso.",
    notationAuto: "Automático", traditionalHint: "Tradicional muestra Zhuyin por defecto.", simplifiedHint: "Simplificado muestra Pinyin por defecto.",
  }
};

function detectedLanguage(): DisplayLanguage {
  const saved = typeof localStorage !== "undefined" ? (localStorage.getItem(DISPLAY_LANGUAGE_KEY) || localStorage.getItem("tongxuan.display-language")) : null;
  if (saved && (saved === "zh-Hant" || saved === "zh-Hans" || saved === "en" || saved === "ja" || saved === "ko" || saved === "es")) {
    return saved as DisplayLanguage;
  }
  const browserLanguage = typeof navigator !== "undefined" && navigator.language ? navigator.language.toLowerCase() : "en";
  if (browserLanguage.includes("hans") || browserLanguage === "zh-cn" || browserLanguage === "zh-sg") return "zh-Hans";
  if (browserLanguage.startsWith("ja")) return "ja";
  if (browserLanguage.startsWith("ko")) return "ko";
  if (browserLanguage.startsWith("es")) return "es";
  if (browserLanguage.startsWith("zh")) return "zh-Hant";
  return "en";
}

type LocaleContextValue = {
  language: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DisplayLanguage>(detectedLanguage);

  function setLanguage(next: DisplayLanguage) {
    localStorage.setItem(DISPLAY_LANGUAGE_KEY, next);
    localStorage.setItem("tongxuan.display-language", next);
    setLanguageState(next);
  }

  useEffect(() => {
    document.documentElement.lang =
      language === "zh-Hant" ? "zh-TW" :
      language === "zh-Hans" ? "zh-CN" :
      language === "ja" ? "ja" :
      language === "ko" ? "ko" :
      language === "es" ? "es" : "en";
  }, [language]);

  const value = useMemo<LocaleContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values = {}) => {
      const msg = messages[language]?.[key] ?? messages["zh-Hant"]?.[key] ?? key;
      return Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), msg);
    }
  }), [language]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context) return context;
  const language = detectedLanguage();
  return {
    language,
    setLanguage: (next: DisplayLanguage) => {
      localStorage.setItem(DISPLAY_LANGUAGE_KEY, next);
      localStorage.setItem("tongxuan.display-language", next);
    },
    t: (key: string, values: Record<string, string | number> = {}) => {
      const msg = messages[language]?.[key] ?? messages["zh-Hant"]?.[key] ?? key;
      return Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), msg);
    },
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
