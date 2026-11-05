import { useState } from "react";
import { type RewardItem, type RedemptionRecord, type RewardCategory, getRewardsCatalog, saveRewardsCatalog, getRedemptionHistory, approveOrClaimTicket, setParentPin, verifyParentPin, addRewardItem, updateRewardItem, deleteRewardItem, resetRewardsCatalogToDefault } from "../../../data/rewardsShopData";

export function useParentLockState(onUnlock: () => void) {
  const [unlocked, setUnlocked] = useState(false);
  const [authMode, setAuthMode] = useState<"pin" | "math">("pin");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

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

  const pendingCount = redemptions.filter((r) => r.status === "pending").length;

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


  return {
    unlocked,setUnlocked,authMode,setAuthMode,pinInput,setPinInput,pinError,setPinError,
    activeTab,setActiveTab,dailyPlanMode,setDailyPlanMode,giftCoins,setGiftCoins,giftStars,setGiftStars,giftNote,setGiftNote,
    redemptions,setRedemptions,catalog,setCatalog,rewardsSubTab,setRewardsSubTab,showRewardModal,setShowRewardModal,editingItem,setEditingItem,
    formName,setFormName,formIcon,setFormIcon,formDesc,setFormDesc,formCoins,setFormCoins,formStars,setFormStars,formCategory,setFormCategory,formRequiresApproval,setFormRequiresApproval,toastMessage,setToastMessage,
    currentPin,setCurrentPin,newPin,setNewPin,confirmPin,setConfirmPin,pinToast,setPinToast,pendingCount,
    handlePinDigit,handlePinBackspace,handlePinClear,handleToggleReward,handleClaimTicket,handleOpenAddModal,handleOpenEditModal,handleSaveReward,handleDeleteReward,handleResetDefaults,handleChangePin,
  };
}
