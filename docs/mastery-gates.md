# Mastery gates

Lesson completion, mastery, soft unlock, points, and School Queue state are separate records.

## State model

| State | Meaning |
| --- | --- |
| `NOT_STARTED` | No practice recorded. |
| `IN_PROGRESS` | A learner entered the lesson and began practice. |
| `PRACTICED` | Practice activity was completed; this is not mastery. |
| `READY_FOR_CHECK` | Practice is ready for a domain assessment. |
| `MASTERED` | Every required skill domain met its own floor with independent evidence. |
| `NEEDS_REVIEW` | A required domain missed its floor, is assisted, or has no evidence. |

Progress and assessment events are append-only. A practice event cannot assign `MASTERED`. A lesson assessment can assign only `MASTERED` or `NEEDS_REVIEW`.

## Gate rules

- Each lesson blueprint lists its own required domains. Scored domains (`recognition`, `reading`, `phonetics`, `vocabulary`, and `grammar`) have a `0.75` floor and use their server-scored linked attempts.
- Non-score domains (`listening`, `speaking`, `pronunciation`, and `writing`) require a linked `ATTEMPTED_INDEPENDENTLY` gate. These gates confirm a completed activity; they do not claim comprehension, speech accuracy, or handwriting quality.
- Listening gates are created only when linked browser speech playback ends. Speaking and pronunciation gates come from a completed, curriculum-sourced read-aloud attempt explicitly categorized by activity domain. Writing gates reference the persisted attempt ID from the writing provider flow.
- Client-supplied scores are rejected. Scored evidence is not averaged across domains. Latest evidence per linked item is evaluated, and assisted activity cannot pass a non-score gate or a scored domain.
- A parent/admin maps an existing activity item to a lesson requirement before its event can count. The mapping endpoint is `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/items`.
- Age is an optional pacing hint in placement profiles; it does not gate a curriculum start. A parent/admin may start a learner at the first lesson of the assessed main curriculum stage.
- The initial prerequisite chain follows Starter 1–12 → Basic 1–12 → Book 1 A lessons 1–3.
- A subsequent lesson is normally accessible only after the previous lesson is `MASTERED`.
- A soft unlock can make a lesson accessible without changing its mastery state. Only an authenticated parent scoped to the child or an admin may unlock it; the append-only event records the actor subject and role.
- Assessment scores, practice completion, and points/rewards do not promote one another.

## Endpoints

- `GET /api/children/{child_id}/validated-curriculum`
- `GET|PUT /api/children/{child_id}/placement-profile` (parent/admin only)
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/items` (parent/admin only)
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/progress` with `IN_PROGRESS`, `PRACTICED`, or `READY_FOR_CHECK`
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/assessment` with an empty body; the server evaluates linked attempts
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/soft-unlock` with an independent `unlocked` boolean and parent/admin authorization
- Listening and read-aloud attempt endpoints persist their lifecycle before adding non-score evidence.

Lesson responses nest source records in `official` and TongXuan-authored practice and learner state in `tongxuan`.

Assessment blueprint and official/source metadata live in [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json). The full status behavior is covered in `backend/tests/test_validated_curriculum_policy.py`.
