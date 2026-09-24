// 童軒中文 · 獎勵品庫與家長核銷帳本 (Rewards Store & Voucher Ledger)

export type RewardCategory = "privilege" | "time" | "food" | "adventure" | "wish" | "stationery" | "badge" | "physical";

export interface RewardItem {
  id: string;
  name: string;
  category: RewardCategory;
  costCoins: number;
  costStars: number;
  icon: string;
  description: string;
  stock: number;
  requiresParentApproval: boolean;
  isExpertRecommended?: boolean;
  enabled?: boolean;
}

export interface RedemptionRecord {
  id: string;
  itemId: string;
  itemName: string;
  itemIcon: string;
  costCoins: number;
  costStars?: number;
  redeemedAt: string;
  status: "approved" | "pending" | "claimed";
  ticketCode: string;
  quantity?: number;
}

// 預設生活約定與成就感獎勵庫
export const DEFAULT_REWARDS: RewardItem[] = [
  {
    id: "reward-dinner-choice",
    name: "🍽️ 晚餐菜色指定券",
    category: "privilege",
    costCoins: 60,
    costStars: 4,
    icon: "🍽️",
    description: "今晚由我做主！全家人晚餐吃我想點的菜色或主餐！",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-noodle-treat",
    name: "🍜 美味泡麵券",
    category: "food",
    costCoins: 50,
    costStars: 3,
    icon: "🍜",
    description: "解鎖吃一次香噴噴泡麵的快樂，加蛋加青菜更美味！",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-tv-1hr",
    name: "📺 看電視 / 動畫 1小時券",
    category: "time",
    costCoins: 70,
    costStars: 5,
    icon: "📺",
    description: "自由挑選喜愛的卡通、科普節目或電影觀看 60 分鐘。",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-tablet-1hr",
    name: "📱 平板 / 自由螢幕 1小時券",
    category: "time",
    costCoins: 80,
    costStars: 6,
    icon: "📱",
    description: "完成今日學習後，兌換 60 分鐘自主自由螢幕娛樂時光。",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-dessert-treat",
    name: "🍦 週末冰淇淋 / 甜點自選券",
    category: "food",
    costCoins: 85,
    costStars: 6,
    icon: "🍦",
    description: "週末去超市或甜點店，任選一份心儀的冰品或甜點！",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-living-room-camp",
    name: "⛺ 客廳搭帳篷探險券",
    category: "adventure",
    costCoins: 110,
    costStars: 8,
    icon: "⛺",
    description: "週末晚上在客廳搭小帳篷露營睡一晚，體驗室內大探險！",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-late-sleep-30m",
    name: "🛌 週末晚睡 30 分鐘券",
    category: "privilege",
    costCoins: 50,
    costStars: 4,
    icon: "🛌",
    description: "週末晚上延後 30 分鐘就寢，享受睡前親子聊天或閱讀時光。",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-no-chore-day",
    name: "✨ 免做家事一天券",
    category: "privilege",
    costCoins: 95,
    costStars: 7,
    icon: "✨",
    description: "今天所有家務勞動全由爸媽代勞，好好放鬆一整天！",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-game-switch-45m",
    name: "🎮 電玩 / Switch 45分鐘券",
    category: "time",
    costCoins: 75,
    costStars: 5,
    icon: "🎮",
    description: "暢玩最喜歡的電視或手把主機遊戲 45 分鐘。",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  },
  {
    id: "reward-custom-wish",
    name: "🌟 家長自訂心願兌換券",
    category: "wish",
    costCoins: 150,
    costStars: 10,
    icon: "🌟",
    description: "與爸爸媽媽約定好的專屬心願（如去公園野餐、買一本書）。",
    stock: 999,
    requiresParentApproval: true,
    enabled: true
  }
];

export const DEFAULT_EXPERT_REWARDS = DEFAULT_REWARDS;
export const REWARDS_CATALOG = DEFAULT_REWARDS;

// 取得當前獎勵型錄（包含啟用與自訂獎勵）
export function getRewardsCatalog(): RewardItem[] {
  try {
    const raw = localStorage.getItem("tongxuan_custom_rewards_catalog");
    if (raw) {
      const parsed: RewardItem[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_REWARDS;
}

// 儲存獎勵型錄（家長後台自訂與開關）
export function saveRewardsCatalog(items: RewardItem[]): void {
  localStorage.setItem("tongxuan_custom_rewards_catalog", JSON.stringify(items));
}

// 恢復為預設範本
export function resetRewardsCatalogToDefault(): RewardItem[] {
  localStorage.setItem("tongxuan_custom_rewards_catalog", JSON.stringify(DEFAULT_REWARDS));
  return DEFAULT_REWARDS;
}

// 新增獎勵項目
export function addRewardItem(item: RewardItem): RewardItem[] {
  const current = getRewardsCatalog();
  const updated = [item, ...current];
  saveRewardsCatalog(updated);
  return updated;
}

// 編輯更新獎勵項目
export function updateRewardItem(updatedItem: RewardItem): RewardItem[] {
  const current = getRewardsCatalog();
  const updated = current.map((item) => (item.id === updatedItem.id ? updatedItem : item));
  saveRewardsCatalog(updated);
  return updated;
}

// 刪除 / 徹底拿掉特定獎勵項目
export function deleteRewardItem(itemId: string): RewardItem[] {
  const current = getRewardsCatalog();
  const updated = current.filter((item) => item.id !== itemId);
  saveRewardsCatalog(updated);
  return updated;
}

// 取得當前學習者金幣與星星餘額
export function getLearnerPoints(): { coins: number; stars: number } {
  try {
    const raw = localStorage.getItem("tongxuan_points_balance");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { coins: 180, stars: 16 };
}

// 儲存金幣與星星餘額
export function saveLearnerPoints(points: { coins: number; stars: number }): void {
  localStorage.setItem("tongxuan_points_balance", JSON.stringify(points));
}

// 取得兌換紀錄清單（獎勵兌換票夾）
export function getRedemptionHistory(): RedemptionRecord[] {
  try {
    const raw = localStorage.getItem("tongxuan_redemptions_history");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    {
      id: "rd-init-1",
      itemId: "reward-noodle-treat",
      itemName: "🍜 美味泡麵券",
      itemIcon: "🍜",
      costCoins: 50,
      costStars: 3,
      redeemedAt: "2026-09-23 18:20",
      status: "claimed",
      ticketCode: "TX-78902",
      quantity: 1
    }
  ];
}

// 執行兌換操作（購買後自動進入票券區，支援同款票券疊加 × 2、× 3）
export function redeemRewardItem(
  item: RewardItem,
  currentPoints: { coins: number; stars: number }
): { success: boolean; newPoints: { coins: number; stars: number }; message: string } {
  if (currentPoints.coins < item.costCoins) {
    return {
      success: false,
      newPoints: currentPoints,
      message: `金幣不足！兌換需要 🪙 ${item.costCoins} 金幣（目前擁有 🪙 ${currentPoints.coins}）。`
    };
  }

  if (currentPoints.stars < item.costStars) {
    return {
      success: false,
      newPoints: currentPoints,
      message: `星星門檻未達成！需要累積達到 ⭐ ${item.costStars} 顆星星才能解鎖此項獎勵（目前擁有 ⭐ ${currentPoints.stars}）。`
    };
  }

  // 金幣為消耗幣，扣除金幣；星星為榮譽門檻，不扣除星星
  const nextPoints = {
    coins: currentPoints.coins - item.costCoins,
    stars: currentPoints.stars
  };

  saveLearnerPoints(nextPoints);

  const currentHistory = getRedemptionHistory();
  // 檢查是否已有相同 itemId 且尚未核銷 (pending) 的票券，若有則數量疊加
  const existingPendingIndex = currentHistory.findIndex(
    (r) => r.itemId === item.id && r.status === "pending"
  );

  let updatedHistory: RedemptionRecord[];

  if (existingPendingIndex !== -1) {
    const existing = currentHistory[existingPendingIndex];
    const newQty = (existing.quantity || 1) + 1;
    const updatedRecord: RedemptionRecord = {
      ...existing,
      quantity: newQty,
      redeemedAt: new Date().toLocaleString()
    };
    updatedHistory = [...currentHistory];
    updatedHistory[existingPendingIndex] = updatedRecord;
  } else {
    const newRecord: RedemptionRecord = {
      id: `rd-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      itemIcon: item.icon,
      costCoins: item.costCoins,
      costStars: item.costStars,
      redeemedAt: new Date().toLocaleString(),
      status: "pending",
      ticketCode: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
      quantity: 1
    };
    updatedHistory = [newRecord, ...currentHistory];
  }

  localStorage.setItem("tongxuan_redemptions_history", JSON.stringify(updatedHistory));

  return {
    success: true,
    newPoints: nextPoints,
    message: `🎉 成功兌換【${item.name}】！票券已自動存入「我的票券夾」！`
  };
}

// 家長審批並核銷票券（若有疊加張數，核銷 1 張）
export function approveOrClaimTicket(recordId: string, _newStatus: "approved" | "claimed"): RedemptionRecord[] {
  const history = getRedemptionHistory();
  const targetIndex = history.findIndex((r) => r.id === recordId);
  if (targetIndex === -1) return history;

  const target = history[targetIndex];
  const qty = target.quantity || 1;

  let updated: RedemptionRecord[];

  if (qty > 1) {
    // 疊加票券核銷 1 張，剩餘張數減 1，並產生一筆 claimed 紀錄
    const decremented: RedemptionRecord = {
      ...target,
      quantity: qty - 1
    };
    const claimedRecord: RedemptionRecord = {
      id: `rd-claimed-${Date.now()}`,
      itemId: target.itemId,
      itemName: target.itemName,
      itemIcon: target.itemIcon,
      costCoins: target.costCoins,
      costStars: target.costStars,
      redeemedAt: new Date().toLocaleString(),
      status: "claimed",
      ticketCode: `${target.ticketCode}-C`,
      quantity: 1
    };
    updated = [...history];
    updated[targetIndex] = decremented;
    updated.unshift(claimedRecord);
  } else {
    // 單張直接標記為 claimed
    updated = history.map((r) => (r.id === recordId ? { ...r, status: "claimed" as const } : r));
  }

  localStorage.setItem("tongxuan_redemptions_history", JSON.stringify(updated));
  return updated;
}

// ========================================================
// 家長安全密碼 PIN 管理 (Parent Security PIN)
// ========================================================
export function getParentPin(): string {
  return localStorage.getItem("tongxuan_parent_pin") || "8888";
}

export function setParentPin(newPin: string): boolean {
  if (/^\d{4}$/.test(newPin)) {
    localStorage.setItem("tongxuan_parent_pin", newPin);
    return true;
  }
  return false;
}

export function verifyParentPin(inputPin: string): boolean {
  const currentPin = getParentPin();
  return inputPin.trim() === currentPin;
}
