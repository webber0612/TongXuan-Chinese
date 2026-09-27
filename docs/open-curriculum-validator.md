# Open Curriculum validator design

## Contract

`backend/app/open_curriculum_validator.py` is a deterministic, offline validator for candidate graph packs. It does not draft targets, choose a next lesson, mutate curriculum, or grant source permission. It validates Draft 2020-12 structure from `shared/open-curriculum/schemas/`, then applies cross-reference, evidence, level, prerequisite, recycling, sentence-token, recognition-before-writing, mastery-target, source-rights, and explicit-policy checks.

The default source registry is [`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json), schema version 2.0. Each rights decision links to evidence URLs, locators, observation dates, capture methods, an explicit `supportsClaims` list, and a response SHA-256 when an HTTP representation was captured. The validator checks evidence references, status/outcome consistency, and requires GREEN license/terms evidence plus linked evidence for every source-level permission claim. Conditional terms still require item-level checks. `UNKNOWN` and validation-only sources cannot become publishable. Missing/invalid registry records fail closed. Remote schema references are not fetched; repository schemas are bundled and resolved locally.

## Graph identity and dependency integrity

Pack schema version 1.4 includes an explicit skill `capability`; distinct nullable character learning stages (`exposureLevel`, `recognitionLevel`, `readingLevel`, and `writingLevel`); vocabulary receptive/productive requirements; grammar receptive/productive requirements plus an explicit sequence-policy state; and a structured proposal-only change record. Every non-required character stage is explicitly `null`. An activity may use a stage only when that character has an explicit level for it, and its level check uses only the stage exercised by the activity.

Pack-level graph validation checks identity and relationship semantics before lesson-level checks:

- Target IDs are unique across skill, vocabulary, grammar, and character nodes. Skill IDs and aliases must not collide with another skill alias or a non-skill target ID.
- Skill `targetVocabulary`, `targetGrammar`, and `targetCharacters` references must resolve to nodes of the corresponding type. Skill `prerequisites` and character `prerequisiteSkills` must resolve to skill IDs or aliases.
- Vocabulary `introducedBySkill` must resolve to a skill. Vocabulary and grammar `prerequisites` may reference a registered graph target or skill alias.
- Missing references and wrong node types fail closed. Prerequisite edges reject self-dependencies and directed cycles across graph node types. Association lists such as skill target lists are not prerequisite edges.
- Writing activities require a character with an explicit writing level, and that graph stage requires recognition and cannot be at a lower level than recognition. Character reading activities require an explicit reading level. Exposure activities require an explicit exposure level and do not mark a character recognized or writable. `priorRecognizedCharacterIds` is the stage-specific prior-state declaration; generic prior knowledge or exposure cannot satisfy a writing prerequisite. A recognition activity in an earlier pack lesson can satisfy it.
- `evidenceIds` must resolve within the candidate pack; schema and rights checks still apply independently.
- Vocabulary and grammar difficulty/role claim references must resolve to evidence attached to that same graph node. Each cited record must declare the matching `supportsClaims` value; claims on `ARCHITECT_APPROVED` nodes and claims in publishable packs require `EVIDENCE_CHECKED` or `ARCHITECT_APPROVED` evidence. Vocabulary frequency records must declare `VOCABULARY_FREQUENCY`.
- Vocabulary and grammar separately state whether receptive and productive learning is required. Grammar records `RECEPTIVE_BEFORE_PRODUCTIVE`, `NO_ORDER_CONSTRAINT`, `NOT_APPLICABLE`, or `UNRESOLVED`; the policy must agree with the requirement records. An unresolved policy cannot be Architect-approved or published. This records an explicit decision and does not choose a decision or change lesson activity ordering.

The diagnostics include `DUPLICATE_TARGET_ID`, `SKILL_ALIAS_COLLISION`, `UNREGISTERED_GRAPH_REFERENCE`, `GRAPH_REFERENCE_TYPE_MISMATCH`, `SELF_PREREQUISITE`, `GRAPH_PREREQUISITE_CYCLE`, `CROSS_NODE_GRAPH_EVIDENCE`, `GRAPH_EVIDENCE_CLAIM_MISMATCH`, `GRAPH_CLAIM_EVIDENCE_UNVERIFIED`, `GRAMMAR_SEQUENCE_POLICY_EVIDENCE_REQUIRED`, `GRAMMAR_SEQUENCE_POLICY_INCONSISTENT`, `UNRESOLVED_GRAMMAR_SEQUENCE_POLICY`, `CHARACTER_WRITING_WITHOUT_RECOGNITION`, `CHARACTER_WRITING_BEFORE_RECOGNITION`, `UNSUPPORTED_PRIOR_RECOGNITION`, `PRIOR_RECOGNITION_NOT_KNOWN`, `EXPOSURE_LEVEL_UNSUPPORTED`, `RECOGNITION_LEVEL_UNSUPPORTED`, `READING_LEVEL_UNSUPPORTED`, and `WRITING_LEVEL_UNSUPPORTED`. These checks constrain graph structure and stage evidence only. They do not approve targets, decide pedagogy, clear rights, or imply that a lesson should come next. Current regression cases use synthetic fixture nodes only.

## Proposal-only change records

Each `CURRICULUM_CHANGE_PROPOSAL` must state the change, why now, prerequisites, affected targets, authority and difficulty evidence, alternatives, expected cognitive-load dimensions, confidence with limitations, and unresolved questions. Evidence IDs must resolve inside the same proposal and declare the required claim (`CURRICULUM_AUTHORITY`, `TARGET_DIFFICULTY`, `EXPECTED_COGNITIVE_LOAD`, or `PROPOSAL_CONFIDENCE`). Top-level and proposed-node relationship references resolve against the current graph plus this proposal's candidate nodes with target-type checks; prerequisite cycles and candidate self-dependencies fail closed. For modifications and prerequisite/sequence changes, proposed node IDs must map one-to-one to affected target IDs and preserve their target types. A removal names existing affected targets and carries no replacement node. Confidence must be finite and in `[0, 1]`; malformed load/confidence records fail the schema. Duplicate proposal identities/targets and graph collisions fail closed.

Proposal and proposed-node `approvalStatus` are fixed to `PROPOSED`. The validator rejects claimed approval and never copies proposals into the approved graph. This contract does not authenticate a human, provide an approval transition, choose curriculum targets, or make a proposal executable. Human approval remains a separate authority gate. Synthetic fixtures are contract examples, not target recommendations.

## Publishable-pack rules

- The pack validation policy must have `approved: true`.
- Every graph target and lesson must be `ARCHITECT_APPROVED`.
- Target/source references must resolve to registered graph nodes and source-registry entries.
- Every publishable content-bearing target and example needs `CONTENT_SOURCE` provenance with item-level creator/date, rights-grant reference, verification, and explicit public-repository permission. This includes proposed nodes embedded in a publishable pack because proposal text is also present in the public artifact. A `CONDITIONAL` registry permission is accepted only when the item record says `YES`; `NO`, `NOT_ALLOWED`, and `UNKNOWN` remain blocked. `EVIDENCE_REFERENCE` alone cannot authorize publishing content. Raw source material additionally requires cleared raw-ingestion permission.
- Content-source records require item-level rights evidence in the schema; missing rights information fails validation before publication.
- Lesson activities, recognition-before-writing order, mastery references, and prerequisite knowledge are checked and accumulated independently for every lesson in pack order.
- Evidence references may cite a source but cannot contain its raw material.
- Prerequisites must be in the explicitly declared pre-lesson knowledge set or be introduced by an earlier pack lesson. The validator does not infer knowledge from titles or lesson order alone.
- Character writing requires prior learner knowledge or an earlier recognition activity in the same lesson. A character without a writing level cannot be assigned writing activity.
- Sentence tokens must map to registered vocabulary/character nodes, match their registered spellings, and cover the sentence in order (ignoring punctuation and spaces).
- Mastery targets must map to a registered skill included in that lesson, and the requested domain must match the skill.
- A publishable lesson that introduces new vocabulary must provide an approved finite `maxNewVocabularyRatio` between 0 and 1. Missing limits fail with `NEW_VOCABULARY_LIMIT_REQUIRED`; non-finite and out-of-range limits fail with `NEW_VOCABULARY_LIMIT_INVALID`. The validator sets no default ratio and does not invent a teaching threshold. If the limit is valid and the policy is approved, the per-lesson ratio is checked against it.
- Recycled targets must have been explicitly known or introduced by an earlier lesson, appear in the lesson targets, and cannot also be labeled new.

## Diagnostic codes

Structural failures use `SCHEMA_INVALID`. Semantic checks include `UNAPPROVED_TARGET`, `UNAPPROVED_LESSON`, `VALIDATION_POLICY_NOT_APPROVED`, `MISSING_PROVENANCE`, `SOURCE_NOT_REGISTERED`, `SOURCE_NOT_GREEN`, `SOURCE_REDISTRIBUTION_NOT_CLEARED`, `ITEM_LICENSE_UNVERIFIED`, `UNLICENSED_RAW_CONTENT`, `RAW_CONTENT_AS_EVIDENCE`, `UNMET_PREREQUISITE`, `TARGET_OUT_OF_LEVEL`, `TARGET_NOT_AVAILABLE`, `NEW_VOCABULARY_LIMIT_REQUIRED`, `NEW_VOCABULARY_RATIO_EXCEEDED`, `UNMET_RECYCLING`, `WRITING_BEFORE_RECOGNITION`, `UNREGISTERED_SENTENCE_TOKEN`, `SENTENCE_TOKEN_TEXT_MISMATCH`, `UNREGISTERED_SENTENCE_TEXT`, and `UNSUPPORTED_MASTERY_TARGET`.

Diagnostics are sorted and deduplicated so identical input yields stable output. Registry diagnostics include `RIGHTS_EVIDENCE_ID_DUPLICATE`, `RIGHTS_DECISION_EVIDENCE_UNRESOLVED`, `RIGHTS_STATUS_DECISION_MISMATCH`, `GREEN_RIGHTS_UNSUPPORTED`, `GREEN_RIGHTS_EVIDENCE_MISSING`, `GREEN_PERMISSION_EVIDENCE_MISSING`, `GREEN_ITEM_LEVEL_GUARD_MISSING`, and `VALIDATION_ONLY_SOURCE_NOT_PUBLISHABLE`. Pack diagnostics also include `ITEM_RIGHTS_EVIDENCE_MISSING`, `CONTENT_RIGHTS_EVIDENCE_REQUIRED`, `PROPOSAL_EVIDENCE_NOT_LOCAL`, `PROPOSAL_EVIDENCE_CLAIM_MISMATCH`, `PROPOSAL_PREREQUISITE_NOT_REGISTERED`, `PROPOSAL_GRAPH_REFERENCE_NOT_REGISTERED`, `PROPOSAL_GRAPH_REFERENCE_AMBIGUOUS`, `PROPOSAL_GRAPH_REFERENCE_TYPE_MISMATCH`, `PROPOSAL_SELF_PREREQUISITE`, `PROPOSAL_GRAPH_PREREQUISITE_CYCLE`, `PROPOSAL_SKILL_ALIAS_COLLISION`, `DUPLICATE_PROPOSED_NODE_ID`, `PROPOSAL_NODE_NOT_AFFECTED`, `PROPOSAL_AFFECTED_TARGET_NOT_PROPOSED`, `PROPOSAL_TARGET_TYPE_MISMATCH`, and `PROPOSAL_CONFIDENCE_INVALID`. Schema validation and semantic checks do not certify pedagogical quality or replace independent review.

The tracked-path inventory and public-artifact guard are implemented in [`scripts/open_curriculum_rights_gate.py`](../scripts/open_curriculum_rights_gate.py). Its `--check` command verifies the machine-readable repository audit, required path coverage, content digests, source/evidence references, and that non-owned content is never placed under root MIT. It also discovers and validates every tracked JSON file under `shared/open-curriculum/packs/`; a pack marked `PUBLISHABLE` must have an individually cleared inventory path. `--publishable-pack` combines curriculum validation with path clearance, while repeated `--publishable-path` arguments validate proposed raw paths. Existing `RIGHTS_UNCLEAR` paths remain blocked from publishable artifacts.

## Verification results

The repository registry passes its schema. Test-only synthetic fixtures cover composed skill/vocabulary/grammar/character schemas; approval; provenance; source rights; prerequisites; vocabulary/grammar level bounds; explicit vocabulary ratio limits; recycling; writing sequence; registered and text-matched sentence tokens; supported mastery targets; proposal/graph separation; required proposal evidence fields; local claim-bound references; top-level and proposed-node prerequisite/relationship resolution; target-type and cycle failures; exact affected/proposed identity mapping; removal shape; confidence and load-shape failures; immutable graph and duplicate-proposal rejection; separate vocabulary/grammar receptive and productive requirements; same-node claim evidence; checked/rejected evidence states; and resolved/unresolved grammar policy. The machine-readable [Phase 3 guard matrix](../shared/open-curriculum/validator-guard-matrix.json) maps all 15 roadmap guards to statuses and existing regressions; a regression checks that all referenced test functions remain present. These fixtures are not curriculum content and are not executable lessons. Run:

```powershell
cd backend
python -m app.open_curriculum_validator path/to/candidate-pack.json
python -m pytest tests/test_open_curriculum.py -q
python ../scripts/open_curriculum_rights_gate.py --check
```

Full backend/frontend/build and validator/right-gate counts for Issues #98/#100 are recorded against each exact reviewed PR head in the current project handoff and PR metadata. These tests establish validator behavior only; they do not validate a real curriculum target or approve teaching policy.
