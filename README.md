# TongXuan Chinese

家庭中文學習系統，服務兩名兒童，支援繁體中文、簡體中文、注音與拼音。

## 目前階段

目前處於 **Phase 0：專案骨架與技術驗證**。

施工路線與驗收條件請參閱 [docs/roadmap.md](docs/roadmap.md)。

## 預定架構

- `frontend/` — React + TypeScript + Vite + PWA
- `backend/` — FastAPI + Python
- `data/` — SQLite 與學習資料
- `scripts/` — 開發與資料處理腳本
- `docker/` — Docker / Docker Compose 設定
- `docs/` — 產品規格與技術文件
- `tests/` — 自動化測試

## 開發原則

1. 一次只施工一個 Phase。
2. 每個 Phase 完成前必須有 automated tests。
3. 所有內容資料都必須標示來源。
4. Curriculum、School Queue、SRS 與 Wrong Answer Queue 分離保存。
5. Backend 資料庫是 authoritative learning state。
6. 正式學習判定必須 deterministic，LLM 不參與判定。
