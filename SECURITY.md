# 隱私與安全性政策 (Security & Privacy Policy)

**TongXuan Chinese（童軒中文）** 是一套專為幼童與家庭設計的學習系統。我們深知兒少隱私的重要性，遵循 COPPA / GDPR-K 隱私原則。

---

## 🛡️ 兒童隱私保護核心原則

1. **零第三方追蹤與廣告 (Zero Tracking & No Ads)**：
   * 專案內不包含任何商業追蹤代碼（如 Google Analytics、Facebook Pixel、廣告 SDK 等）。
2. **音訊與手寫資料不外流 (No Raw Media Storage/Upload)**：
   * 復誦跟讀與語音合成採用瀏覽器原生 Web Speech API 或受控內部 API，音訊不會被持久化儲存於公開伺服器。
   * 手寫筆跡判斷在用戶端即時比對，不保留原始生物辨識或敏感軌跡。
3. **家長控制隔離 (Parent Gate & Child Isolation)**：
   * 家長專區（設定、兌換審核、進度分析）必須通過家長 PIN 碼或後端授權驗證。
   * 不同孩子之間的學習記錄各自獨立隔離，不跨空間共享。
4. **學校教材私人隔離 (Private School Content)**：
   * 家長在 School Queue 上傳之試卷或學校教材，僅供該家庭私人學習分析，絕不回流進公共題庫或官方公開課綱。

---

## 🚨 安全漏洞回報 (Reporting Vulnerabilities)

若您發現本專案存在任何安全漏洞、權限繞過或隱私疑慮：
- 請避免在公開 Issue 中直接發布漏洞細節。
- 請透過 GitHub 專屬的 **Private Vulnerability Reporting** 功能私下回報，或直接聯繫維護者。
- 我們會在最短時間內評估並發布安全性修復更新。
