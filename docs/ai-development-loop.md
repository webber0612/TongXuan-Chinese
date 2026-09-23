# AI Development Loop

## Purpose

This repository uses GitHub as the single source of truth and handoff channel between the implementation agent and the audit agent.

The project owner should not need to copy messages between agents.

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
Independent automated reviewer executed from GitHub.

Responsibilities:
- review the PR diff, tests, architecture and Phase acceptance criteria;
- check roadmap / licensing / privacy / learning-engine rules;
- publish structured findings back to the PR;
- never modify product requirements silently;
- never approve its own implementation work.

The automated Architect / Project Manager Agent is intentionally stateless between runs. Persistent
project context must live in repository documents, GitHub Issues, PRs, labels, and audit comments.

The repository provides two independent Codex roles under `.github/codex/prompts/`:

- `implementer.md` edits code and drives a Phase PR to the audit gate.
- `architect-auditor.md` is read-only and performs a fresh adversarial audit on every PR SHA.

A human-triggered ChatGPT architecture audit may still be used for milestone reviews, but routine implementation handoff must not depend on copying chat messages.

---

# Chosen Automation Architecture

Use:

1. **GitHub Issues** — work orders / Phase scope.
2. **Feature branches + draft Pull Requests** — implementation unit.
3. **GitHub Actions / GitHub Agentic Workflows** — event-driven audit.
4. **OpenAI Codex GitHub Action with dedicated Implementer and Architect prompts** — independent agents.
5. **GitHub Actions labels and PR events** — automatically feed `CHANGES_REQUESTED` back to the Implementer.
6. **Codex PR monitoring ("babysit PR" style workflow where available)** — developer consumes review feedback, patches, pushes, and continues watching.
6. **GitHub branch protection / required checks** — merge gate.

GitHub is the message bus.

No agent-to-agent state may exist only in a local chat. The workflows require an `OPENAI_API_KEY`
repository secret and GitHub Actions write permissions for the Implementer job.

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

The PR should remain **draft** while automated developer/audit iterations are running.

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

# Automated Audit Trigger

Audit should run on:

```text
pull_request:
  opened
  synchronize
  reopened
  ready_for_review
```

Draft-PR support is preferred so AI review can happen before human review.

Use concurrency per PR and cancel stale in-progress audit runs when a newer SHA is pushed.

The audit job must review the exact PR head SHA / diff and must not review an older cached revision.

---

# Audit Output Contract

Every automated audit response must use this structure:

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

# Security Rules for AI GitHub Actions

- Never expose repository/API secrets to untrusted PR code.
- Keep code-review analysis and PR-comment posting in separate jobs where practical.
- Give the analysis job read-only repository permissions.
- Give the posting job only the minimum issue / pull-request write permission.
- Pin or deliberately version third-party Actions.
- Do not use `pull_request_target` with untrusted checked-out PR code unless the workflow has been explicitly designed for that threat model.
- Store OpenAI/Codex credentials only in GitHub Actions Secrets.
- Never commit API keys.

---

# Recommended Repository Files

```text
.github/
  codex/
    prompts/
      audit.md
  workflows/
    ai-audit.md        # or agentic-workflow source + compiled lock workflow

docs/
  ai-development-loop.md
  roadmap.md
  license-and-commercialization.md
```

If GitHub Agentic Workflows is used, initialize it with the official `gh aw` tooling and commit both its Markdown source and generated locked workflow.

---

# Automation Rollout

## Stage A — Audit automation
PR event → read-only Architect Agent → structured PR feedback and `audit-pass` or
`audit-changes-requested` label.

Do not automate merging.

## Stage B — Developer feedback loop
The repository workflow configures Codex to:
- implement an Issue;
- open/update draft PR;
- monitor audit feedback;
- fix findings;
- continue until Architect Audit PASS.

The loop starts from a Product-Owner-created Phase Issue labeled `phase-ready`, or from an explicit
workflow dispatch. A `CHANGES_REQUESTED` audit on a Draft PR triggers the Implementer again. PASS
stops the loop at the merge gate.

## Stage C — Merge gate
Enable branch/ruleset requirements for CI + AI audit.

Human retains final merge control initially.

## Stage D — Optional auto-merge
Only after the loop has proven stable across multiple Phases should auto-merge be considered.

Never auto-advance to a new roadmap Phase solely because an AI reviewer returned PASS unless the roadmap explicitly allows it.

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

Once automation is installed, the desired human instruction to Codex is:

```text
Read docs/ai-development-loop.md and the active GitHub work-order Issue.
Implement only that Issue, open/update its draft PR, run all required tests,
then monitor the PR and address automated audit feedback until the PR reaches
AI AUDIT PASS. Do not start the next Phase and do not merge unless explicitly
authorized by repository policy.
```

This repository, its Issue, PR, CI and review history are authoritative. Do not rely on external chat transcripts for task state.
