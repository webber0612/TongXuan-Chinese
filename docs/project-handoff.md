# 桐軒中文 專案換手

> 這份文件只記錄**已驗證的現況**。每一句都要能用指令或實測重現；做不到就不要寫進來。
> 要做什麼、照什麼順序做，看 `docs/roadmap.md`。歷史紀錄在 `docs/archive/`，內容已過期。

最後驗證：2026-11-04，分支 `rebuild/2026-10`（`main` 已同步到 `5742ece`）。前端 87 個測試通過、建置通過；課程檢查與權利檢查通過。

## 產品定位

- 正式名稱：**桐軒中文**（TongXuan Chinese）。給 5–9 歲初學中文的孩子，家長在旁監督。繁體＋注音、簡體＋拼音，顯示語言另外設定。
- 運作模式：**GitHub 模式**。前端是唯一的產品；學習紀錄存在瀏覽器 localStorage，可用 Google Drive（`appDataFolder`）同步。不使用 NAS 與後端。
- 課程：第一冊＝TBCL 第 1 級 246 字，41 關、10 個階段，全部自編。

## 環境

| 環境 | 網址 | 內容 |
|---|---|---|
| GitHub Pages | `https://webber0612.github.io/TongXuan-Chinese/` | 正式版。推 `main` 會自動部署 |
| 本機 | `http://localhost:5173/TongXuan-Chinese/` | `npm run dev`（`frontend/`） |
| NAS | `webber0612.synology.me:8443`／`:8080` | 未接上前端，應停止對外（擁有者處理） |

## 正式前端

```text
frontend/src/main.tsx → AppShell.tsx → pages/ChildPortalPage.tsx
  → features/childPortal/useChildPortalController.tsx（狀態與動作）
  → features/home/（首頁）、features/childPortal/InteractiveClassroom.tsx（教室）
```

| 路由 | 內容 |
|---|---|
| `/` | 首頁：今日關卡、路線、練習入口、右上角選單（家長專區有 PIN） |
| `/practice`、`/parent-dashboard`、`/tutor`、`/me`、`/diagnostics`、`/admin/commercialization` | 沒有後端時顯示「此路徑已停用」 |

修改 UI 前仍須依 `docs/frontend-architecture.md` 確認目標在正式 import 鏈上。

## 課程資料

| 檔案 | 內容 |
|---|---|
| `shared/curriculum/book1-character-order.json` | 41 關的字序，每關 2–3 個要會寫的字 |
| `shared/curriculum/book1/stage-01.json` | 第 1 階段（第 1–4 關＋檢核）。**目前只有這一個階段** |
| `frontend/src/data/book1.ts` | 把課程檔轉成 App 用的關卡；學習進度存在學習者的 `book1Progress` |
| `shared/voice/feedback-phrases.json` | 固定的鼓勵語（程式透過 `VOICE_PHRASES` 使用） |

## 聲音

- 字、詞、句與鼓勵語用 CosyVoice3 預先錄好，放在 `frontend/public/audio/book1/`、`audio/feedback/`。沒有錄音的文字改用瀏覽器語音。
- 產生方式、授權與品質檢查：`docs/audio-provenance.md`。新增或修改課程後要重跑 `tools/audio/generate_book1_audio.py`。

## 驗證方式

```bash
cd frontend && npm run test && npm run build
python scripts/tbcl_coverage.py --check-order
python scripts/curriculum_check.py
python scripts/open_curriculum_rights_gate.py --check
```

檔案有增刪，或含中文、音檔、圖片的檔案有修改時，提交前要同步權利清單：

```bash
python scripts/open_curriculum_rights_gate.py --sync-inventory
```

新增可發布的資源（音檔、資料檔）時，還要登記到 `data/commercialization-inventory.json` 與 `data/license-registry.json`，並跑 `backend/tests/test_commercialization.py` 與 `test_open_curriculum_rights_gate.py`。

## 開發規則

1. 從 `rebuild/2026-10` 開分支工作。推 `main`＝立刻上線，必須先取得擁有者同意。
2. 同一時間只讓一個 agent 寫同一個分支。Codex 的工作照 `docs/codex-tasks/` 的任務書進行，由 Claude 驗收。
3. 改完要在瀏覽器實際走過受影響的畫面；測試通過不等於畫面正確。
4. 這份文件只改寫、不堆疊。

## 已知問題

詳細缺口與優先順序在 `docs/roadmap.md` 第 4 節。最影響使用的：

- Google Drive 同步只會上傳，換裝置會蓋掉進度。
- 離線時沒有聲音，寫字也無法使用（筆畫資料從 CDN 下載）。
- 仍載入 Google Analytics（GA4），與隱私定位衝突，待擁有者決定。
- 課程只寫到第 4 關。
- 教室與各彈窗仍是舊樣式；擁有者選定的任務地圖首頁尚未實作。
- `backend/`、`shared/validated-curriculum-slice.json`、`shared/lesson-packages/` 仍含僑委會教材，前端已不使用，處理方式待擁有者決定。舊版本留在 tag `archive/before-ocac-removal`。
- 舊的草稿 PR #113、#110 依舊方向撰寫，不合併。
- `main` 沒有分支保護。
