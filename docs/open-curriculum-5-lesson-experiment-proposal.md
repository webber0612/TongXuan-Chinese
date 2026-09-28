# Open Curriculum: Five-Lesson Peer-Exchange Proposal

**Status: `PROPOSED` — not approved, not executable, and not a formal course.**

This proposal replaces the sequencing hypothesis in `prototype-five-weekday-2026-09-v1`, which the Owner explicitly marked `REVISE` for exact canonical SHA-256 `1bafad4a7db3b0af9cd5cda69284b73f6101edc64235d466390fb8f71c69f35a`. The hash-bound decision is recorded at [`prototype-five-weekday-2026-09-v1-revise.json`](../shared/open-curriculum/proposals/owner-decisions/prototype-five-weekday-2026-09-v1-revise.json). The old machine snapshot remains unchanged. The replacement is [`prototype-peer-exchange-2026-09-v2.json`](../shared/open-curriculum/proposals/prototype-peer-exchange-2026-09-v2.json), canonical SHA-256 `7877db1106d8fa69644e026648513a0d9eaa569d23a5860eb81e5ec76ab9d5be`.

The A–E identifiers in the existing schema now identify five ordered lessons. They are not capability/activity slots. Each lesson has its own new communicative outcome, targets, load, recycling, prerequisites, rationale, evidence links, alternatives, and uncertainty. All targets remain `PROPOSED`; the plan creates no executable lesson, learner-facing media, approved graph entry, mastery rule, or next-lesson authority.

## Evidence boundary

| Evidence source | What it supports | What it does not support |
| --- | --- | --- |
| [TBCL Level 1](https://coct.naer.edu.tw/page.jsp?ID=11) | Broad personal-life language, greetings, and basic personal information in listening/speaking. | A required self-name sentence, individual words, target counts, or lesson sequence. |
| [TBCL Level 2](https://coct.naer.edu.tw/page.jsp?ID=12) | Short personal/daily-life interaction; asking personal questions; discussing self/friends' interests. | This exact preference dialogue, an instructional order, or an evidence-backed load limit. |
| [CCCC child-context overview](https://tocfl.edu.tw/tocfl/index.php/test/cccc/list/1) | Child-centered context for non-native speakers ages 7–12; everyday/leisure contexts and cognitive/language development are relevant. | Any copied CCCC question, answer, test item, sequence, or vocabulary requirement. |
| [CC-CEDICT license and release](https://cc-cedict.org/editor/editor.php?handler=Download) and selected [MDBG/CC-CEDICT lookup for 喜歡](https://www.mdbg.net/chinese/dictionary?page=worddict&wdqb=like) | Selected traditional/simplified forms, Mandarin Pinyin, and basic lexical senses are referenced item by item in the machine proposal. CC BY-SA 4.0 attribution, change notice, and share-alike are retained. | Frequency, child familiarity, target priority, grammar, teaching sequence, or mastery. CC-CEDICT data is never relicensed under MIT. |

The cited lexical source supplies no usable frequency evidence for this plan. “Useful” below is a TongXuan hypothesis based on the communicative purpose, not a measured frequency ranking. TBCL and CCCC stay `REFERENCE_ONLY`; CC-CEDICT remains item-level CC BY-SA 4.0. No raw datasets, tables, sample questions, examples, or media are included. No OCAC lesson, title, material, or sequence was consulted. Non-contamination has not been benchmarked or certified.

## Shared five-lesson capability progression

| Lesson | New `WHAT-TO-LEARN` | New candidate targets | Why this capability (`whyThis`) | Why now (`whyNow` / prerequisite) | Recycled prerequisites | Evidence and uncertainty |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Return a greeting and say one's own name. | Vocabulary: `你好`, `我`, `叫`. Grammar: `我叫＋[own name]`. | A greeting and self-identification are short, usable personal-life outcomes that can open a peer interaction. | First lesson; no curricular target prerequisite. The name is a learner variable, not fixed content. | None. | TBCL L1 supports greetings/personal information. Choosing this sentence frame first is a TongXuan hypothesis. |
| L2 | Ask and answer a peer's name. | Vocabulary: `你`, `什麼`, `名字`. Grammar: `你叫什麼名字？` | The learner turns self-introduction into a two-way exchange by asking the same kind of personal information about a peer. | Requires L1's greeting, self-name frame, and turn-taking base; reuse `叫` rather than opening a parallel topic. | L1 greeting and self-name capability; `我`, `叫` and the turn-taking relationship. | TBCL L1/L2 support personal information and short personal questions. Exact wording and productive timing need language/child validation. |
| L3 | Tell an identified peer one personal preference. | Vocabulary: `喜歡`, `球` (one deliberately narrow example noun). Grammar: `我喜歡＋[one known choice]`. | Stating one preference lets the learner share an interest with a known peer using a short sentence. | Requires the L2 peer/name exchange; anchor one preference noun only to keep candidate content bounded. | L1–L2 social exchange, first-person reference, and named peer. | TBCL L2 interests and CCCC leisure context support the domain. The particular noun, child familiarity, and sentence frame are TongXuan hypotheses. |
| L4 | Ask what a peer likes and understand one answer. | Grammar: `你喜歡什麼？`; no new vocabulary. | A learner who can state a preference can now open the same topic for someone else and listen to their answer. | Requires L2 `你`/`什麼` and L3 `喜歡`/`球` plus a preference statement; transfer a familiar question word to personal interests. | L2 `你`/`什麼`; L3 `喜歡`/`球` and preference statement. | TBCL L2 supports personal questions and interest interaction. The transfer/order is a hypothesis; negative answers and additional choices are deliberately out of scope. |
| L5 | Return a preference question and sustain a short reciprocal peer exchange. | Grammar/discourse target: `你呢？` (`呢` as a return prompt); no new vocabulary. | Returning the question adds a new discourse move and enables an orderly multi-turn exchange rather than a review-only activity. | Requires L1 greeting/name exchange, L3 preference statement, and L4 question/answer; the learner reuses them in one conversation. | Integrates L1 greeting/name exchange, L3 preference statement, and L4 question/answer. | TBCL L2 supports interaction; CC-CEDICT supplies the particle's basic context. Whether this particle is a suitable first reciprocal prompt and its load are unvalidated TongXuan hypotheses. |

### Dependency chain

```text
L1 greet + self-identify
  → L2 exchange names with a peer
    → L3 state a preference to that identified peer
      → L4 ask about the peer's preference and understand the answer
        → L5 return the question and sustain the integrated exchange
```

The machine plan records the same dependency in the five proposed skill nodes and each lesson's target prerequisites. The chain is a proposed discourse progression; it is not a claim that TBCL mandates this order. Adaptive ranking may not select between variants, skip prerequisites, or autonomously choose Lesson 6.

## Variant strategies and per-lesson load

The two variants share the five real communicative outcomes and lexical/grammar progression. They compare curriculum strategies by when and how much script recognition is paired with already-heard language. They do not compare five activity orders over one sentence.

Counts below are **new vocabulary + new grammar + new character-recognition targets**; each lesson also adds one new communicative skill. Phonetic counts are new Pinyin syllable targets. Counts describe this proposal only and are not validated child-capacity thresholds.

| Lesson | Variant A — communication-first | A new targets V/G/C; phonetics | Variant B — balanced oral + recognition | B new targets V/G/C; phonetics |
| --- | --- | --- | --- | --- |
| L1 | `你好` + self-name; oral greeting and personal information, no new print. | 3 / 1 / 0; 4 | Same oral outcome; recognize `我` alongside its spoken use. | 3 / 1 / 1; 4 |
| L2 | Ask/answer a peer's name orally; defer print. | 3 / 1 / 0; 4 | Same name exchange; recognize `你` after oral introduction. | 3 / 1 / 1; 4 |
| L3 | State a preference using one example noun; defer print. | 2 / 1 / 0; 3 | Same preference outcome; recognize `球` in its heard-word context. | 2 / 1 / 1; 3 |
| L4 | Ask what the peer likes; now recognize `我` and `你`. | 0 / 1 / 2; 0 | Ask the same question; recognize both characters in the already-heard word `喜歡`. | 0 / 1 / 2; 0 |
| L5 | Use `你呢？` to return the question and complete the integrated exchange; recognize `名`, `字`, and `呢`. | 0 / 1 / 3; 1 | Same communicative outcome; add the same three forms after the oral interaction is established. | 0 / 1 / 3; 1 |

The new vocabulary counts are **3, 3, 2, 0, 0** and new grammar counts **1, 1, 1, 1, 1** in both variants. New character counts are A **0, 0, 0, 2, 3** and B **1, 1, 1, 2, 3**. The B path has earlier print links; it does not require recognition to precede or replace listening/speaking. Both paths have the same oral prerequisite chain.

Recycling is explicit in the machine plan: new-vocabulary counts across L1–L5 are `3/3/2/0/0`; previously taught vocabulary is revisited as `0/3/6/8/8` candidates; prior grammar is revisited as `0/1/2/3/4` candidates. The SRS candidate grain is a whole lexical item, never the characters composing it.

## Word SRS, character recognition, and writing are separate

- **Whole-word SRS candidate:** lesson `srsReviewTargets` contain only previously taught `VOCABULARY` IDs such as `vocab-nihao` and `vocab-xihuan`. This is a proposed content grain only; intervals, rating thresholds, mastery settlement, and actual SRS behavior are not changed or approved here.
- **Character recognition:** the A/B `characterRecognitionTargets` are separate optional visual-recognition candidates attached to already-heard forms. Recognizing `喜` and `歡` does not claim independent word knowledge or character mastery.
- **Character-level SRS:** `UNRESOLVED`. No character ID appears in any SRS list. The framework and lexical lookup do not justify character-level review or mastery units.
- **Writing:** no writing target is proposed. Recognition does not imply writing; no copy, stroke order, handwriting, or productive character requirement is created.
- **Phonetics:** the load lists Pinyin syllables because CC-CEDICT supplies Pinyin. Zhuyin is `SOURCE_INSUFFICIENT` in this proposal; no Zhuyin mapping or child-facing notation policy is approved.

## Framework-derived evidence versus TongXuan hypotheses

**Framework-derived evidence:** beginner learners need personal-life words/phrases and greetings (TBCL L1); short personal questions and short interaction about interests are described at TBCL L2; CCCC is child-centered for ages 7–12 and spans everyday/leisure contexts. CC-CEDICT supports selected item forms, Pinyin, and basic senses under CC BY-SA 4.0.

**TongXuan hypotheses:** the peer-meeting theme; selecting each word, question, `球`, and `呢`; their order and prerequisites; one lexical noun as the load limit; receptive/listening and productive turn outcomes; the recycling schedule; both recognition strategies; one whole-word SRS candidate per vocabulary node; and the estimate that the five lessons are small enough to test. None is elevated to an approved curriculum decision by evidence citation or Architect review.

## Next-target rule and limits beyond five lessons

1. No Lesson 6 target is selected by completing L5. A later plan must start from an Owner-approved, frozen target graph and produce competing proposals, not an AI-improvised next topic.
2. A candidate next target needs explicit authority/provenance, learner capability relevance, required prerequisites, an explainable utility rationale, manageable new/recycled load, and alternatives. A source lookup alone is not sequencing evidence.
3. The highest risk at 20 lessons is uncontrolled growth: weak utility/frequency ranking can multiply loosely linked targets; prerequisite edges and recycling may become unreviewable; recognition, reading, and writing may collapse into one load measure. Current evidence provides no automatic target budget or density threshold.

## Up to five unresolved curriculum questions

1. Is the name → preference → reciprocal-turn path a useful five-lesson progression for the intended children, or is the transition to preferences too large?
2. Is `球` familiar and useful enough as the single noun anchor? No cited source measures its child familiarity or frequency.
3. Is `你呢？` a natural and age-appropriate first reciprocal prompt in the intended Taiwan Mandarin context?
4. Does Variant B's early print pairing help, and are L2/L5 recognition loads acceptable? No controlled or real-child comparison exists.
5. Is whole-word SRS an appropriate future review unit for these candidates? Character-level SRS remains `UNRESOLVED`; no review timing or mastery policy is proposed.

## Hard stop

The Owner's `REVISE` applies only to the exact v1 hash above. This replacement remains `PROPOSED`, with `ownerDecision: null`; it does not choose Variant A or B, promote a graph, create executable Lessons 1–5, or authorize Lessons 6+. After exact-head advisory review, stop at **`AWAITING_OWNER_CURRICULUM_APPROVAL`**. Architect review is advisory and cannot substitute for curriculum, legal, or Owner approval.
