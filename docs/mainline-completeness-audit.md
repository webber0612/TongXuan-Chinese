# Mainline Completeness Audit

**Audit baseline:** `origin/main` at `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7` (PR #48 / Issue #47 merged)
**Scope:** Issue #38 end-to-end learning journey, limited to executable code, tests, APIs, schema, and currently approved curriculum boundaries.
**Result:** PR #40 closed the supported-lesson planner/runtime task-parity P0 for `starter-l01`, `basic-l01`, and `book1-l01`. PR #42 closed the canonical Home → REVIEW handoff and same-lesson task-selection gap. PR #44 closed the supported FAST_TRACK failure→REPAIR lifecycle. PR #46 / Issue #45 completed cross-lesson REVIEW. PR #48 / Issue #47 merged at this baseline, carrying selected numeric child identity through Home and removing display-name/first-child fallbacks. Issue #49 is active on `codex/issue-49-session-settlement-atomicity`, addressing failure-atomic completion. Mainline status rows below describe merged main unless they explicitly identify the pending branch. Fresh/unresolved backend profile selection remains `OWNER_DECISION_REQUIRED`: the child-visible Home switcher is local prototype state; exposing backend siblings without a signed parent session would cross the child authorization boundary. No P0 remains in the validated Home→LEARN/REVIEW/REPAIR slice.

## Current executable path

    frontend/src/main.tsx
      → AppShell.tsx
      → / renders ChildPortalPage
      → Home fetches /api/children/{child_id}/learning-daily-queue
      → Home “start today” callback passes LEARN; due-review CTA passes REVIEW
      → AppShell stores launch lesson + mode and navigates to /learning-session
      → AppShell renders LessonPlayerPage with the selected initialMode
      → backend POST /api/children/{child_id}/learning-sessions builds tasks
      → task answer/evidence APIs write attempts, gates, and SRS
      → POST .../complete checks required task states, assesses mastery, awards 5 points
      → onBack returns to /

The backend also exposes /api/children/{child_id}/learning-sessions/report and a parent-authorized placement profile API. The production Parent Dashboard does not consume the learning-session report, and the production frontend does not call the placement profile API.

When the current lesson is complete and the Daily Queue has due reviews, the Home CTA carries REVIEW through AppShell to the canonical `/learning-session` route. The ordinary lesson CTA explicitly carries LEARN. AppShell resets launch intent when leaving the session route through Home navigation or browser history, so REVIEW cannot persist into a later normal launch. PR #46 reconciles the complete due set across the three existing executable packages, selects exact child/session/lesson/item task rows, and builds each step from its own package. Unsupported or malformed queue/task data fails closed before any partial question set appears. REVIEW wrap-up returns Home with the mixed LEARN session intact; the next normal LEARN launch excludes attached REVIEW rows from curriculum mapping. PR #48 carries the selected backend child ID through Home queue lookup and launch; unresolved identity fails closed. Issue #49's branch moves progress, assessment, reward, wrap-up, session completion, and settlement telemetry into one SQLite transaction; the full backend/frontend/build and diff validations passed locally. No visual direction or layout changed.

PR #40 aligned backend planner tasks with executable player steps for the three supported lesson IDs. Its real API regressions cover planner output, exact task evidence, and settlement for full and supported partial recognition plans. It did not change adaptive/teaching policy, mastery thresholds, SRS policy, or the UI.

## Mainline completeness matrix

| Stage | Status | Priority | Executable finding |
|---|---|---:|---|
| Learner / profile | PARTIAL | P1 | PR #48 / Issue #47 merged exact selected numeric child identity for Home queue/session launch and removed name matching/first-child fallback. Fresh/unresolved backend child binding remains gated until a parent-authorized session/selection surface exists. |
| Placement / current ability | PARTIAL | P1 | placement_profiles and parent/admin GET/PUT /placement-profile exist. Placement starts at the lowest assessed core domain; age is not used as a gate. The production frontend does not call this API, so a new or unconfigured learner silently defaults to STARTER. |
| Daily Queue | PARTIAL | P1 | The backend deterministically returns the placement start, due recognition items, and active session. Executable LEARN is limited to starter-l01, basic-l01, and book1-l01; later accessible curriculum lessons are reported unavailable. PR #46 reconciles cross-lesson due IDs when every item maps to a supported package; malformed or unsupported due items fail closed. |
| Authoritative lesson / review selection | COMPLETE | P2 | PR #46 preserves exact Daily Queue review tasks and mode handoff; PR #48 preserves the exact selected backend child ID through canonical Home. Missing/unresolved identity fails closed. Initial child binding remains an owner gate. |
| LEARN | COMPLETE | P2 | For the three currently executable lessons, PR #40 aligned real backend planner tasks to Lesson Player steps, including the supported single `recognition-1` MINI_CHECK partial plan. Backend API regressions submit exact tasks and settle the session. Later validated lessons remain unavailable (tracked under continuation), and broader settlement/resilience gaps are tracked separately. |
| FAST_TRACK | COMPLETE | P2 | In the supported lesson slice, Fast Track requests bind to exact child/lesson/session identity. Failure pauses that same session and returns authoritative identity; repair authoritatively resumes it before interaction. PR #44 adds real backend and canonical frontend lifecycle regressions. |
| REVIEW | COMPLETE | P2 | PR #46 merged cross-lesson exact task reconciliation for all due items in the three existing executable packages, with idempotency, SRS advancement, pending curriculum preservation, and REVIEW wrap-up that does not complete the parent LEARN session. Unsupported lesson packages remain fail-closed; no due-policy change is included. PR #48 separately closed Home's selected-child ID continuity gap. |
| REPAIR | COMPLETE | P2 | Supported weak-domain repair steps use only exact eligible CURRICULUM task IDs from the same session. Unsupported domains fail closed without an exit-ticket fallback. Repair wrap-up returns Home and leaves the parent LEARN session and unrelated curriculum tasks unchanged; verified by PR #44. |
| Task evidence | PARTIAL | P1 | Server-side scoring, linked evidence, and task persistence exist. Speaking provider completion, skill gate, and learning task share a transaction with backend failure/retry tests. PR #40 adds real planner-task evidence and settlement coverage for all three currently executable lessons; other domains remain separate. |
| Mastery Gate | PARTIAL | P1 | Server-side per-domain scored floors and non-score gates exist, and client-provided mastery scores are rejected. Supported LEARN task parity is now covered; full product mastery visibility and failure-atomic settlement remain incomplete. Session completion and mastery remain separate concepts. |
| SRS | PARTIAL | P1 | Domain/item-specific SRS state and append-only events implement deterministic intervals, assistance behavior, and miss resets. Backend due retrieval, interval advancement, and exact REVIEW task completion are tested. PR #46 merged reconciliation and exact SRS advancement for due items across the three existing executable packages; later unsupported packages still fail closed. |
| Adaptive recommendation | PARTIAL | P2 | The planner is deterministic, explainable, as-of bounded, child-scoped, and non-mutating, with separate tests. Its recommendations do not yet inform authoritative Daily Queue lesson/review selection. |
| Session settlement | BROKEN | P1 | On merged main `a1bcfd9`, `complete_learning_session` commits curriculum progress, assessment, reward, session completion, and telemetry across independent SQLite transactions. Failure/retry can leave mastery/progress events committed while the session remains IN_PROGRESS. Active Issue #49 introduces connection-taking progress/assessment helpers and one settlement transaction with SQLite rollback/retry coverage; status stays BROKEN until reviewed and merged. Lesson summary text also says 10 stars while backend awards 5 points. |
| Return Home | COMPLETE | P2 | REVIEW wrap-up returns to canonical Home while preserving the active LEARN session and pending curriculum task. Browser-history exits also clear launch intent. The next normal CTA still launches LEARN. |
| Next-day due review / next lesson | PARTIAL | P1 | SRS state and due retrieval work in backend tests. The runner is limited to three stage-start lesson IDs, while the validated curriculum manifest lists 12 Starter, 12 Basic, and Book 1 lessons 1–3. Subsequent lessons are explicitly reported unavailable. |
| Parent-visible progress | PARTIAL | P1 | A parent-authorized learning-flow report returns session, task, deferred, mastery, due-count, and privacy summaries. The production Dashboard still consumes the older /api/dashboard projection and never calls /learning-sessions/report. |
| Validated lesson-content continuation | NEEDS_PRODUCT_DECISION | P1 | The source-aware manifest validates titles/objective summaries for Starter, Basic, and Book 1 lessons 1–3, but lesson text/media/activity content remains PERMISSION_REQUIRED; only three lesson packages are in the runtime. Do not infer permission from metadata validation or add Book 2–10 content. |
| Real learner / device validation | NEEDS_REAL_CHILD_VALIDATION | P1 | Repository docs retain a supervised validation protocol, but no deployed database or real-child observation is available to this audit. Timing, child comprehension, parent workflow, and real-device behavior remain unverified. |

### Evidence inspected

- Canonical entry: frontend/src/main.tsx, frontend/src/AppShell.tsx, frontend/src/pages/ChildPortalPage.tsx, and frontend/src/pages/LessonPlayerPage.tsx.
- Backend journey: backend/app/learning_flow.py, backend/app/placement.py, backend/app/curriculum_policy.py, backend/app/curriculum_evidence.py, backend/app/main.py, and backend/app/database.py.
- Curriculum boundary: shared/validated-curriculum-slice.json, shared/lesson-packages/{starter,basic,book1}-l01.json, docs/curriculum-audit-v1.md.
- Policy and architecture: docs/frontend-architecture.md, docs/learning-path-v2.md, docs/mastery-gates.md, docs/srs-policy.md, docs/roadmap.md, and docs/project-handoff.md.
- Relevant test suites: backend/tests/test_learning_flow.py, backend/tests/test_lesson_player.py, backend/tests/test_validated_curriculum_policy.py, backend/tests/test_adaptive.py, backend/tests/test_dashboard.py, frontend/src/lib/lessonPlayer.test.tsx, and frontend/src/lib/childFirst.test.tsx.

PR #40 adds real-backend tests for full-flow task parity on all three supported lesson IDs and the legitimate partial recognition plan on Basic and Book 1. Issue #41 adds canonical Home/AppShell route tests for due-review→REVIEW, normal CTA→LEARN, browser-history intent reset, exact reconciled task completion, Home return, and no whole-session `/complete`. The realistic backend REVIEW lifecycle test covers a pending required curriculum task, exact review task completion, unchanged IN_PROGRESS parent session, exact SRS row advancement, and reconciliation deduplication.

Issue #43 / PR #44 adds a real backend Fast Track failure→same-session resume→exact curriculum task evidence regression, plus canonical Home/AppShell regressions for blocked interaction until resume, exact repair task IDs, resume identity/API failures, unsupported-domain fail-closed behavior, repair wrap-up without whole-session settlement, and next Home launch in LEARN. Independent Architect PASS was posted on exact head `c84c952e709023c4840ed27ca6b362f5fb0f8065`; it merged to main as `8e0c690c960762d33b5bbd96308e4a0b012c4a35`. Independent full validation: backend pytest 152 passed; frontend Vitest 142 passed / 13 files; production build passed; base-to-head `git diff --check` passed. There were no schema changes, so migration checks were not applicable. GitHub Actions returned no workflow runs; CI is NOT VERIFIED.

Issue #45 / PR #46 adds a true backend cross-lesson reconciliation integration covering exact Daily Queue/task item identities, a pending parent curriculum task, retry deduplication, exact SRS advancement, and all-or-none rejection when a due item has no executable package. Canonical frontend regressions cover cross-lesson due selection and completion, unsupported/malformed fail-closed presentation, REVIEW wrap-up without whole-session `/complete`, and next normal launch in LEARN; the shared package contract covers `starter-l01`, `basic-l01`, and `book1-l01`. Verification before merge: backend pytest **153 passed**; frontend Vitest **145 passed / 13 files**; production build **PASS**; base-to-head `git diff --check` **PASS**; no schema changes, so migration checks were not applicable. Browser visual/narrow-viewport verification is not claimed because this change is behavioral and the canonical AppShell flow is exercised by route regressions. GitHub Actions status for PR #46 is **NOT VERIFIED**.

## Ranked gaps

### P0

No open P0 remains in the validated Home→LEARN/REVIEW/REPAIR slice. Issue #41 / PR #42 closed the Home→REVIEW selection gap and stale due-task mismatch; Issue #43 / PR #44 closed the supported FAST_TRACK failure→REPAIR lifecycle; PR #46 / Issue #45 completed cross-lesson REVIEW; PR #48 / Issue #47 closed selected-child identity continuity. Current main is `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7`.

### Resolved P0

- **Planner/runtime task parity for the three currently executable lessons** — closed by Issue #39 / PR #40, reviewed PASS on exact head `3398cee41bd8b0ce9118282682216e30e9fd939b`, then squash-merged to main at `06516a47b4b3c2c77d1f82eefa63e67d454f6282`. Full backend/frontend tests and production build passed locally; GitHub Actions had no run for that exact head.
- **Canonical Home→REVIEW selection and exact due-task matching** — implemented for Issue #41, independently reviewed PASS on exact head `f87e95ad5f1ee7a5a6aa814c50ff61d5d9fc469f`, then squash-merged by PR #42 at `6b6c64e43f18a813d11c1f93c4032f557f631476`. New due IDs are reconciled even when stale REVIEW rows exist; queue/task identity failures fail closed.

### Resolved P1

- **FAST_TRACK failure→REPAIR lifecycle** — Issue #43 / PR #44 passed independent Architect review on exact head `c84c952e709023c4840ed27ca6b362f5fb0f8065` and squash-merged at `8e0c690c960762d33b5bbd96308e4a0b012c4a35`. Full backend/frontend tests, production build, and diff check passed locally; GitHub Actions had no run for that exact head.
- **Exact selected backend child identity through canonical Home** — Issue #47 / PR #48 passed independent review and merged to main at `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7`. It removes display-name resolution and first-child Daily Queue fallback, verifies child identity on queue response, and keeps local prototype learner settings presentation-only. Full frontend Vitest (148/148 across 13 files), production build, and base-to-head diff check passed; exact PR head had no Actions runs or status checks. Fresh/unresolved authorized child binding remains OWNER_DECISION_REQUIRED.

### P1

1. **Issue #49 — failure-atomic session settlement.** Draft PR #50 on branch `codex/issue-49-session-settlement-atomicity` moves progress, assessment, reward, wrap-up, session status, and settlement telemetry into one SQLite transaction. SQLite failure injection covers assessment-event failure and late settlement telemetry failure, followed by retry/replay checks. Local verification: backend pytest 155 passed; frontend Vitest 148 passed across 13 files; production build PASS; base-to-head `git diff --check` PASS. No schema migration was needed. GitHub Actions workflow runs and combined status checks were both absent for exact head `29c534499b64bd8c4295d213519e9d0b92b1af25`; CI is **NOT VERIFIED**. Independent Architect review is pending.
2. **Parent dashboard integration.** The authoritative learning-flow report is not surfaced by the production Parent Dashboard.
3. **Placement editing / first-time child binding.** Existing placement endpoints require a signed parent/admin session; the frontend has no parent session provisioning flow. Keep editing and any selector exposing sibling backend profiles at `OWNER_DECISION_REQUIRED` until an authorized surface/session contract is established.
4. **Next lesson continuation within the already validated slice.** The runner stops at the first lesson for each curriculum stage. Runtime expansion must stay within the manifest and respect the explicit lesson-content licensing boundary.
5. **Adaptive selection policy.** The planner's existing `char_ids[:1]` can choose a strong first character when a later character is weak. Changing target selection is a pedagogical policy decision; do not alter it in technical follow-up work.
6. **Real learner/device trial.** Requires a real child/parent and device; this is an explicit owner gate, not a code-level substitute.

### P2

1. **P2 adaptive recommendation integration.** The existing planner is explainable and read-only, but its recommendations do not select the authoritative Daily Queue lesson or review.

## Proposed autonomous issue sequence

1. **Current implementation: Issue #49, P1 session settlement atomicity.** Await independent Architect review after full backend/frontend/build checks and base-to-head diff-check.
2. **Next autonomous P1: parent report integration.** Display the existing child-scoped authoritative learning report on the Parent surface.
3. **Placement editing and first-time backend-child selection** remain `OWNER_DECISION_REQUIRED` pending signed parent-session provisioning or a verified authorized selector.
4. **Continue the executable path only within the validated curriculum manifest.** Do not reproduce protected source lesson text/media or expand Books 2–10. If completion requires content covered by the current PERMISSION_REQUIRED boundary, stop that content issue at OWNER_DECISION_REQUIRED.
5. **Real child/device trial** remains NEEDS_REAL_CHILD_VALIDATION; do not claim completion from mocks.

## Explicit exclusions and decisions

- **UI/manual lane:** Issue #37 Child Home visual recovery and Issue #30 Practice OCR narrow-width correction remain parked. This audit proposes no redesign, visual direction change, or spacing/alignment work.
- **Book scope:** Books 2–10 remain out of scope. The next code fixes target existing executable lessons and their contracts.
- **Owner decision now:** First-time/unresolved backend child binding and placement editing need a signed parent/admin session or an already-authorized selection surface. The child-visible Home prototype switcher remains local-only; do not use it or its local PIN as backend authorization. Publishing source lesson text, images, audio, or workbook exercises remains separately gated by licensing/permission.
- **Real child/device:** Required before claiming observed child usability or real-device validation.

## Audit limits and repository state

- main baseline is `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7`; PR #40 / Issue #39 closes planner/runtime parity, PR #42 / Issue #41 closes canonical Home→REVIEW mode selection, PR #44 / Issue #43 closes supported FAST_TRACK failure→REPAIR, PR #46 / Issue #45 closes cross-lesson supported REVIEW, and PR #48 / Issue #47 closes exact child identity continuity. Issue #49 is active on `codex/issue-49-session-settlement-atomicity`.
- GitHub's active program includes Issues #30, #37, #38, and #49. Issues #41, #43, #45, and #47 are closed by merged PRs #42, #44, #46, and #48 respectively; Issue #49 is in a Draft PR awaiting independent review.
- docs/project-handoff.md has an Issue #38-aligned active snapshot and merge authority; older Phase 20 records remain explicitly historical. Phase labels were not used as evidence of feature completeness.
- No TONGXUAN_DB_PATH is configured in this audit environment and the worktree has no SQLite database. Backend tests use isolated temporary databases. Deployed learner DB state is **NOT VERIFIED**.
- Initial audit was static. Issue #39 exact-head validation ran backend pytest (151 passed), frontend Vitest (13 files / 128 passed), production build (PASS), and base-to-head `git diff --check` (PASS). Issue #41 / PR #42 passed independent Architect review on exact head `f87e95ad5f1ee7a5a6aa814c50ff61d5d9fc469f`: frontend Vitest 13 files / 140 passed, production build PASS, backend REVIEW lifecycle 5 passed / 10 deselected, and base-to-head `git diff --check` PASS. Issue #43 / PR #44 passed independent full validation on exact head `c84c952e709023c4840ed27ca6b362f5fb0f8065`: backend pytest 152 passed, frontend Vitest 13 files / 142 passed, production build PASS, and `git diff --check` PASS. PR #46 / Issue #45 merged at `b14f24507572fbe38c9a8f0203ec2a0b4a05270b`; its branch had backend pytest 153 passed, frontend Vitest 145 passed / 13 files, production build PASS, and base-to-head `git diff --check` PASS. PR #48 / Issue #47 merged at `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7`; its implementation head `8ef2e7a80e8611f6eca9ca6e04f17ce5bb789070` passed targeted AppShell/Home Vitest 29/29, full frontend Vitest 148/148 across 13 files, production build PASS (existing chunk advisory), and base-to-head `git diff --check` PASS. No backend/API/schema changes were made for #47. Issue #49 local verification on Draft PR #50: backend pytest **155 passed** (7 sqlite datetime adapter deprecation warnings); frontend Vitest **148 passed / 13 files**; production build **PASS** (existing Vite large-chunk advisory); base-to-head `git diff --check` **PASS**. No schema change, so migration checks were not applicable. Exact head `29c534499b64bd8c4295d213519e9d0b92b1af25` has no GitHub Actions workflow runs and no combined status checks; CI is **NOT VERIFIED**.
