// 童軒中文 · 25關關卡制學習路徑、階段檢核測驗券與智能動態組卷引擎
// Stage-Based Progression, 5-Level Checkpoint Quizzes & Dynamic Exam Paper Generator

export type LevelType = "lesson" | "stage_quiz" | "milestone_exam";

export interface HanziCharItem {
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

export interface VocabItem {
  word: string;
  zhuyin: string;
  pinyin: string;
  meaning: string;
  icon: string;
  exampleSentence: string;
}

export interface IdiomItem {
  idiomTitle: string;
  idiomZhuyin: string;
  idiomPinyin: string;
  idiomMeaning: string;
  idiomIcon: string;
  storyContext: string;
}

export interface QuizOption {
  text: string;
  subText?: string;
  isCorrect: boolean;
}

export interface QuizQuestionItem {
  id: string;
  type: "listen-char" | "char-tone" | "img-vocab" | "cloze-sentence" | "stroke-count";
  title: string;
  prompt: string;
  audioText?: string;
  options: QuizOption[];
  explanation: string;
}

export interface CourseLevel {
  levelNumber: number;
  levelId: string;
  stageNumber: number;
  type: LevelType;
  title: string;
  themeTitle: string;
  themeSubtitle: string;
  icon: string;
  estimatedMinutes: number;
  quizScope?: number[]; // [1, 2, 3, 4, 5] for stage 1 quiz, [1..25] for milestone
  characters: HanziCharItem[];
  vocabulary: VocabItem[];
  lessonStory?: string[];
  idiom?: IdiomItem;
  quizQuestions?: QuizQuestionItem[];
}

export interface LearnerLevelProgress {
  levelNumber: number;
  status: "completed" | "current" | "locked";
  completedAt: string | null;
  starsEarned: number;
  score: number | null;
}

// 25 關標準課程進度表
export const ALL_COURSE_LEVELS: CourseLevel[] = [
  // ================= STAGE 1 (關卡 1 ~ 5) =================
  {
    levelNumber: 1,
    levelId: "lvl-1",
    stageNumber: 1,
    type: "lesson",
    title: "第 1 關 · 日月與星光",
    themeTitle: "日月星辰",
    themeSubtitle: "學會「日、月、天、明、星、光」",
    icon: "☀️",
    estimatedMinutes: 25,
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
    }
  },
  {
    levelNumber: 2,
    levelId: "lvl-2",
    stageNumber: 1,
    type: "lesson",
    title: "第 2 關 · 高山與江河",
    themeTitle: "山川江海",
    themeSubtitle: "學會「山、水、川、河、湖、海」",
    icon: "⛰️",
    estimatedMinutes: 25,
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
    }
  },
  {
    levelNumber: 3,
    levelId: "lvl-3",
    stageNumber: 1,
    type: "lesson",
    title: "第 3 關 · 森林與草木",
    themeTitle: "森林火草",
    themeSubtitle: "學會「木、林、森、火、炎、草」",
    icon: "🌲",
    estimatedMinutes: 25,
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
    }
  },
  {
    levelNumber: 4,
    levelId: "lvl-4",
    stageNumber: 1,
    type: "lesson",
    title: "第 4 關 · 人體與動作",
    themeTitle: "人體動作",
    themeSubtitle: "學會「人、大、小、手、足、口」",
    icon: "🧍",
    estimatedMinutes: 25,
    characters: [
      { char: "人", charHans: "人", zhuyin: "ㄖㄣ", zhuyinTone: "ˊ", pinyin: "rén", meaning: "人類", radical: "人", strokeCount: 2, illustrationIcon: "🧍", exampleWord: "大人", exampleSentence: "我們都是快樂的人。", strokeOrderSteps: ["丿 (撇)", "㇏ (捺)"] },
      { char: "大", charHans: "大", zhuyin: "ㄉㄚ", zhuyinTone: "ˋ", pinyin: "dà", meaning: "巨大、廣大", radical: "大", strokeCount: 3, illustrationIcon: "🐘", exampleWord: "大家", exampleSentence: "大象的耳朵很大。", strokeOrderSteps: ["一 (橫)", "丿 (撇)", "㇏ (捺)"] },
      { char: "小", charHans: "小", zhuyin: "ㄒㄧㄠ", zhuyinTone: "ˇ", pinyin: "xiǎo", meaning: "微小", radical: "小", strokeCount: 3, illustrationIcon: "🐜", exampleWord: "小鳥", exampleSentence: "小鳥在樹枝上跳躍。", strokeOrderSteps: ["亅 (豎鉤)", "丿 (左點)", "丶 (右點)"] },
      { char: "手", charHans: "手", zhuyin: "ㄕㄡ", zhuyinTone: "ˇ", pinyin: "shǒu", meaning: "雙手", radical: "手", strokeCount: 4, illustrationIcon: "✋", exampleWord: "小手", exampleSentence: "勤勞的雙手能創造美好。", strokeOrderSteps: ["丿 (短撇)", "一 (橫)", "一 (長橫)", "亅 (豎鉤)"] },
      { char: "足", charHans: "足", zhuyin: "ㄗㄨ", zhuyinTone: "ˊ", pinyin: "zú", meaning: "腳、充足", radical: "足", strokeCount: 7, illustrationIcon: "🦶", exampleWord: "足球", exampleSentence: "我們在草地上踢足球。", strokeOrderSteps: ["口 (上方)", "丨 (豎)", "一 (橫)", "丿 (撇)", "㇏ (捺)"] },
      { char: "口", charHans: "口", zhuyin: "ㄎㄡ", zhuyinTone: "ˇ", pinyin: "kǒu", meaning: "嘴巴", radical: "口", strokeCount: 3, illustrationIcon: "👄", exampleWord: "開口", exampleSentence: "張開口，大聲朗讀課文。", strokeOrderSteps: ["丨 (左豎)", "𠃍 (橫折)", "一 (橫閉口)"] }
    ],
    vocabulary: [
      { word: "大人", zhuyin: "ㄉㄚˋ ㄖㄣˊ", pinyin: "dà rén", meaning: "成年人", icon: "👨", exampleSentence: "大人牽著小朋友的手過馬路。" },
      { word: "小鳥", zhuyin: "ㄒㄧㄠˇ ㄋㄧㄠˇ", pinyin: "xiǎo niǎo", meaning: "體型小巧的飛鳥", icon: "🐦", exampleSentence: "可愛的小鳥在唱歌。" },
      { word: "雙手", zhuyin: "ㄕㄨㄤ ㄕㄡˇ", pinyin: "shuāng shǒu", meaning: "人的兩隻手", icon: "👐", exampleSentence: "飯前要用肥皂洗乾淨雙手。" },
      { word: "足球", zhuyin: "ㄗㄨˊ ㄑㄧㄡˊ", pinyin: "zú qiú", meaning: "用腳踢的球類運動", icon: "⚽", exampleSentence: "操場上大家正在踢足球。" },
      { word: "開口", zhuyin: "ㄎㄞ ㄎㄡˇ", pinyin: "kāi kǒu", meaning: "張開嘴巴說話或唱歌", icon: "🗣️", exampleSentence: "大家開口齊聲朗讀美麗的詩篇。" },
      { word: "大家", zhuyin: "ㄉㄚˋ ㄐㄧㄚ", pinyin: "dà jiā", meaning: "所有人、眾人", icon: "👨‍👩‍👧‍👦", exampleSentence: "大家開心地一起學習中文。" }
    ],
    lessonStory: [
      "人有兩隻手，還有兩隻腳，用手寫字，用腳跑步。",
      "張開口，我們大聲讀書，大人小孩一起快樂學習。",
      "從小做個勤勞愛運動的好孩子。"
    ],
    idiom: {
      idiomTitle: "手足情深",
      idiomZhuyin: "ㄕㄡˇ ㄗㄨˊ ㄑㄧㄥˊ ㄕㄣ",
      idiomPinyin: "shǒu zú qíng shēn",
      idiomMeaning: "比喻兄弟姐妹之間感情非常深厚融洽",
      idiomIcon: "🤝",
      storyContext: "古人將兄弟比作人身上的手與足，彼此相連、互相關心相愛。"
    }
  },
  // 📝 第 5 關：第 1 階段檢核測驗券（涵蓋第 1~5 關生字）
  {
    levelNumber: 5,
    levelId: "lvl-5",
    stageNumber: 1,
    type: "stage_quiz",
    title: "第 5 關 · 第 1 階段檢核測驗券 📝",
    themeTitle: "第 1 階段檢定驗收",
    themeSubtitle: "涵蓋第 1~4 關「日月星辰、山川江海、森林草木、人體動作」共 24 生字",
    icon: "📜",
    estimatedMinutes: 20,
    quizScope: [1, 2, 3, 4],
    characters: [],
    vocabulary: []
  },

  // ================= STAGE 2 (關卡 6 ~ 10) =================
  {
    levelNumber: 6,
    levelId: "lvl-6",
    stageNumber: 2,
    type: "lesson",
    title: "第 6 關 · 數字的天地",
    themeTitle: "數字天地",
    themeSubtitle: "學會「一、二、三、四、五、六、七、八、九、十」",
    icon: "🔢",
    estimatedMinutes: 25,
    characters: [
      { char: "一", charHans: "一", zhuyin: "ㄧ", zhuyinTone: "", pinyin: "yī", meaning: "數字一", radical: "一", strokeCount: 1, illustrationIcon: "1️⃣", exampleWord: "一個", exampleSentence: "樹上有一個紅蘋果。", strokeOrderSteps: ["一 (橫)"] },
      { char: "二", charHans: "二", zhuyin: "ㄦ", zhuyinTone: "ˋ", pinyin: "èr", meaning: "數字二", radical: "二", strokeCount: 2, illustrationIcon: "2️⃣", exampleWord: "二月", exampleSentence: "兩隻小鴨水中游。", strokeOrderSteps: ["一 (上橫)", "一 (下橫)"] },
      { char: "三", charHans: "三", zhuyin: "ㄙㄢ", zhuyinTone: "", pinyin: "sān", meaning: "數字三", radical: "一", strokeCount: 3, illustrationIcon: "3️⃣", exampleWord: "三天", exampleSentence: "天空飛過三隻鳥。", strokeOrderSteps: ["一 (上橫)", "一 (中橫)", "一 (下橫)"] },
      { char: "五", charHans: "五", zhuyin: "ㄨ", zhuyinTone: "ˇ", pinyin: "wǔ", meaning: "數字五", radical: "二", strokeCount: 4, illustrationIcon: "5️⃣", exampleWord: "五個", exampleSentence: "一隻手有五根手指。", strokeOrderSteps: ["一 (橫)", "丨 (豎)", "𠃍 (橫折)", "一 (橫)"] },
      { char: "八", charHans: "八", zhuyin: "ㄅㄚ", zhuyinTone: "", pinyin: "bā", meaning: "數字八", radical: "八", strokeCount: 2, illustrationIcon: "8️⃣", exampleWord: "八月", exampleSentence: "八月十五月兒圓。", strokeOrderSteps: ["丿 (撇)", "㇏ (捺)"] },
      { char: "十", charHans: "十", zhuyin: "ㄕ", zhuyinTone: "ˊ", pinyin: "shí", meaning: "數字十", radical: "十", strokeCount: 2, illustrationIcon: "🔟", exampleWord: "十分", exampleSentence: "雙手一共有十根手指頭。", strokeOrderSteps: ["一 (橫)", "丨 (豎)"] }
    ],
    vocabulary: [
      { word: "一個", zhuyin: "ㄧ ㄍㄜ˙", pinyin: "yí ge", meaning: "數量一", icon: "🍎", exampleSentence: "桌上有一個大蘋果。" },
      { word: "三月", zhuyin: "ㄙㄢ ㄩㄝˋ", pinyin: "sān yuè", meaning: "陽曆或農曆第三個月", icon: "📅", exampleSentence: "三月春天花兒開。" },
      { word: "五月", zhuyin: "ㄨˇ ㄩㄝˋ", pinyin: "wǔ yuè", meaning: "第五個月份", icon: "🎏", exampleSentence: "五月天氣漸漸溫暖了。" },
      { word: "十分", zhuyin: "ㄕˊ ㄈㄣ", pinyin: "shí fēn", meaning: "非常、很", icon: "💯", exampleSentence: "今天的課文十分有趣。" }
    ]
  },
  {
    levelNumber: 7,
    levelId: "lvl-7",
    stageNumber: 2,
    type: "lesson",
    title: "第 7 關 · 方位與空間",
    themeTitle: "方位空間",
    themeSubtitle: "學會「上、下、左、右、前、後」",
    icon: "🧭",
    estimatedMinutes: 25,
    characters: [
      { char: "上", charHans: "上", zhuyin: "ㄕㄤ", zhuyinTone: "ˋ", pinyin: "shàng", meaning: "上方", radical: "一", strokeCount: 3, illustrationIcon: "⬆️", exampleWord: "上面", exampleSentence: "太陽升到山頂上。", strokeOrderSteps: ["丨 (豎)", "一 (短橫)", "一 (長橫)"] },
      { char: "下", charHans: "下", zhuyin: "ㄒㄧㄚ", zhuyinTone: "ˋ", pinyin: "xià", meaning: "下方", radical: "一", strokeCount: 3, illustrationIcon: "⬇️", exampleWord: "下面", exampleSentence: "大樹下有一隻小花貓。", strokeOrderSteps: ["一 (橫)", "丨 (豎)", "丶 (點)"] },
      { char: "左", charHans: "左", zhuyin: "ㄗㄨㄛ", zhuyinTone: "ˇ", pinyin: "zuǒ", meaning: "左邊", radical: "工", strokeCount: 5, illustrationIcon: "⬅️", exampleWord: "左手", exampleSentence: "舉起你的左手。", strokeOrderSteps: ["一 (橫)", "丿 (撇)", "工 (下部)"] },
      { char: "右", charHans: "右", zhuyin: "ㄧㄡ", zhuyinTone: "ˋ", pinyin: "yòu", meaning: "右邊", radical: "口", strokeCount: 5, illustrationIcon: "➡️", exampleWord: "右手", exampleSentence: "我用右手拿鉛筆寫字。", strokeOrderSteps: ["一 (橫)", "丿 (撇)", "口 (下部)"] },
      { char: "前", charHans: "前", zhuyin: "ㄑㄧㄢ", zhuyinTone: "ˊ", pinyin: "qián", meaning: "前方", radical: "刀", strokeCount: 9, illustrationIcon: "⏩", exampleWord: "向前", exampleSentence: "大家勇敢向前走。", strokeOrderSteps: ["丷 (上)", "一 (橫)", "月 (左下)", "刂 (右下)"] },
      { char: "後", charHans: "后", zhuyin: "ㄏㄡ", zhuyinTone: "ˋ", pinyin: "hòu", meaning: "後面", radical: "彳", strokeCount: 9, illustrationIcon: "⏪", exampleWord: "後面", exampleSentence: "小狗跟在我的後面。", strokeOrderSteps: ["彳 (雙人旁)", "幺 (右上)", "夂 (右下)"] }
    ],
    vocabulary: [
      { word: "上面", zhuyin: "ㄕㄤˋ ㄇㄧㄢˋ", pinyin: "shàng miàn", meaning: "頂部、上方位置", icon: "⬆️", exampleSentence: "書本放在桌子上面。" },
      { word: "下面", zhuyin: "ㄒㄧㄚˋ ㄇㄧㄢˋ", pinyin: "xià miàn", meaning: "底部、下方位置", icon: "⬇️", exampleSentence: "小魚在水面下面游。" },
      { word: "向前", zhuyin: "ㄒㄧㄤˋ ㄑㄧㄢˊ", pinyin: "xiàng qián", meaning: "往前方行進", icon: "🚶", exampleSentence: "學華語，我們一起向前走！" }
    ]
  },
  {
    levelNumber: 8,
    levelId: "lvl-8",
    stageNumber: 2,
    type: "lesson",
    title: "第 8 關 · 四季與風雨",
    themeTitle: "四季風雨",
    themeSubtitle: "學會「春、夏、秋、冬、風、雨」",
    icon: "🌸",
    estimatedMinutes: 25,
    characters: [
      { char: "春", charHans: "春", zhuyin: "ㄔㄨㄣ", zhuyinTone: "", pinyin: "chūn", meaning: "春天", radical: "日", strokeCount: 9, illustrationIcon: "🌸", exampleWord: "春天", exampleSentence: "春天到了，百花盛開。", strokeOrderSteps: ["三 (上部)", "人 (中撇捺)", "日 (下部)"] },
      { char: "夏", charHans: "夏", zhuyin: "ㄒㄧㄚ", zhuyinTone: "ˋ", pinyin: "xià", meaning: "夏天", radical: "夂", strokeCount: 10, illustrationIcon: "🍉", exampleWord: "夏天", exampleSentence: "夏天的西瓜甜又多汁。", strokeOrderSteps: ["一 (橫)", "自 (中)", "夂 (下)"] },
      { char: "秋", charHans: "秋", zhuyin: "ㄑㄧㄡ", zhuyinTone: "", pinyin: "qiū", meaning: "秋天", radical: "禾", strokeCount: 9, illustrationIcon: "🍁", exampleWord: "秋天", exampleSentence: "秋天的楓葉變紅了。", strokeOrderSteps: ["禾 (左禾木)", "火 (右火)"] },
      { char: "冬", charHans: "冬", zhuyin: "ㄉㄨㄥ", zhuyinTone: "", pinyin: "dōng", meaning: "冬天", radical: "冫", strokeCount: 5, illustrationIcon: "❄️", exampleWord: "冬天", exampleSentence: "冬天下起美麗的白雪。", strokeOrderSteps: ["夂 (上)", "冫 (下兩點)"] },
      { char: "風", charHans: "风", zhuyin: "ㄈㄥ", zhuyinTone: "", pinyin: "fēng", meaning: "微風、大風", radical: "風", strokeCount: 9, illustrationIcon: "🍃", exampleWord: "微風", exampleSentence: "春風吹綠了大地。", strokeOrderSteps: ["几 (外框)", "丿 (撇)", "丶 (點)", "虫 (內部)"] },
      { char: "雨", charHans: "雨", zhuyin: "ㄩ", zhuyinTone: "ˇ", pinyin: "yǔ", meaning: "雨水", radical: "雨", strokeCount: 8, illustrationIcon: "🌧️", exampleWord: "雨水", exampleSentence: "細細的春雨潤大地。", strokeOrderSteps: ["一 (橫)", "冂 (框)", "丨 (豎)", "四點 (雨滴)"] }
    ],
    vocabulary: [
      { word: "春天", zhuyin: "ㄔㄨㄣ ㄊㄧㄢ", pinyin: "chūn tiān", meaning: "四季的第一季", icon: "🌸", exampleSentence: "春天是萬物復甦的季節。" },
      { word: "秋天", zhuyin: "ㄑㄧㄡ ㄊㄧㄢ", pinyin: "qiū tiān", meaning: "收穫的金秋季節", icon: "🍁", exampleSentence: "秋天樹葉飄落，大地金黃。" },
      { word: "微風", zhuyin: "ㄨㄟˊ ㄈㄥ", pinyin: "wēi fēng", meaning: "輕柔溫和的風", icon: "🍃", exampleSentence: "微風吹過，讓人感覺十分舒服。" }
    ]
  },
  {
    levelNumber: 9,
    levelId: "lvl-9",
    stageNumber: 2,
    type: "lesson",
    title: "第 9 關 · 可愛動物王國",
    themeTitle: "動物生肖",
    themeSubtitle: "學會「鳥、魚、馬、牛、羊、犬」",
    icon: "🐴",
    estimatedMinutes: 25,
    characters: [
      { char: "鳥", charHans: "鸟", zhuyin: "ㄋㄧㄠ", zhuyinTone: "ˇ", pinyin: "niǎo", meaning: "飛鳥", radical: "鳥", strokeCount: 11, illustrationIcon: "🐦", exampleWord: "小鳥", exampleSentence: "小鳥在枝頭快樂唱歌。", strokeOrderSteps: ["丿 (撇)", "𠃌 (橫折鉤)", "丶 (點)", "一 (橫)", "灬 (四點底)"] },
      { char: "魚", charHans: "鱼", zhuyin: "ㄩ", zhuyinTone: "ˊ", pinyin: "yú", meaning: "游魚", radical: "魚", strokeCount: 11, illustrationIcon: "🐟", exampleWord: "小魚", exampleSentence: "小魚在清澈的溪水裡游。", strokeOrderSteps: ["⺈ (頭)", "田 (身)", "灬 (尾四點)"] },
      { char: "馬", charHans: "马", zhuyin: "ㄇㄚ", zhuyinTone: "ˇ", pinyin: "mǎ", meaning: "駿馬", radical: "馬", strokeCount: 10, illustrationIcon: "🐴", exampleWord: "大馬", exampleSentence: "駿馬在草原上奔跑。", strokeOrderSteps: ["丨 (豎)", "𠃍 (橫折)", "三橫 (鬃毛)", "灬 (四蹄)"] },
      { char: "牛", charHans: "牛", zhuyin: "ㄋㄧㄡ", zhuyinTone: "ˊ", pinyin: "niú", meaning: "黃牛、水牛", radical: "牛", strokeCount: 4, illustrationIcon: "🐂", exampleWord: "黃牛", exampleSentence: "勤勞的老牛在田裡耕作。", strokeOrderSteps: ["丿 (撇)", "一 (短橫)", "一 (長橫)", "丨 (豎)"] },
      { char: "羊", charHans: "羊", zhuyin: "ㄧㄤ", zhuyinTone: "ˊ", pinyin: "yáng", meaning: "綿羊、山羊", radical: "羊", strokeCount: 6, illustrationIcon: "🐑", exampleWord: "綿羊", exampleSentence: "可愛的小綿羊全身白毛。", strokeOrderSteps: ["丷 (雙角)", "三 (三橫)", "丨 (中豎)"] }
    ],
    vocabulary: [
      { word: "小鳥", zhuyin: "ㄒㄧㄠˇ ㄋㄧㄠˇ", pinyin: "xiǎo niǎo", meaning: "飛鳥", icon: "🐦", exampleSentence: "清晨小鳥在窗外唱歌。" },
      { word: "白羊", zhuyin: "ㄅㄞˊ ㄧㄤˊ", pinyin: "bái yáng", meaning: "白色的羊群", icon: "🐑", exampleSentence: "藍天下有一群可愛的白羊。" }
    ]
  },
  // 📝 第 10 關：第 2 階段檢核測驗券（涵蓋第 6~10 關生字）
  {
    levelNumber: 10,
    levelId: "lvl-10",
    stageNumber: 2,
    type: "stage_quiz",
    title: "第 10 關 · 第 2 階段檢核測驗券 📝",
    themeTitle: "第 2 階段檢定驗收",
    themeSubtitle: "涵蓋第 6~9 關「數字天地、方位空間、四季風雨、動物生肖」核心生字與詞彙",
    icon: "📜",
    estimatedMinutes: 20,
    quizScope: [6, 7, 8, 9],
    characters: [],
    vocabulary: []
  },

  // ================= STAGE 3 (關卡 11 ~ 15) =================
  {
    levelNumber: 11,
    levelId: "lvl-11",
    stageNumber: 3,
    type: "lesson",
    title: "第 11 關 · 溫馨的家庭親情",
    themeTitle: "家庭親情",
    themeSubtitle: "學會「爸、媽、哥、弟、姐、妹」",
    icon: "👨‍👩‍👧‍👦",
    estimatedMinutes: 25,
    characters: [
      { char: "爸", charHans: "爸", zhuyin: "ㄅㄚ", zhuyinTone: "ˋ", pinyin: "bà", meaning: "爸爸", radical: "父", strokeCount: 8, illustrationIcon: "👨", exampleWord: "爸爸", exampleSentence: "爸爸每天辛苦工作。", strokeOrderSteps: ["父 (上部)", "巴 (下部)"] },
      { char: "媽", charHans: "妈", zhuyin: "ㄇㄚ", zhuyinTone: "", pinyin: "mā", meaning: "媽媽", radical: "女", strokeCount: 13, illustrationIcon: "👩", exampleWord: "媽媽", exampleSentence: "媽媽的笑容最溫柔。", strokeOrderSteps: ["女 (左旁)", "馬 (右部)"] },
      { char: "哥", charHans: "哥", zhuyin: "ㄍㄜ", zhuyinTone: "", pinyin: "gē", meaning: "哥哥", radical: "口", strokeCount: 10, illustrationIcon: "👦", exampleWord: "哥哥", exampleSentence: "哥哥教我騎腳踏車。", strokeOrderSteps: ["可 (上部)", "可 (下部)"] },
      { char: "弟", charHans: "弟", zhuyin: "ㄉㄧ", zhuyinTone: "ˋ", pinyin: "dì", meaning: "弟弟", radical: "弓", strokeCount: 7, illustrationIcon: "👶", exampleWord: "弟弟", exampleSentence: "弟弟長得真可愛。", strokeOrderSteps: ["丷 (上角)", "弓 (中)", "丨 (豎)", "丿 (撇)"] },
      { char: "姐", charHans: "姐", zhuyin: "ㄐㄧㄝ", zhuyinTone: "ˇ", pinyin: "jiě", meaning: "姐姐", radical: "女", strokeCount: 8, illustrationIcon: "👧", exampleWord: "姐姐", exampleSentence: "姐姐在書房認真畫畫。", strokeOrderSteps: ["女 (左)", "且 (右)"] },
      { char: "妹", charHans: "妹", zhuyin: "ㄇㄟ", zhuyinTone: "ˋ", pinyin: "mèi", meaning: "妹妹", radical: "女", strokeCount: 8, illustrationIcon: "👧", exampleWord: "妹妹", exampleSentence: "小妹妹愛笑又懂事。", strokeOrderSteps: ["女 (左)", "未 (右)"] }
    ],
    vocabulary: [
      { word: "爸爸", zhuyin: "ㄅㄚˋ ㄅㄚ˙", pinyin: "bà ba", meaning: "父親", icon: "👨", exampleSentence: "我愛爸爸媽媽。" },
      { word: "媽媽", zhuyin: "ㄇㄚ ㄇㄚ˙", pinyin: "mā ma", meaning: "母親", icon: "👩", exampleSentence: "媽媽做的菜最好吃。" }
    ]
  },
  {
    levelNumber: 12,
    levelId: "lvl-12",
    stageNumber: 3,
    type: "lesson",
    title: "第 12 關 · 繽紛的色彩世界",
    themeTitle: "繽紛色彩",
    themeSubtitle: "學會「紅、黃、藍、綠、白、黑」",
    icon: "🎨",
    estimatedMinutes: 25,
    characters: [
      { char: "紅", charHans: "红", zhuyin: "ㄏㄨㄥ", zhuyinTone: "ˊ", pinyin: "hóng", meaning: "紅色", radical: "糸", strokeCount: 9, illustrationIcon: "🔴", exampleWord: "紅色", exampleSentence: "紅蘋果香又甜。", strokeOrderSteps: ["糹 (絞絲旁)", "工 (右)"] },
      { char: "黃", charHans: "黄", zhuyin: "ㄏㄨㄤ", zhuyinTone: "ˊ", pinyin: "huáng", meaning: "黃色", radical: "黃", strokeCount: 12, illustrationIcon: "🟡", exampleWord: "黃色", exampleSentence: "黃色的小鴨游水中。", strokeOrderSteps: ["廿 (上)", "一 (橫)", "田 (中)", "八 (下)"] },
      { char: "藍", charHans: "蓝", zhuyin: "ㄌㄢ", zhuyinTone: "ˊ", pinyin: "lán", meaning: "藍色", radical: "艸", strokeCount: 18, illustrationIcon: "🔵", exampleWord: "藍天", exampleSentence: "藍天白雲真美麗。", strokeOrderSteps: ["艹 (草頭)", "監 (下部)"] },
      { char: "綠", charHans: "绿", zhuyin: "ㄌㄩ", zhuyinTone: "ˋ", pinyin: "lǜ", meaning: "綠色", radical: "糸", strokeCount: 14, illustrationIcon: "🟢", exampleWord: "綠草", exampleSentence: "春天大地一片翠綠。", strokeOrderSteps: ["糹 (絞絲)", "彖 (右)"] },
      { char: "白", charHans: "白", zhuyin: "ㄅㄞ", zhuyinTone: "ˊ", pinyin: "bái", meaning: "白色", radical: "白", strokeCount: 5, illustrationIcon: "⚪", exampleWord: "白雲", exampleSentence: "天空中飄著朵朵白雲。", strokeOrderSteps: ["丿 (短撇)", "日 (主體)"] },
      { char: "黑", charHans: "黑", zhuyin: "ㄏㄟ", zhuyinTone: "", pinyin: "hēi", meaning: "黑色", radical: "黑", strokeCount: 12, illustrationIcon: "⚫", exampleWord: "黑夜", exampleSentence: "黑夜裡星星特別明亮。", strokeOrderSteps: ["里 (上部)", "灬 (四點底)"] }
    ],
    vocabulary: [
      { word: "紅色", zhuyin: "ㄏㄨㄥˊ ㄙㄜˋ", pinyin: "hóng sè", meaning: "像鮮血或成熟番茄的顏色", icon: "🔴", exampleSentence: "妹妹穿著漂亮的紅色洋裝。" },
      { word: "藍天", zhuyin: "ㄌㄢˊ ㄊㄧㄢ", pinyin: "lán tiān", meaning: "蔚藍的天空", icon: "🌤️", exampleSentence: "藍天上有白色小鳥飛翔。" }
    ]
  },
  {
    levelNumber: 13,
    levelId: "lvl-13",
    stageNumber: 3,
    type: "lesson",
    title: "第 13 關 · 我們的日常生活",
    themeTitle: "日常動作",
    themeSubtitle: "學會「吃、喝、跑、跳、看、聽」",
    icon: "🏃",
    estimatedMinutes: 25,
    characters: [
      { char: "吃", charHans: "吃", zhuyin: "ㄔ", zhuyinTone: "", pinyin: "chī", meaning: "進食", radical: "口", strokeCount: 6, illustrationIcon: "🥣", exampleWord: "吃飯", exampleSentence: "我們按時吃飯長高高。", strokeOrderSteps: ["口 (左)", "乞 (右)"] },
      { char: "喝", charHans: "喝", zhuyin: "ㄏㄜ", zhuyinTone: "", pinyin: "hē", meaning: "飲用", radical: "口", strokeCount: 12, illustrationIcon: "🥤", exampleWord: "喝水", exampleSentence: "運動後要多喝水。", strokeOrderSteps: ["口 (左)", "曷 (右)"] },
      { char: "看", charHans: "看", zhuyin: "ㄎㄢ", zhuyinTone: "ˋ", pinyin: "kàn", meaning: "觀看、閱讀", radical: "目", strokeCount: 9, illustrationIcon: "👀", exampleWord: "看書", exampleSentence: "大家安靜在圖書館看書。", strokeOrderSteps: ["手 (上把手)", "目 (下眼)"] },
      { char: "聽", charHans: "听", zhuyin: "ㄊㄧㄥ", zhuyinTone: "", pinyin: "tīng", meaning: "聆聽", radical: "耳", strokeCount: 22, illustrationIcon: "👂", exampleWord: "聽話", exampleSentence: "專心聽老師說故事。", strokeOrderSteps: ["耳 (左)", "王 (右上)", "十 (中)", "心 (右下)"] }
    ],
    vocabulary: [
      { word: "吃飯", zhuyin: "ㄔ ㄈㄢˋ", pinyin: "chī fàn", meaning: "食用正餐", icon: "🍚", exampleSentence: "全家人開心地一起吃飯。" },
      { word: "看書", zhuyin: "ㄎㄢˋ ㄕㄨ", pinyin: "kàn shū", meaning: "閱讀書籍", icon: "📖", exampleSentence: "養成每天看書的好習慣。" }
    ]
  },
  {
    levelNumber: 14,
    levelId: "lvl-14",
    stageNumber: 3,
    type: "lesson",
    title: "第 14 關 · 校園與學習用品",
    themeTitle: "校園學習",
    themeSubtitle: "學會「書、筆、紙、學、校、友」",
    icon: "📚",
    estimatedMinutes: 25,
    characters: [
      { char: "書", charHans: "书", zhuyin: "ㄕㄨ", zhuyinTone: "", pinyin: "shū", meaning: "書籍", radical: "曰", strokeCount: 10, illustrationIcon: "📖", exampleWord: "讀書", exampleSentence: "書本裡有許多智慧。", strokeOrderSteps: ["聿 (上筆)", "曰 (下底)"] },
      { char: "筆", charHans: "笔", zhuyin: "ㄅㄧ", zhuyinTone: "ˇ", pinyin: "bǐ", meaning: "毛筆、鉛筆", radical: "竹", strokeCount: 12, illustrationIcon: "✏️", exampleWord: "鉛筆", exampleSentence: "我用鉛筆端正寫字。", strokeOrderSteps: ["⺮ (竹字頭)", "聿 (下部)"] },
      { char: "學", charHans: "学", zhuyin: "ㄒㄩㄝ", zhuyinTone: "ˊ", pinyin: "xué", meaning: "學習", radical: "子", strokeCount: 16, illustrationIcon: "🎓", exampleWord: "學習", exampleSentence: "我們快樂學習中文。", strokeOrderSteps: ["⺍ (頂部)", "冖 (禿寶蓋)", "子 (底)"] },
      { char: "校", charHans: "校", zhuyin: "ㄒㄧㄠ", zhuyinTone: "ˋ", pinyin: "xiào", meaning: "學校", radical: "木", strokeCount: 10, illustrationIcon: "🏫", exampleWord: "學校", exampleSentence: "學校裡有許多好朋友。", strokeOrderSteps: ["木 (左)", "交 (右)"] }
    ],
    vocabulary: [
      { word: "學校", zhuyin: "ㄒㄩㄝˊ ㄒㄧㄠˋ", pinyin: "xué xiào", meaning: "學習的地方", icon: "🏫", exampleSentence: "我每天開開心心上學校。" },
      { word: "鉛筆", zhuyin: "ㄑㄧㄢ ㄅㄧˇ", pinyin: "qiān bǐ", meaning: "書寫工具", icon: "✏️", exampleSentence: "鉛筆盒裡裝滿彩色鉛筆。" }
    ]
  },
  // 📝 第 15 關：第 3 階段檢核測驗券（涵蓋第 11~15 關生字）
  {
    levelNumber: 15,
    levelId: "lvl-15",
    stageNumber: 3,
    type: "stage_quiz",
    title: "第 15 關 · 第 3 階段檢核測驗券 📝",
    themeTitle: "第 3 階段檢定驗收",
    themeSubtitle: "涵蓋第 11~14 關「家庭親情、繽紛色彩、日常動作、校園學習」核心生字與詞彙",
    icon: "📜",
    estimatedMinutes: 20,
    quizScope: [11, 12, 13, 14],
    characters: [],
    vocabulary: []
  },

  // ================= STAGE 4 (關卡 16 ~ 20) =================
  {
    levelNumber: 16,
    levelId: "lvl-16",
    stageNumber: 4,
    type: "lesson",
    title: "第 16 關 · 東西南北與國度",
    themeTitle: "地理國度",
    themeSubtitle: "學會「東、西、南、北、中、國」",
    icon: "🌏",
    estimatedMinutes: 25,
    characters: [
      { char: "東", charHans: "东", zhuyin: "ㄉㄨㄥ", zhuyinTone: "", pinyin: "dōng", meaning: "東方", radical: "木", strokeCount: 8, illustrationIcon: "🌅", exampleWord: "東方", exampleSentence: "太陽從東方升起。", strokeOrderSteps: ["一 (橫)", "日 (中)", "木 (底)"] },
      { char: "西", charHans: "西", zhuyin: "ㄒㄧ", zhuyinTone: "", pinyin: "xī", meaning: "西方", radical: "襾", strokeCount: 6, illustrationIcon: "🌇", exampleWord: "西方", exampleSentence: "傍晚夕陽落向西方。", strokeOrderSteps: ["一 (橫)", "冂 (框)", "人 (中)"] },
      { char: "南", charHans: "南", zhuyin: "ㄋㄢ", zhuyinTone: "ˊ", pinyin: "nán", meaning: "南方", radical: "十", strokeCount: 9, illustrationIcon: "🏝️", exampleWord: "南方", exampleSentence: "冬天候鳥飛向溫暖的南方。", strokeOrderSteps: ["十 (上)", "冂 (框)", "羊 (內)"] },
      { char: "北", charHans: "北", zhuyin: "ㄅㄟ", zhuyinTone: "ˇ", pinyin: "běi", meaning: "北方", radical: "匕", strokeCount: 5, illustrationIcon: "❄️", exampleWord: "北方", exampleSentence: "北方的冬天會下大雪。", strokeOrderSteps: ["丨 (豎)", "一 (短橫)", "丿 (短撇)", "匕 (右)"] },
      { char: "中", charHans: "中", zhuyin: "ㄓㄨㄥ", zhuyinTone: "", pinyin: "zhōng", meaning: "中間、中心", radical: "丨", strokeCount: 4, illustrationIcon: "🎯", exampleWord: "中文", exampleSentence: "我們一起學好中文。", strokeOrderSteps: ["口 (框)", "丨 (貫穿豎)"] },
      { char: "國", charHans: "国", zhuyin: "ㄍㄨㄛ", zhuyinTone: "ˊ", pinyin: "guó", meaning: "國家", radical: "囗", strokeCount: 11, illustrationIcon: "🗺️", exampleWord: "國家", exampleSentence: "我們熱愛美麗的家園。", strokeOrderSteps: ["囗 (大口框)", "或 (內部)", "一 (封底)"] }
    ],
    vocabulary: [
      { word: "中文", zhuyin: "ㄓㄨㄥ ㄨㄣˊ", pinyin: "zhōng wén", meaning: "漢語華文", icon: "🀄", exampleSentence: "我喜歡學中文。" },
      { word: "東方", zhuyin: "ㄉㄨㄥ ㄈㄤ", pinyin: "dōng fāng", meaning: "太陽升起的方位", icon: "🌅", exampleSentence: "東方的朝霞非常燦爛。" }
    ]
  },
  {
    levelNumber: 17,
    levelId: "lvl-17",
    stageNumber: 4,
    type: "lesson",
    title: "第 17 關 · 時間的腳步",
    themeTitle: "時間流轉",
    themeSubtitle: "學會「早、午、晚、昨、今、明」",
    icon: "⏰",
    estimatedMinutes: 25,
    characters: [
      { char: "早", charHans: "早", zhuyin: "ㄗㄠ", zhuyinTone: "ˇ", pinyin: "zǎo", meaning: "早晨", radical: "日", strokeCount: 6, illustrationIcon: "🌅", exampleWord: "早安", exampleSentence: "大家見面說一聲早安。", strokeOrderSteps: ["日 (上)", "十 (下)"] },
      { char: "午", charHans: "午", zhuyin: "ㄨ", zhuyinTone: "ˇ", pinyin: "wǔ", meaning: "正午", radical: "十", strokeCount: 4, illustrationIcon: "🕛", exampleWord: "中午", exampleSentence: "中午陽光照頭頂。", strokeOrderSteps: ["丿 (撇)", "一 (橫)", "一 (橫)", "丨 (豎)"] },
      { char: "晚", charHans: "晚", zhuyin: "ㄨㄢ", zhuyinTone: "ˇ", pinyin: "wǎn", meaning: "夜晚", radical: "日", strokeCount: 11, illustrationIcon: "🌃", exampleWord: "晚上", exampleSentence: "晚上早點睡覺精神好。", strokeOrderSteps: ["日 (左)", "免 (右)"] },
      { char: "今", charHans: "今", zhuyin: "ㄐㄧㄣ", zhuyinTone: "", pinyin: "jīn", meaning: "現在、今日", radical: "人", strokeCount: 4, illustrationIcon: "📅", exampleWord: "今天", exampleSentence: "今天是美好的一天。", strokeOrderSteps: ["人 (上)", "丶 (撇點)", "㇇ (橫撇)"] }
    ],
    vocabulary: [
      { word: "早安", zhuyin: "ㄗㄠˇ ㄢ", pinyin: "zǎo ān", meaning: "早晨問候語", icon: "☀️", exampleSentence: "向老師和同學說聲早安！" },
      { word: "今天", zhuyin: "ㄐㄧㄣ ㄊㄧㄢ", pinyin: "jīn tiān", meaning: "現在這一天", icon: "📅", exampleSentence: "今天我們學習了許多生字。" }
    ]
  },
  {
    levelNumber: 18,
    levelId: "lvl-18",
    stageNumber: 4,
    type: "lesson",
    title: "第 18 關 · 心情與情感",
    themeTitle: "情緒情感",
    themeSubtitle: "學會「心、愛、喜、歡、樂、笑」",
    icon: "💖",
    estimatedMinutes: 25,
    characters: [
      { char: "心", charHans: "心", zhuyin: "ㄒㄧㄣ", zhuyinTone: "", pinyin: "xīn", meaning: "心臟、內心", radical: "心", strokeCount: 4, illustrationIcon: "❤️", exampleWord: "愛心", exampleSentence: "人人都要有愛心。", strokeOrderSteps: ["丶 (左點)", "㇂ (臥鉤)", "丶 (中點)", "丶 (右點)"] },
      { char: "愛", charHans: "爱", zhuyin: "ㄞ", zhuyinTone: "ˋ", pinyin: "ài", meaning: "關愛、熱愛", radical: "心", strokeCount: 13, illustrationIcon: "🥰", exampleWord: "相愛", exampleSentence: "爸爸媽媽深愛著我。", strokeOrderSteps: ["爫 (上)", "冖 (禿寶蓋)", "心 (中)", "夂 (下)"] },
      { char: "樂", charHans: "乐", zhuyin: "ㄌㄜ", zhuyinTone: "ˋ", pinyin: "lè", meaning: "快樂、音樂", radical: "木", strokeCount: 15, illustrationIcon: "🥳", exampleWord: "快樂", exampleSentence: "祝大家天天快樂！", strokeOrderSteps: ["白 (上中)", "幺 (左右)", "木 (底)"] },
      { char: "笑", charHans: "笑", zhuyin: "ㄒㄧㄠ", zhuyinTone: "ˋ", pinyin: "xiào", meaning: "笑容", radical: "竹", strokeCount: 10, illustrationIcon: "😄", exampleWord: "微笑", exampleSentence: "臉上帶著甜甜的微笑。", strokeOrderSteps: ["⺮ (竹字頭)", "夭 (下部)"] }
    ],
    vocabulary: [
      { word: "快樂", zhuyin: "ㄎㄨㄞˋ ㄌㄜˋ", pinyin: "kuài lè", meaning: "心情舒暢歡喜", icon: "🎉", exampleSentence: "祝你生日快樂！" },
      { word: "愛心", zhuyin: "ㄞˋ ㄒㄧㄣ", pinyin: "ài xīn", meaning: "關懷助人之心", icon: "💖", exampleSentence: "幫助他人是一件有愛心的事。" }
    ]
  },
  {
    levelNumber: 19,
    levelId: "lvl-19",
    stageNumber: 4,
    type: "lesson",
    title: "第 19 關 · 芳香的花草樹木",
    themeTitle: "植物花果",
    themeSubtitle: "學會「花、草、樹、木、果、香」",
    icon: "🌺",
    estimatedMinutes: 25,
    characters: [
      { char: "花", charHans: "花", zhuyin: "ㄏㄨㄚ", zhuyinTone: "", pinyin: "huā", meaning: "花朵", radical: "艸", strokeCount: 8, illustrationIcon: "🌸", exampleWord: "花朵", exampleSentence: "公園裡開滿了美麗的花。", strokeOrderSteps: ["艹 (草字頭)", "化 (下部)"] },
      { char: "果", charHans: "果", zhuyin: "ㄍㄨㄛ", zhuyinTone: "ˇ", pinyin: "guǒ", meaning: "果實", radical: "木", strokeCount: 8, illustrationIcon: "🍎", exampleWord: "水果", exampleSentence: "多吃新鮮水果身體好。", strokeOrderSteps: ["日 (上)", "木 (下)"] },
      { char: "香", charHans: "香", zhuyin: "ㄒㄧㄤ", zhuyinTone: "", pinyin: "xiāng", meaning: "芳香", radical: "香", strokeCount: 9, illustrationIcon: "💐", exampleWord: "花香", exampleSentence: "茉莉花散發出陣陣花香。", strokeOrderSteps: ["禾 (上)", "日 (下)"] }
    ],
    vocabulary: [
      { word: "花朵", zhuyin: "ㄏㄨㄚ ㄉㄨㄛˇ", pinyin: "huā duǒ", meaning: "盛開的花", icon: "🌺", exampleSentence: "春天花園裡開滿各色花朵。" },
      { word: "水果", zhuyin: "ㄕㄨㄟˇ ㄍㄨㄛˇ", pinyin: "shuǐ guǒ", meaning: "多汁可食用的植物果實", icon: "🍉", exampleSentence: "蘋果和西瓜都是美味的水果。" }
    ]
  },
  // 📝 第 20 關：第 4 階段檢核測驗券（涵蓋第 16~20 關生字）
  {
    levelNumber: 20,
    levelId: "lvl-20",
    stageNumber: 4,
    type: "stage_quiz",
    title: "第 20 關 · 第 4 階段檢核測驗券 📝",
    themeTitle: "第 4 階段檢定驗收",
    themeSubtitle: "涵蓋第 16~19 關「地理國度、時間流轉、情緒情感、植物花果」核心生字與詞彙",
    icon: "📜",
    estimatedMinutes: 20,
    quizScope: [16, 17, 18, 19],
    characters: [],
    vocabulary: []
  },

  // ================= STAGE 5 (關卡 21 ~ 25) =================
  {
    levelNumber: 21,
    levelId: "lvl-21",
    stageNumber: 5,
    type: "lesson",
    title: "第 21 關 · 交通出行與道路",
    themeTitle: "交通出行",
    themeSubtitle: "學會「車、船、飛、機、走、路」",
    icon: "🚗",
    estimatedMinutes: 25,
    characters: [
      { char: "車", charHans: "车", zhuyin: "ㄔㄜ", zhuyinTone: "", pinyin: "chē", meaning: "車輛", radical: "車", strokeCount: 7, illustrationIcon: "🚗", exampleWord: "汽車", exampleSentence: "路上來來往往的汽車。", strokeOrderSteps: ["一 (橫)", "日 (中框)", "一 (長橫)", "丨 (貫穿豎)"] },
      { char: "船", charHans: "船", zhuyin: "ㄔㄨㄢ", zhuyinTone: "ˊ", pinyin: "chuán", meaning: "船隻", radical: "舟", strokeCount: 11, illustrationIcon: "⛵", exampleWord: "小船", exampleSentence: "白色的帆船在海中航行。", strokeOrderSteps: ["舟 (左舟字旁)", "㕣 (右部)"] },
      { char: "飛", charHans: "飞", zhuyin: "ㄈㄟ", zhuyinTone: "", pinyin: "fēi", meaning: "飛行", radical: "飛", strokeCount: 9, illustrationIcon: "✈️", exampleWord: "飛機", exampleSentence: "大飛機在藍天上飛翔。", strokeOrderSteps: ["𠃑 (上折)", "ノ (短撇)", "升 (下部)"] },
      { char: "路", charHans: "路", zhuyin: "ㄌㄨ", zhuyinTone: "ˋ", pinyin: "lù", meaning: "道路", radical: "足", strokeCount: 13, illustrationIcon: "🛣️", exampleWord: "道路", exampleSentence: "寬闊的馬路通四方。", strokeOrderSteps: ["足 (左足旁)", "各 (右部)"] }
    ],
    vocabulary: [
      { word: "飛機", zhuyin: "ㄈㄟ ㄐㄧ", pinyin: "fēi jī", meaning: "空中飛行交通工具", icon: "✈️", exampleSentence: "搭乘飛機去世界各地旅行。" },
      { word: "走路", zhuyin: "ㄗㄡˇ ㄌㄨˋ", pinyin: "zǒu lù", meaning: "步行", icon: "🚶", exampleSentence: "多走路有益身體健康。" }
    ]
  },
  {
    levelNumber: 22,
    levelId: "lvl-22",
    stageNumber: 5,
    type: "lesson",
    title: "第 22 關 · 五行與自然造化",
    themeTitle: "五行自然",
    themeSubtitle: "學會「金、木、水、火、土、生」",
    icon: "🪙",
    estimatedMinutes: 25,
    characters: [
      { char: "金", charHans: "金", zhuyin: "ㄐㄧㄣ", zhuyinTone: "", pinyin: "jīn", meaning: "黃金、金屬", radical: "金", strokeCount: 8, illustrationIcon: "🪙", exampleWord: "黃金", exampleSentence: "黃金閃閃發光。", strokeOrderSteps: ["人 (上)", "一 (橫)", "二 (橫)", "丨 (豎)", "八 (兩側點)"] },
      { char: "土", charHans: "土", zhuyin: "ㄊㄨ", zhuyinTone: "ˇ", pinyin: "tǔ", meaning: "泥土、土地", radical: "土", strokeCount: 3, illustrationIcon: "🪴", exampleWord: "泥土", exampleSentence: "小草在肥沃的泥土裡生長。", strokeOrderSteps: ["一 (短橫)", "丨 (豎)", "一 (長橫)"] },
      { char: "生", charHans: "生", zhuyin: "ㄕㄥ", zhuyinTone: "", pinyin: "shēng", meaning: "生長、生命", radical: "生", strokeCount: 5, illustrationIcon: "🌱", exampleWord: "生長", exampleSentence: "小苗在大自然中健康生長。", strokeOrderSteps: ["丿 (短撇)", "一 (橫)", "丨 (豎)", "一 (橫)", "一 (底長橫)"] }
    ],
    vocabulary: [
      { word: "泥土", zhuyin: "ㄋㄧˊ ㄊㄨˇ", pinyin: "ní tǔ", meaning: "土壤", icon: "🪴", exampleSentence: "種花需要乾淨的泥土。" },
      { word: "黃金", zhuyin: "ㄏㄨㄤˊ ㄐㄧㄣ", pinyin: "huáng jīn", meaning: "珍貴的金屬", icon: "🪙", exampleSentence: "一寸光陰一寸金，寸金難買寸光陰。" }
    ]
  },
  {
    levelNumber: 23,
    levelId: "lvl-23",
    stageNumber: 5,
    type: "lesson",
    title: "第 23 關 · 聽說讀寫話語文",
    themeTitle: "語文素養",
    themeSubtitle: "學會「讀、寫、說、問、答、字」",
    icon: "✍️",
    estimatedMinutes: 25,
    characters: [
      { char: "讀", charHans: "读", zhuyin: "ㄉㄨ", zhuyinTone: "ˊ", pinyin: "dú", meaning: "閱讀、誦讀", radical: "言", strokeCount: 22, illustrationIcon: "📖", exampleWord: "讀書", exampleSentence: "大聲朗讀優美文章。", strokeOrderSteps: ["言 (左言字旁)", "賣 (右部)"] },
      { char: "寫", charHans: "写", zhuyin: "ㄒㄧㄝ", zhuyinTone: "ˇ", pinyin: "xiě", meaning: "書寫", radical: "冖", strokeCount: 15, illustrationIcon: "✍️", exampleWord: "寫字", exampleSentence: "端端正正寫好每一個漢字。", strokeOrderSteps: ["冖 (禿寶蓋)", "臼 (中)", "灬 (四點底)"] },
      { char: "說", charHans: "说", zhuyin: "ㄕㄨㄛ", zhuyinTone: "", pinyin: "shuō", meaning: "說話、表達", radical: "言", strokeCount: 14, illustrationIcon: "🗣️", exampleWord: "說話", exampleSentence: "自信大方地說中文。", strokeOrderSteps: ["言 (左言旁)", "兌 (右部)"] },
      { char: "字", charHans: "字", zhuyin: "ㄗ", zhuyinTone: "ˋ", pinyin: "zì", meaning: "漢字、字形", radical: "子", strokeCount: 6, illustrationIcon: "🀄", exampleWord: "生字", exampleSentence: "今天我們學會了許多生字。", strokeOrderSteps: ["宀 (寶蓋頭)", "子 (底)"] }
    ],
    vocabulary: [
      { word: "寫字", zhuyin: "ㄒㄧㄝˇ ㄗˋ", pinyin: "xiě zì", meaning: "在紙上書寫字元", icon: "✍️", exampleSentence: "每天練習寫字讓字跡更工整。" },
      { word: "說話", zhuyin: "ㄕㄨㄛ ㄏㄨㄚˋ", pinyin: "shuō huà", meaning: "用語言交談", icon: "🗣️", exampleSentence: "上課請舉手再說話。" }
    ]
  },
  {
    levelNumber: 24,
    levelId: "lvl-24",
    stageNumber: 5,
    type: "lesson",
    title: "第 24 關 · 友誼與真善美",
    themeTitle: "品格交友",
    themeSubtitle: "學會「友、朋、和、好、真、善」",
    icon: "🤝",
    estimatedMinutes: 25,
    characters: [
      { char: "朋", charHans: "朋", zhuyin: "ㄆㄥ", zhuyinTone: "ˊ", pinyin: "péng", meaning: "朋友", radical: "月", strokeCount: 8, illustrationIcon: "👬", exampleWord: "朋友", exampleSentence: "我們是最好的好朋友。", strokeOrderSteps: ["月 (左月)", "月 (右月)"] },
      { char: "友", charHans: "友", zhuyin: "ㄧㄡ", zhuyinTone: "ˇ", pinyin: "yǒu", meaning: "友愛、友情", radical: "又", strokeCount: 4, illustrationIcon: "🤝", exampleWord: "好友", exampleSentence: "友愛同學，互相幫助。", strokeOrderSteps: ["一 (橫)", "丿 (撇)", "又 (下部)"] },
      { char: "和", charHans: "和", zhuyin: "ㄏㄜ", zhuyinTone: "ˊ", pinyin: "hé", meaning: "和睦、溫和", radical: "口", strokeCount: 8, illustrationIcon: "🕊️", exampleWord: "和平", exampleSentence: "大家和睦相處真快樂。", strokeOrderSteps: ["禾 (左)", "口 (右)"] },
      { char: "好", charHans: "好", zhuyin: "ㄏㄠ", zhuyinTone: "ˇ", pinyin: "hǎo", meaning: "良好、美好", radical: "女", strokeCount: 6, illustrationIcon: "👍", exampleWord: "好人", exampleSentence: "做一個誠實善良的好孩子。", strokeOrderSteps: ["女 (左)", "子 (右)"] }
    ],
    vocabulary: [
      { word: "朋友", zhuyin: "ㄆㄥˊ ㄧㄡˇ", pinyin: "péng yǒu", meaning: "彼此友好相處的人", icon: "👭", exampleSentence: "我和同學成為了好朋友。" },
      { word: "和睦", zhuyin: "ㄏㄜˊ ㄇㄨˋ", pinyin: "hé mù", meaning: "相處融洽不爭吵", icon: "🕊️", exampleSentence: "家庭和睦，生活幸福。" }
    ]
  },
  // 👑 第 25 關：第 5 次測驗 —— 華語核心榮譽大挑戰
  {
    levelNumber: 25,
    levelId: "lvl-25",
    stageNumber: 5,
    type: "milestone_exam",
    title: "第 25 關 · 華語核心榮譽大驗收 👑",
    themeTitle: "華語進階榮譽挑戰",
    themeSubtitle: "涵蓋 1~24 關全部 120+ 核心生字，通過即解鎖幸運寶箱與小狀元榮譽證書！",
    icon: "👑",
    estimatedMinutes: 30,
    quizScope: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24],
    characters: [],
    vocabulary: []
  }
];

// ========================================================
// 進度持久化管理 (Learner Level Progress Storage)
// ========================================================

export function getLearnerLevelsProgress(): LearnerLevelProgress[] {
  try {
    const raw = localStorage.getItem("tongxuan_levels_progress");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 25) {
        return parsed;
      }
    }
  } catch (e) {}

  // 初始預設：新使用者只有「第 1 關」解鎖 (current)，第 2~25 關全部鎖定 (locked)，無虛假通關日期！
  const initial: LearnerLevelProgress[] = ALL_COURSE_LEVELS.map((lvl) => ({
    levelNumber: lvl.levelNumber,
    status: lvl.levelNumber === 1 ? "current" : "locked",
    completedAt: null,
    starsEarned: 0,
    score: null
  }));

  localStorage.setItem("tongxuan_levels_progress", JSON.stringify(initial));
  return initial;
}

export function saveLearnerLevelsProgress(progress: LearnerLevelProgress[]): void {
  localStorage.setItem("tongxuan_levels_progress", JSON.stringify(progress));
}

// 通關特定關卡：記錄實際通關時間、星數、分數，並自動解鎖下一關
export function completeCourseLevel(
  levelNum: number,
  earnedStars: number = 3,
  quizScore: number | null = null
): { updatedProgress: LearnerLevelProgress[]; unlockedNext: boolean } {
  const current = getLearnerLevelsProgress();
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;

  let unlockedNext = false;

  const updated = current.map((item) => {
    if (item.levelNumber === levelNum) {
      return {
        ...item,
        status: "completed" as const,
        completedAt: dateStr,
        starsEarned: Math.max(item.starsEarned, earnedStars),
        score: quizScore !== null ? quizScore : item.score
      };
    }
    if (item.levelNumber === levelNum + 1 && item.status === "locked") {
      unlockedNext = true;
      return {
        ...item,
        status: "current" as const
      };
    }
    return item;
  });

  saveLearnerLevelsProgress(updated);
  return { updatedProgress: updated, unlockedNext };
}

// ========================================================
// 智能動態組卷引擎 (Dynamic Quiz Paper Generator)
// ========================================================
export function generateQuizPaper(
  targetLevel: CourseLevel,
  allLevels: CourseLevel[] = ALL_COURSE_LEVELS
): QuizQuestionItem[] {
  const scopeLevelNums = targetLevel.quizScope || [1, 2, 3, 4];
  const scopeLevels = allLevels.filter((l) => scopeLevelNums.includes(l.levelNumber));

  // 收集範圍內所有的生字與詞彙
  const allChars: HanziCharItem[] = [];
  const allVocabs: VocabItem[] = [];

  scopeLevels.forEach((lvl) => {
    allChars.push(...lvl.characters);
    allVocabs.push(...lvl.vocabulary);
  });

  if (allChars.length === 0) {
    return [];
  }

  const isMilestone = targetLevel.type === "milestone_exam";
  const questionCount = isMilestone ? 10 : 6;
  const questions: QuizQuestionItem[] = [];

  // 隨機打亂輔助
  const shuffledChars = [...allChars].sort(() => 0.5 - Math.random());
  const shuffledVocabs = [...allVocabs].sort(() => 0.5 - Math.random());

  // 題型 1: 🔊 聽音選字 (Listening Recognition)
  shuffledChars.slice(0, Math.ceil(questionCount / 3)).forEach((targetChar, idx) => {
    const distractors = allChars
      .filter((c) => c.char !== targetChar.char)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const options: QuizOption[] = [
      { text: targetChar.char, subText: `${targetChar.pinyin} / ${targetChar.zhuyin}`, isCorrect: true },
      ...distractors.map((d) => ({
        text: d.char,
        subText: `${d.pinyin} / ${d.zhuyin}`,
        isCorrect: false
      }))
    ].sort(() => 0.5 - Math.random());

    questions.push({
      id: `q-listen-${idx}-${targetChar.char}`,
      type: "listen-char",
      title: "🔊 聽音辨字",
      prompt: "請點擊語音播放，選出發音正確的生字：",
      audioText: targetChar.char,
      options,
      explanation: `發音「${targetChar.pinyin} / ${targetChar.zhuyin}」對應的生字是「${targetChar.char}」（${targetChar.meaning}）！`
    });
  });

  // 題型 2: 🔤 看字選拼音/注音 (Tone & Phonetic Match)
  shuffledChars.slice(Math.ceil(questionCount / 3), Math.ceil((questionCount * 2) / 3)).forEach((targetChar, idx) => {
    const otherChars = allChars.filter((c) => c.char !== targetChar.char);
    const fakeTones = otherChars.slice(0, 2).map((c) => ({
      text: `${c.pinyin}`,
      subText: `${c.zhuyin}`,
      isCorrect: false
    }));

    const options: QuizOption[] = [
      { text: `${targetChar.pinyin}`, subText: `${targetChar.zhuyin}`, isCorrect: true },
      ...fakeTones,
      { text: `${targetChar.pinyin} (輕聲)`, subText: "無調號", isCorrect: false }
    ].sort(() => 0.5 - Math.random());

    questions.push({
      id: `q-tone-${idx}-${targetChar.char}`,
      type: "char-tone",
      title: "🔤 字音聲調辨析",
      prompt: `生字「${targetChar.char}」的正確拼音與注音是？`,
      options,
      explanation: `「${targetChar.char}」正確讀音為 ${targetChar.pinyin} / ${targetChar.zhuyin}。`
    });
  });

  // 題型 3: 🖼️ 看圖配詞 / 詞意配對 (Visual Vocabulary Match)
  shuffledVocabs.slice(0, Math.ceil(questionCount / 3)).forEach((targetVocab, idx) => {
    const distractors = allVocabs
      .filter((v) => v.word !== targetVocab.word)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    const options: QuizOption[] = [
      { text: targetVocab.word, subText: `${targetVocab.pinyin}`, isCorrect: true },
      ...distractors.map((d) => ({
        text: d.word,
        subText: `${d.pinyin}`,
        isCorrect: false
      }))
    ].sort(() => 0.5 - Math.random());

    questions.push({
      id: `q-vocab-${idx}-${targetVocab.word}`,
      type: "img-vocab",
      title: "🖼️ 圖文詞義配對",
      prompt: `圖案「${targetVocab.icon}」最適合配對哪一個詞彙？`,
      options,
      explanation: `圖案「${targetVocab.icon}」代表「${targetVocab.word}」（${targetVocab.meaning}）！`
    });
  });

  // 題型 4: 📐 筆畫數與部首檢核 (Stroke Count & Radical Check)
  if (shuffledChars.length >= 2) {
    const strokeTarget = shuffledChars[0];
    const correctStrokes = strokeTarget.strokeCount;
    const fake1 = Math.max(1, correctStrokes - 1);
    const fake2 = correctStrokes + 1;
    const fake3 = correctStrokes + 2;

    const options: QuizOption[] = [
      { text: `${correctStrokes} 畫`, subText: `部首：${strokeTarget.radical}`, isCorrect: true },
      { text: `${fake1} 畫`, subText: `部首：${strokeTarget.radical}`, isCorrect: false },
      { text: `${fake2} 畫`, subText: `部首：${strokeTarget.radical}`, isCorrect: false },
      { text: `${fake3} 畫`, subText: `部首：${strokeTarget.radical}`, isCorrect: false }
    ].sort(() => 0.5 - Math.random());

    questions.push({
      id: `q-stroke-${strokeTarget.char}`,
      type: "stroke-count",
      title: "📐 筆畫與部首驗收",
      prompt: `漢字「${strokeTarget.char}」的標準筆畫數是多少？`,
      options,
      explanation: `「${strokeTarget.char}」的部首是「${strokeTarget.radical}」，總筆畫數為 ${correctStrokes} 畫。`
    });
  }

  return questions.slice(0, questionCount);
}
