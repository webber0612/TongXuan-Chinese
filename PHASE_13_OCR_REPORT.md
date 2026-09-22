# Phase 13 — OCR Import Report

## Scope

Implemented only Phase 13 OCR Import from GitHub Issue #11. Phase 14 Adaptive Learning has not started.

## Architecture

- Added `backend/app/ocr_import.py` with a replaceable `OCRProvider` boundary and a deterministic
  local/mock provider.
- Browser image selection is isolated in `frontend/src/lib/ocrImport.ts`; image bytes are not sent
  to the backend or any third-party provider.
- OCR output is persisted as a candidate import metadata record only. It does not create School Queue
  content until explicit parent confirmation.
- Confirmation validates non-empty edited text, explicit locale/script, source provenance, duplicate
  semantics, and child ownership.
- Known Traditional/Simplified markers must agree with the selected locale and script; uncertain text
  is not aggressively inferred and remains dependent on explicit parent selection.

## School Queue and commercialization

- Confirmed imports create private School Queue content with `source_type=OCR_IMPORT` provenance.
- Confirmed text is never promoted to Curriculum and does not mutate mastery/state.
- `private_content=true`, `provenance_status=PRIVATE_OK`, and `commercial_ready=false` remain explicit.
- Duplicate confirmed text for the same child and source label is rejected without merging unrelated records.

## Privacy

- No raw image blob/base64 column, upload endpoint, server/NAS image storage, or third-party OCR call
  was added.
- The local provider is intentionally deterministic/mockable until a production OCR engine is selected.
- Cancel/reset clears local image/candidate state only.

## Learner/parent surface

- Added image selection, Run OCR, editable candidate text, source/title, locale/script selectors,
  confirm-to-private-School-Queue, cancel/reset, and clear status/error handling.

## Verification

- Backend: `42 passed, 39 warnings` with `PYTHONPATH=backend` and the project virtual environment.
- Frontend: `11 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes candidate-only metadata, confirmation flow, private provenance,
  no Curriculum promotion, child isolation, duplicate prevention, empty/invalid confirmation,
  locale/script handling, no mastery mutation, provider-unavailable behavior, and no image upload
  through the frontend OCR adapter.

## Manual validation outstanding

- Real iPad camera/photo picker behavior.
- OCR accuracy on real school worksheets.
- Lighting, blur, skew, and handwriting conditions.
- Synology deployment and network behavior.

These are not claimed as automated PASS results.

## Delivery

- Dedicated branch: `phase13/ocr-import`.
- Draft PR targets `main`.
- Do not mark Ready for review or merge automatically.
- Do not start Phase 14.
