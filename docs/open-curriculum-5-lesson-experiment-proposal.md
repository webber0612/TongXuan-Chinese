# Open Curriculum: Five-Lesson Peer-Exchange Proposal

**Status: `PROPOSED` — not approved, not executable, and not a formal course.**

The Owner accepted the cumulative five-lesson direction in v2 but marked the exact v2 snapshot `REVISE` for (1) L3's lexical choice and (2) dependency semantics. The hash-bound record is [`prototype-peer-exchange-2026-09-v2-revise.json`](../shared/open-curriculum/proposals/owner-decisions/prototype-peer-exchange-2026-09-v2-revise.json), bound to v2 SHA-256 `7877db1106d8fa69644e026648513a0d9eaa569d23a5860eb81e5ec76ab9d5be`. v1 and v2 remain immutable historical proposals. The Owner then marked exact v3 hash `b5ff4050fd107220926f15f403a2d68a0895f30694a628704d7faa594bafb097` `REVISE — L3 LEXICAL SELECTION ONLY`; the record is [`prototype-peer-exchange-2026-09-v3-revise.json`](../shared/open-curriculum/proposals/owner-decisions/prototype-peer-exchange-2026-09-v3-revise.json).

The current replacement is [`prototype-peer-exchange-2026-09-v4.json`](../shared/open-curriculum/proposals/prototype-peer-exchange-2026-09-v4.json), canonical SHA-256 `1d72be175f30b3b7a520a6f581b3dea286ecd103ffde84b2e99d5d282ecf270d`. Its schema v2 distinguishes `HARD_PREREQUISITE`, `PEDAGOGICAL_SEQUENCE`, `RECYCLED_CONTEXT`, and `ASSUMED_KNOWN`. Only explicit, justified lesson hard prerequisites may block entry. Earlier lesson appearance does not create a prerequisite. All target records remain `PROPOSED`; the plan creates no executable lesson, approved graph entry, learner-facing content, mastery rule, or next-lesson authority.

## L3 lexical decision gate

L3 proposes the communicative capability “state a preference,” with the frame `我喜歡＋玩具`. The machine-readable gate `l3-preference-object` records the selection as `OWNER_CURRICULUM_DECISION`, with `selectedTargetId: vocab-wanju`. The exact v3 Owner decision record is the source of this selection. The overall proposal remains `PROPOSED`; selecting this noun does not approve Variant A/B or promote any target.

| Candidate | Item-level dictionary support | v4 status |
| --- | --- | --- |
| `玩具` | CC-CEDICT/MDBG form, Pinyin, basic sense | Active L3 target by Owner decision / TongXuan hypothesis. |
| `球` | CC-CEDICT/MDBG form, Pinyin, basic sense | Retained as comparison provenance; inactive target. |
| `書` | CC-CEDICT/MDBG form, Pinyin, basic sense | Retained as comparison provenance; inactive target. |
| `遊戲` | CC-CEDICT/MDBG form, Pinyin, basic sense | Retained as comparison provenance; inactive target. |
| `電影` | CC-CEDICT/MDBG form, Pinyin, basic sense | Retained as comparison provenance; inactive target. |

The Owner selected `玩具` because `我喜歡玩具` is a complete direct-noun preference statement; it needs no additional verb or classifier/measure-word grammar; it is concrete and visualizable; and the Owner judges it suitable for a child context without complex cultural background. Relative to the alternatives, the Owner prefers it because `球` may invite `打球`, `遊戲` may invite `玩遊戲`, `電影` is less directly tied to children's everyday lives, and `書` is less suitable as a neutral concrete-interest example for this prototype. This is an Owner curriculum decision / TongXuan hypothesis, not an evidence-backed universal ranking.

The [CC-CEDICT/MDBG source](https://www.mdbg.net/chinese/dictionary?lang=en&page=cc-cedict) supplies lexical form, Pinyin, basic meaning, and provenance under CC BY-SA 4.0, with attribution and share-alike. Its item lookup does not prove that `玩具` is the best beginner word or establish frequency, child familiarity, cognitive burden, or sequence. TBCL and CCCC do not establish that it is the best choice either. Other candidates and their comparison notes stay in the proposal as provenance and are not active targets.

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
| L3 | None; asking/answering a name is not required to state a preference. | L2 | Peer address and a self-name cue for an extended dialogue. | Name-exchange skill; identify the peer with a name card/model if missing. If `我` is missing, cue the learner as speaker, model it with audio, and rehearse `我喜歡` before preference production. |
| L4 | None; stating one’s preference is not required to ask what a peer likes. | L3 | `你` / `什麼` / `喜歡` / `玩具` and the preference topic. | Preference-statement skill; provide a model line if missing. Also model `你`, `喜歡`, and `什麼` with a peer cue, replayed audio, and a simple visual choice set before the question task. |
| L5 | Ask/answer names; state a preference; ask/answer a peer preference. | L1–L4, as the selected integrated teaching sequence. | Name and preference exchanges, including `玩具`, from earlier slots. | None; the three integrated communication capabilities are hard gates. |

The graph deliberately does not expand into “L5 requires every L1–L4 target.” A future selector could skip a pedagogical predecessor when the exact hard capabilities are authoritative; this proposal contains no selector implementation and does not authorize autonomous next lessons.

## Variant A and B

The accepted strategies are retained:

- **Variant A — Communication-first:** spoken language precedes selected character recognition.
- **Variant B — Oral + recognition balanced:** a small number of character-recognition links accompany already heard language.

Both retain the same L1–L5 oral capabilities and grammar path, and no third variant is created. The only lexical-path substitution is the Owner-selected `玩具` target in L3, recycled in L4/L5 and included in subsequent whole-word SRS review. L3 new vocabulary changes from one to two items and its proposed phonetic syllables change from three to four (`xǐ`, `huan`, `wán`, `jù`). B's recognition pairing and counts remain unchanged: A `[0,0,0,2,3]`, B `[1,1,1,1,3]`; B pairs recognition with already heard language. Recognition, reading, and writing remain distinct. No writing is proposed; character SRS remains unresolved.

## Verification contracts in the proposal tests

The tests verify that:

1. prior lesson targets are not auto-converted into hard prerequisites;
2. every hard edge has a rationale;
3. recycled targets may remain non-hard;
4. pedagogical order can differ from the blocking hard graph;
5. theoretical fast-track eligibility depends only on exact lesson hard edges, and each new grammar target's required lexical components are introduced in the lesson or have an explicit scaffold when missing;
6. L3 uses only the Owner-selected direct nominal target `玩具`; the Owner record, not external source claims, supplies the selection. Other lexical candidates stay inactive provenance. The exact v4 delta is limited to that lexical choice and its derived L3 load/phonetics, later recycling/SRS, and explanatory metadata.

These checks validate proposal data and the conceptual fast-track rule only; they do not implement or test a production adaptive engine.

## Evidence and rights boundary

TBCL Level 1/2 supports broad beginner personal-life language, greetings, personal questions, and interest interaction, not this exact lesson order, exact word choice, or mastery thresholds. CCCC supports broad non-native child context and leisure domains, not a specific word's frequency or familiarity. CC-CEDICT supplies the `玩具` form/Pinyin/basic sense under CC BY-SA 4.0; this data is never relicensed under repository MIT. The Owner decision is explicitly a TongXuan hypothesis and is not attributed to those sources. TBCL and CCCC remain `REFERENCE_ONLY`. No raw dataset or substantial excerpt is included, and no OCAC material or sequence was consulted.

## Hard stop

The v4 replacement remains `PROPOSED`, with `ownerDecision: null`; the lexical decision does not approve Variant A/B, promote graph targets, authorize executable lesson generation, L1 implementation, or Lesson 6+. After exact-head advisory review, stop at **`AWAITING_OWNER_CURRICULUM_APPROVAL`**. Architect review is advisory and cannot substitute for Owner approval.
