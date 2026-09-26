# Mainline Completeness Audit

**Audit baseline:** main at 71d928b6d0d00d0a5738bf61fc4d6cbf2fe72321 (merge of PR #36)  
**Scope:** Issue #38 end-to-end learning journey, limited to executable code, tests, APIs, schema, and currently approved curriculum boundaries.  
**Result:** The underlying services and isolated mode components exist, but the production path does not yet compose them into a reliable end-to-end journey. Two P0 contract gaps are selected for autonomous repair before broader work.

## Current executable path

    frontend/src/main.tsx
      → AppShell.tsx
      → / renders ChildPortalPage
      → Home fetches /api/children/{child_id}/learning-daily-queue
      → “start today” callback stores lessonId and navigates to /learning-session
      → AppShell renders LessonPlayerPage (initialMode defaults to LEARN)
      → backend POST /api/children/{child_id}/learning-sessions builds tasks
      → task answer/evidence APIs write attempts, gates, and SRS
      → POST .../complete checks required task states, assesses mastery, awards 5 points
      → onBack returns to /

The backend also exposes /api/children/{child_id}/learning-sessions/report and a parent-authorized placement profile API. The production Parent Dashboard does not consume the learning-session report, and the production frontend does not call the placement profile API.

A direct component test can initialize LessonPlayerPage in REVIEW, but the canonical AppShell path never passes that mode. The backend planner conditionally emits required tasks by lesson domain; the Lesson Player uses the package step sequence and requires matching backend task identities before advancing. Those contracts do not match for all three supported lesson IDs.

## Mainline completeness matrix

| Stage | Status | Priority | Executable finding |
|---|---|---:|---|
| Learner / profile | PARTIAL | P1 | Backend children are reconciled with local profiles, while Child Home retains its own local learner list and can resolve backend identity by displayed name. Profile and child identity do not have one fully canonical persisted selection boundary. |
| Placement / current ability | PARTIAL | P1 | placement_profiles and parent/admin GET/PUT /placement-profile exist. Placement starts at the lowest assessed core domain; age is not used as a gate. The production frontend does not call this API, so a new or unconfigured learner silently defaults to STARTER. |
| Daily Queue | PARTIAL | P1 | The backend deterministically returns the placement start, due recognition items, and active session. It supports executable sessions only for starter-l01, basic-l01, and book1-l01; later accessible curriculum lessons are returned as unavailable. The due list can include items that are not reconciled into the selected lesson session. |
| Authoritative lesson / review selection | BROKEN | P0 | Home's due-review action passes a learner and lesson ID, then navigates to /learning-session. AppShell renders LessonPlayerPage without initialMode, whose default is LEARN. Thus the production entry does not select REVIEW even though the button says review. |
| LEARN | BROKEN | P0 | learning_flow._session_plan conditionally creates tasks by curriculum domain; package steps and Lesson Player Next guards expect tasks that the real planner may not emit. For example, Starter L1 has no backend vocabulary, recognition, or sentence-pattern task; Basic L1 has no sentence-pattern task; Book 1 L1 has no vocabulary task. Missing task identity fails closed, so a real session can stop before settlement. |
| FAST_TRACK | PARTIAL | P1 | The server validates the challenge and does not directly grant MASTERED. On failure it pauses the active session; the UI transitions to REPAIR without first authoritatively resuming it. Task mutation APIs require an IN_PROGRESS session, so this path is not executable end to end. |
| REVIEW | BROKEN | P0 | Exact-task retrieval and review wrap-up are implemented and component-tested, including avoiding whole-session completion. However, canonical Home/AppShell cannot enter that mode. Due tasks inserted into the parent LEARN session are not rendered by LEARN steps and can remain required, causing /complete to reject with required_learning_tasks_incomplete. |
| REPAIR | BROKEN | P1 | The component renders targeted weak-domain steps, but the FAST_TRACK failure route leaves the parent session PAUSED. No authoritative active repair lifecycle is completed before interaction. |
| Task evidence | PARTIAL | P1 | Server-side scoring, linked evidence, and task persistence exist. Speaking provider completion, skill gate, and learning task share a transaction with backend failure/retry tests. Real planner-to-runtime task parity is not covered by the current full-flow frontend fixture. |
| Mastery Gate | PARTIAL | P1 | Server-side per-domain scored floors and non-score gates exist, and client-provided mastery scores are rejected. End-to-end mastery remains blocked by the LEARN task mismatch; session completion and mastery remain separate concepts. |
| SRS | PARTIAL | P1 | Domain/item-specific SRS state and append-only events implement deterministic intervals, assistance behavior, and miss resets. Backend due retrieval and interval tests exist. Production Home→REVIEW selection is broken, and the due list is wider than the same-lesson reconciliation boundary. |
| Adaptive | COMPLETE | P2 | The adaptive planner is deterministic, explainable, as-of bounded, child-scoped, and non-mutating, with separate tests. It is an independent recommendation/read model; it does not choose the authoritative lesson or replace the Daily Queue. |
| Session settlement | PARTIAL | P1 | The backend checks required tasks, writes PRACTICED, assesses mastery, awards points, completes wrap-up/session, and logs transitions. These steps use separate database connections rather than one failure-atomic boundary; failure injection/retry consistency is not covered. Lesson summary text also says 10 stars while backend awards 5 points. |
| Return Home | PARTIAL | P1 | onBack returns to canonical Home, and REVIEW wrap-up uses it without completing the parent session. A realistic API-backed path from Home through a full session settlement and refreshed queue is not proven while LEARN/REVIEW contracts fail. |
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

The code-level Book 1 full-flow test supplies a hand-built session task list. It includes vocabulary and sentence-pattern tasks that the production Book 1 L1 planner does not emit. Component REVIEW tests pass initialMode="REVIEW" directly and therefore do not exercise the canonical Home→AppShell mode handoff. These tests demonstrate component behavior, not the full production contract.

## Ranked gaps

### P0

1. **Planner/runtime task parity for the three currently executable lessons.** Real backend plans and production package steps disagree; a child can be blocked before task completion or settlement. This affects the base LEARN path.
2. **Canonical Home→REVIEW selection.** Due-review UI cannot enter the tested REVIEW mode. Required review tasks may be stranded inside LEARN, and due items from different lesson scopes are shown more broadly than the active session can reconcile.

### P1

3. **FAST_TRACK failure→REPAIR lifecycle.** The parent session becomes PAUSED and is not authoritatively resumed before repair interaction.
4. **Failure-atomic/idempotent settlement.** Progress, assessment, reward, session status, and wrap-up completion need a consistent persistence boundary or an explicitly recoverable idempotent contract.
5. **Canonical backend child identity and usable placement flow.** Placement endpoints exist but are not wired into the current parent/profile experience.
6. **Parent dashboard integration.** The authoritative learning-flow report is not surfaced by the production Parent Dashboard.
7. **Next lesson continuation within the already validated slice.** The runner stops at the first lesson for each curriculum stage. Runtime expansion must stay within the manifest and respect the explicit lesson-content licensing boundary.
8. **Real learner/device trial.** Requires a real child/parent and device; this is an explicit owner gate, not a code-level substitute.

### P2

9. **Adaptive recommendation integration.** The existing planner is explainable and read-only, but its recommendations do not select the authoritative Daily Queue lesson or review.

## Proposed autonomous issue sequence

1. **Next: P0 real planner ↔ Lesson Player parity for starter-l01, basic-l01, and book1-l01.** Use actual backend session responses in regressions. Every required backend task must map to a supported runtime step; no mocked task may be added solely to satisfy the test. Each supported LEARN path must reach authoritative wrap-up and settlement without changing mastery policy or visual direction.
2. **P0 Home→REVIEW contract.** Route the due-review action into the exact REVIEW mode and exact authoritative tasks. Keep the parent LEARN session IN_PROGRESS, do not call whole-session /complete, preserve pending curriculum tasks, and test the canonical Home/AppShell path.
3. **P1 FAST_TRACK failure→REPAIR lifecycle.** Require authoritative IN_PROGRESS session state before repair task UI or writes.
4. **P1 settlement consistency.** Add failure-injection and retry coverage for curriculum progress, mastery assessment, rewards, wrap-up task, and session status; return authoritative settlement values to the UI.
5. **P1 profile identity / placement integration.** Use stable backend child IDs end to end and expose the existing placement contract without changing its policy.
6. **P1 parent report integration.** Display the existing child-scoped authoritative learning report on the Parent surface.
7. **P1 continue the executable path only within the validated curriculum manifest.** Do not reproduce protected source lesson text/media or expand Books 2–10. If completion requires content covered by the current PERMISSION_REQUIRED boundary, stop that content issue at OWNER_DECISION_REQUIRED.
8. **Real child/device trial** remains NEEDS_REAL_CHILD_VALIDATION; do not claim completion from mocks.

## Explicit exclusions and decisions

- **UI/manual lane:** Issue #37 Child Home visual recovery and Issue #30 Practice OCR narrow-width correction remain parked. This audit proposes no redesign, visual direction change, or spacing/alignment work.
- **Book scope:** Books 2–10 remain out of scope. The next code fixes target existing executable lessons and their contracts.
- **Owner decision now:** None for the first code-level fixes. A future request to publish source lesson text, images, audio, or workbook exercises remains gated by licensing/permission; do not start that work without the required authorization.
- **Real child/device:** Required before claiming observed child usability or real-device validation.

## Audit limits and repository state

- main is at 71d928b6d0d00d0a5738bf61fc4d6cbf2fe72321; PR #36 is merged at this head.
- GitHub currently has open Issues #30, #37, and #38; the open-PR search returned no open PRs. Relevant completed work includes Issues/PRs #28/#29, #31/#32, #33/#34, and #35/#36. Issue #38 supersedes old phase-based stop instructions in handoff text.
- docs/project-handoff.md contains historical active-handoff and Phase 20 wording that no longer matches current main or Issue #38. Phase labels were not used as evidence of feature completeness.
- No TONGXUAN_DB_PATH is configured in this audit environment and the worktree has no SQLite database. Backend tests use isolated temporary databases. Deployed learner DB state is **NOT VERIFIED**.
- This deliverable is a static code/test/API/docs audit. Tests and build were inspected but not executed during audit.

