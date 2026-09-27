# Open Curriculum validator design

## Contract

`backend/app/open_curriculum_validator.py` is a deterministic, offline validator for candidate graph packs. It does not draft targets, choose a next lesson, mutate curriculum, or grant source permission. It validates Draft 2020-12 structure from `shared/open-curriculum/schemas/`, then applies cross-reference, evidence, level, prerequisite, recycling, sentence-token, recognition-before-writing, mastery-target, source-rights, and explicit-policy checks.

The default source registry is [`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json). Missing/invalid registry records fail closed. Remote schema references are not fetched; repository schemas are bundled and resolved locally.

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

Diagnostics are sorted and deduplicated so identical input yields stable output. Rights-related diagnostics include `ITEM_RIGHTS_EVIDENCE_MISSING` and `CONTENT_RIGHTS_EVIDENCE_REQUIRED`. Schema validation and semantic checks do not certify pedagogical quality or replace independent review.

## Verification results

The repository registry passes its schema. Test-only synthetic fixtures cover composed skill/vocabulary/grammar/character schemas; approval; provenance; source rights; prerequisites; level bounds; conditional vocabulary ratio; recycling; writing sequence; registered sentence tokens; and supported mastery targets. These fixtures are not curriculum content and are not executable lessons. Run:

```powershell
cd backend
python -m app.open_curriculum_validator path/to/candidate-pack.json
python -m pytest tests/test_open_curriculum.py -q
```

The targeted validator suite passes **29 tests**. Full backend, frontend, and production-build results are recorded in the active project handoff snapshot and Issue #86 PR metadata.
