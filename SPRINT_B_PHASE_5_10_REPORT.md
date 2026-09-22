# Fast Track Sprint B — Phase 5–10 Report

## Scope and delivery

Implemented only GitHub Issue #6: Words + Sentences, Writing, Zhuyin + Pinyin,
Grammar, Idioms, and Reading. Phase 11+ was not started.

Branch: `sprint/phase5-10`

## Phase checkpoints

### Phase 5 — Words + Sentences

- Added durable child-scoped words, character linkage, sentences, and word linkage.
- Added separate word attempts/state with correct, incorrect, and assisted behavior.
- Added separate sentence attempts/state and deterministic exact-sentence practice;
  sentence mastery is independent from word and Recognition mastery.
- Added a small auditable sample only; no broad curriculum was fabricated.

### Phase 6 — Writing

- Added writing attempts and writing state independent from Recognition.
- Trace practice uses an explicit `HANZI_WRITER` client adapter/provider boundary and records
  the provider on every attempt. The backend keeps a deterministic event contract for the MVP.
- Assisted traces do not increase independent success; no handwriting quality score is claimed.

### Phase 7 — Zhuyin + Pinyin

- Added script-aware reading rows for Traditional `學` + Zhuyin and Simplified `学` + Hanyu
  Pinyin, with locale, context, and provenance metadata.
- Added a real Simplified-character → Pinyin practice surface: the child sees the character,
  enters/selects a target reading, submits it to backend deterministic scoring, and receives
  correct/incorrect feedback.
- Canonical Pinyin is stored with tone marks. A deterministic normalization layer accepts
  tone-number input such as `xue2` and scores it against canonical `xué`.
- Multiple lexical readings use explicit context (`銀行` → `háng`, `行走` → `xíng`);
  notation variants are not stored as separate readings.
- School Queue Pinyin bridging refuses to choose arbitrarily when a character has multiple
  readings; the caller must provide an explicit `reading_id` or matching context.
- Pinyin normalization preserves `ü` through Unicode decomposition and supports deterministic
  `lü3`, `lv3`, and `lǚ` equivalence.
- Traditional Zhuyin and Simplified Pinyin state/attempts remain independently auditable;
  assisted answers are persisted and do not increase independent Pinyin mastery.

### Phase 8 — Grammar

- Added grammar concept, explanation/example, exercise, deterministic answer rule, attempts, and child state.
- Correctness is backend rule matching; no LLM decides official scoring.

### Phase 9 — Idioms

- Added idiom text, meaning, example, constituent-character linkage, provenance, attempts, and separate state.
- Idiom mastery never updates Recognition mastery.

### Phase 10 — Reading

- Added child-scoped passage, provenance, vocabulary linkage, deterministic comprehension question,
  reading attempts, score, separate reading state, submitted-answer snapshot, and per-question
  correctness snapshot for audit/reproducibility.
- Reading-aloud/ASR scoring is explicitly out of scope.

## Architecture and schema

- SQLite remains authoritative.
- Domain rules are in `backend/app/sprint_b.py`; FastAPI routes remain thin.
- Recognition, Writing, Reading, Pronunciation, Words, Grammar, and Idioms use separate state/attempt tables.
- Sentences use their own state/attempt tables; pronunciation attempts/states persist assisted counts;
  reading attempts persist normalized JSON snapshots of answers and correctness.
- Points and rewards are not used as mastery signals.
- Child ownership is checked on all child-scoped content and practice operations.
- School Queue items can create a private Pinyin practice prompt through an explicit bridge;
  source/provenance is retained, practice attempts remain auditable, and the item is never
  promoted into core Curriculum.

## UI

The family UI provides a functional Sprint B seed and practice surface for all six
dimensions. It intentionally remains minimal and unpolished.

## Tests and build

- Backend: `26 passed` (33 non-blocking dependency deprecation warnings) with `backend/.venv` and `PYTHONPATH=backend`.
- Frontend: `4 passed` with Vitest.
- Production frontend build: passed; PWA assets generated.
- Existing Sprint A and Phase 0 tests remain green.

## Provenance, privacy, and commercialization

- All Sprint B sample content carries `LICENSE_REVIEW_REQUIRED`, `commercial_ready=false`,
  source name, license name, and commercial action in durable rows.
- The same sample source is registered in `data/license-registry.json`.
- Child-scoped progress and attempts remain isolated.
- No permanent audio, photo, or handwriting media is stored.
- Family use is supported; Commercial Build must replace or license the sample source.

## Known limitations and manual validation remaining

- No real-child/parent trial feedback is available yet.
- iPad Safari, Docker runtime, and Synology DS723+ persistence remain manual validation items.
- Writing is deterministic trace-result recording, not handwriting quality assessment.
- Pronunciation is notation practice, not audio/ASR evaluation.
- Reading is silent comprehension only; ASR and reading-aloud belong to later work.

## Delivery

- Draft PR: [#7](https://github.com/webber0612/TongXuan-Chinese/pull/7), kept Draft.
- Latest Architect Audit remediation: AUD-B01 through AUD-B12 addressed with regression coverage,
  including Simplified Pinyin normalization, script/state separation, context disambiguation,
  School Queue private provenance bridging, polyphone ambiguity rejection, and `ü` handling.
- The final pushed head is the latest commit on `sprint/phase5-10` / PR #7.
- Phase 11: not started.
