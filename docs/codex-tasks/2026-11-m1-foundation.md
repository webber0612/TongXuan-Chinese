# Codex 任務書：M1 資料與離線基礎

- 開立：2026-11-04，Claude（驗收者）
- 對應路線圖：`docs/roadmap.md` 第 5 節 M1
- 分支：從 `rebuild/2026-10`（`724aea3` 或更新）開 **`codex/m1-foundation`**
- 成果報告：完成後寫 `docs/codex-tasks/2026-11-m1-foundation-report.md`

## 0. 先讀

1. `AGENTS.md`、`docs/project-handoff.md`、`docs/roadmap.md`
2. `frontend/src/features/childPortal/useChildPortalController.tsx`（學習者狀態）
3. `frontend/src/lib/googleDriveSync.ts`、`frontend/src/components/GoogleDriveSyncCard.tsx`
4. `frontend/src/lib/voiceClips.ts`、`frontend/vite.config.ts`
5. `frontend/src/features/childPortal/InteractiveClassroom.tsx`（寫字，`HanziWriter.create` 約在第 317 行）

## 1. 規則（違反任何一條，整包退回）

1. **只在 `codex/m1-foundation` 工作。** 不推、不合併到 `main` 或 `rebuild/2026-10`。可以推這個分支到 origin。
2. **不改**：課程檔（`shared/curriculum/**`、`shared/voice/**`）、音檔、學習與計分規則（`lib/adaptiveWriting.ts` 的判定、星星與金幣數值）、畫面外觀（CSS、版面、文案）。需要新增的家長端提示文字，只能放在已有的同步卡片裡，且要有 6 種顯示語言的文案（缺的語言先用英文）。
3. **不刪**任何學習者既有資料。舊格式資料必須能讀、能遷移；遷移前先備份到 `tongxuan_backup_<舊版本>`。
4. 每個工作包一個 commit（Conventional Commits，例如 `feat(sync): ...`），commit 前跑完第 3 節的檢查。不要把多個工作包混在一個 commit。
5. 檔案有增刪，或含中文、音檔、圖片的檔案有修改時，commit 前要跑 `python scripts/open_curriculum_rights_gate.py --sync-inventory`。新增會被發布的檔案（`frontend/public/**`、`frontend/src/data/**`）要登記到 `data/commercialization-inventory.json` 與 `data/license-registry.json`。
6. 不新增任何會把資料送到第三方的程式（分析、錯誤回報、CDN 載入）。
7. 不確定的地方，在報告的「未決事項」寫下你的假設，不要擴大範圍。

## 2. 工作包

### W1 本機資料集中管理與版本化

**問題**：localStorage 的鍵散在各處（`tongxuan_learners_list`、`tongxuan_active_learner_id`、`tongxuan_writing_progress_v2`、`tongxuan_expert_rewards_catalog`、`tongxuan_custom_rewards_catalog`、`tongxuan_display_lang`、`tongxuan_voice_guide`、`tongxuan_parent_pin`、`tongxuan_onboarded`、`tongxuan_hand_mode`、`tongxuan_levels_progress`、`tongxuan_points_balance`、`tongxuan_redemptions_history` 等，用 `grep -rn "tongxuan_" frontend/src` 找全），沒有版本號，解析失敗時有些地方會靜默吞掉。

**要做**：
- 新增 `frontend/src/lib/storage/`：一個型別化的讀寫介面（每個鍵一個 get／set，讀取時驗證形狀，壞資料回傳預設值並記錄在 `tongxuan_storage_errors`，不丟例外到畫面）。
- 加入 `tongxuan_schema_version`。寫一個 `migrate()`，App 啟動時（`main.tsx`）在畫面渲染前執行：從「沒有版本號」遷移到版本 1，遷移前備份。
- 學習者資料加上 `updatedAt`（ISO 字串），每次改動學習者時更新；每一筆 `book1Progress` 加上 `updatedAt`。寫字進度的每一筆加上 `updatedAt`。這是 W3 合併的依據。
- 所有程式改走這個模組；`grep -rn "localStorage" frontend/src` 在 `lib/storage/` 以外只剩測試。

**驗收**：
- 單元測試：無版本資料 → 版本 1 的遷移；壞 JSON；缺欄位；遷移重跑不會重複（冪等）。
- 用舊資料（我會用 `tongxuan_learners_list` 的現有格式手動放一份）打開 App，進度與金幣不變。

### W2 離線可用

**問題**：(a) Workbox 預設只快取 js／css／html，`frontend/public/audio/**` 的 mp3 與 `manifest.json` 沒有快取，離線時沒有聲音。(b) `hanzi-writer` 執行時從 `cdn.jsdelivr.net` 下載筆畫資料，離線時無法寫字，也違反規則 6。

**要做**：
- `vite.config.ts` 的 VitePWA 設定：預先快取 `audio/**/*.{mp3,json}`；確認 `maximumFileSizeToCacheInBytes` 足夠。
- 新增腳本 `frontend/scripts/build-stroke-data.mjs`：從 npm 套件 `hanzi-writer-data`（加進 devDependencies，鎖定版本）複製**第一冊會用到的字**（讀 `shared/curriculum/book1-character-order.json`，繁體與簡體都要）到 `frontend/public/hanzi/<字>.json`，並複製其授權條款到 `frontend/public/hanzi/LICENSE`。缺字時腳本失敗並列出缺的字。
- `HanziWriter.create` 傳入 `charDataLoader`，從 `${import.meta.env.BASE_URL}hanzi/<字>.json` 讀取；`DiagnosticsPage.tsx` 也一樣。讀不到時畫面顯示現有的錯誤狀態，不要改去 CDN。
- 預先快取 `hanzi/*.json`。
- 在 `data/license-registry.json` 登記筆畫資料（來源 Make Me a Hanzi／hanzi-writer-data，授權 Arphic Public License，可商用，需附條款）。

**驗收**：
- `npm run build` 後，`dist/sw.js` 的預先快取清單包含 mp3、`audio/*/manifest.json`、`hanzi/*.json`。
- 用 `npm run preview` 打開一次後，瀏覽器切離線、重新整理：首頁能開、第 1 關課文能播聲音、生字能寫。
- `grep -rn "jsdelivr" frontend/dist` 沒有結果。

### W3 Google Drive 雙向同步

**問題**：`performFullDriveSync` 拿本機「現在時間」當 `updatedAt`，所以本機永遠比較新，只會上傳；換裝置會把另一台的進度整包蓋掉。

**要做**：
- 同步檔格式升到 `version: 2`，包含 `schemaVersion`、各學習者（含 `book1Progress`、`updatedAt`）、寫字進度、獎勵目錄。讀到 `version: 1` 的雲端檔要能合併。
- 新增純函式 `mergeSyncPayloads(local, remote): SyncPayload`，放在 `frontend/src/lib/sync/merge.ts`，規則：
  - 學習者以 `id` 對齊；只在一邊的保留。刪除學習者用墓碑（`deletedLearnerIds` 與刪除時間），晚於對方 `updatedAt` 的刪除才生效。
  - `book1Progress` 每一關：`completed` 勝過 `current` 勝過 `locked`；`starsEarned` 與 `score` 取較高；`completedAt` 取較早的完成時間。
  - 寫字進度每一筆：取 `updatedAt` 較新的一筆；若同時有 `retryPending`，以較新的為準。
  - 金幣、星星：無法安全相加，取 `updatedAt` 較新的那位學習者記錄的值，並在報告中說明這個限制。
  - 偏好設定（顯示語言、語音開關）：取較新的。
- `performFullDriveSync`：下載 → 合併 → 寫回本機 → 上傳合併結果。上傳失敗時本機已合併的資料保留，下次再傳。
- 自動同步：已連結 Drive 時，App 開啟時與每完成一關後同步一次（同一時間只跑一個，失敗不打擾孩子，只在家長專區的同步卡片顯示狀態與最後同步時間）。
- Token 過期時不跳出登入視窗打斷孩子，只在同步卡片顯示「需要重新連結」。

**驗收**：
- `merge.ts` 單元測試至少涵蓋：兩台各完成不同關；同一關一台完成一台進行中；一邊刪除學習者；version 1 雲端檔；合併兩次結果相同（冪等）；交換參數順序結果相同（可交換，金幣星星除外需註明）。
- 用假的 `fetch` 測 `performFullDriveSync` 的流程：無雲端檔、雲端較新、上傳失敗。

### W4 端對端測試

**要做**：
- 加入 Playwright（devDependency），設定 `frontend/playwright.config.ts`，跑 `vite preview`；兩個專案：桌機 Chromium 1280×800、iPad 尺寸 WebKit 820×1180（WebKit 無法安裝時改 Chromium 並在報告註明）。
- `frontend/package.json` 新增 `test:e2e`。
- 測試流程（`frontend/e2e/`）：
  1. 第一次打開 → 建立學習者 → 首頁出現今日任務。
  2. 開始第 1 關 → 課文畫面 → 按一句的播放，確認有請求 `audio/book1/*.mp3`。
  3. 進入生字 → 筆畫資料是從 `hanzi/` 讀取（不是 CDN）。寫字本身不必模擬；可以透過**只在測試建置存在**的測試掛鉤完成，掛鉤不可進入正式建置（用 `import.meta.env.MODE` 判斷，並以 `grep` 驗證 dist 裡沒有）。
  4. 小測驗答一題，確認有請求 `audio/feedback/*.mp3`。
  5. 完成第 1 關 → 重新整理 → 第 1 關顯示完成、第 2 關變成目前關卡。
  6. 離線重新整理（`context.setOffline(true)`）→ 首頁仍能開。
- 加入 GitHub Actions 的現有前端工作流程（不要新增部署步驟）。

**驗收**：`npm run test:e2e` 在本機兩個專案都通過。

### W5 拆分過大的檔案（行為不變）

**要做**：把 `InteractiveClassroom.tsx`（約 1,277 行）與 `modals/ParentLockModal.tsx`（約 1,047 行）拆成每檔 400 行以內為原則、最多 800 行。按畫面模式（課文、生字、寫字、測驗）或子面板拆，狀態留在原本的 hook 或父元件。

**驗收**：
- 拆分前後 `npm run test`、`npm run test:e2e` 結果相同。
- 不改任何 CSS class 名稱與 DOM 結構（拆分前後在第 1 關各畫面的 `document.body.innerHTML` 去掉動態 id 後相同；報告中附上比對方式）。
- `node frontend/scripts/assert-canonical-frontend.mjs` 通過。

## 3. 每個 commit 前的檢查

```bash
cd frontend && npm run test && npm run build
cd frontend && npm run test:e2e        # W4 之後
python scripts/curriculum_check.py
python scripts/tbcl_coverage.py --check-order
python scripts/open_curriculum_rights_gate.py --check
cd backend && python -m pytest -q tests/test_open_curriculum_rights_gate.py tests/test_commercialization.py
```

注意：工作目錄中 `資產/APP LOGO.png` 有擁有者未提交的修改，**不要 commit 它**，也不要還原它。權利檢查若只因這個檔案的雜湊不符而失敗，可以忽略並在報告註明。

## 4. 成果報告格式

`docs/codex-tasks/2026-11-m1-foundation-report.md`：

1. 每個工作包：commit 雜湊、改了哪些檔案、驗收項目逐條「通過／未通過＋證據（指令與輸出摘要）」。
2. 資料格式：遷移前後的範例 JSON。
3. 未決事項與假設。
4. 已知限制（例如金幣合併）。

## 5. Claude 驗收方式

Claude 會在乾淨的工作樹重跑第 3 節所有檢查，並另外：
- 用舊格式資料與兩台模擬裝置測同步合併；
- 在瀏覽器實際走過第 1 關、離線重開；
- 檢查 `dist/` 沒有 CDN、分析或測試掛鉤；
- 逐條比對第 1 節規則（特別是沒有動到課程、學習規則與外觀）。

全部通過才合併到 `rebuild/2026-10`；有問題會寫在 `docs/codex-tasks/2026-11-m1-foundation-review.md` 退回。
