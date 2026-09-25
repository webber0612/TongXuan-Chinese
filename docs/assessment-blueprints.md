# Assessment blueprints

## Validated lesson checks

The curriculum response keeps source-verified title/source metadata under `official`. TongXuan-authored handbook paraphrases, domains, practice targets, gates, and learner state stay under `tongxuan`. The domains are taken from `domains` in [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json). Each listed domain has a floor of `0.75` and requires independent evidence. The assessment endpoint accepts an empty request only; scores and assistance flags from callers are rejected. The server finds the latest server-scored evidence per linked item and derives the score from those results. Raw attempt rows alone do not count. An evidence reference and attempt type are persisted for audit.

Current server scorers cover recognition, vocabulary word attempts, grammar attempts, and phonetic notation recognition. Typed Zhuyin/Pinyin answers count as phonetics, never spoken pronunciation. Listening, speaking, actual pronunciation, and handwriting-quality mastery have no authoritative provider yet. Those domains have no evidence source and remain missing, so they cannot be passed with fabricated client scores.

Book 1 A's first lessons are mapped to their documented functions:

- Lesson 1 (你好): listening, speaking, recognition, pronunciation.
- Lesson 2 (你家有幾個人？): listening, speaking, recognition, vocabulary, grammar.
- Lesson 3 (你們班有幾個同學？): listening, speaking, recognition, vocabulary, grammar.

Every lesson in Starter, Basic, and Book 1 A lessons 1–3 has an `officialObjectiveSummary` paraphrased from its recorded official teacher-handbook page. Those summaries are not copied lesson content. Domain mapping, mastery thresholds, and practice targets are authored by TongXuan and should not be presented as OCAC's own assessment rubric.

## Weekly practice assessment

`guided-practice-review-v2` selects at most ten activities deterministically. Recognition uses a character choice; vocabulary asks for a missing character; sentence practice is a cloze; grammar and reading use their own answer rules; idiom practice uses an authored context-choice scorer; phonetic notation uses the pronunciation-reading scorer; writing stores a `HANZI_WRITER` provider event. It returns item-level practice results only. It does not return per-domain ability scores and does not claim to assess multidomain ability, handwriting quality, or lesson mastery.

Each scored activity writes its own attempt type and uses its domain scorer. Phonetic notation attempts are not recorded as pronunciation SRS. Recognition misses also enter the existing recognition review queue. Activity results are not merged into curriculum mastery or School Queue.

## Adaptive selection

Adaptive ranking can reorder only eligible candidates. A candidate linked to a validated lesson is omitted until its prerequisite lesson is mastered or that lesson is explicitly soft-unlocked. The deterministic planner still honors child scoping and `as_of` event history.
