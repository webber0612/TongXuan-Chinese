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

[`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json) is the source-of-truth registry for curriculum sources. Each source record contains source/authority identity, ownership, license scope, commercial/modification/redistribution/attribution/share-alike/raw-ingestion/public-repository/derivative permissions, validation-only and item-level flags, evidence records, a policy decision, verification date, and constraints. Every rights decision links its evidence IDs to records containing the evidence URL, locator, observation date, capture method, supported claim types, a SHA-256 of the UTF-8 response-text representation when captured, and a concise claim summary. Evidence records store no third-party corpus rows or substantial source excerpts.

The registry's `rightsDecision` joins the evidence to the project's operational decision. Its outcome must match `legalStatus` exactly:

| Status | Pipeline behavior |
| --- | --- |
| `GREEN` + `ALLOW_WITH_ITEM_CHECKS` | May be considered only within evidence-backed terms and item-level conditions. This is not a blanket rights conclusion. |
| `YELLOW` + `REFERENCE_ONLY` | Cite/reference only. No conversion to publishable content. |
| `RED` + `BLOCK` | Do not ingest or use for current product content. |
| `UNKNOWN` + `UNKNOWN_BLOCKED` | Fail closed; do not ingest or publish until evidence supports a different policy outcome. |

Conditional licenses are represented as `GREEN` plus explicit item-level checks and constraints; there is no extra `GREEN_WITH_CONDITIONS` status. A GREEN record must have linked license/terms evidence and known source-level permissions. Missing evidence, a validation-only record, UNKNOWN permission, or a mismatched decision downgrades the registry validation result. `UNKNOWN != GREEN`.

### First registered sources

- **OCAC / Let's Learn Mandarin (For Children): YELLOW / `REFERENCE_ONLY`.** Cite source metadata only. The source page is not treated as a public-repository, adaptation, or commercial license. No OCAC-derived text, vocabulary, exercise, image, audio, or close rewrite enters a publishable pack without a separately recorded grant and approval.
- **TBCL: YELLOW / `REFERENCE_ONLY`.** Framework descriptions may support cited validation only. Bulk lists are not mirrored.
- **TOCFL / CCCC: YELLOW / `REFERENCE_ONLY`.** Keep question banks and attached media out of publishable packs. This verification did not establish a current item-level reuse grant; it also did not re-verify an earlier note about non-commercial use, so no current legal conclusion is recorded.
- **CC-CEDICT: GREEN / `ALLOW_WITH_ITEM_CHECKS`, CC BY-SA 4.0.** Official download-page and license-deed evidence is recorded. Keep attribution, change notices, compatible share-alike terms, item/version provenance, and license scope; never apply the root MIT license to derived content.
- **Tatoeba: GREEN / `ALLOW_WITH_ITEM_CHECKS`.** Official terms distinguish sentence text from contributor audio. Verify the license, attribution, and conditions per sentence and separately per audio contributor. No corpus-wide item clearance is implied.
- **Mozilla Common Voice: UNKNOWN / `UNKNOWN_BLOCKED`.** The current official terms endpoint returned an application shell without extractable operative clauses in the verification capture. Earlier CC0/access claims are not carried forward as current; no data or audio may be ingested until the terms can be verified.
- **TongXuan-authored material: UNKNOWN / `UNKNOWN_BLOCKED` at source level.** A source-wide grant is not asserted. Each content item still needs authorship/contributor rights evidence; original-authorship claims do not establish level, prerequisites, target approval, or curriculum authority.

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

See [`docs/content-rights-audit.md`](content-rights-audit.md) and machine-readable [`shared/content-sources/public-repo-audit.json`](../shared/content-sources/public-repo-audit.json) for the current tracked-tree inventory and classification boundaries. [`scripts/open_curriculum_rights_gate.py`](../scripts/open_curriculum_rights_gate.py) verifies inventory coverage, evidence references, digest drift, root-MIT separation, and publishable pack/path rejection. See [`docs/open-curriculum-experiment-proposal.md`](open-curriculum-experiment-proposal.md) for the proposed five-slot experiment structure; it contains no selected official targets or executable lessons.

## Official references checked on 2026-09-28

- [OCAC / HuayuWorld series page](https://www.huayuworld.org/Ebook/LearnMandarinChildren) describes textbooks, text, images, audio, and downloadable teaching material. No blanket repository license is asserted here.
- [TBCL official site](https://bcoct.naer.edu.tw/TBCL/) describes level indicators and vocabulary/character/grammar lists. This policy does not bulk reproduce those lists.
- [CCCC official question-bank page](https://tocfl.edu.tw/tocfl/index.php/test/cccc/list/7) identifies question-bank resources. This capture did not verify item-level redistribution rights or the prior non-commercial-use note.
- [CC-CEDICT download page](https://cc-cedict.org/editor/editor.php?handler=Download) identifies CC BY-SA 4.0; see the [license deed](https://creativecommons.org/licenses/by-sa/4.0/).
- [Tatoeba terms](https://tatoeba.org/en/terms_of_use), [corpus reuse guidance](https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus), and [audio license guidance](https://en.www.en.wiki.tatoeba.org/articles/show/faq) distinguish sentence text from contributor audio and explain item-level conditions.
- [Mozilla Common Voice terms](https://commonvoice.mozilla.org/en/terms) resolved to an HTML application shell in this capture; operative dataset terms were not extracted, so the source is `UNKNOWN` and blocked.

Response digests and evidence locators are in the source registry. HTTP digests cover the UTF-8 re-encoded response-text representation, not the wire bytes. They do not constitute a license, preserve the underlying page, or prove the claim summary by themselves. For the OCAC page, direct HTTP retrieval returned an access challenge, so the evidence record identifies the browser-rendered source reference and has no response digest.

This is an engineering gate, not a legal opinion. Legal or commercial decisions remain outside Codex’s authority.
