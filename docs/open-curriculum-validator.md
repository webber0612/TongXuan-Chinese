# Open Curriculum validator design

## Contract

`backend/app/open_curriculum_validator.py` is a deterministic, offline validator for candidate graph packs. It does not draft targets, choose a next lesson, mutate curriculum, or grant source permission. It validates Draft 2020-12 structure from `shared/open-curriculum/schemas/`, then applies cross-reference, evidence, level, prerequisite, recycling, sentence-token, recognition-before-writing, mastery-target, source-rights, and explicit-policy checks.

The default source registry is [`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json), schema version 2.0. Each rights decision links to evidence URLs, locators, observation dates, capture methods, an explicit `supportsClaims` list, and a response SHA-256 when an HTTP representation was captured. The validator checks evidence references, status/outcome consistency, and requires GREEN license/terms evidence plus linked evidence for every source-level permission claim. Conditional terms still require item-level checks. `UNKNOWN` and validation-only sources cannot become publishable. Missing/invalid registry records fail closed. Remote schema references are not fetched; repository schemas are bundled and resolved locally.

## Graph identity and dependency integrity

Pack schema version 1.1 includes an explicit skill `capability` and distinct nullable character learning stages: `exposureLevel`, `recognitionLevel`, `readingLevel`, and `writingLevel`. Every non-required stage is explicitly `null`. An activity may use a stage only when that character has an explicit level for it. Exposure alone never implies a recognition or writing requirement.

Pack-level graph validation checks identity and relationship semantics before lesson-level checks:

- Target IDs are unique across skill, vocabulary, grammar, and character nodes. Skill IDs and aliases must not collide with another skill alias or a non-skill target ID.
- Skill `targetVocabulary`, `targetGrammar`, and `targetCharacters` references must resolve to nodes of the corresponding type. Skill `prerequisites` and character `prerequisiteSkills` must resolve to skill IDs or aliases.
- Vocabulary `introducedBySkill` must resolve to a skill. Vocabulary and grammar `prerequisites` may reference a registered graph target or skill alias.
- Missing references and wrong node types fail closed. Prerequisite edges reject self-dependencies and directed cycles across graph node types. Association lists such as skill target lists are not prerequisite edges.
- Writing activities require a character with an explicit writing level, and that graph stage requires recognition and cannot be at a lower level than recognition. Character reading activities require an explicit reading level. Exposure activities require an explicit exposure level and do not mark a character recognized or writable.
- `evidenceIds` must resolve within the candidate pack; schema and rights checks still apply independently.

The diagnostics include `DUPLICATE_TARGET_ID`, `SKILL_ALIAS_COLLISION`, `UNREGISTERED_GRAPH_REFERENCE`, `GRAPH_REFERENCE_TYPE_MISMATCH`, `SELF_PREREQUISITE`, `GRAPH_PREREQUISITE_CYCLE`, `CHARACTER_WRITING_WITHOUT_RECOGNITION`, `CHARACTER_WRITING_BEFORE_RECOGNITION`, `EXPOSURE_LEVEL_UNSUPPORTED`, `RECOGNITION_LEVEL_UNSUPPORTED`, `READING_LEVEL_UNSUPPORTED`, and `WRITING_LEVEL_UNSUPPORTED`. These checks constrain graph structure only. They do not approve targets, decide pedagogy, clear rights, or imply that a lesson should come next. Current regression cases use synthetic fixture nodes only.

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
- New-vocabulary ratio is checked only when a numeric maximum is present and the validation policy is approved. This repository sets no default ratio.
- Recycled targets must have been explicitly known or introduced by an earlier lesson, appear in the lesson targets, and cannot also be labeled new.

## Diagnostic codes

Structural failures use `SCHEMA_INVALID`. Semantic checks include `UNAPPROVED_TARGET`, `UNAPPROVED_LESSON`, `VALIDATION_POLICY_NOT_APPROVED`, `MISSING_PROVENANCE`, `SOURCE_NOT_REGISTERED`, `SOURCE_NOT_GREEN`, `SOURCE_REDISTRIBUTION_NOT_CLEARED`, `ITEM_LICENSE_UNVERIFIED`, `UNLICENSED_RAW_CONTENT`, `RAW_CONTENT_AS_EVIDENCE`, `UNMET_PREREQUISITE`, `TARGET_OUT_OF_LEVEL`, `TARGET_NOT_AVAILABLE`, `NEW_VOCABULARY_RATIO_EXCEEDED`, `UNMET_RECYCLING`, `WRITING_BEFORE_RECOGNITION`, `UNREGISTERED_SENTENCE_TOKEN`, `UNREGISTERED_SENTENCE_TEXT`, and `UNSUPPORTED_MASTERY_TARGET`.

Diagnostics are sorted and deduplicated so identical input yields stable output. Registry diagnostics include `RIGHTS_EVIDENCE_ID_DUPLICATE`, `RIGHTS_DECISION_EVIDENCE_UNRESOLVED`, `RIGHTS_STATUS_DECISION_MISMATCH`, `GREEN_RIGHTS_UNSUPPORTED`, `GREEN_RIGHTS_EVIDENCE_MISSING`, `GREEN_PERMISSION_EVIDENCE_MISSING`, `GREEN_ITEM_LEVEL_GUARD_MISSING`, and `VALIDATION_ONLY_SOURCE_NOT_PUBLISHABLE`. Pack diagnostics also include `ITEM_RIGHTS_EVIDENCE_MISSING` and `CONTENT_RIGHTS_EVIDENCE_REQUIRED`. Schema validation and semantic checks do not certify pedagogical quality or replace independent review.

The tracked-path inventory and public-artifact guard are implemented in [`scripts/open_curriculum_rights_gate.py`](../scripts/open_curriculum_rights_gate.py). Its `--check` command verifies the machine-readable repository audit, required path coverage, content digests, source/evidence references, and that non-owned content is never placed under root MIT. It also discovers and validates every tracked JSON file under `shared/open-curriculum/packs/`; a pack marked `PUBLISHABLE` must have an individually cleared inventory path. `--publishable-pack` combines curriculum validation with path clearance, while repeated `--publishable-path` arguments validate proposed raw paths. Existing `RIGHTS_UNCLEAR` paths remain blocked from publishable artifacts.

## Verification results

The repository registry passes its schema. Test-only synthetic fixtures cover composed skill/vocabulary/grammar/character schemas; approval; provenance; source rights; prerequisites; level bounds; conditional vocabulary ratio; recycling; writing sequence; registered sentence tokens; and supported mastery targets. These fixtures are not curriculum content and are not executable lessons. Run:

```powershell
cd backend
python -m app.open_curriculum_validator path/to/candidate-pack.json
python -m pytest tests/test_open_curriculum.py -q
python ../scripts/open_curriculum_rights_gate.py --check
```

The authority and rights regression suites pass **50 tests** on the current PR head. Full backend, frontend, production-build, and exact-head review results are recorded in the active project handoff snapshot and the Phase 1 PR metadata for Issue #88.
