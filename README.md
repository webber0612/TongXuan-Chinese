# TongXuan Chinese (童軒中文) 🏮

> 專為海外與幼童家庭打造的現代中文沉浸式自主學習系統。  
> 支援 **繁體中文 + 注音** 與 **簡體中文 + 拼音** 雙軌學習，融合筆順引導、智能跟讀、溫暖獎勵與無壓力的每日學習循環。

🌐 **[點此直接在瀏覽器 / iPad 上線體驗 (Live Demo)](https://webber0612.github.io/TongXuan-Chinese/)**

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()
[![PWA Ready](https://img.shields.io/badge/PWA-ready-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Child Safe](https://img.shields.io/badge/Child%20Privacy-COPPA%20Compliant-success.svg)](SECURITY.md)

---

## ✨ 核心特色 (Key Features)

* 🎨 **溫暖童趣、無干擾介面（Child-First UI）**：
  * 捨棄噪音刺激的課金遊戲化設計與刺眼色調，採用柔和紙实质感的雙週衝刺軌道、沉浸式課文大繪本與大按鈕無障礙互動。
* 🀄 **專業漢字注音/拼音排版引擎**：
  * 獨家精準的注音符號與標點符號基準線對齊演算法，支援直式注音排版與橫式拼音自由切換。
* ✍️ **互動式漢字筆順引導（Stroke Tracing）**：
  * 動態筆順描紅、引導筆畫動畫、筆順錯誤即時指引與自主默寫評分。
* 🎙️ **智能語音跟讀與朗讀（Speech & Reading Aloud）**：
  * 具備語音朗讀合成（TTS）與自適應麥克風跟讀評測，提供即時鼓勵反饋與離線容錯機制。
* 🎁 **獎勵兌換舖與生活小約定（Rewards Shop）**：
  * 「星星」代表技能熟練門檻，「代幣」可自由兌換家庭約定票券（如看卡通 20 分鐘、睡前多講一本故事），支援家長 PIN 碼防誤觸。
* 👨‍👩‍👧 **家長控制與隱私安全（Parent Dashboard & Safe Privacy）**：
  * 零第三方廣告、零追蹤代碼，錄音音訊完全不外流，各孩子學習進度與學校作業（School Queue）完全獨立隔離。

---

## 🛠️ 技術架構 (Tech Stack)

* **Frontend**:
  * [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
  * [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (符合 WAI-ARIA 頂級無障礙標準)
  * [Vite PWA](https://vite-pwa-org.netlify.app/) (離線快取、可安裝至 iPad / 桌面主畫面)
  * [Lucide React](https://lucide.dev/) (輕量現代向量圖標)
  * [Hanzi Writer](https://chanind.github.io/hanzi-writer/) (筆順互動動畫引擎)
* **Backend**:
  * [FastAPI](https://fastapi.tiangolo.com/) (現代 Python 非同步高效能 API)
  * [SQLite](https://www.sqlite.org/) (本地輕量持久化資料庫)
  * [Docker / Docker Compose](https://www.docker.com/) (容器化一鍵部署)

---

## 🚀 快速啟動 (Quick Start)

### 1. 前端本機運行 (Frontend)
```bash
cd frontend
npm install
npm run dev
```
打開瀏覽器訪問 `http://localhost:5173`。

### 2. 後端本機運行 (Backend)
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. 使用 Docker 一鍵啟動 (Docker Compose)
```bash
docker compose up -d
```

---

## 📋 測試與代碼品質 (Testing & CI)

```bash
# 執行前端單元測試
cd frontend
npm run test

# 執行前端建置檢查
npm run build

# 執行全系統功能 Smoke Check
python scripts/final_smoke.py
```

---

## 🤝 參與貢獻與反饋 (Contributing & Feedback)

我們非常重視來自家長、幼教教師與開發者的回饋！  
為了維持專案架構穩定與著作權完整，本專案**暫不接受外部程式碼 Pull Request**，歡迎透過 [GitHub Issues](../../issues) 回報 Bug 或建議改進想法。詳細規範請參閱 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## ☕ 支持與贊助 (Support & Sponsor)

**童軒中文** 是一個由獨立開發者為孩子打造的開源學習專案。如果這個專案對您與孩子的中文學習有所幫助，歡迎請作者喝杯咖啡支持持續維護與內容充實！

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-☕%20請作者喝咖啡-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/webber0612)

---

## 📄 授權條款 (License)

本專案程式碼基於 [MIT License](LICENSE) 授權發布。  
專案內含之官方專有教材與繪本插畫內容保留所有權利。

