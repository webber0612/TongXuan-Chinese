# Open Curriculum Five-Lesson Feasibility Proposal

**Status: `PROPOSED` — not approved, not executable, and not a formal course.**

This document presents two candidate sequences for the five-slot feasibility experiment requested by Issue #109. Its only purpose is to let the curriculum owner compare bounded hypotheses. It creates no lesson package, learner-facing copy, activity, media, audio, score, mastery rule, SRS interval, approved graph node, or next-lesson decision. The machine-readable counterpart is [`prototype-five-weekday-2026-09.json`](../shared/open-curriculum/proposals/prototype-five-weekday-2026-09.json), validated against [`five-lesson-experiment-proposal.schema.json`](../shared/open-curriculum/schemas/five-lesson-experiment-proposal.schema.json).

## Decision requested

After reviewing this proposal and its exact-hash record contract, the final curriculum approver may record exactly one decision:

- `APPROVE A` — approve Variant A's sequencing hypothesis for a later, separately reviewed content-authoring workstream.
- `APPROVE B` — approve Variant B's sequencing hypothesis for a later, separately reviewed content-authoring workstream.
- `REVISE` — request proposal changes; no candidate becomes approved.
- `REJECT` — reject both variants; no candidate becomes approved.

An approval would apply only to the selected experiment plan, not automatically authorize public release, a formal course, new targets, assets, child-facing Pinyin, assessment policy, or graph promotion. Until an explicit Owner-authored decision record binds the proposal ID and canonical hash, all candidates remain `PROPOSED`.

## Experiment boundary and contamination statement

The proposed topic is one bounded calendar statement using **今天** (“today”), **星期一** (“Monday”), and a candidate copula **是**. Calendar expressions are a planning hypothesis supported by broad official framework references; those sources do not prescribe this topic, this sentence frame, or either sequence.

No OCAC lesson, title, text, exercise, teacher material, or sequence was consulted or used as a seed. The exact overlap with other beginner curricula has not been checked; calendar vocabulary is generic and may naturally overlap. This proposal makes no claim of verified non-overlap. Any authorized future benchmark must occur only after an independently authored pack is frozen and must remain benchmark-only.

The five required capability slots are fixed:

1. Listening and pronunciation.
2. Vocabulary and visual meaning recognition, without conflating visual meaning with Chinese-script recognition.
3. Sentence pattern and speaking.
4. Character recognition and a proposed SRS item grain.
5. Integrated LEARN, REVIEW, and REPAIR over the same fixed target set.

The proposal has no handwriting targets and no independent script-reading targets. Character exposure/recognition, reading, and writing remain distinct. This is a scope statement for this experiment, not a general policy that writing is never needed.

## Evidence and rights boundary

| Source | Recorded status and permitted role | Evidence used here | Excluded use |
| --- | --- | --- | --- |
| [CC-CEDICT](https://cc-cedict.org/editor/editor.php?handler=Download) / MDBG lookups | `GREEN` for selected item-level lexical reference under **CC BY-SA 4.0**, subject to attribution, change notices, and share-alike. The proposal preserves a source-specific license notice. | Candidate forms and Pinyin for 今天, 星期一, and 是; see item-level links in the machine plan. | No raw dictionary dump, examples, corpus, audio, or images. CC-CEDICT-derived records are not relicensed under MIT. |
| [TBCL Level 1 overview](https://coct.naer.edu.tw/page.jsp?ID=11), [Level 1 vocabulary reference](https://coct.naer.edu.tw/file/files/TBCL%E8%A9%9E%E8%AA%9E%E8%A1%A8_14420.pdf), and [grammar lookup](https://coct.naer.edu.tw/grammar.jsp) | `YELLOW` / `REFERENCE_ONLY`. Used only for individual lookups and broad ability descriptors. | Broad beginner listening/speaking scope; the individual candidate word and copula are listed at Level 1. These facts do not establish teaching order, productivity, or mastery. | No copied table, bulk ingestion, redistribution, or assumption that a lookup grants reuse rights. |
| [TOCFL CCCC overview](https://tocfl.edu.tw/tocfl/index.php/test/cccc/list/1) | `YELLOW` / `REFERENCE_ONLY`. | Broad child-age context and time/space topic scope. | No question-bank item, answer, audio, image, lesson sequence, or content is copied. |
| TongXuan experiment/system records | Internal hypothesis or engineering context only; not curriculum or rights authority. | Experiment slots, distinct capability boundaries, and existing adaptive-selection guardrail. | System behavior and AI rationale do not authorize a target or next lesson. |

The proposal contains selected CC-CEDICT-backed forms/Pinyin and derived character-recognition candidates. Its notice attributes CC-CEDICT contributors and MDBG distribution, records the normalization/derivation changes, and retains CC BY-SA 4.0 share-alike. Do not replace this with the repository's root MIT license. Registry evidence and public-repository inventory entries are linked separately; a digest records file drift, not legal proof.

Pinyin is research metadata from CC-CEDICT only. It is not proposed as child-facing notation or pronunciation audio. No Zhuyin source, licensed voice asset, visual asset, or localization decision is included. Any future child-facing Traditional Chinese + Zhuyin implementation needs its own approved source/rights and product decisions.

## Candidate target inventory

Every row remains `PROPOSED`. “Productive” describes the candidate experiment requirement only; it is not an approved rubric, accuracy threshold, or mastery gate. Full item-level provenance, evidence IDs, source license fields, alternatives, confidence, and prerequisites are in the JSON plan.

| Candidate | Evidence-backed identity | Candidate receptive / productive role | Why now and limits |
| --- | --- | --- | --- |
| `vocab-today` — 今天, *jīntiān* | CC-CEDICT/MDBG item lookup; TBCL Level 1 single-item lookup. | Understand the calendar meaning; optionally say it as a phrase, without an accuracy threshold. | Introduced in Slot A in both variants as one of two anchors; later visual mapping and the sentence frame recycle it. This is a proposed placement, not a source-prescribed order. |
| `vocab-weekday-monday` — 星期一, *xīngqīyī* | CC-CEDICT/MDBG item lookup; TBCL Level 1 single-item lookup. | Understand one weekday when heard; say it within the candidate frame. | Paired with 今天 in Slot A to bound a single statement. It does not propose a weekday sequence. |
| `grammar-copula-is` — 是, *shì* | CC-CEDICT/MDBG item lookup; TBCL Level 1 grammar reference identifies a copula point. | Understand the candidate relation; use 是 orally in the frame TIME + 是 + WEEKDAY. | Variant A defers it to Slot C; Variant B introduces it receptively in Slot A. Neither the exact formula nor its productive timing is established by TBCL. |
| `char-jin` — 今 | Derived from the licensed 今天 candidate. | Recognize only within the already-heard 今天; no independent reading or writing. | First introduced in Slot D after its containing word has been heard. |
| `char-tian` — 天 | Derived from the licensed 今天 candidate. | Recognize only within the already-heard 今天; no independent reading or writing. | First introduced in Slot D after its containing word has been heard. |
| `char-xing` — 星 | Derived from the licensed 星期一 candidate. | Recognize only within the already-heard 星期一; no isolated meaning/reading/writing. | First introduced in Slot D after its containing word has been heard. |
| `char-qi` — 期 | Derived from the licensed 星期一 candidate. | Recognize only within the already-heard 星期一; no isolated meaning/reading/writing. | First introduced in Slot D after its containing word has been heard. |
| `char-yi` — 一 | Derived from the licensed 星期一 candidate. | Recognize only within the already-heard 星期一; no separate number lesson or writing. | First introduced in Slot D after its containing word has been heard. |
| `char-shi` — 是 | Derived from the licensed 是 candidate. | Recognize only within the heard candidate form; no independent reading or handwriting. | First introduced in Slot D after the form has been heard. |

The candidate character grain and use as SRS items are low-confidence proposals. Exact character identity in backend SRS, scheduling, mastery effects, and task links have not been verified by this proposal and remain unimplemented here. No SRS interval or mastery settlement is suggested.

## Variant comparison

The two variants use the same target identities and the same five slots. They differ only in sequencing: whether the copula is heard with the first vocabulary slot, and whether character recognition/SRS precedes full-frame speaking.

| Slot | Variant A — Communication-first (`A → B → C → D → E`) | Variant B — Phonetic/recognition-balanced (`A → B → D → C → E`) |
| --- | --- | --- |
| A — Listening + pronunciation | New vocabulary: 2; new grammar: 0; new character recognition: 0; new phonetic syllables: 5. Listen to and say the two candidate lexical phrases. | New vocabulary: 2; new grammar: 1, receptive only; new character recognition: 0; new phonetic syllables: 6. Hear the copular relation but defer full-frame speaking. |
| B — Vocabulary + visual recognition | Recycle the two words; map spoken meanings to visual calendar cues; no new targets. | Same fixed visual-meaning task and zero new targets. |
| C — Sentence pattern + speaking | Add one grammar candidate after the words; speak the TIME + 是 + WEEKDAY frame before character recognition. New grammar: 1; new vocabulary/characters: 0. | After Slot D, recycle the same vocabulary and grammar to speak the frame. No new target. |
| D — Character recognition + SRS | Introduce six character forms for recognition after speaking; propose those exact character IDs as review items. New character recognition: 6. | Introduce the same six recognition candidates before speaking; propose those exact character IDs as review items. New character recognition: 6. |
| E — Integrated LEARN + REVIEW + REPAIR | Reuse only the earlier fixed target set; no new target. | Same integrated slot and fixed targets; no new target. |

All counts are transparent load descriptors, not validated child-capacity thresholds. Both variants propose six character forms in one slot, a notable unresolved load risk. Variant B has the higher first-slot load (two words, one receptive grammar candidate, six phonetic syllables). Variant A makes speaking precede script recognition; whether that is beneficial is unknown. The JSON records each slot's explicit skill/vocabulary/grammar/character groups (including empty arrays), prerequisites, alternatives, confidence, adaptive fit, risk flags, phonetic load, and separate listening, visual meaning, speaking, character recognition, script reading, writing, and SRS fields.

### Prerequisites and adaptive-selection boundary

- Both variants introduce the two vocabulary candidates in Slot A; Slot B depends on those exact targets.
- Variant A Slot C depends on the two vocabulary candidates; its candidate grammar is introduced there. Slot D depends on both vocabulary candidates and the copula candidate; Slot E depends on the exact prior vocabulary, grammar, and six character identities.
- Variant B Slot A includes receptive grammar. Slot D depends on the two vocabulary candidates and that grammar candidate. Slot C depends on those three candidates plus all six character-recognition candidates; Slot E reuses the same fixed target identities.
- These are fixed proposal orders. Adaptive recommendation may rank only within already-authorized policy; it must not choose, reorder, or invent the next lesson. No lesson-selection behavior is changed by this proposal.
- Slot E is a feasibility placeholder for integrated LEARN/REVIEW/REPAIR coverage, not an implementation of review policy or permission to complete a parent session. Exact task evidence, review completion, repair settlement, SRS effects, and session lifecycle need separate executable audits.

## Alternatives, confidence, and unresolved questions

Alternatives recorded per slot include teaching only 今天 first, deferring 是, showing print during visual matching, using whole-word instead of per-character SRS items, speaking before recognition, or omitting integrated modes. These choices change either first-slot load or the contract being tested. The JSON gives a reason and confidence/limitations for each slot and each full variant; overall confidence is **LOW** because there is no learner comparison and neither sequence is prescribed by the references.

### Curriculum questions for the Owner

1. Should the experiment compare Variant A's speak-before-script order with Variant B's receptive-grammar/recognition-before-speaking order, or should both be revised?
2. Is a single weekday plus the frame TIME + 是 + WEEKDAY a useful, age-appropriate hypothesis, given that the source evidence does not establish the sentence's naturalness or teaching value?
3. Should character recognition be evaluated as six individual SRS candidates, or should the experiment avoid asserting a character-level SRS grain until an executable content contract exists?

### Source, notation, and validation limits

- No unresolved source claim is promoted to `GREEN` by this proposal. TBCL and CCCC remain `REFERENCE_ONLY`; source evidence does not grant bulk reuse.
- CC-CEDICT item use is conditional on CC BY-SA 4.0 attribution and share-alike. It is not MIT. If the proposed record cannot preserve that boundary, do not publish it as a curriculum artifact.
- Zhuyin, child-facing notation, pronunciation media, visual assets, localization conventions, learner difficulty, speaking rubric, and real-child/device behavior are not covered. These require their own review or Owner/real-learner validation gates.
- Exact overlap with OCAC or other materials is `UNVERIFIED`; no derivative relationship is asserted or ruled out by this proposal.

## Required stop state

After Draft PR creation and exact-head advisory review, stop at **`AWAITING_OWNER_CURRICULUM_APPROVAL`**. Architect review is advisory only and cannot approve a target, settle a rights question, or substitute for an Owner-authored decision. Do not author Lessons A–E, mutate the approved graph, publish an executable pack, add more targets, expand Books 2–10, or start the next workstream until the Owner records `APPROVE A`, `APPROVE B`, `REVISE`, or `REJECT` against the reviewed proposal hash.
