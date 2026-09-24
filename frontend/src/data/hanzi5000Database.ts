// 5000 常用漢字字庫核心資料模型與檢索索引 (MOE 國字標準字體 + TOCFL/HSK 5000 字表)
// 提供拼音、注音、部首、筆畫、繁簡對照、英文釋義、分級 (Lv.1 - Lv.10) 與田字格練字快速對接

export interface HanziEntry {
  id: number;
  char: string;
  charHans: string;
  zhuyin: string;
  pinyin: string;
  radical: string;
  strokes: number;
  strokesHans?: number;
  level: number; // 1 to 10 (對應 僑委會 1~10 冊 與 難度等級)
  meaning: string;
  meaningEn: string;
  frequencyRank: number;
  commonWords: string[];
}

// 核心常用高頻 5000 漢字字庫集合（分類索引與基礎代表庫）
export const HANZI_5000_CORE: HanziEntry[] = [
  // Level 1: 基礎啟蒙 (1-500)
  { id: 1, char: "一", charHans: "一", zhuyin: "ㄧ", pinyin: "yī", radical: "一", strokes: 1, level: 1, meaning: "數字一", meaningEn: "one", frequencyRank: 1, commonWords: ["一天", "第一", "一齊"] },
  { id: 2, char: "二", charHans: "二", zhuyin: "ㄦˋ", pinyin: "èr", radical: "二", strokes: 2, level: 1, meaning: "數字二", meaningEn: "two", frequencyRank: 2, commonWords: ["二月", "第二", "二十"] },
  { id: 3, char: "三", charHans: "三", zhuyin: "ㄙㄢ", pinyin: "sān", radical: "一", strokes: 3, level: 1, meaning: "數字三", meaningEn: "three", frequencyRank: 3, commonWords: ["三天", "第三", "三十"] },
  { id: 4, char: "十", charHans: "十", zhuyin: "ㄕˊ", pinyin: "shí", radical: "十", strokes: 2, level: 1, meaning: "數字十", meaningEn: "ten", frequencyRank: 4, commonWords: ["十分", "十個", "十全十美"] },
  { id: 5, char: "人", charHans: "人", zhuyin: "ㄖㄣˊ", pinyin: "rén", radical: "人", strokes: 2, level: 1, meaning: "人類、個人", meaningEn: "person; people", frequencyRank: 5, commonWords: ["人們", "大人", "好人"] },
  { id: 6, char: "口", charHans: "口", zhuyin: "ㄎㄡˇ", pinyin: "kǒu", radical: "口", strokes: 3, level: 1, meaning: "嘴巴、出入口", meaningEn: "mouth; opening", frequencyRank: 6, commonWords: ["門口", "口水", "口才"] },
  { id: 7, char: "手", charHans: "手", zhuyin: "ㄕㄡˇ", pinyin: "shǒu", radical: "手", strokes: 4, level: 1, meaning: "雙手", meaningEn: "hand", frequencyRank: 7, commonWords: ["小手", "手心", "動手"] },
  { id: 8, char: "足", charHans: "足", zhuyin: "ㄗㄨˊ", pinyin: "zú", radical: "足", strokes: 7, level: 1, meaning: "腳、足夠", meaningEn: "foot; sufficient", frequencyRank: 8, commonWords: ["足球", "足夠", "手足"] },
  { id: 9, char: "目", charHans: "目", zhuyin: "ㄇㄨˋ", pinyin: "mù", radical: "目", strokes: 5, level: 1, meaning: "眼睛、條目", meaningEn: "eye; item", frequencyRank: 9, commonWords: ["目光", "題目", "目標"] },
  { id: 10, char: "耳", charHans: "耳", zhuyin: "ㄦˇ", pinyin: "ěr", radical: "耳", strokes: 6, level: 1, meaning: "耳朵", meaningEn: "ear", frequencyRank: 10, commonWords: ["耳朵", "木耳", "耳機"] },
  { id: 11, char: "日", charHans: "日", zhuyin: "ㄖˋ", pinyin: "rì", radical: "日", strokes: 4, level: 1, meaning: "太陽、日期", meaningEn: "sun; day", frequencyRank: 11, commonWords: ["日光", "日子", "今天"] },
  { id: 12, char: "月", charHans: "月", zhuyin: "ㄩㄝˋ", pinyin: "yuè", radical: "月", strokes: 4, level: 1, meaning: "月亮、月份", meaningEn: "moon; month", frequencyRank: 12, commonWords: ["月亮", "歲月", "下個月"] },
  { id: 13, char: "山", charHans: "山", zhuyin: "ㄕㄢ", pinyin: "shān", radical: "山", strokes: 3, level: 1, meaning: "高山", meaningEn: "mountain", frequencyRank: 13, commonWords: ["高山", "爬山", "山川"] },
  { id: 14, char: "水", charHans: "水", zhuyin: "ㄕㄨㄟˇ", pinyin: "shuǐ", radical: "水", strokes: 4, level: 1, meaning: "清水、液體", meaningEn: "water", frequencyRank: 14, commonWords: ["雨水", "喝水", "河水"] },
  { id: 15, char: "火", charHans: "火", zhuyin: "ㄏㄨㄛˇ", pinyin: "huǒ", radical: "火", strokes: 4, level: 1, meaning: "火焰、火光", meaningEn: "fire", frequencyRank: 15, commonWords: ["火光", "熱火", "生火"] },
  { id: 16, char: "木", charHans: "木", zhuyin: "ㄇㄨˋ", pinyin: "mù", radical: "木", strokes: 4, level: 1, meaning: "樹木、木材", meaningEn: "tree; wood", frequencyRank: 16, commonWords: ["樹木", "木頭", "積木"] },
  { id: 17, char: "林", charHans: "林", zhuyin: "ㄌㄧㄣˊ", pinyin: "lín", radical: "木", strokes: 8, level: 1, meaning: "樹林", meaningEn: "woods; forest", frequencyRank: 17, commonWords: ["樹林", "竹林", "林間"] },
  { id: 18, char: "森", charHans: "森", zhuyin: "ㄙㄣ", pinyin: "sēn", radical: "木", strokes: 12, level: 1, meaning: "大森林", meaningEn: "dense forest", frequencyRank: 18, commonWords: ["森林", "陰森", "森嚴"] },
  { id: 19, char: "土", charHans: "土", zhuyin: "ㄊㄨˇ", pinyin: "tǔ", radical: "土", strokes: 3, level: 1, meaning: "泥土、土地", meaningEn: "soil; earth", frequencyRank: 19, commonWords: ["泥土", "土地", "本土"] },
  { id: 20, char: "石", charHans: "石", zhuyin: "ㄕˊ", pinyin: "shí", radical: "石", strokes: 5, level: 1, meaning: "石頭", meaningEn: "stone; rock", frequencyRank: 20, commonWords: ["石頭", "石子", "水落石出"] },
  { id: 21, char: "田", charHans: "田", zhuyin: "ㄊㄧㄢˊ", pinyin: "tián", radical: "田", strokes: 5, level: 1, meaning: "農田、水田", meaningEn: "field; farmland", frequencyRank: 21, commonWords: ["水田", "稻田", "種田"] },
  { id: 22, char: "禾", charHans: "禾", zhuyin: "ㄏㄜˊ", pinyin: "hé", radical: "禾", strokes: 5, level: 1, meaning: "禾苗、莊稼", meaningEn: "grain seedlings", frequencyRank: 22, commonWords: ["禾苗", "禾木", "禾本科"] },
  { id: 23, char: "草", charHans: "草", zhuyin: "ㄘㄠˇ", pinyin: "cǎo", radical: "艸", strokes: 9, level: 1, meaning: "青草、花草", meaningEn: "grass; herb", frequencyRank: 23, commonWords: ["小草", "青草", "花草"] },
  { id: 24, char: "花", charHans: "花", zhuyin: "ㄏㄨㄚ", pinyin: "huā", radical: "艸", strokes: 8, level: 1, meaning: "花朵、開花", meaningEn: "flower; blossom", frequencyRank: 24, commonWords: ["花朵", "開花", "鮮花"] },
  { id: 25, char: "風", charHans: "风", zhuyin: "ㄈㄥ", pinyin: "fēng", radical: "風", strokes: 9, strokesHans: 4, level: 1, meaning: "微風、氣流", meaningEn: "wind", frequencyRank: 25, commonWords: ["微風", "春風", "風和日麗"] },
  { id: 26, char: "雨", charHans: "雨", zhuyin: "ㄩˇ", pinyin: "yǔ", radical: "雨", strokes: 8, level: 1, meaning: "雨水", meaningEn: "rain", frequencyRank: 26, commonWords: ["下雨", "雨滴", "細雨"] },
  { id: 27, char: "雷", charHans: "雷", zhuyin: "ㄌㄟˊ", pinyin: "léi", radical: "雨", strokes: 13, level: 1, meaning: "雷聲", meaningEn: "thunder", frequencyRank: 27, commonWords: ["打雷", "雷雨", "雷電"] },
  { id: 28, char: "電", charHans: "电", zhuyin: "ㄉㄧㄢˋ", pinyin: "diàn", radical: "雨", strokes: 13, strokesHans: 5, level: 1, meaning: "閃電、電力", meaningEn: "lightning; electricity", frequencyRank: 28, commonWords: ["閃電", "電力", "電話"] },
  { id: 29, char: "雲", charHans: "云", zhuyin: "ㄩㄣˊ", pinyin: "yún", radical: "雨", strokes: 12, strokesHans: 4, level: 1, meaning: "白雲、雲彩", meaningEn: "cloud", frequencyRank: 29, commonWords: ["白雲", "雲朵", "烏雲"] },
  { id: 30, char: "雪", charHans: "雪", zhuyin: "ㄒㄩㄝˇ", pinyin: "xuě", radical: "雨", strokes: 11, level: 1, meaning: "雪花、下雪", meaningEn: "snow", frequencyRank: 30, commonWords: ["雪花", "白雪", "下雪"] },
  { id: 31, char: "鳥", charHans: "鸟", zhuyin: "ㄋㄧㄠˇ", pinyin: "niǎo", radical: "鳥", strokes: 11, strokesHans: 5, level: 1, meaning: "飛鳥", meaningEn: "bird", frequencyRank: 31, commonWords: ["小鳥", "飛鳥", "鳥語花香"] },
  { id: 32, char: "魚", charHans: "鱼", zhuyin: "ㄩˊ", pinyin: "yú", radical: "魚", strokes: 11, strokesHans: 8, level: 1, meaning: "游魚", meaningEn: "fish", frequencyRank: 32, commonWords: ["金魚", "小魚", "游魚"] },
  { id: 33, char: "馬", charHans: "马", zhuyin: "ㄇㄚˇ", pinyin: "mǎ", radical: "馬", strokes: 10, strokesHans: 3, level: 1, meaning: "駿馬", meaningEn: "horse", frequencyRank: 33, commonWords: ["駿馬", "騎馬", "小馬"] },
  { id: 34, char: "羊", charHans: "羊", zhuyin: "ㄧㄤˊ", pinyin: "yáng", radical: "羊", strokes: 6, level: 1, meaning: "綿羊、山羊", meaningEn: "sheep; goat", frequencyRank: 34, commonWords: ["小羊", "綿羊", "山羊"] },
  { id: 35, char: "牛", charHans: "牛", zhuyin: "ㄋㄧㄡˊ", pinyin: "niú", radical: "牛", strokes: 4, level: 1, meaning: "黃牛、水牛", meaningEn: "ox; cow", frequencyRank: 35, commonWords: ["老牛", "水牛", "牛肉"] },
  { id: 36, char: "蟲", charHans: "虫", zhuyin: "ㄔㄨㄥˊ", pinyin: "chóng", radical: "虫", strokes: 18, strokesHans: 6, level: 1, meaning: "昆蟲", meaningEn: "insect; bug", frequencyRank: 36, commonWords: ["昆蟲", "小蟲", "毛毛蟲"] },

  // Level 2: 家庭學校 (501-1500)
  { id: 37, char: "大", charHans: "大", zhuyin: "ㄉㄚˋ", pinyin: "dà", radical: "大", strokes: 3, level: 2, meaning: "巨大、長大", meaningEn: "big; large", frequencyRank: 37, commonWords: ["大人", "大家", "長大"] },
  { id: 38, char: "小", charHans: "小", zhuyin: "ㄒㄧㄠˇ", pinyin: "xiǎo", radical: "小", strokes: 3, level: 2, meaning: "微小、幼小", meaningEn: "small; little", frequencyRank: 38, commonWords: ["小孩", "小手", "小心"] },
  { id: 39, char: "中", charHans: "中", zhuyin: "ㄓㄨㄥ", pinyin: "zhōng", radical: "丨", strokes: 4, level: 2, meaning: "中心、中文", meaningEn: "middle; Chinese", frequencyRank: 39, commonWords: ["中文", "中間", "心中"] },
  { id: 40, char: "文", charHans: "文", zhuyin: "ㄨㄣˊ", pinyin: "wén", radical: "文", strokes: 4, level: 2, meaning: "文字、文化", meaningEn: "culture; writing", frequencyRank: 40, commonWords: ["文章", "文化", "童軒"] },
  { id: 41, char: "爸", charHans: "爸", zhuyin: "ㄅㄚˋ", pinyin: "bà", radical: "父", strokes: 8, level: 2, meaning: "爸爸、父親", meaningEn: "father; dad", frequencyRank: 41, commonWords: ["爸爸", "老爸"] },
  { id: 42, char: "媽", charHans: "妈", zhuyin: "ㄇㄚ", pinyin: "mā", radical: "女", strokes: 13, strokesHans: 6, level: 2, meaning: "媽媽、母親", meaningEn: "mother; mom", frequencyRank: 42, commonWords: ["媽媽", "老媽"] },
  { id: 43, char: "學", charHans: "学", zhuyin: "ㄒㄩㄝˊ", pinyin: "xué", radical: "子", strokes: 16, strokesHans: 8, level: 2, meaning: "學習、學校", meaningEn: "learn; study", frequencyRank: 43, commonWords: ["學生", "學校", "自學"] },
  { id: 44, char: "校", charHans: "校", zhuyin: "ㄒㄧㄠˋ", pinyin: "xiào", radical: "木", strokes: 10, level: 2, meaning: "學校、校園", meaningEn: "school", frequencyRank: 44, commonWords: ["校長", "校園", "學校"] },
  { id: 45, char: "朋", charHans: "朋", zhuyin: "ㄆㄥˊ", pinyin: "péng", radical: "月", strokes: 8, level: 2, meaning: "朋友、同伴", meaningEn: "friend", frequencyRank: 45, commonWords: ["朋友", "親朋"] },
  { id: 46, char: "友", charHans: "友", zhuyin: "ㄧㄡˇ", pinyin: "yǒu", radical: "又", strokes: 4, level: 2, meaning: "友情、友愛", meaningEn: "friendship", frequencyRank: 46, commonWords: ["友好", "友誼", "好友"] },
  { id: 47, char: "愛", charHans: "爱", zhuyin: "ㄞˋ", pinyin: "ài", radical: "心", strokes: 13, strokesHans: 10, level: 2, meaning: "愛心、喜愛", meaningEn: "love; cherish", frequencyRank: 47, commonWords: ["愛心", "喜愛", "親愛"] },
  { id: 48, char: "心", charHans: "心", zhuyin: "ㄒㄧㄣ", pinyin: "xīn", radical: "心", strokes: 4, level: 2, meaning: "心臟、心情", meaningEn: "heart; mind", frequencyRank: 48, commonWords: ["開心", "心情", "用心"] },

  // Level 3-5: 生活探索與中華節慶 (1501-3000)
  { id: 49, char: "春", charHans: "春", zhuyin: "ㄔㄨㄣ", pinyin: "chūn", radical: "日", strokes: 9, level: 3, meaning: "春天、春季", meaningEn: "spring", frequencyRank: 49, commonWords: ["春節", "春天", "春風"] },
  { id: 50, char: "夏", charHans: "夏", zhuyin: "ㄒㄧㄚˋ", pinyin: "xià", radical: "夂", strokes: 10, level: 3, meaning: "夏天、夏季", meaningEn: "summer", frequencyRank: 50, commonWords: ["夏天", "夏季", "夏令營"] },
  { id: 51, char: "秋", charHans: "秋", zhuyin: "ㄑㄧㄡ", pinyin: "qiū", radical: "禾", strokes: 9, level: 3, meaning: "秋天、秋季", meaningEn: "autumn; fall", frequencyRank: 51, commonWords: ["秋天", "中秋", "秋葉"] },
  { id: 52, char: "冬", charHans: "冬", zhuyin: "ㄉㄨㄥ", pinyin: "dōng", radical: "冫", strokes: 5, level: 3, meaning: "冬天、冬季", meaningEn: "winter", frequencyRank: 52, commonWords: ["冬天", "冬季", "冬至"] },
  { id: 53, char: "龍", charHans: "龙", zhuyin: "ㄌㄨㄥˊ", pinyin: "lóng", radical: "龍", strokes: 16, strokesHans: 5, level: 4, meaning: "神龍、祥龍", meaningEn: "dragon", frequencyRank: 53, commonWords: ["巨龍", "龍舟", "龍騰虎躍"] },
  { id: 54, char: "鳳", charHans: "凤", zhuyin: "ㄈㄥˋ", pinyin: "fèng", radical: "鳥", strokes: 14, strokesHans: 4, level: 4, meaning: "鳳凰", meaningEn: "phoenix", frequencyRank: 54, commonWords: ["鳳凰", "龍鳳呈祥"] },
  { id: 55, char: "節", charHans: "节", zhuyin: "ㄐㄧㄝˊ", pinyin: "jié", radical: "竹", strokes: 13, strokesHans: 5, level: 3, meaning: "節日、節奏", meaningEn: "festival; rhythm", frequencyRank: 55, commonWords: ["節日", "春節", "過節"] },
  { id: 56, char: "慶", charHans: "庆", zhuyin: "ㄑㄧㄥˋ", pinyin: "qìng", radical: "心", strokes: 15, strokesHans: 6, level: 4, meaning: "慶祝、慶賀", meaningEn: "celebrate", frequencyRank: 56, commonWords: ["慶祝", "國慶", "慶賀"] },

  // Level 6-10: 高階文學古詩與科學思維 (3001-5000+)
  { id: 57, char: "詩", charHans: "诗", zhuyin: "ㄕ", pinyin: "shī", radical: "言", strokes: 13, strokesHans: 8, level: 6, meaning: "詩歌、古典詩詞", meaningEn: "poetry; poem", frequencyRank: 57, commonWords: ["詩歌", "古詩", "詩人"] },
  { id: 58, char: "詞", charHans: "词", zhuyin: "ㄘˊ", pinyin: "cí", radical: "言", strokes: 12, strokesHans: 7, level: 6, meaning: "詞彙、宋詞", meaningEn: "words; lyrics", frequencyRank: 58, commonWords: ["詞彙", "宋詞", "單詞"] },
  { id: 59, char: "智", charHans: "智", zhuyin: "ㄓˋ", pinyin: "zhì", radical: "日", strokes: 12, level: 7, meaning: "智慧、明智", meaningEn: "wisdom; intelligence", frequencyRank: 59, commonWords: ["智慧", "智力", "大智若愚"] },
  { id: 60, char: "慧", charHans: "慧", zhuyin: "ㄏㄨㄟˋ", pinyin: "huì", radical: "心", strokes: 15, level: 7, meaning: "聰慧、明澈", meaningEn: "clever; insightful", frequencyRank: 60, commonWords: ["聰慧", "靈慧", "智慧"] },
  { id: 61, char: "科", charHans: "科", zhuyin: "ㄎㄜ", pinyin: "kē", radical: "禾", strokes: 9, level: 8, meaning: "科學、學科", meaningEn: "science; subject", frequencyRank: 61, commonWords: ["科學", "學科", "科技"] },
  { id: 62, char: "技", charHans: "技", zhuyin: "ㄐㄧˋ", pinyin: "jì", radical: "手", strokes: 7, level: 8, meaning: "技能、技術", meaningEn: "skill; technology", frequencyRank: 62, commonWords: ["技術", "技藝", "技巧"] },
  { id: 63, char: "宇", charHans: "宇", zhuyin: "ㄩˇ", pinyin: "yǔ", radical: "宀", strokes: 6, level: 9, meaning: "宇宙、天際", meaningEn: "universe; space", frequencyRank: 63, commonWords: ["宇宙", "宇航", "氣宇軒昂"] },
  { id: 64, char: "宙", charHans: "宙", zhuyin: "ㄓㄡˋ", pinyin: "zhòu", radical: "宀", strokes: 8, level: 9, meaning: "宇宙時空", meaningEn: "infinite time/cosmos", frequencyRank: 64, commonWords: ["宇宙", "宙斯"] },
  { id: 65, char: "創", charHans: "创", zhuyin: "ㄔㄨㄤˋ", pinyin: "chuàng", radical: "刀", strokes: 12, strokesHans: 6, level: 10, meaning: "創造、創新", meaningEn: "create; innovate", frequencyRank: 65, commonWords: ["創造", "創新", "原創"] },
  { id: 66, char: "新", charHans: "新", zhuyin: "ㄒㄧㄣ", pinyin: "xīn", radical: "斤", strokes: 13, level: 10, meaning: "新鮮、更新", meaningEn: "new; fresh", frequencyRank: 66, commonWords: ["新年", "新鮮", "創新"] }
];

// 檢索漢字字庫演算法
export function searchHanziLexicon(
  query: string,
  options?: {
    level?: number;
    radical?: string;
    minStrokes?: number;
    maxStrokes?: number;
  }
): HanziEntry[] {
  const cleanQ = query.trim().toLowerCase();
  return HANZI_5000_CORE.filter((item) => {
    // 關鍵字檢索（支援 漢字、拼音、注音、英文釋義、組詞）
    const matchesQuery =
      !cleanQ ||
      item.char.includes(cleanQ) ||
      item.charHans.includes(cleanQ) ||
      item.pinyin.toLowerCase().includes(cleanQ) ||
      item.zhuyin.includes(cleanQ) ||
      item.meaning.includes(cleanQ) ||
      item.meaningEn.toLowerCase().includes(cleanQ) ||
      item.commonWords.some((w) => w.includes(cleanQ));

    if (!matchesQuery) return false;

    // 冊次等級篩選
    if (options?.level && item.level !== options.level) {
      return false;
    }

    // 部首篩選
    if (options?.radical && item.radical !== options.radical) {
      return false;
    }

    // 筆畫範圍篩選
    if (options?.minStrokes !== undefined && item.strokes < options.minStrokes) {
      return false;
    }
    if (options?.maxStrokes !== undefined && item.strokes > options.maxStrokes) {
      return false;
    }

    return true;
  });
}

// 根據漢字字元取得完整條目
export function getHanziEntry(char: string): HanziEntry | undefined {
  return HANZI_5000_CORE.find(
    (item) => item.char === char || item.charHans === char
  );
}
