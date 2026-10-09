import { useState } from "react";
import {
X
} from "lucide-react";

/* ========================================================
   5. 關於桐軒中文、版權宣告與檢定進階路線 (About & Roadmap)
   ======================================================== */
export function AboutTongXuanModal({
  initialTab = "about",
  t = (k) => k,
  onClose
}: {
  initialTab?: "about" | "roadmap" | "legal" | "disclaimer";
  t?: (key: string, values?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"about" | "roadmap" | "legal" | "disclaimer">(initialTab);

  return (
    <div className="modal-backdrop">
      <div className="about-tongxuan-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="about-modal-header">
          <div className="about-brand-badge">☀️</div>
          <div>
            <h2>{t("aboutModalTitle")}</h2>
            <p className="about-sub-lead">
              {t("aboutModalSub")}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="about-tabs-row">
          <button
            className={`about-tab-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            {t("tabAbout")}
          </button>
          <button
            className={`about-tab-btn ${activeTab === "roadmap" ? "active" : ""}`}
            onClick={() => setActiveTab("roadmap")}
          >
            {t("tabRoadmap")}
          </button>
          <button
            className={`about-tab-btn ${activeTab === "legal" ? "active" : ""}`}
            onClick={() => setActiveTab("legal")}
          >
            {t("tabLegal")}
          </button>
          <button
            className={`about-tab-btn ${activeTab === "disclaimer" ? "active" : ""}`}
            onClick={() => setActiveTab("disclaimer")}
          >
            {t("tabDisclaimer")}
          </button>
        </div>

        {/* TAB 1: 理念與特色 */}
        {activeTab === "about" && (
          <div className="about-tab-pane animate-fade">
            <div className="about-feature-cards-grid">
              <div className="about-feature-box">
                <span className="feat-icon">✍️</span>
                <h4>{t("aboutFeat1Title")}</h4>
                <p>{t("aboutFeat1Desc")}</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">🇹🇼🔤</span>
                <h4>{t("aboutFeat2Title")}</h4>
                <p>{t("aboutFeat2Desc")}</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">📚</span>
                <h4>{t("aboutFeat3Title")}</h4>
                <p>{t("aboutFeat3Desc")}</p>
              </div>
              <div className="about-feature-box">
                <span className="feat-icon">🎁</span>
                <h4>{t("aboutFeat4Title")}</h4>
                <p>{t("aboutFeat4Desc")}</p>
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
                  <h4>📖 基礎字詞：桐軒舊版階段草稿</h4>
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
                  <h4>🚀 獨立閱讀：桐軒舊版階段草稿</h4>
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
                  <h4>🌳 文化深讀：桐軒舊版階段草稿</h4>
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
                  <h4>🎓 學術中文與高階檢定專題：桐軒舊版階段草稿</h4>
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
                  <strong>桐軒自編示範內容：</strong>
                  這些舊關卡與生字資料是內部草稿，未逐課驗證為僑務委員會（OCAC）《學華語向前走》教材。官方課程路線與目標請查看學習地圖中的已驗證切片。
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
                <span>© 2026 桐軒中文 (TongXuan Chinese) · 陪伴每一位孩子探索漢字之美</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 測試版免責聲明與隱私條款 */}
        {activeTab === "disclaimer" && (
          <div className="about-tab-pane animate-fade">
            <div className="legal-notice-box">
              <h3>{t("disclaimerTitle")}</h3>
              <ul className="legal-points-list">
                <li>
                  <strong>{t("disclaimerPoint1Title")}</strong>
                  {t("disclaimerPoint1Desc")}
                </li>
                <li>
                  <strong>{t("disclaimerPoint2Title")}</strong>
                  {t("disclaimerPoint2Desc")}
                </li>
                <li>
                  <strong>{t("disclaimerPoint3Title")}</strong>
                  {t("disclaimerPoint3Desc")}
                </li>
                <li>
                  <strong>{t("disclaimerPoint4Title")}</strong>
                  {t("disclaimerPoint4Desc")}
                </li>
              </ul>
              <div className="legal-footer-note">
                <span>{t("disclaimerFooter")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

