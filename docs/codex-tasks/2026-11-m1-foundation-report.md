# M1 基礎工作成果報告

## 工作包提交與驗收

| 工作包 | Commit | 結果 |
|---|---|---|
| W1 | `77290f5` | Storage 集中管理、版本遷移及舊格式備份。storage 測試通過。 |
| W2 | `8bb9243` | 預快取音訊和 312 份繁簡筆畫檔，附 Arphic 授權。Build 與離線檢查通過。 |
| W3 | `4293bf1` | Drive v2、逐學習者／關卡合併、墓碑、自動同步。merge 與假 fetch 測試通過。 |
| W4 | `6cffa03` | Playwright 桌機與 iPad 尺寸流程、音訊／筆畫請求和離線重載通過。iPad 專案使用 Chromium：Windows Playwright WebKit 雖可安裝，但離線後重載未能完成。E2E 僅在 `MODE === "test-e2e"` 略過實際書寫；正式 `dist` 的 `test-e2e`、`jsdelivr` 搜尋均無結果。 |
| R1、N1 修正 | `eac6a0a` | R1 單筆資料修補與覆寫前備份；N1 筆畫載入錯誤訊息使用六語系 i18n。 |
| W5 | `16f60dd` | 將課堂模式畫面抽至 `ClassroomModeScreens.tsx`、生字資訊面板抽至 `CharacterInfoPanel.tsx`；家長鎖狀態和動作抽至 `useParentLockState.ts`，分頁導覽抽至 `ParentLockTabs.tsx`。`InteractiveClassroom.tsx` 為 766 行，`ParentLockModal.tsx` 為 796 行。 |

## R1 驗證

- `npm run test`: 23 個測試檔、103 項通過；Storage 單元測試 7 項通過。`npm run build` 與 E2E 的 2 個專案均通過。
- 瀏覽器重現：以第 4 關缺少 `score` 的學習者資料載入正式 preview。首頁仍顯示 `R1驗證`、`已完成 1 / 5 關`；該關分數補成 `null`，金幣 250、星星 21 保留；`tongxuan_storage_errors` 記錄修補原因。
- 新增測試涵蓋缺 `score` 保留金幣、壞 learner 不影響另一位、寫字記錄逐筆修補、不可讀舊值覆寫前建立 `tongxuan_backup_unreadable_<key>`。

## W5 拆檔驗證

- `npm run test`: 103 項通過；`npm run test:e2e`: 桌機與 iPad 尺寸兩個專案通過；`npm run build` 與 canonical frontend assertion 通過。
- E2E 在修改前後分別保存兩個 viewport 專案的 `document.body.innerHTML`，將 `id`、`for`、`aria-labelledby`、`aria-describedby` 動態屬性正規化後逐字比較。課文、生字、測驗、完成畫面共 8 組相同。快照留在工作階段暫存目錄，不納入產品檔案。
- 本次只移動既有 JSX、狀態與事件處理；CSS、文案、child isolation、學習和計分邏輯未改。

## 儲存格式範例

修補前：

```json
{"id":"child-1","points":{"coins":250,"stars":21},"book1Progress":[{"levelNumber":4,"status":"locked","starsEarned":0}]}
```

修補後：

```json
{"id":"child-1","points":{"coins":250,"stars":21},"book1Progress":[{"levelNumber":4,"status":"locked","starsEarned":0,"score":null,"completedAt":null,"updatedAt":"1970-01-01T00:00:00.000Z"}],"updatedAt":"1970-01-01T00:00:00.000Z"}
```

## 已知限制與假設

- 金幣與星星是快照而非可安全相加的增量，Drive 合併採較新學習者記錄。
- E2E iPad 尺寸專案因 Windows WebKit 離線重載限制採 Chromium。
