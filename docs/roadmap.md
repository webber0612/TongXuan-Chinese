# 家庭中文學習系統施工計畫

本文件保存產品的全階段施工計畫，版本 v1.0。

完整原始規劃已納入本專案，涵蓋 Phase 0（技術驗證）至 Phase 20（最終成品），並遵循以下施工順序：

1. Phase 0：技術驗證
2. Phase 0A：License Tracking & Commercialization Gate
3. Phase 1：Recognition MVP
4. Phase 2：School Queue
5. Phase 3：Weekly Test + Scoring
6. Phase 4：Points + Reward System
7. 讓兩名兒童實際使用並收集資料
8. 再逐步加入詞語、手寫、語法、閱讀、朗讀與其他功能

## Phase 0 驗收重點

需在 iPad Safari 完成以下流程：

```text
iPad → NAS → 登入測試頁 → 看到「學」 → 播放筆順 → 手寫
→ 聽發音 → 錄音 → 儲存紀錄
```

## 長期產品範圍

識字、繁簡轉換、注音、拼音、詞彙、句型、語法、成語、手寫、閱讀、朗讀、每週測驗、School Queue、OCR、SRS、Mastery、學習歷程、積分、獎勵、Adaptive Learning，以及最後階段的可選 AI Tutor。

## 重要原則

- 正規課程不能因學校臨時考試而停止，學校進度也不能被忽略；Daily Queue 合併兩者，但資料來源保持分離。
- Recognition、Writing、Reading、Pronunciation 必須分開追蹤。
- 所有第三方 library 使用 adapter 包裝，避免更換元件時影響整體系統。
- 內容、題庫、圖片與音訊必須有來源與授權紀錄。
- Family Build 可以使用符合家庭私人使用條件的資源，但必須標記完整 provenance 與 `commercial_ready` 狀態。
- Commercial Build 只能通過 `COMMERCIAL_OK` 或已完成商業授權登記的資源。
- Phase 18 是 Commercialization Gate & Release Audit；只有 commercial blockers 為 0 才能產生商業版。

## 授權與商業化

Phase 0A 的狀態定義、資料欄位、School Queue 私人教材規則、Commercial Replacement Registry 與 CI 行為，請參閱 [docs/license-and-commercialization.md](license-and-commercialization.md)。
