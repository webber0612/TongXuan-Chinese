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

No browser automation.
No GitHub AI agent.
No OpenAI API requirement.
No manual copy/paste of diffs or review text.

## Product Owner PR Authorization

The Product Owner authorizes Codex to automatically create or update a **Draft Pull Request** after completing an explicitly assigned work order. This authorization does not include merging, marking a PR ready for review, changing branch protection, or starting the next Phase. Codex must stop at the requested Phase boundary and wait for a new work order or explicit review decision.

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
- Phase 5 has **not** started.
- Real-child usability validation is still outstanding before treating Sprint A as field-validated.

Relevant completed commits / milestones:
- `2a6395a` — add license tracking commercialization gate.
- `005f8dc` — define AI development and audit loop.
- PR #3 — Phase 0 technical validation, merged to `main`.
- PR #5 — Fast Track Sprint A, Phases 1–4, merged to `main`.

Important:
The original automated GitHub-AI / Chrome-MCP idea was abandoned.

Do not continue that automation design unless the Product Owner explicitly reopens it.

The active collaboration model is manual trigger + GitHub handoff:
- Product Owner tells Codex to read GitHub.
- Product Owner tells ChatGPT to inspect new GitHub changes.

Next product phase is Phase 5 only after explicit Product Owner instruction.

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
- Phase 5 has not started.

Remaining validation:
- real iPad Safari;
- Docker runtime;
- Synology DS723+ deployment/persistence;
- real-child usability / parent workflow trial.

Do not start Phase 5 without explicit Product Owner authorization.
