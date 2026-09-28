# Open Curriculum authority gate

This directory defines data contracts and validation behavior. It contains no approved learner targets or executable lesson packages. The active Issue #109 proposal uses the schema's A–E identifiers as five cumulative lesson positions, not capability/activity slots; see [`docs/open-curriculum-5-lesson-experiment-proposal.md`](../../docs/open-curriculum-5-lesson-experiment-proposal.md). Its targets remain `PROPOSED` and do not mutate the approved graph.

## Schema inventory

| Contract | Schema |
| --- | --- |
| Pack, graph, lesson, and proposal bundle | `schemas/open-curriculum.schema.json` |
| Skill node | `schemas/skill-node.schema.json` |
| Vocabulary node | `schemas/vocabulary-node.schema.json` |
| Grammar node and sourced examples | `schemas/grammar-node.schema.json` |
| Character node and script readings | `schemas/character-node.schema.json` |
| Evidence record | `schemas/evidence.schema.json` |
| Item-level source provenance | `schemas/source-provenance.schema.json` |
| Existing pack approval-state vocabulary | `schemas/approval-status.schema.json` |
| Manual Owner decision record | `schemas/owner-decision-record.schema.json` and `../../docs/curriculum-approval-contract.md` |
| Curriculum change proposal | `schemas/curriculum-change-proposal.schema.json` |
| Content source registry | `schemas/source-registry.schema.json` |

All schema wrappers resolve into the bundled Draft 2020-12 schema; consumers should use the repository validator or register the bundle locally rather than fetch `tongxuan.dev` over the network.

`availableTargetIds` lists vocabulary, grammar, and character targets allowed in that lesson; selected targets must be included. `availableSkillIds` lists skills allowed for use. `priorKnowledgeTargetIds` and `priorKnowledgeSkillIds` are the explicit learner-known sets before the lesson; the validator also treats targets and skills from earlier lessons in the same candidate pack as previously taught. `priorRecognizedCharacterIds` separately records characters already recognized before the lesson. Generic prior knowledge and exposure never satisfy the recognition prerequisite for writing; recognition activities from earlier pack lessons do. Prerequisites are checked against these declared/validated states, not inferred from a lesson title or sequence position.

Pack schema version 1.4 records receptive and productive requirements separately on vocabulary and grammar nodes. Each requirement carries evidence references; those references must resolve to evidence attached to the same node and declare the matching claim. Publishable claims additionally require evidence status `EVIDENCE_CHECKED` or `ARCHITECT_APPROVED`. Vocabulary frequency evidence must declare `VOCABULARY_FREQUENCY`. Grammar nodes record `RECEPTIVE_BEFORE_PRODUCTIVE`, `NO_ORDER_CONSTRAINT`, `NOT_APPLICABLE`, or `UNRESOLVED` explicitly. An unresolved grammar policy cannot be approved or published; the validator does not choose a policy or rewrite lesson order.

Schema v1.4 also requires proposal-only change records to contain why-now rationale, prerequisite and affected-target references, claim-bound authority/difficulty evidence, alternatives, expected cognitive-load dimensions, confidence basis/limitations, and unresolved questions. Evidence must be local to the proposal and support the declared claim. Top-level and proposed-node graph references must resolve with the expected target type, and candidate prerequisite cycles fail closed. Modify/prerequisite/sequence proposed-node IDs must match affected target IDs one-to-one and preserve target types; removal proposals identify affected targets without replacement nodes. Confidence must be finite and between 0 and 1. Proposals and embedded targets remain `PROPOSED`, cannot self-approve, and never mutate the approved graph. This schema does not authenticate a human approval or authorize a lesson; that transition remains a separate authority gate. Examples and tests use synthetic records only.

Graph relationships are validated against registered node identity and type. Skill nodes state a capability separately from their domain and description. Character nodes record `exposureLevel`, `recognitionLevel`, `readingLevel`, and `writingLevel` independently; every non-required stage is explicitly `null`. Exposure does not create a recognition or writing requirement, and an exposure activity requires an explicit exposure level. Writing requires an explicit recognition stage and cannot precede it. Skill target lists must point to the matching vocabulary, grammar, or character group; skill prerequisites and character prerequisite skills must resolve to skills; vocabulary and grammar prerequisites may point to a registered target or a skill alias. Vocabulary introducing skills must resolve to a skill. Skill aliases may not collide with another skill or target ID. Prerequisite edges must be acyclic; target-association edges do not imply prerequisites.

Publishable content-bearing targets and examples require `CONTENT_SOURCE` provenance with affirmative item-level rights evidence, including author, creation date, rights-grant reference, verification, and public-repository permission. Evidence citations can support a target's rationale but do not authorize the text or media itself.

## Authority states

`PROPOSED` is never executable. `EVIDENCE_CHECKED` is not approval. The existing `ARCHITECT_APPROVED` pack token is a legacy structural state, not evidence that an advisory Architect review authorized a target. The manual Owner decision contract records an explicit Owner decision against an exact proposal hash; it does not mutate proposals or promote graph nodes. Until a separate authority-bound promotion contract exists, do not infer approval or publication permission from that legacy token. The pack's validation policy, source rights, educational validity, sequencing, and learner validation remain separate gates.

Curriculum additions and changes are represented as `CURRICULUM_CHANGE_PROPOSAL` records. They do not mutate the graph automatically. No next lesson is inferred or generated by the validator.
