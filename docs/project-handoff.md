# ChatGPT ↔ Codex Project Handoff

## Purpose

This document is the persistent handoff for the TongXuan Chinese project.

Use it when:
- continuing the project in a new ChatGPT conversation;
- recovering context after a long session;
- handing work between ChatGPT and Codex;
- checking current collaboration rules.

GitHub is the source of truth for project state.

---

# Roles

## Product Owner

Human owner.

Responsibilities:
- decide product direction;
- approve requirement changes;
- decide when to advance to the next Phase;
- manually tell Codex to read the latest PR / GitHub changes;
- manually tell ChatGPT to review the latest GitHub changes.

The Product Owner is **not** expected to copy code, diffs, or long audit messages between agents.

## Codex

Primary implementer.

Responsibilities:
- implement authorized scope;
- update files, tests, docs, git;
- push changes;
- read ChatGPT review from GitHub;
- fix findings;
- stop at the requested Phase boundary.

## ChatGPT

Architect / Auditor.

Responsibilities:
- inspect GitHub directly;
- review new commits / branches / PRs;
- verify architecture, scope, tests, learning logic, licensing and privacy;
- publish concise findings back to GitHub;
- prepare the next implementation work order / PR instructions when needed.

ChatGPT should avoid long status narration unless the Product Owner asks for it.

---

## Internal Agent Loop

The Codex runtime launches an independent internal Implementer and Architect / Project Manager
pair for each Work Order. The Architect reads the exact implementation, schema, migrations, tests,
frontend, report, and handoff; it performs an adversarial audit and sends findings back to the
Implementer for correction and fresh re-audit.

This loop has no GitHub Actions Codex workflow, no external API or repository secret dependency,
and no timer-based progress check. GitHub remains the durable branch/Draft PR and merge-gate record.
The pair never auto-merges, marks a PR Ready for review, or starts a later Phase without its
explicit Work Order and boundary.

# Normal Working Loop

Use this simple loop:

```text
ChatGPT
↓
publish PR / work order / review on GitHub
↓
Product Owner tells Codex:
"看最新 PR / GitHub"
↓
Codex implements and pushes
↓
Product Owner tells ChatGPT:
"看新 Git"
↓
ChatGPT audits GitHub directly
↓
repeat
```

No browser automation, GitHub Actions, external API, or timer is required for the agent loop.
The Codex runtime is the agent-to-agent handoff channel; repository documents preserve durable
state.

## Product Owner PR Authorization

The Product Owner authorizes Codex to automatically create or update a **Draft Pull Request** after completing an explicitly assigned work order. This authorization does not include merging, marking a PR ready for review, or changing branch protection.

## Continuous Development Authorization

To accelerate development, the Product Owner has authorized continuous phase progression.

Rules:
- After a Phase passes ChatGPT Architect Audit and is merged to `main`, ChatGPT should immediately prepare/publish the next Phase work order without asking the Product Owner for separate authorization.
- Codex may start the next Phase when an explicit ChatGPT work order for that Phase exists on GitHub; no additional Product Owner confirmation is required.
- Codex must still stop at the end of each assigned Phase, open/update one Draft PR, and wait for ChatGPT Architect Audit.
- Codex must not merge its own PR, mark it Ready for review, bypass audit, or skip ahead beyond the currently published work order.
- A failed audit blocks phase progression until findings are resolved.
- Manual iPad/NAS/real-child validation remains distinct from code-level audit and must not be falsely claimed as completed.

The Implementer/Auditor automation may continue fixing the current Phase until Architect PASS;
the merge gate and Phase boundary remain explicit human/work-order boundaries.

This continuous authorization supersedes older handoff wording that required a separate Product Owner authorization before each next Phase.

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

# Current Project State

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

The active collaboration model is manual trigger + GitHub handoff:
- Product Owner tells Codex to read GitHub.
- Product Owner tells ChatGPT to inspect new GitHub changes.

Phases 11–19 are complete and merged. Phase 20 Final Product is the currently assigned
Phase on `phase20/final-product` from `origin/main` `04e3f88`; do not start Phase 21.

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
- The Phase UI audit also updated `scripts/final_smoke.py` to provide and restore the production
  parent-password environment during the canonical root smoke command, keeping fail-closed
  readiness checks compatible with the release-candidate harness.

Remaining validation:
- real iPad Safari;
- Docker runtime;
- Synology DS723+ deployment/persistence;
- real-child usability / parent workflow trial.

Continuous development authorization is active. Phase 20 is the current assigned Phase; do not
start Phase 21.
