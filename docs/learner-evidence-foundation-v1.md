# Learner Evidence Foundation v1

**Implementation status:** Implemented on the stacked Evidence Foundation v1 branch; verify exact PR head and checks before treating it as merged or deployed.

This specification records the executable v1 evidence contract. It does not approve curriculum targets, declare educational mastery, or claim learning efficacy.

## Existing records and compatibility

| Existing record | Reuse | Missing for Evidence v1 | Compatibility handling |
| --- | --- | --- | --- |
| `recognition_attempts` | Server-scored correct/incorrect, assistance, item, queue, session, timestamp | Explicit script scope, concept/form identity, cue semantics, versioned read model | Learning Flow's private server answer key writes a linked orthographic-recognition event in the same transaction. Other legacy rows are not backfilled. |
| `learning_flow_task_attempts` | Exact child/task/session/source attempt reference and scorer label | Target identity and structured cue/script/delay | Remains intact; new evidence stores the task/session/lesson references alongside the provider attempt ID. |
| `reading_aloud_attempts` | Completed/aborted provider lifecycle, locale, assistance/manual-review, duration; no raw voice | Accuracy scorer, target dimension, orthographic scope | Completion writes `SPEAK` or `PRONUNCIATION` as `NOT_ASSESSED`; it never converts recording completion into correctness. No media is copied. |
| `listening_attempts` | Audio playback completion, item, lesson, timestamp | Comprehension result | Writes a `HEAR / NOT_ASSESSED` activity fact only. |
| `pronunciation_attempts` | Server comparison against stored Zhuyin/Pinyin notation, exact reading ID, assistance | Versioned evidence projection and certainty that a legacy script field was explicit | `script_scope_verified=1` is set only on records created by explicit v1 seed/material adapters. Legacy rows migrate with `0`; they may continue the existing flow but do not create script-specific Evidence v1 events. Private School Queue rows also remain excluded. |
| `writing_attempts` | Provider, phase, exact script on a persisted Flow task, activity timestamp | The trace result is client-reported and is not a reliable independent scorer | Only the exact server-bound Learning Flow writing submission creates `HANDWRITING / NOT_ASSESSED`. Standalone writes that only trust a client script label do not create Evidence v1 events. No client trace result becomes evidence of correctness. |
| `curriculum_skill_evidence` / gates | Current lesson-level scoring and gate records | Stable concept/form dimensions beyond a lesson | Continues to serve current mastery gates; Evidence v1 is separate and does not change their thresholds. |
| `srs_review_states` / events | Due time, item/domain, assisted and correct/incorrect scheduling history | Concept × form × evidence dimension and prior exposure contract | Remains unchanged. Evidence stores the due/prior-exposure references where available; the scheduler is not reinterpreted. |
| `placement_profiles` | Existing ten general placement domains and main start | Explicit script-specific recognition/writing placement | Retained unchanged as `legacyAggregate`; no values are copied into the new six-domain placement profile. |
| Parent dashboard / learning report | Child-scoped activity summaries | Evidence facts by target and script | No dashboard UI change. New read-only evidence endpoints are available for later parent read-model work. |

There is no child/account deletion API or data-export endpoint in the audited application. Evidence targets, events, materialized profiles, and placement v2 rows use child foreign keys with cascade deletion so direct child deletion leaves no orphan v1 rows. Existing provider tables keep their pre-existing deletion behavior. No legacy record is silently recast as new evidence.

## Repository boundary audit

| Area | Existing executable boundary inspected | Evidence v1 decision |
| --- | --- | --- |
| `database.py` and test fixtures | SQLite schema v5 and per-test temporary databases | Add v6 evidence tables and v7 expectation column; preserve populated v5 records; verify v6→v7 upgrade and repeated initialization. |
| `learning_flow.py`, `curriculum_policy.py`, assessment and mastery gates | Task identity, private answer keys, server-derived scores, lesson settlement and existing operational mastery | Record only exact server-derived recognition and review facts. Existing assessment/mastery contracts stay unchanged; no target mastery or curriculum authority is inferred. |
| `placement.py` | Existing aggregate placement and child authorization | Preserve v1; store six script-aware fields in additive placement v2; do not copy legacy values. |
| SRS in `learning.py` / session review adapters | Domain/item scheduling, due timestamps, attempt history | Keep scheduler unchanged; attach review source, prior exposure, and due timestamp only when authoritative rows provide them. |
| `adaptive.py` and daily queue | Deterministic recommendations and separate authoritative queue/session creation | No selection or skip policy reads Evidence v1 yet; read models expose facts only. |
| `dashboard.py` and parent report | Read-only, child-scoped activity summaries | Add evidence-summary APIs with factual counts; no dashboard UI and no percentage or mastery KPI. |
| `school_queue.py`, `sprint_b.py`, pronunciation | Private-school provenance and server-normalized notation comparison | Never ingest private School Queue attempts; only explicitly verified script-scoped notation rows create pronunciation facts. |
| `reading_aloud.py`, `writing_provider.py` | Provider lifecycle metadata; client-originated handwriting trace result | Store speaking as `NOT_ASSESSED`; writing only records script-bound `NOT_ASSESSED`, never the client trace result as correctness. |
| Frontend API types and canonical import checks | Existing API client patterns and production import-graph guard | Add typed read-only client contracts and tests; no runtime UI import or visual change. |
| Child ownership and auth tests | Parent/admin child-access dependency and child deletion semantics | Apply the same route boundary, add cross-family read-denial coverage, and cascade new rows with child deletion. |

The integration tests use real endpoint/provider transactions and isolated SQLite databases. No production evidence endpoint accepts client-authored outcomes, target mastery, or evidence scores.

## Identity and evidence contract

- A target row is scoped to a child and keyed by an explicit `target_id`. `target_kind` is one of `LEXICAL_CONCEPT`, `ORTHOGRAPHIC_FORM`, `PHRASE`, `PRONUNCIATION`, or `CHARACTER`.
- `concept_id` is optional and only joins forms when a trusted caller supplies the same explicit identity. v1 production adapters do not infer that two glyphs or records are equivalent. The `醫院 / 医院 / hospital` example is illustrative only; no such target is seeded by this PR.
- Orthographic target IDs include the exact source item and script. `TRADITIONAL` and `SIMPLIFIED` facts never aggregate into each other. `SCRIPT_INDEPENDENT` is available for spoken facts and shared concept recall. `ZHUYIN` and `PINYIN` are input/notation methods, not scripts.
- Dimensions: `HEAR`, `RECALL`, `READ`, `INPUT`, `HANDWRITING`, `SPEAK`, plus `ORTHOGRAPHIC_RECOGNITION` and `PRONUNCIATION`. The current scored recognition task plays audio and asks the learner to choose a glyph, so it measures orthographic recognition rather than spoken listening comprehension or reading aloud. `SPEAK` means a spoken attempt; read-aloud completion is not an accuracy score. `PRONUNCIATION` is reserved for an actual server-scored notation or speech pronunciation contract.
- Outcomes: `CORRECT`, `INCORRECT`, `PARTIAL`, `NOT_ASSESSED`. Assistance is independent, assisted, or unknown. Only scored server adapters write numeric scores. Missing evidence is not failure.
- A `RECALL` event is rejected when Chinese text is the cue or when the answer is marked exposed. Image/concept/native-language/context/audio/none cues are representable, but there is no active-recall production task in v1.
- Retrieval timing is `IMMEDIATE`, `DELAYED`, or `UNKNOWN`; prior exposure and SRS due timestamps are optional facts. There is no retention threshold or mastery inference.
- Every event stores source attempt reference, optional task/session/lesson references, occurrence and creation time, schema version, scorer/provider name and version, cue, input method, and script scope. No voice/audio payload or learner response text is added.

## Persistence and migration

SQLite schema v6/v7 adds:

- `learner_evidence_targets` — child-scoped target registry, optional explicit concept link, form script, display reference, and optional validated `WRITE_CORE` / `WRITE_FAMILIAR` / `READ_INPUT` / `EXPOSURE_ONLY` handwriting expectation. These expectation labels are target-authority metadata, not inferred from attempts; no current content target is assigned one by this PR. Existing targets can receive explicit metadata through a trusted internal adapter; mismatches are rejected.
- `learner_evidence_events` — append-only outcome facts. Updates are rejected by a database trigger; deletion is reserved for child-cascade privacy deletion. A unique child/source/target/dimension/script/input-method key makes provider retries idempotent.
- `learner_evidence_profiles` — deterministic aggregate by target, dimension, script, and input method. It contains counts and latest outcome/time only. State is limited to `NOT_ASSESSED` or `OBSERVED`; it is not mastery.
- `placement_profiles_v2` — additive, separately editable six-domain placement input; legacy fields are returned under `legacyAggregate`.
- Migration v7 adds a constrained optional handwriting expectation to each target and upgrades earlier v6 tables in place. v5→v7 preserves legacy rows with no synthetic evidence; repeated initialization is idempotent. No target expectation is populated from past scores or current lesson data.

Migration is additive and idempotent. Clean installs create v7 directly; upgrades from populated v5 retain existing learner, placement, attempt, and SRS rows and create no synthetic evidence. A v6 database receives only the v7 handwriting-expectation column. Re-running initialization does not add duplicate migration records or events. No in-place downgrade preserves v7 data when running a v5 binary; downgrade requires restoring the pre-migration database backup or a separately reviewed forward-compatible migration.

Aggregates rebuild from event history in stable `(occurred_at, id)` order. The internal `rebuild_child_profile` service updates only the derived table. No target has assessment state until an authoritative event is recorded; a missing orthographic dimension for a known target is exposed as `NOT_ASSESSED`.

## Production ingestion boundaries

| Existing flow | Evidence v1 write | Source of outcome | Transaction |
| --- | --- | --- | --- |
| Learning Flow recognition / review recognition | `ORTHOGRAPHIC_RECOGNITION`, exact script, `AUDIO` cue | Server answer key and provider attempt; review delay recorded only when prior attempt and due timestamp exist | Same SQLite transaction as recognition attempt, task attempt, existing linked score evidence, and SRS update |
| Sprint B / Learning Flow pronunciation notation | `PRONUNCIATION`, exact glyph script, `ZHUYIN` or `PINYIN` input method | Server-normalized comparison with stored notation | Same transaction as pronunciation attempt/state and linked evidence; private School Queue source is excluded |
| Reading Aloud completion | `SPEAK` or `PRONUNCIATION`, `SCRIPT_INDEPENDENT`, `VOICE`, `NOT_ASSESSED` | No accuracy scorer exists; only provider lifecycle is known | Same transaction as provider completion, linked gate, and Learning Flow evidence where applicable |
| Listening playback completion | `HEAR`, `SCRIPT_INDEPENDENT`, `NOT_ASSESSED` | Completion means reference audio played, not comprehension | Same transaction as provider completion and gate |
| Server-bound Learning Flow writing trace | `HANDWRITING`, script-specific, `NOT_ASSESSED` | Existing trace result is client-supplied, so it is deliberately not used as a score | Same transaction as writing provider record/state/SRS/gate; a standalone client-selected script is not enough to create this fact |

Not yet ingested as scored evidence: active lexical recall, separate text reading, Chinese keyboard input, or handwriting correctness. They lack a suitable current authoritative task/scorer contract. This PR does not add those flows or infer outcomes from lesson completion, self-report, duration, or presence of SRS state.

## API

All routes are child-scoped and use the existing parent/admin child-access boundary:

- `GET /api/children/{child_id}/learner-evidence/summary` (per-dimension/script observed counts plus event facts for active recall, delayed correct retrieval, independent delayed correct retrieval, and incorrect/partial observations)
- `GET /api/children/{child_id}/learner-evidence/targets/{target_id}`
- `GET /api/children/{child_id}/learner-evidence/orthographic-profile`
- `GET /api/children/{child_id}/placement-profile/v2`
- `PUT /api/children/{child_id}/placement-profile/v2`

There is deliberately no client-facing evidence-write endpoint and no endpoint that accepts `mastered` or arbitrary outcome claims. OpenAPI is generated from FastAPI and includes these routes. The original placement API remains readable and writable with its original payload.

Example shape (illustrative, not curriculum content):

```json
{
  "target": {"id": "example:traditional", "conceptId": "example:hospital", "script": "TRADITIONAL"},
  "traditional": {"recognition": {"state": "OBSERVED", "independentCorrectCount": 1}},
  "simplified": {"recognition": {"state": "NOT_ASSESSED", "evidenceCount": 0}}
}
```

The frontend exports typed read models for summary, target history, orthographic facts, handwriting expectation labels, and placement v2. It exposes no client evidence-write method. UI remains unchanged. `EXPOSURE_ONLY` or absent handwriting evidence is not converted to a failed state; an unobserved handwriting dimension remains `NOT_ASSESSED`.

## Limitations and next dependencies

- Current curriculum/task source IDs are not universal lexical identity. Until an approved or otherwise trusted concept registry exists, cross-script lexical equivalence remains unknown.
- Evidence aggregation reports facts, not educational sufficiency. No permanent mastery, placement-from-evidence, Fast Track eligibility, or progression choice is computed here.
- Current SRS remains provider/domain-item scoped. Deeper lexical recall and delayed SRS integration should be a separately scoped next step and must use approved targets and authoritative prompts.
- No real-child/device, deployment OAuth, or educational validation was run by this backend model; endpoint tests do not establish those outcomes.
- Parent export and full account deletion workflows remain absent from the current product. The new rows are cascade-compatible with child deletion, but this PR does not add an export or deletion API.

The canonical architecture's design principles remain in [learning-system-architecture-v1.md](learning-system-architecture-v1.md). This implementation does not build its Progression Engine, curriculum promotion, lessons, dashboard UI, or Adaptive selection policy.

## Verification before push

- Backend full pytest: **333 passed**; 93 existing SQLite datetime-adapter deprecation warnings.
- Frontend full Vitest: **181/181 across 16 files**.
- Production build: **PASS**; canonical frontend import check: **PASS, 38 production modules**. Vite reports the repository's existing large-chunk advisory.
- Clean and populated migration coverage: **PASS** for clean initialization, populated v5→v7 without legacy backfill, v6→v7 column addition, and repeat initialization. Migration-specific subset: **4 passed**.
- `compileall`, rights gate, production artifact check, root final smoke, and `git diff --check`: **PASS**. The fail-closed inventory contains 117 paths (110 `RIGHTS_UNCLEAR`, 7 `REFERENCE_ONLY`); no rights classification was cleared.
- GitHub Actions and independent Architect review remain **pending** until the pushed exact PR head exists. The PR must remain Draft and unmerged.
