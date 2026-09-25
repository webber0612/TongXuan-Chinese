# Assessment blueprints

## Validated lesson checks

The validated slice associates each official title with handbook-backed objective summaries, separate TongXuan-authored practice targets, and a non-collapsing skill-domain blueprint. The domains are taken from `domains` in [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json). Each listed domain has a floor of `0.75` and requires independent evidence. Missing, assisted, or below-floor evidence results in `NEEDS_REVIEW` for that lesson; a high score in another domain cannot compensate.

Book 1 A's first lessons are mapped to their documented functions:

- Lesson 1 (你好): listening, speaking, recognition, pronunciation.
- Lesson 2 (你家有幾個人？): listening, speaking, recognition, vocabulary, grammar.
- Lesson 3 (你們班有幾個同學？): listening, speaking, recognition, vocabulary, grammar.

Every lesson in Starter, Basic, and Book 1 A lessons 1–3 has an `officialObjectiveSummary` paraphrased from its recorded official teacher-handbook page. Those summaries are not copied lesson content. Domain mapping, mastery thresholds, and practice targets are authored by TongXuan and should not be presented as OCAC's own assessment rubric.

## Weekly practice assessment

`beginner-multidomain-v1` selects available items deterministically from recognition, word, sentence, writing, pronunciation, grammar, idiom, and reading domains, with a ten-item cap. It returns a separate score/ratio/floor/pass field for every domain. The legacy scalar `score` remains for compatibility only; `overall_score_is_mastery` is always false. A weekly score does not set lesson mastery.

Misses update domain-local SRS state. Recognition misses also enter the existing recognition review queue. Other practice-domain state is not merged into recognition state, mastery, or School Queue.

## Adaptive selection

Adaptive ranking can reorder only eligible candidates. A candidate linked to a validated lesson is omitted until its prerequisite lesson is mastered or that lesson is explicitly soft-unlocked. The deterministic planner still honors child scoping and `as_of` event history.
