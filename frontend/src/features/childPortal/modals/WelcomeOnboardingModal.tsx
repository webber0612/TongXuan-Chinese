import { useState,type ReactNode } from "react";
import {
ArrowRight,X
} from "lucide-react";

import { ScriptMode,DisplayLang,HandMode } from "../types";
/* ========================================================
   1. 第一次進入的使用者歡迎畫面與新手啟航引導
   ======================================================== */
export function WelcomeOnboardingModal({
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
    handMode?: HandMode;
    displayLang: DisplayLang;
  }) => void;
  R?: (text: string) => ReactNode;
}) {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>("小明");
  const [avatar, setAvatar] = useState<string>("🐼");
  const [selectedScript, setSelectedScript] = useState<ScriptMode>("dual");
  const [selectedHand, setSelectedHand] = useState<HandMode>(() => {
    if (typeof window === "undefined") return "right";
    const saved = localStorage.getItem("tongxuan_hand_mode");
    return saved === "left" || saved === "right" ? saved : "right";
  });

  const avatars = ["🐼", "🐯", "🐰", "🦁", "🐨", "🦊", "🐶", "🦄"];

  const handleFinish = () => {
    localStorage.setItem("tongxuan_onboarded", "true");
    localStorage.setItem("tongxuan_hand_mode", selectedHand);
    onComplete({
      name: name.trim() || "小明",
      avatar,
      scriptMode: selectedScript,
      handMode: selectedHand,
      displayLang
    });
  };

  // Multilingual text dictionary for Onboarding
  const i18nTexts: Record<string, Record<string, string>> = {
    "zh-Hant": {
      langLabel: "介面語言：",
      step1: "學習角色",
      step2: "字體偏好",
      heroTitle: "歡迎來到 桐軒中文！",
      heroDesc: "為寶貝建立專屬學習身分，開啟溫暖有趣的漢字探索之旅！",
      nameLabel: "小朋友的暱稱或姓名",
      namePlaceholder: "例如：安安、小明、亮亮",
      avatarLabel: "挑選一隻最喜歡的學習夥伴頭像",
      handLabel: "書寫慣用手（可隨時換手）：",
      handRight: "右手寫字",
      handLeft: "左手寫字",
      step2Title: "選擇偏好的學習字體與標音",
      step2Desc: "桐軒深度支援繁簡雙軌！簡中用戶可透過雙軌對照輕鬆掌握繁體字形與筆畫。",
      dualTag: "✨ 推薦雙軌",
      dualTitle: "繁體注音 + 簡體拼音（雙軌模式）",
      dualDesc: "同步掌握繁體字形結構之美與簡體常用規範。簡中用戶能藉由對照快速認寫繁體！",
      twTag: "🇹🇼 臺灣正體",
      twTitle: "繁體中文 + 注音符號（ㄅㄆㄇ）",
      twDesc: "標準教育部標楷體筆順與注音標音，奠定最扎實的正體字書寫基礎。",
      cnTag: "🔤 規範漢字",
      cnTitle: "簡體中文 + 漢語拼音（pīnyīn）",
      cnDesc: "國際通用漢語拼音輔助發音，簡化筆畫快速開展識字與閱讀。",
      nextBtnScript: "下一步：選擇學習字體",
      finishBtn: "🚀 完成設定 · 開始第一課！",
      backBtn: "上一步"
    },
    "zh-Hans": {
      langLabel: "界面语言：",
      step1: "学习角色",
      step2: "字体偏好",
      heroTitle: "欢迎来到 童轩中文！",
      heroDesc: "为宝贝建立专属学习身分，开启温暖有趣的汉字探索之旅！",
      nameLabel: "小朋友的昵称或姓名",
      namePlaceholder: "例如：安安、小明、亮亮",
      avatarLabel: "挑选一只最喜欢的学习伙伴头像",
      handLabel: "书写惯用手（可随时换手）：",
      handRight: "右手写字",
      handLeft: "左手写字",
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
      nextBtnScript: "下一步：选择学习字体",
      finishBtn: "🚀 完成设定 · 开始第一课！",
      backBtn: "上一步"
    },
    "en": {
      langLabel: "Language:",
      step1: "Profile",
      step2: "Script",
      heroTitle: "Welcome to TongXuan Chinese!",
      heroDesc: "Create a personalized learner profile and start a warm, engaging Chinese adventure!",
      nameLabel: "Child's Nickname or Name",
      namePlaceholder: "e.g. Leo, Anna, Max",
      avatarLabel: "Pick a favorite learning avatar buddy",
      handLabel: "Writing Hand (switch anytime):",
      handRight: "Right Hand",
      handLeft: "Left Hand",
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
      nextBtnScript: "Next: Choose Script Mode",
      finishBtn: "🚀 Complete Setup · Start Lesson 1!",
      backBtn: "Back"
    }
  };

  const L = (key: string) => {
    return i18nTexts[displayLang]?.[key] || i18nTexts["zh-Hant"][key] || key;
  };

  const stepsData = [
    { num: 1, title: L("step1"), icon: "👤" },
    { num: 2, title: L("step2"), icon: "🔤" }
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

        {/* Top Step Progress Bar */}
        <div className="onboard-stepper-container">
          <div className="onboard-stepper-track">
            <div
              className="onboard-stepper-progress-fill"
              style={{ width: `${((step - 1) / (stepsData.length - 1 || 1)) * 100}%` }}
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

              {/* Hand Mode Selector: 習慣用手（右手／左手寫字） */}
              <div className="onboard-field-group">
                <label className="onboard-field-label">
                  <span className="label-icon">✍️</span>
                  <span>{L("handLabel")}</span>
                </label>
                <div className="onboard-hand-pills">
                  <button
                    type="button"
                    className={`onboard-hand-btn ${selectedHand === "right" ? "is-selected" : ""}`}
                    onClick={() => setSelectedHand("right")}
                  >
                    <span>✋</span>
                    <span>{L("handRight")}</span>
                  </button>
                  <button
                    type="button"
                    className={`onboard-hand-btn ${selectedHand === "left" ? "is-selected" : ""}`}
                    onClick={() => setSelectedHand("left")}
                  >
                    <span>🤚</span>
                    <span>{L("handLeft")}</span>
                  </button>
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
                className="onboard-primary-btn launch-finish-btn"
                onClick={handleFinish}
              >
                <span>{L("finishBtn")}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

