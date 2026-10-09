import { DisplayLang } from "./types";
/* ========================================================
   FULLSCREEN INTERACTIVE CLASSROOM (分區練字教室)
   - ① 練字區 (標準標楷體字型 + 提示漸退 + 筆順檢查 + 筆畫展示播放 + 整合發音膠囊)
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

