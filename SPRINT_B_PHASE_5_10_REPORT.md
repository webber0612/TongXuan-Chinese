# Fast Track Sprint B — Phase 5–10 Report

## Scope and delivery

Implemented only GitHub Issue #6: Words + Sentences, Writing, Zhuyin + Pinyin,
Grammar, Idioms, and Reading. Phase 11+ was not started.

Branch: `sprint/phase5-10`

## Phase checkpoints

### Phase 5 — Words + Sentences

- Added durable child-scoped words, character linkage, sentences, and word linkage.
- Added separate word attempts/state with correct, incorrect, and assisted behavior.
- Added a small auditable sample only; no broad curriculum was fabricated.

### Phase 6 — Writing

- Added writing attempts and writing state independent from Recognition.
- Trace practice uses an explicit deterministic `correct`/`incorrect` result and records provider boundary.
- Assisted traces do not increase independent success; no handwriting quality score is claimed.

### Phase 7 — Zhuyin + Pinyin

- Added separate reading rows for ZHUYIN and PINYIN, locale and provenance metadata.
- Multiple readings are retained without overwriting character identity or another notation system.
- Practice scores exact notation matches only.

### Phase 8 — Grammar

- Added grammar concept, explanation/example, exercise, deterministic answer rule, attempts, and child state.
- Correctness is backend rule matching; no LLM decides official scoring.

### Phase 9 — Idioms

- Added idiom text, meaning, example, constituent-character linkage, provenance, attempts, and separate state.
- Idiom mastery never updates Recognition mastery.

### Phase 10 — Reading

- Added child-scoped passage, provenance, vocabulary linkage, deterministic comprehension question,
  reading attempts, score, and separate reading state.
- Reading-aloud/ASR scoring is explicitly out of scope.

## Architecture and schema

- SQLite remains authoritative.
- Domain rules are in `backend/app/sprint_b.py`; FastAPI routes remain thin.
- Recognition, Writing, Reading, Pronunciation, Words, Grammar, and Idioms use separate state/attempt tables.
- Points and rewards are not used as mastery signals.
- Child ownership is checked on all child-scoped content and practice operations.

## UI

The family UI provides a functional Sprint B seed and practice surface for all six
dimensions. It intentionally remains minimal and unpolished.

## Tests and build

- Backend: `24 passed` with `backend/.venv` and `PYTHONPATH=backend`.
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
- Final head SHA: `069fcf253246a619081c8df8dfc73bf9ac23c785` before this documentation-only update; final pushed head is recorded in the delivery message.
- Phase 11: not started.
