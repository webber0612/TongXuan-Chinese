# ChatGPT ↔ Codex Project Handoff


> ## ACTIVE HANDOFF SNAPSHOT — 2026-09-27
>
> **Read this section first. It is the authoritative handoff and supersedes the old Phase-based and manual-relay instructions below for Issue #38.**
>
> Repository: `webber0612/TongXuan-Chinese`
>
> ### Current autonomous mainline state
>
> - Current `main`: `6b6c64e43f18a813d11c1f93c4032f557f631476`.
> - PR #42 / Issue #41 passed independent Architect review on exact head `f87e95ad5f1ee7a5a6aa814c50ff61d5d9fc469f` and was squash-merged to `main` at `6b6c64e43f18a813d11c1f93c4032f557f631476`.
> - Issue #43, `[P1 Mainline] Make FAST_TRACK failure → REPAIR lifecycle executable`, is implemented on `codex/issue-43-fast-track-repair`, from the current `main`, in [Draft PR #44](https://github.com/webber0612/TongXuan-Chinese/pull/44). It adds exact Fast Track session binding, authoritative same-session resume, task-backed REPAIR, and wrap-up that preserves the IN_PROGRESS parent LEARN session. Issue #43 remains open pending independent exact-head review and merge.
> - Local validation on the Issue #43 branch: backend pytest **152 passed** (4 sqlite datetime adapter deprecation warnings); frontend Vitest **142 passed** across 13 files; production build passed (Vite reported the existing large-chunk advisory); `git diff --check 6b6c64e43f18a813d11c1f93c4032f557f631476` passed. No schema/persistence migration changed, so migration checks were not applicable.
> - Issue #38 is the governing continuous program. See [the completeness audit](mainline-completeness-audit.md) for the executable matrix, priorities, UI/manual lanes, and audit limits.
>
> ### Program workflow and authority
>
> Project Manager selects the next ranked issue and writes acceptance criteria → Implementer makes a branch and Draft PR → independent Architect reviews the exact head → findings return through GitHub → after PASS and required tests/build/migration checks, PM marks ready and merges → update the audit and continue to the next issue.
>
> No Product Owner message relay is required between Implementer and Architect. Issue #38 authorizes PM merge only after exact-head PASS, required tests/build and any migration checks pass, no unresolved P0/P1 remains, and scope is within the autonomous lane.
>
> Stop and mark `OWNER_DECISION_REQUIRED` only for approved UI design choices, major teaching policy, legal/licensing/commercial rights, irreversible data risk, paid external services, real-child/device validation, or core product scope changes.
>
> ### Scope and verification limits
>
> - Issues #37 and #30 remain in the UI/manual lane. Preserve the approved deployed UI direction; do not redesign it.
> - Do not expand Books 2–10. Current runtime work stays within the existing validated lesson packages and backend contracts.
> - No local or deployed learner database is configured in this worktree; deployed DB state is **NOT VERIFIED**.
> - GitHub Actions status for the new Issue #43 PR is **NOT VERIFIED** until inspected after opening the Draft PR; local checks above are not CI evidence.
>
> ### Canonical frontend identity
>
> **TongXuan Web App**
>
> ```text
> frontend/src/main.tsx
>   → frontend/src/AppShell.tsx
>
> Child Home / Today:
> /
>
> Canonical lesson runtime:
> /learning-session → LessonPlayerPage
> ```
>
> Historical preview React pages are not production surfaces. Legacy preview URLs are tombstones only.
> All UI work must follow `docs/frontend-architecture.md` and the user-approved design direction.
> If canonical branch/route/component/import-chain cannot be verified, stop with:
>
> `CANONICAL_FRONTEND_NOT_VERIFIED`
>
> ### Collaboration rule
>
> Project Manager, Implementer, and independent Architect work as one autonomous loop. GitHub Issues, PR comments, and repository docs are the durable handoff. The Product Owner is not asked to copy review messages or authorize ordinary code fixes and integrations.


## Purpose

This document is the persistent handoff for the TongXuan Chinese project.

Use it when:
- continuing the project in a new ChatGPT conversation;
- recovering context after a long session;
- handing work between ChatGPT and Codex;
- checking current collaboration rules.

GitHub is the source of truth for project state.

## Canonical Frontend Identity

- Official name: **TongXuan Web App**
- Production entry: `frontend/src/main.tsx`
- Application shell: `frontend/src/AppShell.tsx`
- Canonical child route: `/`
- Archived previews are **not** valid implementation targets.
- UI modifications must follow `docs/frontend-architecture.md` and verify the production import chain.

---

## Historical handoff snapshot — superseded

The snapshot below this heading in earlier revisions described PR #34 / PR #36 and is obsolete. Use the ACTIVE HANDOFF SNAPSHOT at the top of this file and `docs/mainline-completeness-audit.md` for current GitHub state, work order, and merge authority.

---

# Roles

## Product Owner

The Product Owner decides only at the `OWNER_DECISION_REQUIRED` gates listed in the ACTIVE HANDOFF SNAPSHOT and Issue #38. Ordinary architecture, bug fixes, persistence, API consistency, tests, and mainline integration remain autonomous. The Product Owner does not relay messages between agents.

## Project Manager / Architect

- inspect the actual `main` executable path, tests, APIs, schema, relevant docs, and open GitHub work;
- maintain `docs/mainline-completeness-audit.md` and select the next highest-priority issue;
- write concrete work orders and acceptance criteria on GitHub;
- independently review each exact PR head, record PASS or CHANGES_REQUESTED on the PR, and verify required local tests/build/migrations;
- after PASS and all Issue #38 merge conditions are satisfied, mark ready and merge, then update the baseline and continue.

## Implementer

- create a branch from current `main` for the assigned issue;
- implement only the accepted work order, add regression coverage, and run the required checks;
- open/update a Draft PR and respond to Architect findings on GitHub until exact-head PASS.

The Project Manager and Implementer may be separate Codex agents. GitHub Issues, PR comments, and repository docs are the durable handoff; no Product Owner copy/paste step is part of the loop.

---

## Internal Agent Loop

The Implementer and independent Architect review every PR head. CHANGES_REQUESTED findings go on GitHub and return directly to the Implementer; the Product Owner is not a message relay. GitHub is the durable issue/branch/PR record. Local verification is reported separately from GitHub Actions; a missing workflow run is recorded as NOT VERIFIED.

# Autonomous Mainline Working Loop

```text
Project Manager audits and selects issue
→ Implementer branch / code / regression tests / Draft PR
→ independent Architect reviews exact head
→ fix and re-review until PASS
→ verify tests, build, and migrations as applicable
→ Project Manager marks ready and merges
→ update completeness audit and main baseline
→ start next highest-priority issue
```

Issue #38 explicitly authorizes Project Manager merges after exact-head Architect PASS, required tests/build and migration checks pass, no P0/P1 finding remains, scope stays in the autonomous lane, and no owner decision is required. Do not carry old Phase stop rules or no-merge wording into this lane. Issues #37 and #30 remain manual UI work and do not block mainline progress.

---

# Communication Style

To conserve conversation context:

ChatGPT should keep normal audit replies compact.

Preferred response after audit:

```text
已看最新 GitHub。

Result: PASS / CHANGES_REQUESTED

Blockers:
- ...

Major:
- ...

我已把完整 review 放到 GitHub。
```

Do not restate the full diff or full repository state in chat unless explicitly requested.

---

# GitHub as Persistent Memory

All important persistent project information should live in repository documents, not only in chat.

Key documents:

```text
docs/roadmap.md
docs/license-and-commercialization.md
docs/ai-development-loop.md
docs/project-handoff.md
```

If future conversations lose context, first read these files and the latest open PR / recent commits.

---

# Audit Scope

ChatGPT reviews at least:

## Scope / Phase
- no unauthorized Phase creep;
- no premature implementation of later roadmap stages.

## Architecture
- adapter/provider boundaries;
- backend authoritative learning state;
- database ownership and separation;
- maintainability.

## Learning logic
- Recognition / Writing / Reading / Pronunciation remain separate;
- guessed answers do not incorrectly increase mastery;
- Curriculum and School Queue remain separated;
- no accidental content leakage or invalid learning assumptions.

## Licensing / commercialization
- provenance tracked;
- Family vs Commercial build rules preserved;
- no commercial-readiness assumptions without license evidence.

## Child privacy
- recordings/photos/handwriting treated as sensitive media;
- parent/child ownership boundaries preserved.

## Testing
- changed behavior covered by tests where appropriate;
- no false claim of iPad / NAS validation without real manual test evidence.

---

# Historical Phase Record — superseded for current work

The following phase log is retained for historical context only. It is not evidence of current feature completeness, does not define the active work order, and does not override Issue #38 or `docs/mainline-completeness-audit.md`.

Project:
```text
webber0612/TongXuan-Chinese
```

Current baseline known from GitHub:
- Phase 0A completed.
- License Tracking & Commercialization Gate added.
- Family / Commercial build distinction defined.
- License registry exists.
- School Queue private-content rule defined.
- Commercial Replacement Registry defined.
- Phase 0 completed, audited PASS, and PR #3 merged to `main`.
- Phase 0 manual validation items still outstanding: real iPad Safari, Docker runtime, and Synology DS723+ deployment/persistence checks.
- Fast Track Sprint A (Phases 1–4) completed, audited PASS, and PR #5 merged to `main`.
- Phase 1 Recognition MVP completed.
- Phase 2 School Queue completed.
- Phase 3 Weekly Test + Scoring completed.
- Phase 4 Points + Reward System completed.
- Fast Track Sprint B (Phases 5–10) completed, audited PASS, and PR #7 merged to `main`.
- Phase 5 Words + Sentences completed.
- Phase 6 Writing completed.
- Phase 7 Zhuyin + Pinyin completed, including Simplified Chinese Pinyin practice.
- Phase 8 Grammar completed.
- Phase 9 Idioms completed.
- Phase 10 Reading completed.
- Phase 11 TTS completed, audited PASS, and PR #8 merged to `main`.
- Phase 12 Reading Aloud completed, audited PASS, and PR #10 merged to `main`.
- Phase 13 OCR Import completed, audited PASS, and PR #12 merged to `main`.
- Phase 14 Adaptive Learning passed Architect Audit and was merged to `main`.
- Phase 15 Parent Dashboard was completed and merged to `main`.
- Phase 16 Long-Term Curriculum was completed and merged to `main`.
- Phase 17 Optional AI Tutor was completed and merged to `main`.
- Phase 18 Commercialization Gate & Release Audit is implemented on `phase18/commercialization-gate`
  from merged main `1ca8037`; its registry/gate/admin read model and regression tests are complete
  and awaiting Architect Audit. Its unresolved Commercial blockers remain explicit; no legal or
  paid-license decision is claimed.
- Real-child usability validation is still outstanding before treating Sprints A/B as field-validated.

Relevant completed commits / milestones:
- `2a6395a` — add license tracking commercialization gate.
- `005f8dc` — define AI development and audit loop.
- PR #3 — Phase 0 technical validation, merged to `main`.
- PR #5 — Fast Track Sprint A, Phases 1–4, merged to `main`.
- PR #7 — Fast Track Sprint B, Phases 5–10, merged to `main`.
- PR #8 — Phase 11 TTS, audited PASS and merged to `main`.

Important:
The original automated GitHub-AI / Chrome-MCP idea was abandoned.

Do not continue that automation design unless the Product Owner explicitly reopens it.

This historical phase status predates the Issue #38 autonomous mainline program. Read the ACTIVE HANDOFF SNAPSHOT and completeness audit for the current `main` baseline and work order.

---

# Roadmap Context

The product is a family Chinese learning system that may later commercialize.

Core long-term architecture:
- React + TypeScript + Vite + PWA
- FastAPI + Python
- SQLite
- Docker / Synology NAS
- iPad / browser frontend
- deterministic learning engine
- optional local LLM later, never authoritative for mastery or official scoring

Core learning model:
- Curriculum Queue
- School Queue
- SRS Review
- Wrong Answer Queue
- Daily Learning Queue merges them

Major future areas:
- Recognition MVP
- School Queue
- Weekly tests
- points / rewards
- words / sentences
- handwriting
- Zhuyin / Pinyin
- grammar
- idioms
- reading
- TTS
- reading aloud
- OCR import
- adaptive learning
- parent dashboard
- long-term curriculum
- optional AI tutor
- commercialization audit
- production hardening

Read `docs/roadmap.md` for authoritative current ordering.

---

# Commercialization Rule

Family/private use and commercial readiness are separate.

A resource may be usable in Family Build while not being Commercial Ready.

All such resources must still retain:
- source;
- license;
- usage status;
- provenance;
- commercial replacement / licensing action if required.

Commercial release only happens after Commercialization Gate is cleared.

Read:
`docs/license-and-commercialization.md`

---

# How a New ChatGPT Conversation Should Resume

When the Product Owner says something like:

```text
繼續 TongXuan
```

or

```text
看最新 Git
```

the new ChatGPT session should:

1. read `docs/project-handoff.md`;
2. read `docs/roadmap.md`;
3. read `docs/license-and-commercialization.md`;
4. inspect latest commits / open PRs / current work order;
5. continue from GitHub state;
6. avoid asking the Product Owner to re-explain prior context unless GitHub lacks required information.

---

# How Codex Should Resume

When the Product Owner says:

```text
看最新 PR / GitHub
```

Codex should:

1. pull/fetch latest repository state;
2. read the active PR / work order;
3. read this handoff document if needed;
4. implement only the requested scope;
5. run tests;
6. push changes;
7. stop and report completion;
8. do not advance phases without authorization.

---

# Context Preservation Principle

If any important decision is made in chat and will matter later, ChatGPT should update this handoff document or another appropriate persistent project document.

Do not rely on chat memory alone for durable project decisions.

## Fast Track Sprint A status

Issue #4 covered one continuous Sprint A for Phases 1–4.

Final state:
- PR #5 passed ChatGPT Architect Audit and was merged to `main`.
- Phase 1 Recognition MVP completed.
- Phase 2 School Queue completed.
- Phase 3 Weekly Test + Scoring completed.
- Phase 4 Points + Rewards completed.
- SQLite remains authoritative.
- Review/Wrong Answer Queue behavior is implemented.
- Weekly Test records are deterministic/auditable and immutable after completion.
- Points remain separate from recognition mastery.
- Phase 5 completed in Sprint B.

Remaining validation:
- real iPad Safari;
- Docker runtime;
- Synology DS723+ deployment/persistence;
- real-child usability / parent workflow trial.

Phase 11 was outside Sprint A; current Phase 11 authorization is recorded below.

## Fast Track Sprint B status

Issue #6 covered one continuous Sprint B for Phases 5–10.

Final state:
- PR #7 passed ChatGPT Architect Audit and was merged to `main`.
- Phase 5 Words + Sentences completed.
- Phase 6 Writing completed.
- Phase 7 Zhuyin + Pinyin completed.
- Simplified Chinese Pinyin practice completed:
  - real Simplified-character → Pinyin input flow;
  - canonical tone-marked Pinyin;
  - tone-number normalization such as `xue2 → xué`;
  - `ü` normalization such as `lü3 / lv3 / lǚ → lǚ`;
  - explicit context/reading selection for polyphones such as `銀行 → háng` and `行走 → xíng`;
  - Traditional Zhuyin and Simplified Pinyin states remain separate;
  - School Queue private provenance can bridge into Pinyin practice without curriculum promotion.
- Phase 8 Grammar completed.
- Phase 9 Idioms completed.
- Phase 10 Reading completed.
- SQLite remains authoritative.
- Skill/mastery dimensions remain separated and auditable.
- Phase 11 TTS completed, passed ChatGPT Architect Audit, and PR #8 merged to `main`.
- Phase 11 includes a replaceable provider boundary, `zh-TW`/`zh-CN` routing, transient browser playback, speed control, source/provenance binding for School Queue TTS, and no mastery/state writes.
- `PHASE_11_TTS_REPORT.md` records the implementation and verification.
- Phase 12 Reading Aloud completed, passed ChatGPT Architect Audit, and PR #10 merged to `main`.
- Phase 12 includes a separate attempt metadata boundary, transient browser MediaRecorder adapter, durable auditable attempt history, source/provenance validation, and no raw audio persistence.
- `PHASE_12_READING_ALOUD_REPORT.md` records the implementation and verification.
- Phase 13 OCR Import completed, passed ChatGPT Architect Audit, and PR #12 merged to `main`.
- Phase 13 includes a replaceable local/mock OCR provider, candidate-review boundary, private School Queue confirmation, provenance tracking, and no raw image persistence.
- `PHASE_13_OCR_REPORT.md` records the implementation and verification.
- Phase 14 Adaptive Learning is implemented on `phase14/adaptive-learning` with deterministic/as-of
  scoring, explainable components, anti-starvation, child isolation, and non-mutating manual overrides.
- `PHASE_14_ADAPTIVE_REPORT.md` records the implementation and verification.
- Phase 15 Parent Dashboard was implemented and merged to `main`; its report/API/UI and regression
  tests are retained as the baseline.
- Phase 16 Long-Term Curriculum was implemented and merged to `main`; its hierarchy,
  provenance/license tracking, child-scoped as-of progression read model, frontend view, and
  regression tests are retained as the baseline.
- Phase 17 Optional AI Tutor was implemented and merged to `main`; its replaceable retrieval-first
  adapter, deterministic refusal boundary, child/provenance privacy rules, frontend panel, and
  regression tests are retained as the baseline.
- Phase 18 Commercialization Gate & Release Audit is implemented on
  `phase18/commercialization-gate`; its auditable registry, Family/Commercial gate behavior,
  replacement registry, manifest/provider inventory reconciliation, server-verified developer/admin
  readiness view, private School Queue enforcement, repository source-of-truth inventory manifest,
  package-lock reconciliation, stale-path detection, drift detection, and regression tests are
  complete and retained in merged `main`. No legal or paid-license decision is claimed.

- Phase 19 Production Hardening is implemented on `phase19/production-hardening` from merged
  `origin/main` `47361e4`; deterministic health/readiness, fail-closed production config,
  versioned additive schema migration, non-destructive backup/restore, privacy-safe errors,
  CORS/child/admin boundaries, mutation authorization, SQLite safety policy, structured redacted
  request logging, PWA checks, readiness-aware deployment wiring, runbook, and regression tests
  are complete and retained in merged `main`.
- Phase 20 Final Product is implemented on `phase20/final-product` from merged
  `origin/main` `04e3f88`; it adds the deterministic seeded end-to-end smoke harness, cross-domain
  child/private-provenance/source-locale checks, read-only snapshot verification, family packaging
  and PWA artifact checks, backup/restore smoke coverage, commercial blocker fidelity, release notes,
  and operator/manual NAS/iPad checklist. The canonical verification command is
  `python scripts/final_smoke.py` from the repository root (no pre-set `PYTHONPATH` required),
  with `python scripts/test_final_smoke_command.py` as its command regression. It is awaiting
  Architect PASS; do not merge or start Phase 21.
- The child-first frontend redesign is implemented on `ui/child-first-redesign` from the current
  `origin/main`. It adds a responsive app shell, two default child profiles plus a parent manager,
  stable backend-ID profile binding, real `POST /api/children` add-user persistence, a touch-first
  daily route, visible parent area, settings, accessible dialogs, reduced-motion support,
  loading/empty/error/success states, race-safe dashboard refresh and child switching, and a visual
  reward redemption flow. Existing learning semantics are preserved. Reward redemption now uses a
  server-verified `TONGXUAN_PARENT_PASSWORD` (required in production, minimum 12 characters),
  constant-time comparison, and production parent/developer/admin session authorization; the
  frontend is only the password-entry UX and never claims to provide security by itself. Local
  development/tests may use the documented `test-parent-password` default or an explicit env
  override; passwords are never logged or returned. The app shell listens for browser `popstate`.
  The Phase UI audit regression suite and production build are required before review. Do not merge
  automatically.
- The active PM frontend-rebuild objective continues on the same working tree. The current slice
  adds the official-course learning-map presentation, a Course 0 sound-lab route for Zhuyin/Pinyin/
  tones, an official 《學華語向前走》 path manifest (Starter → Basic → Book 1A Lesson 1「你好」),
  a source-bound first-lesson holding screen, an App-like course lesson flow, child-first profile menu
  compatibility, and local frontend API configuration for port 5174. Exact textbook content remains
  import-pending until provenance/licence records are complete. The durable design contract is `docs/frontend-rebuild-plan.md`;
  the replaceable asset request list is `資產/前端資產需求清單.md`. Mini-games remain deferred.
- The Phase UI audit also updated `scripts/final_smoke.py` to provide and restore the production
  parent-password environment during the canonical root smoke command, keeping fail-closed
  readiness checks compatible with the release-candidate harness.

Remaining validation:
- real iPad Safari;
- Docker runtime;
- Synology DS723+ deployment/persistence;
- real-child usability / parent workflow trial.

Issue #38 is the active continuous development authorization. Phase numbers below are historical and do not constrain the mainline issue sequence.
