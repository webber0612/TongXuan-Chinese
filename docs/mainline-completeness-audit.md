# Mainline Completeness Audit

**Audit baseline:** main at 6b6c64e43f18a813d11c1f93c4032f557f631476 (squash merge of PR #42 / Issue #41)
**Scope:** Issue #38 end-to-end learning journey, limited to executable code, tests, APIs, schema, and currently approved curriculum boundaries.
**Result:** PR #40 closed the supported-lesson planner/runtime task-parity P0 for `starter-l01`, `basic-l01`, and `book1-l01`. PR #42 closed the canonical Home → REVIEW mode handoff and exact Daily Queue task-selection gap. No P0 remains in the validated Home→LEARN/REVIEW slice. Issue #43 is implemented on `codex/issue-43-fast-track-repair` and awaiting exact-head Architect review; main remains at the audit baseline until the PR passes and merges.

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

When the current lesson is complete and the Daily Queue has due reviews, the Home CTA now carries REVIEW through AppShell to the canonical `/learning-session` route. The ordinary lesson CTA explicitly carries LEARN. AppShell resets launch intent when leaving the session route through Home navigation or browser history, so REVIEW cannot persist into a later normal launch. Frontend route regressions exercise due-task reconciliation, exact task completion, return Home with the mixed LEARN session intact, the next normal LEARN launch, and fail-closed behavior when a browser-history exit returns to Home. The backend integration independently verifies exact reconciliation and SRS persistence.

PR #40 aligned backend planner tasks with executable player steps for the three supported lesson IDs. Its real API regressions cover planner output, exact task evidence, and settlement for full and supported partial recognition plans. It did not change adaptive/teaching policy, mastery thresholds, SRS policy, or the UI.

## Mainline completeness matrix

| Stage | Status | Priority | Executable finding |
|---|---|---:|---|
| Learner / profile | PARTIAL | P1 | Backend children are reconciled with local profiles, while Child Home retains its own local learner list and can resolve backend identity by displayed name. Profile and child identity do not have one fully canonical persisted selection boundary. |
| Placement / current ability | PARTIAL | P1 | placement_profiles and parent/admin GET/PUT /placement-profile exist. Placement starts at the lowest assessed core domain; age is not used as a gate. The production frontend does not call this API, so a new or unconfigured learner silently defaults to STARTER. |
| Daily Queue | PARTIAL | P1 | The backend deterministically returns the placement start, due recognition items, and active session. Executable LEARN is limited to starter-l01, basic-l01, and book1-l01; later accessible curriculum lessons are reported unavailable. Daily Queue can return due IDs across lessons, while reconciliation is scoped to the current session lesson; the REVIEW route now fails closed for cross-lesson due sets. |
| Authoritative lesson / review selection | COMPLETE | P2 | On the supported canonical Home flow, the due-review CTA passes REVIEW through AppShell to `/learning-session`; the normal lesson CTA explicitly passes LEARN. REVIEW tasks still come only from backend Daily Queue + reconciliation, and missing tasks fail closed. |
| LEARN | COMPLETE | P2 | For the three currently executable lessons, PR #40 aligned real backend planner tasks to Lesson Player steps, including the supported single `recognition-1` MINI_CHECK partial plan. Backend API regressions submit exact tasks and settle the session. Later validated lessons remain unavailable (tracked under continuation), and broader settlement/resilience gaps are tracked separately. |
| FAST_TRACK | PARTIAL | P1 | On main, failure pauses the active session, but repair needs authoritative same-session resume before task interaction. Issue #43's Draft PR adds exact child/lesson/session binding and expected-session resume; this remains unmerged pending review. |
| REVIEW | COMPLETE | P2 | The canonical due-review CTA enters REVIEW. Exact-task reconciliation, task completion, SRS advancement, and wrap-up are covered; wrap-up returns Home without completing the parent LEARN session or changing pending curriculum work. |
| REPAIR | BROKEN | P1 | Main still leaves the parent session PAUSED and may fall back to a Fast Track exit ticket for unsupported domains. Issue #43's Draft PR builds repair only from exact eligible existing curriculum tasks and returns Home without settling the parent LEARN session; pending Architect review. |
| Task evidence | PARTIAL | P1 | Server-side scoring, linked evidence, and task persistence exist. Speaking provider completion, skill gate, and learning task share a transaction with backend failure/retry tests. PR #40 adds real planner-task evidence and settlement coverage for all three currently executable lessons; other domains remain separate. |
| Mastery Gate | PARTIAL | P1 | Server-side per-domain scored floors and non-score gates exist, and client-provided mastery scores are rejected. Supported LEARN task parity is now covered; full product mastery visibility and failure-atomic settlement remain incomplete. Session completion and mastery remain separate concepts. |
| SRS | PARTIAL | P1 | Domain/item-specific SRS state and append-only events implement deterministic intervals, assistance behavior, and miss resets. Backend due retrieval, interval advancement, and exact REVIEW task completion are tested. Daily Queue may contain due IDs from multiple lessons; one session reconciliation is lesson-scoped, so out-of-scope due IDs fail closed until multi-lesson selection is addressed. |
| Adaptive recommendation | PARTIAL | P2 | The planner is deterministic, explainable, as-of bounded, child-scoped, and non-mutating, with separate tests. Its recommendations do not yet inform authoritative Daily Queue lesson/review selection. |
| Session settlement | PARTIAL | P1 | The backend checks required tasks, writes PRACTICED, assesses mastery, awards points, completes wrap-up/session, and logs transitions. These steps use separate database connections rather than one failure-atomic boundary; failure injection/retry consistency is not covered. Lesson summary text also says 10 stars while backend awards 5 points. |
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

Issue #43 adds a real backend Fast Track failure→same-session resume→exact curriculum task evidence regression, plus canonical Home/AppShell regressions for blocked interaction until resume, exact repair task IDs, resume identity/API failures, unsupported-domain fail-closed behavior, repair wrap-up without whole-session settlement, and next Home launch in LEARN. Local full validation on the Draft branch: backend pytest 152 passed; frontend Vitest 142 passed; production build passed; base-to-head `git diff --check` passed. There are no schema changes, so no migration check was applicable. This branch-level evidence does not change main's status until PR #43 receives exact-head PASS and merges.

## Ranked gaps

### P0

No open P0 remains in the validated Home→LEARN/REVIEW handoff slice. Issue #41 / PR #42 closed the Home→REVIEW selection gap and stale due-task mismatch; main is now at `6b6c64e43f18a813d11c1f93c4032f557f631476`.

### Resolved P0

- **Planner/runtime task parity for the three currently executable lessons** — closed by Issue #39 / PR #40, reviewed PASS on exact head `3398cee41bd8b0ce9118282682216e30e9fd939b`, then squash-merged to main at `06516a47b4b3c2c77d1f82eefa63e67d454f6282`. Full backend/frontend tests and production build passed locally; GitHub Actions had no run for that exact head.
- **Canonical Home→REVIEW selection and exact due-task matching** — implemented for Issue #41, independently reviewed PASS on exact head `f87e95ad5f1ee7a5a6aa814c50ff61d5d9fc469f`, then squash-merged by PR #42 at `6b6c64e43f18a813d11c1f93c4032f557f631476`. New due IDs are reconciled even when stale REVIEW rows exist; queue/task identity failures fail closed.

### P1

1. **Issue #43 — FAST_TRACK failure→REPAIR lifecycle.** Main has the failure path described above. The implementation is in Draft PR #43; it is not counted as resolved until independent review passes and the PR merges. Acceptance covers exact same-session resume/evidence, no unsupported fallback, and no whole-session completion from partial repair.
2. **Cross-lesson Daily Queue review.** Daily Queue can return exact due IDs from multiple lessons, but reconciliation is limited to the active session lesson; canonical REVIEW now fails closed rather than replay stale or mismatched tasks. Support due IDs within the currently executable lesson packages without changing eligibility or dropping items.
3. **Canonical backend child identity and usable placement flow.** Placement endpoints exist but are not wired into the current parent/profile experience.
4. **Parent dashboard integration.** The authoritative learning-flow report is not surfaced by the production Parent Dashboard.
5. **Next lesson continuation within the already validated slice.** The runner stops at the first lesson for each curriculum stage. Runtime expansion must stay within the manifest and respect the explicit lesson-content licensing boundary.
6. **Adaptive selection policy.** The planner's existing `char_ids[:1]` can choose a strong first character when a later character is weak. Whether to change target selection is a pedagogical policy decision; keep current behavior until a concrete learner-impact fix can preserve the established policy or needs owner decision.
7. **Real learner/device trial.** Requires a real child/parent and device; this is an explicit owner gate, not a code-level substitute.

### P2

1. **P2 adaptive recommendation integration.** The existing planner is explainable and read-only, but its recommendations do not select the authoritative Daily Queue lesson or review.

## Proposed autonomous issue sequence

1. **Current: review Draft PR #43 for Issue #43, P1 FAST_TRACK failure→REPAIR lifecycle.** After exact-head PASS, merge and update this matrix to reflect authoritative same-session `IN_PROGRESS` before repair interaction and preserved LEARN work through repair wrap-up.
2. **Next: P1 cross-lesson Daily Queue review.** Reconcile and present each eligible due item from existing executable lesson packages by exact backend identity; preserve current due eligibility and fail closed for genuinely unavailable content.
3. **P1 profile identity / placement integration.** Use stable backend child IDs end to end and expose the existing placement contract without changing its policy.
4. **P1 parent report integration.** Display the existing child-scoped authoritative learning report on the Parent surface.
5. **P1 continue the executable path only within the validated curriculum manifest.** Do not reproduce protected source lesson text/media or expand Books 2–10. If completion requires content covered by the current PERMISSION_REQUIRED boundary, stop that content issue at OWNER_DECISION_REQUIRED.
6. **Adaptive target selection** only after confirming the policy can remain unchanged; otherwise mark OWNER_DECISION_REQUIRED for the pedagogical choice.
7. **Real child/device trial** remains NEEDS_REAL_CHILD_VALIDATION; do not claim completion from mocks.

## Explicit exclusions and decisions

- **UI/manual lane:** Issue #37 Child Home visual recovery and Issue #30 Practice OCR narrow-width correction remain parked. This audit proposes no redesign, visual direction change, or spacing/alignment work.
- **Book scope:** Books 2–10 remain out of scope. The next code fixes target existing executable lessons and their contracts.
- **Owner decision now:** None for the first code-level fixes. A future request to publish source lesson text, images, audio, or workbook exercises remains gated by licensing/permission; do not start that work without the required authorization.
- **Real child/device:** Required before claiming observed child usability or real-device validation.

## Audit limits and repository state

- main is at `6b6c64e43f18a813d11c1f93c4032f557f631476`; PR #40 / Issue #39 closes planner/runtime parity and PR #42 / Issue #41 closes canonical Home→REVIEW selection. Issue #43 implementation is on its Draft branch and is not yet part of main's completeness status.
- GitHub currently has open Issues #30, #37, #38, and #43. Issue #38 supersedes old phase-based stop instructions in handoff text; Issue #41 is closed by merged PR #42.
- docs/project-handoff.md now has an Issue #38-aligned active snapshot and merge authority; older Phase 20 records remain explicitly historical. Phase labels were not used as evidence of feature completeness.
- No TONGXUAN_DB_PATH is configured in this audit environment and the worktree has no SQLite database. Backend tests use isolated temporary databases. Deployed learner DB state is **NOT VERIFIED**.
- Initial audit was static. Issue #39 exact-head validation ran backend pytest (151 passed), frontend Vitest (13 files / 128 passed), production build (PASS), and base-to-head `git diff --check` (PASS). Issue #41 / PR #42 passed independent Architect review on exact head `f87e95ad5f1ee7a5a6aa814c50ff61d5d9fc469f`: frontend Vitest 13 files / 140 passed, production build PASS, backend REVIEW lifecycle 5 passed / 10 deselected, and base-to-head `git diff --check` PASS. GitHub Actions returned zero workflow runs; CI is NOT VERIFIED.
