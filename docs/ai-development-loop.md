# AI Development Loop

## Purpose

The Codex runtime is the execution and handoff channel for the implementation agent and the
independent audit agent. Repository files remain the durable project record, while GitHub is used
for the requested branch, Draft PR, and merge gate.

## Roles

### Product Owner
Human owner.

Responsibilities:
- define product direction and approve requirement changes;
- provide secrets / repository settings that cannot safely be committed;
- make final decisions when agents disagree;
- approve commercial-release decisions.

The Product Owner is **not** responsible for relaying implementation or audit messages.

### Developer Agent
Primary implementation agent: Codex.

Responsibilities:
- read the active GitHub Issue and repository documentation;
- implement only the authorized scope;
- work on a feature branch;
- run tests and license/content audits;
- open or update a draft Pull Request;
- monitor PR feedback;
- fix actionable audit findings;
- never begin the next Phase until the current Phase reaches PASS.

### Architect / Project Manager Agent
Independent reviewer launched inside the Codex runtime for each work order.

Responsibilities:
- review the PR diff, tests, architecture and Phase acceptance criteria;
- check roadmap / licensing / privacy / learning-engine rules;
- publish structured findings back to the PR;
- never modify product requirements silently;
- never approve its own implementation work.

The Codex runtime launches an internal Implementer and Architect pair for the current work order.
The Architect receives the completed implementation in an isolated review context, performs a
fresh adversarial audit, and returns findings to the Implementer. This loop does not depend on
GitHub Actions, an external API, a repository secret, or a timer.

---

# Runtime Coordination Architecture

Use:

1. **Work Order / roadmap** — authorized Phase scope and boundaries.
2. **Internal Implementer** — edits only the current Phase, adds tests, and prepares the Draft PR.
3. **Internal Architect / Project Manager** — independently reviews implementation, schema,
   migrations, tests, frontend, provenance, and adversarial cases.
4. **Codex runtime handoff** — sends findings back for correction and starts a fresh re-audit.
5. **Feature branch + Draft PR** — durable delivery artifact and merge gate.

There is no GitHub Actions Codex workflow, external API dependency, or periodic timer in this
coordination loop. The internal pair must never auto-merge, mark a PR Ready, or cross a Phase
boundary without the applicable work order and merge gate.

---

# State Machine

```text
ISSUE_READY
    ↓
DEVELOPING
    ↓
DRAFT_PR
    ↓
AUDIT_RUNNING
    ↓
┌───────────────────────┐
│                       │
CHANGES_REQUESTED      AUDIT_PASS
│                       │
↓                       ↓
CODEX_FIXING          CI_PASS
│                       │
└──────→ AUDIT_RUNNING  ↓
                     READY_TO_MERGE
                         ↓
                       MERGED
                         ↓
                    NEXT_PHASE_READY
```

---

# Work Order Protocol

Every implementation Phase or bounded task must originate from a GitHub Issue.

Required Issue fields:

```text
PHASE
STATUS
AUTHORIZED_SCOPE
OUT_OF_SCOPE
ACCEPTANCE_CRITERIA
REQUIRED_TESTS
REQUIRED_DOC_UPDATES
COMMERCIALIZATION_CHECKS
PR
LAST_AUDITED_SHA
BLOCKERS
NEXT_ACTION
```

Recommended status values:

```text
ISSUE_READY
DEVELOPING
AUDIT_READY
CHANGES_REQUESTED
AUDIT_PASS
BLOCKED
MERGED
```

---

# Branch / PR Protocol

Branch naming:

```text
phase/<phase>-<slug>
fix/<slug>
```

Example:

```text
phase/0-technical-validation
```

PR title:

```text
[Phase 0] Technical validation
```

The PR should remain **draft** while the internal Implementer/Architect iterations are running.

PR body must contain:

```text
Issue:
Phase:
Head SHA:
Implemented:
Tests:
License registry changes:
Known limitations:
Manual hardware validation required:
Audit status:
```

---

# Internal Audit Trigger

After the Implementer completes a bounded Work Order, the Codex runtime starts a fresh isolated
Architect review against the exact current checkout. A new implementation commit starts a new
audit cycle. No GitHub event, external API, or timer is required.

---

# Audit Output Contract

Every internal audit response must use this structure:

```text
## AI AUDIT

Reviewed SHA: <sha>
Phase: <phase>
Result: PASS | CHANGES_REQUESTED | BLOCKED

### BLOCKER
- AUD-001 ...

### MAJOR
- AUD-002 ...

### MINOR
- AUD-003 ...

### Acceptance Criteria
- [x] ...
- [ ] ...

### Test / CI Status
...

### License / Provenance Status
...

### Required Next Action
...
```

IDs such as `AUD-001` must remain stable until resolved.

A new push must not silently erase an unresolved finding.

---

# Audit Dimensions

The automated reviewer must evaluate at least:

## Architecture
- Phase boundaries respected;
- provider / adapter boundaries respected;
- backend remains authoritative for learning state;
- no unnecessary infrastructure;
- schema changes are migration-safe.

## Functional correctness
- acceptance criteria;
- edge cases;
- failure paths;
- idempotency where applicable.

## Learning engine
- Recognition / Writing / Reading / Pronunciation remain separate;
- no answer leakage;
- guessed answers do not incorrectly become mastery;
- Curriculum and School Queue remain separate sources;
- School content cannot pollute global curriculum.

## Child privacy
- recordings, photos and handwriting traces treated as sensitive media;
- retention follows project rules;
- parent/child ownership boundaries preserved.

## Commercialization gate
- dependency/resource provenance recorded;
- Family-only resources are allowed only under Family rules;
- Commercial build does not accept non-commercial-ready resources.

## Testing
- tests added for changed behavior;
- existing tests pass;
- audit scripts pass;
- no acceptance claim based only on desktop when iPad/NAS manual verification is required.

---

# Developer Feedback Loop

After the audit posts CHANGES_REQUESTED:

1. Codex reads all unresolved `AUD-*` findings.
2. Codex verifies each finding rather than blindly changing code.
3. Valid findings are fixed on the same PR branch.
4. Tests are rerun.
5. Codex pushes a new commit.
6. The push triggers a new audit automatically.
7. Repeat until PASS.

Codex must not start the next Phase while the current PR has unresolved BLOCKER or MAJOR findings.

If Codex disagrees with an audit finding, it must document the disagreement in the PR rather than silently ignoring it.

---

# Merge Gate

A Phase PR is mergeable only when:

```text
AI Audit       PASS
Required CI    PASS
License Audit  PASS
Content Audit  PASS
Phase tests    PASS
```

Manual requirements such as real iPad Safari or Synology deployment tests may remain human-verified acceptance items and must not be fabricated by an agent.

Do not claim hardware validation unless it was actually performed.

---

# Runtime Safety Rules

- Keep Implementer and Architect contexts independent for every work order.
- Never let the Architect modify the implementation it is auditing.
- Never expose secrets or require an external API for the development loop.
- Preserve child isolation, provenance, privacy, and read-only audit boundaries.
- Never auto-merge, mark Ready for review, or start a later Phase.

---

# Recommended Repository Files

```text
docs/
  ai-development-loop.md
  roadmap.md
  license-and-commercialization.md
```

---

# Human Escalation Conditions

Stop the autonomous loop and require Product Owner decision when:

- requirements conflict;
- a change expands Phase scope materially;
- commercial licensing requires payment or legal acceptance;
- child privacy behavior changes;
- destructive migration / data loss risk exists;
- security policy must be weakened;
- audit and developer agents disagree repeatedly;
- real hardware/manual verification is required.

---

# One-command Developer Handoff

The desired runtime instruction to Codex is:

```text
Read docs/ai-development-loop.md and the active GitHub work-order Issue.
Implement only that Issue, open/update its draft PR, run all required tests,
then launch the internal Architect review and address audit feedback until the PR reaches
AI AUDIT PASS. Do not start the next Phase and do not merge unless explicitly
authorized by repository policy.
```

This repository, its Issue, PR, CI and review history are authoritative. Do not rely on external chat transcripts for task state.
