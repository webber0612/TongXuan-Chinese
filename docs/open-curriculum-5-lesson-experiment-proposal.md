# Open Curriculum: Five-Lesson Peer-Exchange Proposal

**Status: `PROPOSED` — not approved, not executable, and not a formal course.**

The Owner accepted the cumulative five-lesson direction in v2 but marked the exact v2 snapshot `REVISE` for (1) L3's lexical choice and (2) dependency semantics. The hash-bound record is [`prototype-peer-exchange-2026-09-v2-revise.json`](../shared/open-curriculum/proposals/owner-decisions/prototype-peer-exchange-2026-09-v2-revise.json), bound to v2 SHA-256 `7877db1106d8fa69644e026648513a0d9eaa569d23a5860eb81e5ec76ab9d5be`. v1 and v2 remain immutable historical proposals.

The current replacement is [`prototype-peer-exchange-2026-09-v3.json`](../shared/open-curriculum/proposals/prototype-peer-exchange-2026-09-v3.json), canonical SHA-256 `0406565582401c0c7b976ff91c86849a6f196ab3f01d546287283cbf16d58b87`. Its schema v2 distinguishes `HARD_PREREQUISITE`, `PEDAGOGICAL_SEQUENCE`, `RECYCLED_CONTEXT`, and `ASSUMED_KNOWN`. Only explicit, justified lesson hard prerequisites may block entry. Earlier lesson appearance does not create a prerequisite. All target records remain `PROPOSED`; the plan creates no executable lesson, approved graph entry, learner-facing content, mastery rule, or next-lesson authority.

## L3 lexical decision gate

L3 continues to propose the communicative capability “state a preference,” with the frame `我喜歡＋[直接名詞補語]`. It adds `喜歡`, but no noun is selected. The machine-readable gate is `l3-preference-object` with status `OWNER_LEXICAL_DECISION_REQUIRED`.

| Candidate | Item-level dictionary support | Remaining issue |
| --- | --- | --- |
| `球` | CC-CEDICT/MDBG form, Pinyin, basic sense | Owner questions whether it is a natural, child-common direct preference object. |
| `玩具` | CC-CEDICT/MDBG form, Pinyin, basic sense | Concreteness is plausible, but age familiarity, naturalness, and semantic burden are not evidenced. |
| `書` | CC-CEDICT/MDBG form, Pinyin, basic sense | Individual book/literacy interest and frame fit are not evidenced. |
| `遊戲` | CC-CEDICT/MDBG form, Pinyin, basic sense | Direct bare-noun naturalness for the intended preference is unverified. |
| `電影` | CC-CEDICT/MDBG form, Pinyin, basic sense | Child exposure/familiarity and instructional value are unverified. |

The [CC-CEDICT/MDBG source](https://www.mdbg.net/chinese/dictionary?lang=en&page=cc-cedict) supplies lexical forms and glosses under CC BY-SA 4.0, with attribution and share-alike; the item lookups do not rank frequency, learner familiarity, naturalness in this frame, cognitive burden, or sequence. The CCCC reference supports broad child-life/leisure context only, not any of these exact words. Therefore no unique lexical choice is supported. No option is promoted. The gate requires direct-frame language review, child-fit evidence, low semantic burden, no new classifier/measure-word construction, no complex cultural knowledge, provenance, and beginner difficulty evidence before selection.

This does not add another grammar target: the proposal retains one direct nominal slot and no additional verb or classifier target. The exact naturalness of any candidate remains unresolved, so the proposal stays non-executable and requires the Owner's lexical decision.

## Relationship semantics

| Relation | Meaning | Can block lesson entry? |
| --- | --- | --- |
| `hardPrerequisites` | Necessary learner capability; every edge has a rationale answering why the new capability cannot reasonably be understood or performed without it. | Yes, the only lesson-entry blocker. |
| `pedagogicalPredecessors` | The chosen order for this proposal. A prior lesson can be helpful without being a language requirement. | No. |
| `recycledContext` | Earlier words, grammar, or skills intentionally reused in the dialogue. | No. |
| `assumedKnown` | Material expected to have been encountered, with an explicit scaffold if it is missing. | No. |

`skillCatalog` and grammar candidate dependencies also use typed, rationale-bearing hard edges for their own capability/composition contracts. Those edges are not inferred from lesson order. A target listed for recycling is not thereby a lesson hard prerequisite.

## L1–L5 relationship review

These relationships are shared by Variants A and B.

| Lesson | Hard prerequisites | Pedagogical sequence | Recycled context | Assumed known / scaffold |
| --- | --- | --- | --- | --- |
| L1 | None | None | None | None |
| L2 | None; name-question components are introduced or scaffolded in the lesson. | L1 | Greeting and self-name phrase. | L1 words/frame; audio cue and phrase strip if missing. |
| L3 | None; asking/answering a name is not required to state a preference. | L2 | Peer address and a self-name cue for an extended dialogue. | Name-exchange skill; identify the peer with a name card/model if missing. |
| L4 | None; stating one’s preference is not required to ask what a peer likes. | L3 | `你` / `什麼` / `喜歡` and the preference topic. | Preference-statement skill; provide a model line if missing. |
| L5 | Ask/answer names; state a preference; ask/answer a peer preference. | L1–L4, as the selected integrated teaching sequence. | Name and preference exchanges from earlier slots. | None; the three integrated communication capabilities are hard gates. |

The graph deliberately does not expand into “L5 requires every L1–L4 target.” A future selector could skip a pedagogical predecessor when the exact hard capabilities are authoritative; this proposal contains no selector implementation and does not authorize autonomous next lessons.

## Variant A and B

The accepted strategies are retained:

- **Variant A — Communication-first:** spoken language precedes selected character recognition.
- **Variant B — Oral + recognition balanced:** a small number of character-recognition links accompany already heard language.

Both retain the same L1–L5 oral capabilities and lexical/grammar path, and no third variant is created. Since `球` is no longer an active target, B's recognition pairing uses `喜` in L3 and `歡` in L4; counts are A `[0,0,0,2,3]`, B `[1,1,1,1,3]`. This preserves the recognition strategy while keeping recognition, reading, and writing distinct. No writing is proposed; character SRS remains unresolved.

## Verification contracts in the proposal tests

The tests verify that:

1. prior lesson targets are not auto-converted into hard prerequisites;
2. every hard edge has a rationale;
3. recycled targets may remain non-hard;
4. pedagogical order can differ from the blocking hard graph;
5. theoretical fast-track eligibility depends only on exact hard edges;
6. L3 keeps a direct nominal slot without adding an undeclared verb/classifier grammar target; lexical naturalness and familiarity remain explicitly unresolved rather than falsely asserted.

These checks validate proposal data and the conceptual fast-track rule only; they do not implement or test a production adaptive engine.

## Evidence and rights boundary

TBCL Level 1/2 supports broad beginner personal-life language, greetings, personal questions, and interest interaction, not this exact lesson order or mastery thresholds. CCCC supports broad non-native child context and leisure domains, not a specific word's frequency or familiarity. CC-CEDICT item lookups supply form/Pinyin/basic sense under CC BY-SA 4.0; data is never relicensed under repository MIT. TBCL and CCCC remain `REFERENCE_ONLY`. No raw dataset or substantial excerpt is included, and no OCAC material or sequence was consulted.

## Hard stop

The v3 replacement remains `PROPOSED`, with `ownerDecision: null`; no Variant A/B approval, graph promotion, executable lesson generation, L1 implementation, or Lesson 6+ is authorized. After exact-head advisory review, stop at **`AWAITING_OWNER_CURRICULUM_APPROVAL`**. Architect review is advisory and cannot substitute for Owner approval.
