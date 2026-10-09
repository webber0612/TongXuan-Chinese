import { useState,type ReactNode } from "react";
import {
ShieldAlert,X,Key
} from "lucide-react";
import {
type RewardItem,
type RedemptionRecord,
type RewardCategory,
getRewardsCatalog,
saveRewardsCatalog,getRedemptionHistory,approveOrClaimTicket,setParentPin,
verifyParentPin,
addRewardItem,
updateRewardItem,
deleteRewardItem,
resetRewardsCatalogToDefault
} from "../../../data/rewardsShopData";

import { ScriptMode,DisplayLang,PhoneticAssist,ChildLearner } from "../types";
/* ========================================================
   家長鎖驗證與管理後台
   ======================================================== */
/* ========================================================
   家長鎖驗證與管理後台 (Parent Gate & Management Center)
   ======================================================== */
export function ParentLockModal({
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
              <h2>桐軒中文 · 家長管理與學習監督後台</h2>
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

