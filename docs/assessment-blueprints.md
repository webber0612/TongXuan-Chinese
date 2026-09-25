# Assessment blueprints

## Validated lesson checks

The curriculum response keeps source-verified title/source metadata under `official`. TongXuan-authored handbook paraphrases, domains, practice targets, gates, and learner state stay under `tongxuan`. The domains are taken from `domains` in [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json). Scored domains (`recognition`, `reading`, `phonetics`, `vocabulary`, `grammar`) have a `0.75` floor. The assessment endpoint accepts an empty request only; scores and assistance flags from callers are rejected. The server finds the latest server-scored evidence per linked item and derives each score from those results. Raw attempt rows alone do not count. An evidence reference and attempt type are persisted for audit.

Non-score domains (`listening`, `speaking`, `pronunciation`, `writing`) use separate `curriculum_skill_gates` records. The assessment response lists these under `gateStatuses` and does not fabricate percentages:

- Listening records `ATTEMPTED_INDEPENDENTLY` after the linked browser TTS playback ends.
- Speaking and pronunciation record separate `ATTEMPTED_INDEPENDENTLY` gates after a completed read-aloud attempt sourced from a linked curriculum item. The learner selects which activity they attempted. No ASR score or pronunciation accuracy is inferred.
- Writing references the persisted attempt ID returned by the Hanzi Writer flow. A weekly review can reference that real ID; an empty writing response is `unverified`, and no attempt ID cannot create a writing event or advance writing SRS.

These gates prove that a linked activity was completed independently. They do not claim comprehension, speech accuracy, or handwriting quality. A completed event is appended with its source attempt ID and item link. A parent/admin creates item links against existing child activity items; mismatched or unlinked items cannot satisfy lesson gates.

Book 1 A's first lessons are mapped to their documented functions:

- Lesson 1 (你好): listening, speaking, recognition, pronunciation.
- Lesson 2 (你家有幾個人？): listening, speaking, recognition, vocabulary, grammar.
- Lesson 3 (你們班有幾個同學？): listening, speaking, recognition, vocabulary, grammar.

Every lesson in Starter, Basic, and Book 1 A lessons 1–3 has an `officialObjectiveSummary` paraphrased from its recorded official teacher-handbook page. Those summaries are not copied lesson content. Domain mapping, mastery thresholds, and practice targets are authored by TongXuan and should not be presented as OCAC's own assessment rubric.

## Weekly practice assessment

`guided-practice-review-v2` selects at most ten activities deterministically. Recognition uses a character choice; vocabulary asks for a missing character; sentence practice is a cloze; grammar and reading use their own answer rules; idiom practice uses an authored context-choice scorer; phonetic notation uses the pronunciation-reading scorer; writing references an existing `HANZI_WRITER` provider event. It returns item-level practice results only. If no writing event is attached, that item remains `unverified`. It does not return per-domain ability scores and does not claim to assess multidomain ability, handwriting quality, or lesson mastery.

Each scored activity writes its own attempt type and uses its domain scorer. Linked server-scored attempts may satisfy only that same curriculum domain; the weekly aggregate never becomes a mastery score. Phonetic notation attempts are not recorded as pronunciation SRS. Recognition misses also enter the existing recognition review queue.

## Placement profile

`GET|PUT /api/children/{child_id}/placement-profile` stores independently assessed levels for listening, speaking, recognition, writing, reading, Zhuyin, Pinyin, vocabulary, and grammar. Levels are `NOT_ASSESSED`, `STARTER`, `BASIC`, or `BOOK_1`. The deterministic main starting stage is the lowest assessed level among recognition, reading, vocabulary, and grammar; if none are assessed, it defaults to Starter. Domain-specific levels remain separate. `age_hint_years` is stored for pacing only and never affects placement. The selected stage's first lesson becomes accessible; subsequent lessons in that stage follow the regular mastery chain.

## Adaptive selection

Adaptive ranking can reorder only eligible candidates. A candidate linked to a validated lesson is omitted until its prerequisite lesson is mastered or that lesson is explicitly soft-unlocked. The deterministic planner still honors child scoping and `as_of` event history.
