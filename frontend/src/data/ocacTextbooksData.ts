// Legacy internal sample data. This unverified prototype is not an OCAC textbook catalog.

export interface AuthoredDraftLesson {
  lessonId: string;
  lessonNumber: number;
  title: string;
  subtitle: string;
  theme: string;
  characters: {
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
    exampleSentence: string;
    strokeOrderSteps?: string[];
  }[];
  vocabulary: {
    word: string;
    zhuyin: string;
    pinyin: string;
    meaning: string;
    icon: string;
    exampleSentence: string;
  }[];
  lessonStory: string[];
  idiom: {
    idiomTitle: string;
    idiomZhuyin: string;
    idiomPinyin: string;
    idiomMeaning: string;
    idiomIcon: string;
    storyContext: string;
  };
  quizQuestions: {
    id: string;
    type: "listen-char" | "char-tone" | "img-vocab";
    title: string;
    prompt: string;
    audioText?: string;
    options: { text: string; subText?: string; isCorrect: boolean }[];
    explanation: string;
  }[];
  sourceKind?: "TONGXUAN_AUTHORED";
  sourceName?: string;
  sourceUrl?: string;
  sourceBook?: string;
  sourceLesson?: string;
  provenanceStatus?: "INTERNAL_DRAFT";
  licenseStatus?: "INTERNAL_ONLY";
  commercialReady?: false;
}

export interface AuthoredDraftVolume {
  volume: number;
  gradeName: string;
  targetAudience: string;
  description: string;
  totalChars: number;
  badgeIcon: string;
  colorTheme: string;
  lessons: AuthoredDraftLesson[];
  sourceKind?: "TONGXUAN_AUTHORED";
  sourceName?: string;
  sourceUrl?: string;
  sourceBook?: string;
  sourceLesson?: string;
  provenanceStatus?: "INTERNAL_DRAFT";
  licenseStatus?: "INTERNAL_ONLY";
  commercialReady?: false;
}

const LEGACY_UNVERIFIED_VOLUME_DATA: AuthoredDraftVolume[] = [
  {
    volume: 1,
    gradeName: "第一冊 · 啟蒙與基礎感知",
    targetAudience: "初學兒童（4-6 歲 / 零基礎）",
    description: "從人體五官、數字方位、大自然天地草木開始，建立漢字基本筆形與拼讀概念。",
    totalChars: 120,
    badgeIcon: "🌱",
    colorTheme: "#10b981",
    lessons: [
      {
        lessonId: "v1-l1",
        lessonNumber: 1,
        title: "人體與五官感知",
        subtitle: "學會「人、口、手、足、目、耳」",
        theme: "認識自我與五官",
        characters: [
          { char: "人", charHans: "人", zhuyin: "ㄖㄣ", zhuyinTone: "ˊ", pinyin: "rén", meaning: "人類、個人", radical: "人", strokeCount: 2, illustrationIcon: "👤", exampleWord: "人們", exampleSentence: "大家都是快樂的好朋友。", strokeOrderSteps: ["丿 (撇)", "㇏ (捺)"] },
          { char: "口", charHans: "口", zhuyin: "ㄎㄡ", zhuyinTone: "ˇ", pinyin: "kǒu", meaning: "嘴巴", radical: "口", strokeCount: 3, illustrationIcon: "👄", exampleWord: "口水", exampleSentence: "看到好吃的食物流口水。", strokeOrderSteps: ["丨 (左豎)", "𠃍 (橫折)", "一 (底橫)"] },
          { char: "手", charHans: "手", zhuyin: "ㄕㄡ", zhuyinTone: "ˇ", pinyin: "shǒu", meaning: "雙手", radical: "手", strokeCount: 4, illustrationIcon: "✋", exampleWord: "雙手", exampleSentence: "我們有一雙勤勞的雙手。", strokeOrderSteps: ["丿 (短撇)", "一 (上橫)", "一 (下橫)", "亅 (豎鉤)"] },
          { char: "足", charHans: "足", zhuyin: "ㄗㄨ", zhuyinTone: "ˊ", pinyin: "zú", meaning: "腳、足部", radical: "足", strokeCount: 7, illustrationIcon: "🦶", exampleWord: "足球", exampleSentence: "放學後我們一起踢足球。", strokeOrderSteps: ["口 (上部)", "丨 (豎)", "一 (橫)", "丿 (撇)", "㇏ (捺)"] },
          { char: "目", charHans: "目", zhuyin: "ㄇㄨ", zhuyinTone: "ˋ", pinyin: "mù", meaning: "眼睛", radical: "目", strokeCount: 5, illustrationIcon: "👁️", exampleWord: "目光", exampleSentence: "他的目光溫柔又明亮。", strokeOrderSteps: ["丨 (左豎)", "𠃍 (橫折)", "一 (中橫)", "一 (中橫)", "一 (底橫)"] },
          { char: "耳", charHans: "耳", zhuyin: "ㄦ", zhuyinTone: "ˇ", pinyin: "ěr", meaning: "耳朵", radical: "耳", strokeCount: 6, illustrationIcon: "👂", exampleWord: "耳朵", exampleSentence: "兔子有一對長長的耳朵。", strokeOrderSteps: ["一 (上橫)", "丨 (左豎)", "丨 (右豎)", "一 (中橫)", "一 (中橫)", "一 (長橫)"] }
        ],
        vocabulary: [
          { word: "人們", zhuyin: "ㄖㄣˊ ˙ㄇㄣ", pinyin: "rén men", meaning: "許多不同的人", icon: "👥", exampleSentence: "廣場上聚集了許多熱情的人們。" },
          { word: "小手", zhuyin: "ㄒㄧㄠˇ ㄕㄡˇ", pinyin: "xiǎo shǒu", meaning: "小孩子稚嫩的手", icon: "✋", exampleSentence: "拍拍你的小手，一起來唱歌。" },
          { word: "耳朵", zhuyin: "ㄦˇ ˙ㄉㄨㄛ", pinyin: "ěr duo", meaning: "聽聲音的器官", icon: "👂", exampleSentence: "豎起小耳朵，仔細聽故事。" },
          { word: "目光", zhuyin: "ㄇㄨˋ ㄍㄨㄤ", pinyin: "mù guāng", meaning: "眼神與注視的光彩", icon: "👀", exampleSentence: "他的目光充滿了好奇與期待。" },
          { word: "足球", zhuyin: "ㄗㄨˊ ㄑㄧㄡˊ", pinyin: "zú qiú", meaning: "用腳踢的運動球類", icon: "⚽", exampleSentence: "操場上有好多人在踢足球。" },
          { word: "口才", zhuyin: "ㄎㄡˇ ㄘㄞˊ", pinyin: "kǒu cái", meaning: "說話流利動聽的能力", icon: "🗣️", exampleSentence: "妹妹的口才很好，很會講故事。" }
        ],
        lessonStory: [
          "我們有明亮的眼睛看世界，靈巧的雙耳聽音樂。",
          "張開小口大聲讀書，揮動小手畫出美麗的彩虹。",
          "用雙足奔跑在大地上，每個人都是快樂的小寶貝。"
        ],
        idiom: {
          idiomTitle: "人山人海",
          idiomZhuyin: "ㄖㄣˊ ㄕㄢ ㄖㄣˊ ㄏㄞˇ",
          idiomPinyin: "rén shān rén hǎi",
          idiomMeaning: "人群如山如海，形容聚集的人非常多",
          idiomIcon: "👥",
          storyContext: "逢年過節的市集裡擠滿了逛街的人群，真是人山人海。"
        },
        quizQuestions: [
          {
            id: "v1-l1-q1",
            type: "listen-char",
            title: "聽音選字",
            prompt: "請聽語音，選出正確的生字：",
            audioText: "手",
            options: [
              { text: "人", subText: "rén", isCorrect: false },
              { text: "手", subText: "shǒu", isCorrect: true },
              { text: "口", subText: "kǒu", isCorrect: false },
              { text: "足", subText: "zú", isCorrect: false }
            ],
            explanation: "發音「shǒu / ㄕㄡˇ」對應的生字是「手」！"
          },
          {
            id: "v1-l1-q2",
            type: "char-tone",
            title: "筆畫辨析",
            prompt: "「人」字一共有幾畫？",
            options: [
              { text: "2 畫", subText: "一撇一捺", isCorrect: true },
              { text: "3 畫", subText: "", isCorrect: false },
              { text: "4 畫", subText: "", isCorrect: false }
            ],
            explanation: "「人」字由撇、捺兩筆組成，共 2 畫！"
          },
          {
            id: "v1-l1-q3",
            type: "img-vocab",
            title: "看圖選詞",
            prompt: "圖案「👂」最適合配對哪一個生詞？",
            options: [
              { text: "小手", subText: "xiǎo shǒu", isCorrect: false },
              { text: "耳朵", subText: "ěr duo", isCorrect: true },
              { text: "目光", subText: "mù guāng", isCorrect: false }
            ],
            explanation: "耳朵 (👂) 聆聽美妙的聲音！"
          }
        ]
      },
      {
        lessonId: "v1-l2",
        lessonNumber: 2,
        title: "日月星辰與自然",
        subtitle: "學會「日、月、星、光、天、地」",
        theme: "宇宙天象與光明",
        characters: [
          { char: "日", charHans: "日", zhuyin: "ㄖ", zhuyinTone: "ˋ", pinyin: "rì", meaning: "太陽、日子", radical: "日", strokeCount: 4, illustrationIcon: "☀️", exampleWord: "日光", exampleSentence: "金色的日光照亮大地。", strokeOrderSteps: ["丨 (左豎)", "𠃍 (橫折)", "一 (中橫)", "一 (底橫)"] },
          { char: "月", charHans: "月", zhuyin: "ㄩㄝ", zhuyinTone: "ˋ", pinyin: "yuè", meaning: "月亮、月份", radical: "月", strokeCount: 4, illustrationIcon: "🌙", exampleWord: "月亮", exampleSentence: "彎彎的月亮掛在天上。", strokeOrderSteps: ["丿 (撇)", "𠃌 (橫折鉤)", "一 (中橫)", "一 (中橫)"] },
          { char: "星", charHans: "星", zhuyin: "ㄒㄧㄥ", zhuyinTone: "", pinyin: "xīng", meaning: "星星", radical: "日", strokeCount: 9, illustrationIcon: "⭐", exampleWord: "星星", exampleSentence: "夜空中有閃爍的星星。", strokeOrderSteps: ["日 (上部)", "生 (下部)"] },
          { char: "光", charHans: "光", zhuyin: "ㄍㄨㄤ", zhuyinTone: "", pinyin: "guāng", meaning: "光芒、明亮", radical: "儿", strokeCount: 6, illustrationIcon: "✨", exampleWord: "陽光", exampleSentence: "溫暖的陽光灑在身上。", strokeOrderSteps: ["丨 (豎)", "丶 (點)", "丿 (撇)", "一 (橫)", "丿 (撇)", "乚 (豎彎鉤)"] },
          { char: "天", charHans: "天", zhuyin: "ㄊㄧㄢ", zhuyinTone: "", pinyin: "tiān", meaning: "天空、天氣", radical: "大", strokeCount: 4, illustrationIcon: "🌤️", exampleWord: "天空", exampleSentence: "藍藍的天空萬里無雲。", strokeOrderSteps: ["一 (上橫)", "一 (下橫)", "丿 (撇)", "㇏ (捺)"] },
          { char: "地", charHans: "地", zhuyin: "ㄉㄧ", zhuyinTone: "ˋ", pinyin: "dì", meaning: "大地、地面", radical: "土", strokeCount: 6, illustrationIcon: "🌍", exampleWord: "大地", exampleSentence: "大地長滿了青翠的草木。", strokeOrderSteps: ["土 (左土旁)", "也 (右側)"] }
        ],
        vocabulary: [
          { word: "太陽", zhuyin: "ㄊㄞˋ ㄧㄤˊ", pinyin: "tài yáng", meaning: "恆星太陽", icon: "☀️", exampleSentence: "早晨太陽從東方緩緩升起。" },
          { word: "月亮", zhuyin: "ㄩㄝˋ ˙ㄌㄧㄤ", pinyin: "yuè liang", meaning: "夜空中的月球", icon: "🌙", exampleSentence: "圓圓的月亮像玉盤一樣皎潔。" },
          { word: "星星", zhuyin: "ㄒㄧㄥ ㄒㄧㄥ", pinyin: "xīng xing", meaning: "夜空中閃亮的星體", icon: "⭐", exampleSentence: "天上的星星一閃一閃眨著眼睛。" },
          { word: "陽光", zhuyin: "ㄧㄤˊ ㄍㄨㄤ", pinyin: "yáng guāng", meaning: "太陽發出的光芒", icon: "✨", exampleSentence: "溫暖的陽光照耀著小花朵。" },
          { word: "藍天", zhuyin: "ㄌㄢˊ ㄊㄧㄢ", pinyin: "lán tiān", meaning: "碧藍無際的天空", icon: "🌤️", exampleSentence: "白鴿在廣闊的藍天中飛翔。" },
          { word: "大地", zhuyin: "ㄉㄚˋ ㄉㄧˋ", pinyin: "dà dì", meaning: "廣闊的地面世界", icon: "🌍", exampleSentence: "春回大地，萬物復甦生長。" }
        ],
        lessonStory: [
          "白天，金色的太陽給大地帶來光明與溫暖。",
          "夜晚，皎潔的月亮伴著滿天閃爍的星星。",
          "天地無比廣闊，大自然的世界多麼美麗神奇！"
        ],
        idiom: {
          idiomTitle: "日新月異",
          idiomZhuyin: "ㄖˋ ㄒㄧㄣ ㄩㄝˋ ㄧˋ",
          idiomPinyin: "rì xīn yuè yì",
          idiomMeaning: "每天每月都有新的進步與變化，形容進步極快",
          idiomIcon: "🚀",
          storyContext: "現代科技日新月異，讓我們的生活越來越便利。"
        },
        quizQuestions: [
          {
            id: "v1-l2-q1",
            type: "listen-char",
            title: "聽音選字",
            prompt: "請聽語音，選出正確的生字：",
            audioText: "月",
            options: [
              { text: "日", subText: "rì", isCorrect: false },
              { text: "月", subText: "yuè", isCorrect: true },
              { text: "星", subText: "xīng", isCorrect: false },
              { text: "光", subText: "guāng", isCorrect: false }
            ],
            explanation: "發音「yuè / ㄩㄝˋ」對應的生字是「月」！"
          },
          {
            id: "v1-l2-q2",
            type: "char-tone",
            title: "字音辨析",
            prompt: "「日」字的部首是？",
            options: [
              { text: "日部", subText: "本字為部首", isCorrect: true },
              { text: "口部", subText: "", isCorrect: false },
              { text: "一部", subText: "", isCorrect: false }
            ],
            explanation: "「日」是獨立部首（日部），共 4 畫！"
          },
          {
            id: "v1-l2-q3",
            type: "img-vocab",
            title: "看圖選詞",
            prompt: "圖案「⭐」最適合配對哪一個生詞？",
            options: [
              { text: "太陽", subText: "tài yáng", isCorrect: false },
              { text: "星星", subText: "xīng xing", isCorrect: true },
              { text: "月亮", subText: "yuè liang", isCorrect: false }
            ],
            explanation: "星星 (⭐) 閃耀在夜空中！"
          }
        ]
      }
    ]
  },
  {
    volume: 2,
    gradeName: "第二冊 · 家庭校園與日常生活",
    targetAudience: "初小學童（6-7 歲）",
    description: "學習家庭成員稱謂、學校師生互動、日常禮貌用語，掌握常用部首與基本句型造句。",
    totalChars: 180,
    badgeIcon: "🏫",
    colorTheme: "#3b82f6",
    lessons: [
      {
        lessonId: "v2-l1",
        lessonNumber: 1,
        title: "溫馨的家庭成員",
        subtitle: "學會「爸、媽、爺、奶、哥、弟」",
        theme: "家庭親情與長幼",
        characters: [
          { char: "爸", charHans: "爸", zhuyin: "ㄅㄚˋ", zhuyinTone: "ˋ", pinyin: "bà", meaning: "爸爸、父親", radical: "父", strokeCount: 8, illustrationIcon: "👨", exampleWord: "爸爸", exampleSentence: "爸爸每天辛苦工作照顧我們。" },
          { char: "媽", charHans: "妈", zhuyin: "ㄇㄚ", zhuyinTone: "", pinyin: "mā", meaning: "媽媽、母親", radical: "女", strokeCount: 13, strokeCountHans: 6, illustrationIcon: "👩", exampleWord: "媽媽", exampleSentence: "媽媽做的菜香甜可口。" },
          { char: "爺", charHans: "爷", zhuyin: "ㄧㄝˊ", zhuyinTone: "ˊ", pinyin: "yé", meaning: "爺爺、祖父", radical: "父", strokeCount: 13, strokeCountHans: 6, illustrationIcon: "👴", exampleWord: "爺爺", exampleSentence: "爺爺喜歡在院子裡澆花。" },
          { char: "奶", charHans: "奶", zhuyin: "ㄋㄞˇ", zhuyinTone: "ˇ", pinyin: "nǎi", meaning: "奶奶、祖母", radical: "女", strokeCount: 5, illustrationIcon: "👵", exampleWord: "奶奶", exampleSentence: "奶奶講的睡前故事真有趣。" },
          { char: "哥", charHans: "哥", zhuyin: "ㄍㄜ", zhuyinTone: "", pinyin: "gē", meaning: "哥哥、兄長", radical: "口", strokeCount: 10, illustrationIcon: "👦", exampleWord: "哥哥", exampleSentence: "哥哥教我騎腳踏車。" },
          { char: "弟", charHans: "弟", zhuyin: "ㄉㄧˋ", zhuyinTone: "ˋ", pinyin: "dì", meaning: "弟弟、胞弟", radical: "弓", strokeCount: 7, illustrationIcon: "👶", exampleWord: "弟弟", exampleSentence: "弟弟笑得好開心。" }
        ],
        vocabulary: [
          { word: "家人", zhuyin: "ㄐㄧㄚ ㄖㄣˊ", pinyin: "jiā rén", meaning: "同住在一起的親人", icon: "👨‍👩‍👧‍👦", exampleSentence: "我們全家人一起吃溫馨的晚餐。" },
          { word: "父母", zhuyin: "ㄈㄨˋ ㄇㄨˇ", pinyin: "fù mǔ", meaning: "父親與母親", icon: "👫", exampleSentence: "我們要孝順勤勞的父母。" },
          { word: "兄弟", zhuyin: "ㄒㄧㄨㄥ ㄉㄧˋ", pinyin: "xiōng dì", meaning: "哥哥與弟弟", icon: "👬", exampleSentence: "兄弟倆感情融洽互相幫忙。" }
        ],
        lessonStory: [
          "我家有爸爸、媽媽、爺爺、奶奶，還有活潑的弟弟。",
          "大家相親相愛，每天客廳裡都充滿了歡聲笑語。",
          "家是世界上最溫暖舒適的港灣。"
        ],
        idiom: {
          idiomTitle: "闔家歡樂",
          idiomZhuyin: "ㄏㄜˊ ㄐㄧㄚ ㄏㄨㄢ ㄌㄜˋ",
          idiomPinyin: "hé jiā huān lè",
          idiomMeaning: "全家人都歡歡喜喜、非常快樂",
          idiomIcon: "🎉",
          storyContext: "新年團圓時，大家都祝福彼此闔家歡樂。"
        },
        quizQuestions: [
          {
            id: "v2-l1-q1",
            type: "listen-char",
            title: "聽音選字",
            prompt: "請聽語音，選出正確的生字：",
            audioText: "媽",
            options: [
              { text: "爸", subText: "bà", isCorrect: false },
              { text: "媽", subText: "mā", isCorrect: true },
              { text: "奶", subText: "nǎi", isCorrect: false }
            ],
            explanation: "發音「mā / ㄇㄚ」對應「媽」！"
          }
        ]
      }
    ]
  },
  {
    volume: 3,
    gradeName: "第三冊 · 四季時序與大自然探索",
    targetAudience: "中低年級學童（7-8 歲）",
    description: "學習春夏秋冬、氣候節令、動植物生態，開始掌握段落短文閱讀與多音字。",
    totalChars: 220,
    badgeIcon: "🍂",
    colorTheme: "#f59e0b",
    lessons: []
  },
  {
    volume: 4,
    gradeName: "第四冊 · 社會生活與社區友好",
    targetAudience: "中年級學童（8-9 歲）",
    description: "學習公共設施、職業角色、交通出行、社交禮儀與書信便條寫作。",
    totalChars: 260,
    badgeIcon: "🏘️",
    colorTheme: "#8b5cf6",
    lessons: []
  },
  {
    volume: 5,
    gradeName: "第五冊 · 中華傳統節慶與民俗",
    targetAudience: "中年級學童（9-10 歲）",
    description: "春節、元宵、端午、中秋節慶由來、傳統美食文化與十二生肖傳說。",
    totalChars: 300,
    badgeIcon: "🏮",
    colorTheme: "#ef4444",
    lessons: []
  },
  {
    volume: 6,
    gradeName: "第六冊 · 歷史神話與成語寓言",
    targetAudience: "高年級學童（10-11 歲）",
    description: "盤古開天、女媧補天、愚公移山、經典寓言故事與成語典故精讀。",
    totalChars: 350,
    badgeIcon: "🐉",
    colorTheme: "#d97706",
    lessons: []
  },
  {
    volume: 7,
    gradeName: "第七冊 · 地理風貌與名勝古蹟",
    targetAudience: "高年級學童（11-12 歲）",
    description: "日月潭、長江黃河、故宮博物院、萬里長城，探索中華山川與古蹟人文。",
    totalChars: 400,
    badgeIcon: "🏯",
    colorTheme: "#0284c7",
    lessons: []
  },
  {
    volume: 8,
    gradeName: "第八冊 · 古典詩詞與名家名篇",
    targetAudience: "初中預備（12-13 歲）",
    description: "唐詩宋詞朗誦欣賞（李白、杜甫、蘇軾）、文言入門虛詞與音韻賞析。",
    totalChars: 450,
    badgeIcon: "📜",
    colorTheme: "#6366f1",
    lessons: []
  },
  {
    volume: 9,
    gradeName: "第九冊 · 科學思維與當代科技",
    targetAudience: "初中學童（13-14 歲）",
    description: "環境保護、航天探索、人工智慧、科普閱讀與邏輯議論文初探。",
    totalChars: 500,
    badgeIcon: "🔭",
    colorTheme: "#059669",
    lessons: []
  },
  {
    volume: 10,
    gradeName: "第十冊 · 跨文化對話與文學創作",
    targetAudience: "高階進階（14 歲以上 / 雙語精通）",
    description: "中西文學對比、深度文化思辨、散文創作與高階流暢商務中文表達。",
    totalChars: 600,
    badgeIcon: "🎓",
    colorTheme: "#ec4899",
    lessons: []
  }
];

type DraftStamped = {
  sourceKind: "TONGXUAN_AUTHORED";
  sourceName: "TongXuan legacy sample content";
  sourceUrl: string;
  sourceBook: string;
  sourceLesson: string;
  provenanceStatus: "INTERNAL_DRAFT";
  licenseStatus: "INTERNAL_ONLY";
  commercialReady: false;
};

function stampLegacyDraft(value: unknown, volume: number, lesson?: number): unknown {
  if (Array.isArray(value)) return value.map((entry) => stampLegacyDraft(entry, volume, lesson));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const lessonNumber = typeof record.lessonNumber === "number" ? record.lessonNumber : lesson;
  const children = Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, stampLegacyDraft(entry, volume, lessonNumber)]));
  const provenance: DraftStamped = {
    sourceKind: "TONGXUAN_AUTHORED",
    sourceName: "TongXuan legacy sample content",
    sourceUrl: "https://github.com/webber0612/TongXuan-Chinese/blob/main/frontend/src/data/ocacTextbooksData.ts",
    sourceBook: `UNVERIFIED_LEGACY_VOLUME_${volume}`,
    sourceLesson: lessonNumber ? `TONGXUAN_LEGACY_LESSON_${lessonNumber}` : "UNVERIFIED",
    provenanceStatus: "INTERNAL_DRAFT",
    licenseStatus: "INTERNAL_ONLY",
    commercialReady: false,
  };
  return { ...children, ...provenance };
}

/** Explicitly non-official legacy material retained for internal prototype use. */
export const TONGXUAN_AUTHORED_DRAFT_VOLUMES: AuthoredDraftVolume[] =
  LEGACY_UNVERIFIED_VOLUME_DATA.map((volume) => stampLegacyDraft(volume, volume.volume) as AuthoredDraftVolume);
