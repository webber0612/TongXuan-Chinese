import { useState,type ReactNode } from "react";
import {
X
} from "lucide-react";
import { searchHanziLexicon,type HanziEntry } from "../../../data/hanzi5000Database";

/* ========================================================
   3. 5000 常用漢字字庫檢索與即時田字格練字發音
   ======================================================== */
export function Hanzi5000LexiconModal({
  onPracticeChar,
  onClose,
  R
}: {
  onPracticeChar: (hanzi: HanziEntry) => void;
  onClose: () => void;
  R: (text: string) => ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | undefined>(undefined);
  const [selectedRadical, setSelectedRadical] = useState<string>("");

  const radicalsList = ["全部", "人", "口", "手", "日", "月", "木", "水", "火", "土", "石", "田", "禾", "艸", "雨", "鳥", "魚", "馬", "羊", "牛", "虫", "心", "言", "大"];

  const filteredEntries = searchHanziLexicon(searchQuery, {
    level: selectedLevel,
    radical: selectedRadical && selectedRadical !== "全部" ? selectedRadical : undefined
  });

  return (
    <div className="modal-backdrop">
      <div className="hanzi-lexicon-modal-card animate-fade">
        <button className="modal-close-x" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="lexicon-modal-header">
          <div className="lexicon-icon-badge">🔍</div>
          <div>
            <h2>5000 常用漢字字庫檢索與即時練字</h2>
            <p className="lexicon-sub">教育部國字標準字體庫 · 支援繁簡檢索、拼音注音、部首筆畫與即時田字格練字！</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="lexicon-search-bar-row">
          <input
            type="text"
            className="lexicon-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="輸入漢字、拼音 (如: feng)、注音 (如: ㄈㄥ)、部首或英文意思搜尋..."
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        {/* Level Filters & Radical Filter */}
        <div className="lexicon-filter-pills-row">
          <span className="filter-label">冊次分級：</span>
          <button
            className={`filter-pill ${selectedLevel === undefined ? "active" : ""}`}
            onClick={() => setSelectedLevel(undefined)}
          >
            全部示範關卡
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((lvl) => (
            <button
              key={lvl}
              className={`filter-pill ${selectedLevel === lvl ? "active" : ""}`}
              onClick={() => setSelectedLevel(lvl)}
            >
              Lv.{lvl}
            </button>
          ))}
        </div>

        <div className="lexicon-radical-chips-row">
          <span className="filter-label">常用部首：</span>
          {radicalsList.map((rad) => (
            <button
              key={rad}
              className={`radical-chip-btn ${selectedRadical === rad || (!selectedRadical && rad === "全部") ? "active" : ""}`}
              onClick={() => setSelectedRadical(rad === "全部" ? "" : rad)}
            >
              {rad}
            </button>
          ))}
        </div>

        {/* Results Counter */}
        <div className="lexicon-results-info-bar">
          <span>找到 <b>{filteredEntries.length}</b> 個符合條件的標準生字</span>
          <small>點擊任意漢字，即可開啟分階段提示與筆順落點檢查。</small>
        </div>

        {/* Character Cards Grid */}
        <div className="lexicon-cards-grid">
          {filteredEntries.map((hanzi) => (
            <div key={hanzi.id} className="hanzi-entry-card">
              <div className="hanzi-entry-top">
                <span className="hanzi-main-glyph kaiti-standard">{hanzi.char}</span>
                {hanzi.char !== hanzi.charHans && (
                  <span className="hanzi-hans-pill" title="簡體字">
                    簡: {hanzi.charHans}
                  </span>
                )}
                <span className="hanzi-level-badge">Lv.{hanzi.level}</span>
              </div>

              <div className="hanzi-entry-phonetics">
                <span className="hanzi-zhuyin-text">{hanzi.zhuyin}</span>
                <span className="hanzi-pinyin-text">{hanzi.pinyin}</span>
              </div>

              <div className="hanzi-entry-meta">
                <span>🧩 部首：{hanzi.radical}</span>
                <span>📏 筆畫：{hanzi.strokes} 畫</span>
              </div>

              <p className="hanzi-meaning-text">💡 {hanzi.meaning} ({hanzi.meaningEn})</p>

              <div className="hanzi-common-words-tags">
                {hanzi.commonWords.map((w) => (
                  <span key={w} className="common-word-tag">{w}</span>
                ))}
              </div>

              <button
                className="practice-this-char-btn"
                onClick={() => onPracticeChar(hanzi)}
              >
                <span>✍️ 進入田字格練字</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

