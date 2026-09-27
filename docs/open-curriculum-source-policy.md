# Open Curriculum source and authority policy

## Authority boundary

The curriculum pipeline is:

```text
AUTHORITATIVE FRAMEWORK / LEGALLY USABLE SOURCES
→ CURRICULUM GRAPH
→ AI PROPOSAL
→ AUTOMATED VALIDATION
→ HUMAN / ARCHITECT APPROVAL
→ EXECUTABLE LESSON
```

`AI_PROPOSES_HUMAN_APPROVES`: AI/Codex may collect evidence and propose sequencing, targets, examples, exercises, and prerequisite relationships. It may not turn those proposals into official learning targets or executable curriculum by itself.

`NO_UNSOURCED_CURRICULUM_DECISION`: each proposed or approved target records its identity and type, evidence and source provenance, authority type, difficulty evidence, prerequisite evidence, rationale, and review status. “Plausible for beginners” and “the next textbook lesson” are not evidence.

`NO_AUTONOMOUS_NEXT_LESSON`: completing lesson N never authorizes Codex to choose lesson N+1. The next targets must come from an approved Curriculum Graph and plan.

## Source registry

[`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json) is the source-of-truth registry for curriculum sources. Each record captures the source, authority and evidence roles, license statement and scope, use permissions, legal status, verification date, and constraints. `legalStatus` is restricted to:

| Status | Pipeline behavior |
| --- | --- |
| `GREEN` | May be considered only within its recorded license and access conditions. Item-level checks still apply when the record says they do. |
| `YELLOW` | Reference and cite only. No bulk ingestion or public-repository redistribution while rights are unclear. |
| `RED` | Do not ingest or use for current product content. |
| `UNKNOWN` | Do not ingest until status and terms are verified. |

Conditional licenses are represented as `GREEN` plus explicit constraints; there is no extra `GREEN_WITH_CONDITIONS` status. `GREEN` is an operational intake status, not legal advice or a blanket rights conclusion.

### First registered sources

- **OCAC / Let's Learn Mandarin (For Children): YELLOW.** Cite verified source metadata as needed. The public page describes downloadable textbooks and teaching aids, but this registry does not infer a public-repository, adaptation, or commercial license from availability. No new OCAC-derived authoring, textbook text, vocabulary list, exercise, image, audio, or close rewrite is allowed until the relevant permission is recorded.
- **TBCL: YELLOW.** Use framework descriptions for reference, validation, and cited evidence. Do not mirror the full character, word, or grammar lists.
- **TOCFL / CCCC: YELLOW.** Use level and format references. The official CCCC question-bank page says the bank is for learning and not commercial use; do not mirror test items, answer keys, audio, or images.
- **CC-CEDICT: GREEN with CC BY-SA 4.0 conditions.** Preserve attribution and share-alike obligations and keep derived material out of the root MIT license.
- **Tatoeba: GREEN with per-item conditions.** Verify text license per sentence and audio license separately per contributor. The corpus default for text does not determine a given item’s license, and text and audio do not necessarily share terms.
- **Mozilla Common Voice: GREEN with access conditions.** Although datasets are offered under CC0, current terms direct access through Mozilla Data Collective and request no rehosting, distributing, or mirroring. Do not commit dataset files or rows here.
- **TongXuan-authored material: GREEN only with item-level authorship/rights evidence.** Original-authorship provenance does not establish learning level, prerequisites, target approval, or curriculum authority.

The existing [`data/license-registry.json`](../data/license-registry.json) remains for technical dependencies, assets, and commercialization tracking. It uses a different status vocabulary and must not be treated as the curriculum source registry.

## Curriculum Graph approval states

All graph nodes and proposed targets use exactly these states:

- `PROPOSED`: candidate only; cannot enter an executable or publishable pack.
- `EVIDENCE_CHECKED`: evidence and source references have been checked; approval is still required.
- `ARCHITECT_APPROVED`: eligible for inclusion, subject to pack validation and source license constraints.
- `REJECTED`: cannot be included.

The node schemas live in [`shared/open-curriculum/schemas/`](../shared/open-curriculum/schemas/). A curriculum change is represented as a proposal; it does not mutate an approved graph until a human explicitly accepts it.

## Content intake and publication rules

1. Register a source before adding source-derived content. Record an item-level license where the source requires it.
2. Store source identifiers and concise citations as evidence. Do not store a YELLOW source’s raw content as a shortcut for evidence.
3. Preserve the source’s license, attribution, share-alike, and access requirements on each item and derived pack.
4. Include only approved graph target IDs in a publishable pack. Every target must have source provenance, difficulty and prerequisite evidence, and rationale.
5. Keep AI-created examples bounded by the explicitly approved graph and learner-known vocabulary. Submit any new target as a `CURRICULUM_CHANGE_PROPOSAL`.
6. If rights evidence is missing or a source is `RED` / `UNKNOWN`, fail closed. If an audit finds a potentially substantial source reproduction, preserve the files, stop curriculum implementation, and ask the Architect to review the exact paths. Do not make a legal finding or rewrite Git history.
7. Existing course data may remain as an engineering regression fixture during review, but it is not thereby approved or cleared for public/commercial curriculum use.

## Current audit references

See [`docs/content-rights-audit.md`](content-rights-audit.md) for the current tracked-tree inventory and its classification boundaries. See [`docs/open-curriculum-experiment-proposal.md`](open-curriculum-experiment-proposal.md) for the proposed five-slot experiment structure; it contains no selected official targets or executable lessons.

## Official references checked on 2026-09-27

- [OCAC / HuayuWorld series page](https://www.huayuworld.org/Ebook/LearnMandarinChildren) describes textbooks, text, images, audio, and downloadable teaching material. No blanket repository license is asserted here.
- [TBCL official site](https://bcoct.naer.edu.tw/TBCL/) describes level indicators and vocabulary/character/grammar lists. This policy does not bulk reproduce those lists.
- [CCCC official question-bank page](https://tocfl.edu.tw/tocfl/index.php/test/cccc/list/7) states the bank is for learning use and not commercial use.
- [CC-CEDICT download page](https://cc-cedict.org/editor/editor.php?handler=Download) identifies CC BY-SA 4.0; see the [license deed](https://creativecommons.org/licenses/by-sa/4.0/).
- [Tatoeba terms](https://tatoeba.org/en/terms_of_use), [corpus reuse guidance](https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus), and [audio license guidance](https://en.www.en.wiki.tatoeba.org/articles/show/faq) distinguish sentence text from contributor audio and explain item-level conditions.
- [Mozilla Common Voice terms](https://commonvoice.mozilla.org/en/terms) describe CC0 datasets and the Mozilla Data Collective access / no-mirroring conditions.

This is an engineering gate, not a legal opinion. Legal or commercial decisions remain outside Codex’s authority.
