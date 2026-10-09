# 桐軒中文 專案換手

> 這份文件只記錄**已驗證的現況**。每一句都要能用指令或實測重現；做不到就不要寫進來。
> 歷史紀錄在 `docs/archive/project-handoff-until-2026-10-09.md`，內容已過期，不可當作現況依據。

最後驗證：2026-10-10，分支 `rebuild/2026-10`。

## 產品定位

- 正式名稱：**桐軒中文**（TongXuan Chinese）。
- 對象：初學中文的兒童，家長在旁監督。支援繁體＋注音、簡體＋拼音，顯示語言獨立設定。
- 運作模式：**GitHub 模式**。前端是唯一的產品；學習紀錄存在瀏覽器 localStorage，並可用 Google Drive（`appDataFolder`）同步。

## 環境

| 環境 | 網址 | 內容 | 狀態 |
|---|---|---|---|
| GitHub Pages | `https://webber0612.github.io/TongXuan-Chinese/` | 前端，推 `main` 自動部署 | 正式版 |
| 本機 | `http://localhost:5173/TongXuan-Chinese/` | `npm run dev`（`frontend/`） | 開發用 |
| NAS 後端 | `https://webber0612.synology.me:8443` | FastAPI，`development` 模式 | **未接上前端**，資料為空，應停止對外 |
| NAS 前端 | `http://webber0612.synology.me:8080` | nginx 預設頁 | 沒有放桐軒 |

前端建置時 `VITE_API_BASE` 為空，所以不會呼叫任何後端。`backend/` 的程式與測試保留在 repo，作為日後把複習與精熟規則移到前端時的規格參考，目前不屬於產品的一部分。

## 正式前端

```text
frontend/src/main.tsx → frontend/src/AppShell.tsx
```

| 路由 | 用途 | 沒有後端時 |
|---|---|---|
| `/` | 兒童首頁 | 可用 |
| `/learning-session` | 課程播放器（9 步） | 可用（本機預覽模式） |
| `/parent-dashboard` | 家長專區、Google Drive 同步 | 同步可用；後端報表顯示離線提示 |
| `/me` | 設定 | 語言設定可用；孩子清單依賴後端 |
| `/practice`、`/curriculum`、`/tutor`、`/diagnostics`、`/admin/commercialization` | 後端時期的工具頁 | 大多無資料 |

修改 UI 前仍須依 `docs/frontend-architecture.md` 確認目標在正式 import 鏈上。

## 驗證方式

```bash
cd frontend && npm run test && npm run build
cd backend && ../.venv/Scripts/python.exe -m pytest -q
python scripts/open_curriculum_rights_gate.py --check
```

檔案有增刪或含中文的檔案有修改時，提交前要同步權利清單（只更新雜湊與新增路徑，不改任何權利分類）：

```bash
python scripts/open_curriculum_rights_gate.py --sync-inventory
```

## 開發規則

1. 一律從 `main` 開分支、走 PR，不直接推 `main`。推 `main` 會立刻部署到正式站。
2. 同一時間只讓一個 agent 寫同一個分支。
3. 改完要在瀏覽器實際走過受影響的畫面；測試通過不等於畫面正確。
4. 這份文件只改寫、不堆疊。不要在最上面再加一段「最新成果」。

## 已知問題

- **教材授權**：權利清單中絕大多數檔案標為 `RIGHTS_UNCLEAR`，repo 是公開的。擴充課程內容前必須處理。
- **追蹤碼**：`frontend/src/lib/analytics.ts` 會載入 Google Analytics（GA4），但 `README.md` 與 `.better-web-ui.md` 都寫「零追蹤」。需要擁有者決定保留或移除。
- **未合併的舊工作**：PR #113、PR #110 與 Issue #116 是依「後端為權威」的架構寫的，與 GitHub 模式方向相反，不合併，僅供參考。
- **`main` 沒有分支保護**，需在 GitHub 設定中開啟。
- 實機 iPad Safari 與真實兒童試用都還沒做過。

## 路線

| 階段 | 內容 | 狀態 |
|---|---|---|
| 0 | 備份未提交的工作、定名 | 完成 |
| 1 | 修復 CI、清除死路由、改寫換手文件 | 完成 |
| 2 | 學習規則定案（`docs/learning-loop-v1.md`） | 進行中 |
| 3 | 前端結構重構（畫面不變） | 未開始 |
| 4 | UX 翻新，完成後由擁有者審查畫面 | 未開始 |
| 5 | 學習規則實作為前端模組 | 未開始 |
| 6 | 學習內容擴充 | 未開始 |
