import { useState,type ReactNode } from "react";
import {
X
} from "lucide-react";
import {
type RewardItem,
type RedemptionRecord,getRewardsCatalog,getRedemptionHistory,
redeemRewardItem,
approveOrClaimTicket,verifyParentPin
} from "../../../data/rewardsShopData";
import {
trackRewardRedeem
} from "../../../lib/analytics";

/* ========================================================
   4. 積分金幣結算與禮物獎勵商城 (Rewards Shop & Privilege Passbook)
   ======================================================== */
export function RewardsStoreModal({
  points,
  redemptions,
  onUpdatePoints,
  onUpdateRedemptions,
  onClose,
  R,
  t
}: {
  points: { coins: number; stars: number };
  redemptions: RedemptionRecord[];
  onUpdatePoints: (newPts: { coins: number; stars: number }) => void;
  onUpdateRedemptions: (newHistory: RedemptionRecord[]) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
  t: (key: string, values?: Record<string, string | number>) => string;
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
      trackRewardRedeem(item.name, item.costStars || item.costCoins);
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
              <h2>{t("rewardsStoreTitle")}</h2>
              <p className="rewards-sub">{t("rewardsStoreSub")}</p>
            </div>
          </div>

          <div className="rewards-balance-box">
            <div className="balance-item-chip gold-coin-chip" title="可消耗金幣">
              <span className="coin-icon">🪙</span>
              <span className="balance-val">{points.coins.toLocaleString()}</span>
              <small>{t("coinBalanceLabel")}</small>
            </div>
            <div className="balance-item-chip star-chip" title="學習累積星星（榮譽門檻）">
              <span className="star-icon">⭐</span>
              <span className="balance-val">{points.stars}</span>
              <small>{t("starBalanceLabel")}</small>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="rewards-tabs-row">
          <button
            className={`rewards-tab-btn ${activeTab === "shop" ? "active" : ""}`}
            onClick={() => setActiveTab("shop")}
          >
            {t("tabCatalog")}
          </button>
          <button
            className={`rewards-tab-btn ${activeTab === "passbook" ? "active" : ""}`}
            onClick={() => setActiveTab("passbook")}
          >
            {t("tabPassbook")} ({totalPendingTickets})
            {totalPendingTickets > 0 && (
              <span className="passbook-pending-badge">{t("passbookPendingCount", { n: totalPendingTickets })}</span>
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
                        <span className="cost-tag coin-cost">{t("costCoinLabel", { n: item.costCoins.toLocaleString() })}</span>
                        <span className="cost-tag star-cost">{t("costStarThreshold", { n: item.costStars })}</span>
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
                {t("passbookUsageGuide")}
              </p>
            </div>

            {/* Passbook Sub-Tabs: Pending vs Claimed */}
            <div className="passbook-subtabs-row">
              <button
                type="button"
                className={`passbook-subtab-btn ${passbookSubTab === "pending" ? "active" : ""}`}
                onClick={() => setPassbookSubTab("pending")}
              >
                {t("tabPendingVouchers", { n: totalPendingTickets })}
              </button>
              <button
                type="button"
                className={`passbook-subtab-btn ${passbookSubTab === "claimed" ? "active" : ""}`}
                onClick={() => setPassbookSubTab("claimed")}
              >
                {t("tabClaimedVouchers", { n: claimedList.length })}
              </button>
            </div>

            {passbookSubTab === "pending" ? (
              pendingList.length === 0 ? (
                <div className="empty-passbook-state">
                  <span>🎟️</span>
                  <h4>{t("noPendingVouchersTitle")}</h4><p>{t("noPendingVouchersDesc")}</p>
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
                          <div className="ticket-status-pill pending">{t("pendingBadge")}</div>
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
                            {t("useTicketBtn")}
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
                  <h4>{t("noClaimedVouchersTitle")}</h4><p>{t("noClaimedVouchersDesc")}</p>
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
                          <div className="ticket-status-pill claimed">{t("claimedBadge")}</div>
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
              <h3>{t("parentPinDialogTitle")}</h3>
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

