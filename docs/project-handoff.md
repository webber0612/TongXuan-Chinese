# ChatGPT ↔ Codex Project Handoff


> ## ACTIVE HANDOFF SNAPSHOT — 2026-09-28
>
> **Read this section first. It is the authoritative handoff and supersedes the old Phase-based and manual-relay instructions below for Issue #38.**
>
> Repository: `webber0612/TongXuan-Chinese`
>
> ### Current autonomous mainline state
>
> - Current work order: PR #107 / Issue #106 is complete and squash-merged at `aded29c8ee9a7d834e4c667fe67f2a9b797998e2`; exact head `11b790cf91a02deec24b6010e425d9294e54c81b` received advisory `ADVERSARIAL_ARCHITECT_REVIEW` PASS and Actions run `36365331029` PASS. The 113-path inventory is 109 `RIGHTS_UNCLEAR` plus 4 `REFERENCE_ONLY`; none were cleared. `RIGHTS_TOOLING_FEATURE_FREEZE` is active: only a reproducible supported-format bypass, newly declared format, pre-release defect, or real third-party escape reopens tooling.
>
> - Current audited main baseline: `aded29c8ee9a7d834e4c667fe67f2a9b797998e2`. Phases 0–4 proposal-only record contracts and dynamic fail-closed rights-path discovery are merged. Existing lesson packages remain engineering regression fixtures, not approved or rights-cleared curriculum.
> - PR #107 exact-head verification: backend full pytest 318 passed (93 existing SQLite datetime-adapter warnings); rights-gate suite 34 passed; frontend Vitest 178/178 across 15 files; production build and canonical import guard PASS (38 modules); rights gate, compileall, and diff check PASS; migration N/A. Exact head `11b790cf91a02deec24b6010e425d9294e54c81b`, Actions `36365331029` PASS, advisory review PASS. Full details are in PR #107 metadata.
> - Issue #87: [Open Curriculum Mainline](https://github.com/webber0612/TongXuan-Chinese/issues/87) owns the autonomous roadmap. Issue #88 / PR #89 completed Phase 1 on exact reviewed head `8c08249f91d14e162342a3a862a8492f6b1b9c25`; Architect PASS; squash merge `7d35d39ea4cfee9067afc1363a38dcff0628d353`. The exact-path inventory reports 31 `RIGHTS_UNCLEAR` and 3 `REFERENCE_ONLY` paths, all blocked from publishable artifacts. This is not a legal determination or proof of copying/non-copying. Captured response hashes are metadata fingerprints, not legal proof; source captures are not retained. See [content-rights-audit.md](content-rights-audit.md) and [the current mainline checkpoint](mainline-completeness-audit.md).
> - PR #89 exact-head verification: backend full pytest **240 passed** (93 existing SQLite datetime-adapter warnings); rights/authority regressions **50 passed**; frontend full Vitest **178/178 / 15 files**; production build, canonical import guard (**38 modules**), public-repo rights gate, compileall, and `git diff --check` **PASS**. GitHub Actions exact-head run `36341068191` **PASS**. No migration, curriculum lesson, UI, or learning-policy changes. Independent Architect exact-head review **PASS**.
> - Issue #94 / PR #95 completed Phase 2 graph identity and dependency integrity. Exact PR head `bcd477e77ed94f34c453cedeb224a8e2d4feccbd` received independent Architect PASS after fixes; squash merge `653d402923be81a7b47772eb8e16b419593b5873`. Backend pytest **257 passed** (93 existing SQLite datetime-adapter warnings); Open Curriculum validator **46 passed**; frontend Vitest **178 passed / 15 files**; build/canonical import guard **PASS (38 modules)**; rights gate, compileall, and diff check **PASS**; Actions rights-gate run `36344688362 PASS`. No migration, content, target, rights, UI, or learning-policy changes.
> - Issue #96 / PR #97 is complete: schema v1.3 adds vocabulary/grammar receptive/productive requirements, explicit grammar policy state, and claim-bound node-local evidence validation. Architect PASS on exact head `9771bd7ed67c530d9cf1eb218fdbc069e4e64426`; squash merge `bd62bb2f23ea75061db39a3b7751b45b2f1bbb0d`. Exact-head verification: backend **266 passed** (93 existing SQLite datetime-adapter deprecation warnings), Open Curriculum suite **55 passed**, frontend **178 passed / 15 files**, production build/canonical import guard **PASS (38 modules)**, rights gate, compileall, and diff check **PASS**; Actions run `36347199921 PASS`; no migration. No real targets/content or rights status changed.
> - Issue #98 / PR #99 / Phase 3 completed: PR #99 merged at `2ae8f669223c5c8597795a37d8a114efe10be1f6` after Architect PASS on exact head `6743e2d7d214faa473e9e84c954a2cd2addb1e6e`. Exact-head verification: backend pytest **279 passed** (93 existing SQLite datetime-adapter deprecation warnings), validator + rights-gate regressions **89 passed**, frontend Vitest **178 passed / 15 files**, production build/canonical import guard **PASS (38 modules)**, rights gate, compileall, and diff check **PASS**; Actions run `36350084674 PASS`; migration **N/A**. It added no lesson, target, source/rights change, UI, learner-data change, or migration. Vocabulary load threshold, lexical segmentation, public retention, and authenticated proposal approval remain gated.
> - Issue #100 / Phase 4 proposal-only record contract is complete in PR #101, squash-merged at `5b9149052871734861f498f019c759e285ee8c1e` after independent Architect PASS on exact head `bc93bd22d6377ce98dee7b75ace6095daaba3ada`. Exact-head Actions Rights Gate run `36355485771` passed. Verification: backend full pytest **305 passed** (93 existing SQLite datetime-adapter warnings), Open Curriculum + rights regressions **116 passed**, frontend Vitest **178/178 across 15 files**, production build/canonical import guard **PASS (38 modules)**, rights gate, compileall, and `git diff --check` **PASS**. Proposal candidates remain outside the approved graph and `PROPOSED`; no targets, graph promotion, source/rights, content, UI, learner data, database schema, or migration changed. An earlier test concurrent with frontend/build had a `test_deterministic_final_product_smoke` readiness 500; isolated smoke and subsequent standalone full backend runs passed, so no repeatable root cause was found.
> - Issue #102 is active for the Manual Owner Approval Contract: Webber (`webber0612`) is `FINAL_HUMAN_CURRICULUM_APPROVER`; Codex/AI is `PROPOSER`; Architect reasoning is advisory. This work adds only an exact-hash manual decision record, with no IAM/API/DB or graph promotion. After merge, prepare a two-variant five-lesson proposal only and stop at `AWAITING_OWNER_CURRICULUM_APPROVAL`. Public source retention remains separate. Deployed OAuth and real-child/device validation remain NOT VERIFIED.
> - Audit handoff closeout: Issue #90 / PR #91 is complete. PR #91 passed independent exact-head review on `fe1bf6529d891c8c8a9e23fe87fd1208c4bc35fd`, squash-merged at `f8d505f4c151a6ecfbcfeaa6ce4d569ee8fe597f`; documentation-only, `git diff --check` PASS, no code/schema tests or migration required.
> - UI Issues #30 and #37 remain in the manual visual collaboration lane. No UI redesign or layout changes are part of Issue #86.
> - Owner decision for Issue #66, reconfirmed 2026-09-27: one parent signs in with Google, creates/manages multiple child profiles, and children do not log in individually. PR #67 merged identity, child ownership, creation, and selection at `1bd5d813ddcf510f80423009e866544a13001606`.
> - Issue #51 is complete in [PR #68](https://github.com/webber0612/TongXuan-Chinese/pull/68), squash-merged at `7160456faa90a685a593f8a69b9a69c163996dbc`. Parent Dashboard requests both the existing activity view and the authoritative learning-flow report for the same child and time window. The report uses the signed-session cookie, shows sessions/mastery states/review due/tasks needing practice, and keeps prior activity visible if the report fails. No layout or learning policy changed; no schema migration was needed.
> - Issue #51 verification: backend full pytest **179 passed** (81 existing SQLite adapter deprecation warnings); frontend full Vitest **165 passed / 15 files**; production build and canonical import-graph check **PASS** (existing Vite large-chunk advisory); `git diff --check` **PASS**. The real backend report test verifies an owned active session, privacy summary, cross-parent 403, and unauthenticated 401. Architect exact-head textual review **PASS** on `76f20b588f9392aa70ecf0f5c716889975760420`. The signed-in report UI/live Google OAuth and GitHub Actions remain **NOT VERIFIED**.
> - PR #44 / Issue #43 passed independent Architect review on exact head `c84c952e709023c4840ed27ca6b362f5fb0f8065` and squash-merged to `main` at `8e0c690c960762d33b5bbd96308e4a0b012c4a35`. PR #46 / Issue #45 merged cross-lesson REVIEW reconciliation at `b14f24507572fbe38c9a8f0203ec2a0b4a05270b`; PR #48 / Issue #47 merged selected-child identity at `a1bcfd9b2e42fa7e8a03736e3e64746a6880f7d7`; PR #50 / Issue #49 merged failure-atomic settlement at `b0c5cfb6db40bcfa4b7741f06b8462b01d6e2fe3`; PR #54 / Issue #53 merged scored LEARN evidence/SRS atomicity at `e55b9def972f8c6ffbd97b3b5ed234686d0aea46`; PR #56 / Issue #55 merged flow-owned listening evidence atomicity at then-current main `286d344e9918ee644c29150fdedb54f81142757e`.
> - Issue #49 is complete: [PR #50](https://github.com/webber0612/TongXuan-Chinese/pull/50) passed independent Architect review on exact head `9109cbb586afedca839d659b5e4c474ca5fb1ae3` and squash-merged at `b0c5cfb6db40bcfa4b7741f06b8462b01d6e2fe3`. Progress, assessment, reward, wrap-up, session status, and settlement telemetry now commit together. Backend pytest **155 passed** (7 SQLite adapter warnings); frontend Vitest **148 passed / 13 files**; production build **PASS** (existing large-chunk advisory); base-to-head `git diff --check` **PASS**. No schema change. Exact head has no GitHub Actions workflow runs or combined status checks; CI is **NOT VERIFIED**.
> - Issue #53 is complete: [PR #54](https://github.com/webber0612/TongXuan-Chinese/pull/54) passed Architect review on exact head `adbb951e2a20eccd3b438d370f78461e06d779ce` and merged at `e55b9def972f8c6ffbd97b3b5ed234686d0aea46`. Recognition, vocabulary, and phonetics scorer activity/state, linked evidence, applicable SRS, learning-flow task attempts/state, and telemetry now share one transaction. Backend pytest **158 passed**; frontend Vitest **148 passed / 13 files**; production build and base-to-head `git diff --check` **PASS**. No schema/migration files changed. The Architect checked GitHub for that exact head and found no workflow runs or combined status checks; CI is **NOT VERIFIED**. This corrects the earlier stale phrase “until checked on GitHub.”
> - Issue #55 is complete: [PR #56](https://github.com/webber0612/TongXuan-Chinese/pull/56) passed Architect review on exact head `9ac9cb9b5f02f3a21c81f5ea58bbb19e8db8d6c4` and squash-merged at `286d344e9918ee644c29150fdedb54f81142757e`. A flow-owned listening attempt, linked gate, learning-flow task attempt/state, and telemetry now commit together through final `/evidence`; standalone finalization fails closed while LEARN owns the task, and PAUSED task start requires authoritative resume. Real SQLite integration covers success, telemetry-failure rollback, same-ID retry/replay, legacy completed-attempt recovery, and active/paused guards. Backend pytest **160 passed** (7 existing SQLite adapter warnings); frontend Vitest **148 passed / 13 files**; production build and canonical import-graph check **PASS**; base-to-head `git diff --check` **PASS**. No schema/migration files changed. Exact-head Actions/status had no runs/checks; CI is **NOT VERIFIED**. No visual redesign or content scope changed.
> - Issue #57, `[P1 Mainline] Make LEARN writing evidence and SRS atomic`, is complete: [PR #58](https://github.com/webber0612/TongXuan-Chinese/pull/58) passed independent Architect review on exact head `183e9c72b21be587336c5e16c5e4f0501e80b534` and squash-merged to main at `ab62a4a5e7e62eedcd84d47f7b565e07cb4a60b7`. Final `/evidence` atomically commits flow-owned writing provider attempt, exact lesson provenance link, applicable gate, writing state/SRS, flow attempt/task state, and telemetry with stable retry/replay identity. Backend pytest **162 passed** (7 existing SQLite datetime adapter deprecation warnings); frontend Vitest **149 passed / 13 files**; production build and canonical import-graph check **PASS**; `py_compile` and base-to-head `git diff --check` **PASS**. No schema/migration changes. Architect reran exact-head writing backend and LessonPlayer regressions; no GitHub Actions runs/status exist for exact head (**CI NOT VERIFIED**). No UI redesign, content, or Books 2–10 scope changed.
> - Issue #59 is complete: [PR #60](https://github.com/webber0612/TongXuan-Chinese/pull/60) received final Architect PASS on exact head `2d85655f0e8a499039bd96ef4d3fd607bab4d847` and squash-merged to main at `0539bc1867b2a3b5e77fb129a7193cfa010c5954`. Canonical REVIEW added exact recognition, flow-owned writing, and vocabulary/word SRS with retry due-date synchronization; Fast Track records SRS only from exact supported scored materials. REVIEW word evidence does not alter curriculum mastery. Backend pytest **166 passed** (40 SQLite datetime-adapter deprecation warnings); frontend Vitest **152 passed / 13 files**; production build/canonical import-graph check and base-to-head `git diff --check` **PASS**. No schema/migration changes. GitHub Actions/status were **NOT VERIFIED**. PR #62 subsequently closed the exact listening SRS retrieval gap.
> - Issue #61 is complete: [PR #62](https://github.com/webber0612/TongXuan-Chinese/pull/62) passed independent Architect review on exact head `494ec225beabedf5144c71002442bee0f23e73ca` and squash-merged to main at `598f22db7a2795fa618eef03ce03b5964567fb83`. Canonical Daily Queue/plan/reconciliation now retrieves the exact Book 1 Fast Track listening row; REVIEW accepts literal package choice IDs, atomically advances only its exact phrase SRS with task state/attempt/telemetry, and leaves mastery evidence/gates and the parent LEARN session untouched. Regressions cover correct/incorrect/assisted, alias rejection before mutation, rollback/retry/replay, unsupported/ambiguous/cross-child isolation, and mixed-session wrap-up. Backend pytest **173 passed** (81 SQLite datetime-adapter deprecation warnings); frontend Vitest **154 passed / 13 files**; production build/canonical import-graph check **PASS** (existing Vite large-chunk advisory); base-to-head `git diff --check` **PASS**. No schema/migration files changed. GitHub Actions/status for the exact PR head were empty (**CI NOT VERIFIED**). No new content, provider, interval, mastery policy, visual redesign, or Books 2–10 expansion.
> - Issue #66 is complete: verified Google identity, persistent parent-to-child ownership, exact child creation/selection in existing Parent/Settings surfaces, production route enforcement, and preservation of unowned legacy rows. Issue #51 integrates the authoritative parent learning report through this signed session. No Home redesign or child-visible sibling selector is authorized.
> - Issue #69 is complete in [PR #71](https://github.com/webber0612/TongXuan-Chinese/pull/71), squash-merged at `379dba97bf456dd60c88e120541c98092da93dbc`. Parent Settings reads the authoritative placement profile for the exact selected child. Owner selected retaining the STARTER default for new/unconfigured profiles, labeled “Starter default — not assessed”; no assessment or placement policy change was added.
> - PR #71 exact-head verification: Architect PASS on `06de5b88ac5c3347378d3dd2d5c1e89e0916eacd`; backend full pytest **179 passed** (81 existing SQLite datetime adapter deprecation warnings); frontend full Vitest **168 passed / 15 files**; production build and canonical import-graph check **PASS** (38 production modules; existing Vite large-chunk warning); targeted parent ownership regression **1 passed**; base-to-head `git diff --check` **PASS**. Desktop `/me` plus 390×844 narrow viewport checked; no horizontal overflow. Live Google OAuth and GitHub Actions are **NOT VERIFIED**. No schema/migration changes.
> - Issue #72 / PR #74 is complete. PR #74 squash-merged at `1dbf229c39eff07b8cbda4f2001359600aae19c8` after Architect PASS on exact head `6212608636cd55265f10056408dd396dabdc4d6d` (review `5329855722`). Starter L2 is now queue-locked until its existing prerequisite and uses package-backed exact tasks through evidence, settlement, and due vocabulary REVIEW/SRS. Backend pytest **182 passed** (85 SQLite datetime adapter deprecation warnings); frontend Vitest **173 passed / 15 files**; production build and canonical import-graph guard **PASS**; base-to-head `git diff --check` **PASS**. No schema/migration change. Actions had no workflow run (**CI NOT VERIFIED**). Local canonical `/learning-session` seeded-child spot-check covered desktop and 390×844; no horizontal overflow and keyboard focus visible. OAuth, reduced-motion emulation, and real-child/device validation remain **NOT VERIFIED**.
> - Issue #75 / PR #75 is complete: original-authored Starter L3 (`starter-l03`, “爸爸媽媽”) passed exact-head Architect review on `8d71722a7515730a291e2e50de9bc0e34767b82e` (review `5330021066`) and squash-merged at `0076377e2d22d297c771b2ed0f7abbdbdbefa4e3`. It preserves the existing L2 prerequisite and authoritative evidence/mastery/SRS/settlement contracts. Backend pytest **185 passed** (89 existing SQLite datetime-adapter warnings); frontend Vitest **175 passed / 15 files**; production build/import guard **PASS** (38 modules); base-to-head `git diff --check` **PASS**. No schema/migration. GitHub Actions/status are empty (**CI NOT VERIFIED**); browser child-flow/OAuth, responsive/focus/reduced-motion, and real-child/device validation are **NOT VERIFIED**. No UI redesign or curriculum rights change; reviewer noted that a future visible simplified-glyph task should represent `妈` explicitly.
> - Issue #77 / PR #79 is complete: original-authored Starter L4 (`starter-l04`, “小狗”) passed exact-head Architect review on `9040215cdc55c81884bbf3004c6e2f2709b9e31e` (review `5330230857`) and squash-merged at `18d39a8199afd87c9f22075f2bbd6e583e653c89`. It retains the L3 prerequisite and recognition-only SRS; no vocabulary task/word row. The malformed-choice finding was fixed with backend/frontend validation and API regressions proving no invalid session/task persists. Backend pytest **188 passed** (89 existing SQLite datetime-adapter warnings); frontend Vitest **176 passed / 15 files**; production build/import guard **PASS** (38 modules); `py_compile` and base-to-head `git diff --check` **PASS**. No schema/migration. Actions/status, child-flow browser/OAuth/accessibility/reduced-motion, and real-child/device validation are **NOT VERIFIED**.
> - Issue #80 is closed and PR #83 is complete: original-authored Starter L5 (starter-l05, “我的妹妹”) passed Architect exact-head review on 87af3c860c43c9b0c7962245b00d8515e02f4700 (review 5330587967) and squash-merged to main at a7cde7ee71006088d9618f5c72a37239807edcea. Backend pytest **190 passed** (93 existing SQLite datetime adapter warnings); frontend Vitest **178 passed / 15 files**; production build/canonical import guard (38 production modules), compileall, and diff check **PASS**. No schema migration. Actions and authenticated browser lesson flow are **NOT VERIFIED**; objective-array tampering is code-inspected but lacks a dedicated mutation regression.
> - Historical post-L5 checkpoint: Starter L6+ is paused. The former recommendation for Issue #84 is superseded by Issue #86 and remains paused until source rights, item provenance, and target approval are reviewed. Adaptive-to-queue policy, the unlinked Sprint B review lane, deployed OAuth verification, and real-child/device validation remain separately gated.
> - Placement editing and assessment policy remain separate owner/product gates. Do not expose backend siblings in child-visible local controls or treat local PIN as backend authorization.
> - Issue #66 / PR #67 passed Architect review on exact head `e8ff2f9d8984b6b936b9ee7007e64bbd4b768bd1` and squash-merged at `1bd5d813ddcf510f80423009e866544a13001606`. Review found the child-route CORS preflight and linked learning-row migration fixture fixes correct. Backend pytest **178 passed** (81 existing SQLite datetime-adapter deprecation warnings); frontend Vitest **163 passed / 15 files**; production build and canonical import-graph check **PASS** (existing Vite large-chunk advisory); migration preservation regressions and base-to-head `git diff --check` **PASS**. Browser review at 390×844 found no horizontal overflow and visible keyboard focus through the existing Parent/Settings controls; no layout redesign or media changes were made. Live Google sign-in/deployed OAuth and GitHub Actions/status checks are **NOT VERIFIED**.
> - PR #46 local verification at creation: backend pytest **153 passed** (7 sqlite datetime adapter deprecation warnings); frontend Vitest **145 passed** across 13 files; production build passed (existing large-chunk advisory); base-to-head `git diff --check` passed. No schema change, so migration checks were not applicable. This behavior-only change makes no visual redesign; canonical AppShell route behavior is verified by tests. GitHub Actions is **NOT VERIFIED**.
> - Independent PR #44 validation: backend pytest **152 passed** (4 sqlite datetime adapter deprecation warnings); frontend Vitest **142 passed** across 13 files; production build passed (Vite reported the existing large-chunk advisory); base-to-head `git diff --check` passed. No schema/persistence migration changed, so migration checks were not applicable. PR #44 had no GitHub Actions workflow runs; CI is **NOT VERIFIED**.
> - Issue #38 remains the governing continuous program; Issue #87 is its Open Curriculum source of truth. PR #107 / Issue #106 is complete. Issue #102 is active for the manual Owner decision-record contract; public source retention remains separate. Rights tooling is feature-frozen, Issue #84 remains paused, and Issues #30/#37 remain in the manual UI lane. No flagged raw material, rights-dependent target, graph promotion, or new lesson may be introduced.
> - Issue #86 Phase 0 verification (2026-09-28): backend full pytest **219 passed** (93 existing SQLite datetime adapter warnings); frontend full Vitest **178 passed / 15 files**; production build and canonical import-graph guard **PASS** (38 production modules; existing Vite chunk advisory); synthetic validator tests **29 passed**; source registry and commercialization inventory reconciliation **PASS**; `git diff --check` **PASS**. No lesson package, UI, or migration changed. GitHub Actions/status checks have no run recorded for the reviewed head (**CI NOT VERIFIED**).
>
> ### Program workflow and authority
>
> Project Manager selects the next ranked issue and writes acceptance criteria → Implementer makes a branch and Draft PR → ADVERSARIAL_ARCHITECT_REVIEW checks the exact head as advisory reasoning → findings return through GitHub → after PASS and required tests/build/migration checks, PM marks ready and merges → update the audit and continue. Review PASS is never human, legal, or curriculum approval.
>
> No Product Owner message relay is required between Implementer and Architect. Issue #38 authorizes PM merge only after exact-head PASS, required tests/build and any migration checks pass, no unresolved P0/P1 remains, and scope is within the autonomous lane.
>
> Stop and mark `OWNER_DECISION_REQUIRED` for approved UI design choices, major teaching policy, legal/licensing/commercial rights, authentication/authorization/security choices, irreversible data risk, paid external services, real-child/device validation, core product scope changes, or parent-authorized identity/session provisioning. Local PIN and child-visible prototype controls are not backend authorization.
>
> ### Scope and verification limits
>
> - Issues #37 and #30 remain in the UI/manual lane. Preserve the approved deployed UI direction; do not redesign it.
> - Do not expand Books 2–10. Current runtime work stays within the existing validated lesson packages and backend contracts.
> - No local or deployed learner database is configured in this worktree; deployed DB state is **NOT VERIFIED**.
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
> Project Manager, Implementer, and advisory reviewer work as one autonomous loop. ADVERSARIAL_ARCHITECT_REVIEW is not independent human/legal/curriculum approval. GitHub Issues, PR comments, and repository docs are the durable handoff. The Product Owner is not asked to relay routine implementation or review messages.


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
- perform an exact-head advisory adversarial review, record PASS or CHANGES_REQUESTED on the PR, and verify required local tests/build/migrations;
- after PASS and all Issue #38 merge conditions are satisfied, mark ready and merge, then update the baseline and continue.

## Implementer

- create a branch from current `main` for the assigned issue;
- implement only the accepted work order, add regression coverage, and run the required checks;
- open/update a Draft PR and respond to Architect findings on GitHub until exact-head PASS.

The Project Manager and Implementer may be separate Codex agents. GitHub Issues, PR comments, and repository docs are the durable handoff; no Product Owner copy/paste step is part of the loop.

---

## Internal Agent Loop

The Implementer receives ADVERSARIAL_ARCHITECT_REVIEW findings for each exact PR head. This review is advisory and does not act as independent human, legal, or curriculum approval. CHANGES_REQUESTED findings return directly to the Implementer; GitHub is the durable issue/branch/PR record.

# Autonomous Mainline Working Loop

```text
Project Manager audits and selects issue
→ Implementer branch / code / regression tests / Draft PR
→ ADVERSARIAL_ARCHITECT_REVIEW checks the exact head as advisory reasoning
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
