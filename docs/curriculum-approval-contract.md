# Manual Curriculum Owner Approval Contract

This contract preserves AI_PROPOSES_HUMAN_APPROVES without adding an authenticated approval service.

## Roles

- **PROPOSER — Codex / AI:** prepares a CURRICULUM_CHANGE_PROPOSAL. It cannot issue a final Owner decision, approve its own proposal, edit a proposal after review without creating a new snapshot, or promote graph targets.
- **ADVISORY_REVIEWER — Architect reasoning:** performs ADVERSARIAL_ARCHITECT_REVIEW against an exact proposal hash and reports PASS, CHANGES_REQUESTED, or NOT_RUN. This is advisory technical reasoning. It is not an independent human, legal, or curriculum authority, and its PASS does not authorize targets.
- **FINAL_HUMAN_CURRICULUM_APPROVER — Webber (webber0612):** gives the final human decision for the stated proposal scope. The designated role comes from the Owner's explicit instruction in this project; this record format does not authenticate the GitHub/chat identity.

## Decision record

An Owner decision is recorded separately from the proposal using [owner-decision-record.schema.json](../shared/open-curriculum/schemas/owner-decision-record.schema.json) and validate_curriculum_owner_decision_record().

Each record binds the exact proposal ID and canonical JSON SHA-256 of the full proposal snapshot; the Codex proposer role; the advisory review type, outcome, findings, and same proposal hash; and the Owner role, identity label, decision (APPROVE, REVISE, or REJECT), scope, timestamp, rationale, and a reference to the Owner-authored source decision.

The validator fails closed if the proposal ID/hash differs, the proposal is no longer PROPOSED, the advisory review names another snapshot, the Owner field is missing/wrong, or the record is malformed. A valid record is a structured audit record; it is not cryptographic identity proof.

## Effects and boundaries

- The proposal and its candidate nodes stay PROPOSED and immutable after the decision. APPROVE applies only to the exact FIVE_LESSON_FEASIBILITY_PLAN snapshot; it does not mutate an approved graph, generate lessons, clear source rights, authorize publication, or imply permission for another proposal.
- A proposal edit requires a new hash, a new advisory review, and a new explicit Owner decision.
- A reviewer PASS never becomes an Owner decision. Codex may record a decision only after an explicit Owner-authored message; missing or ambiguous evidence means no record and no approval.
- This issue adds no IAM, authentication, API, database, graph-promotion path, or lesson authoring. Any later executable promotion mechanism requires its own authority-boundary work order.

## Current state

The approver role is designated, but no five-lesson proposal has been approved. The current workflow state remains AWAITING_OWNER_CURRICULUM_APPROVAL once the proposal is ready.
