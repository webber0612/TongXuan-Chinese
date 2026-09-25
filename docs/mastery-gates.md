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

- Each lesson blueprint in the validated slice lists its own required domains. The default floor is `0.75` per domain.
- Every required domain needs evidence from its own server-side scorer and linked attempt record. Client-supplied scores are rejected and scores are not averaged across domains.
- Latest evidence per linked item is evaluated. Assisted evidence is retained but cannot pass a mastery domain.
- Listening, speaking, spoken pronunciation, and handwriting-quality evidence remain unavailable until the matching authoritative activity provider is implemented. Those gates remain missing rather than accepting typed or client-asserted results.
- Age and grade do not gate access.
- The initial prerequisite chain follows Starter 1–12 → Basic 1–12 → Book 1 A lessons 1–3.
- A subsequent lesson is normally accessible only after the previous lesson is `MASTERED`.
- A soft unlock can make a lesson accessible without changing its mastery state. Only an authenticated parent scoped to the child or an admin may unlock it; the append-only event records the actor subject and role.
- Assessment scores, practice completion, and points/rewards do not promote one another.

## Endpoints

- `GET /api/children/{child_id}/validated-curriculum`
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/progress` with `IN_PROGRESS`, `PRACTICED`, or `READY_FOR_CHECK`
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/assessment` with an empty body; the server evaluates linked attempts
- `POST /api/children/{child_id}/validated-curriculum/lessons/{lesson_id}/soft-unlock` with an independent `unlocked` boolean and parent/admin authorization

Lesson responses nest source records in `official` and TongXuan-authored practice and learner state in `tongxuan`.

Assessment blueprint and official/source metadata live in [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json). The full status behavior is covered in `backend/tests/test_validated_curriculum_policy.py`.
