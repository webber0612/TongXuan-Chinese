# Repository content-rights audit — 2026-09-27

## Scope and method

This is a static source/provenance inventory of the tracked current tree at main baseline `52a20eaf35099044ef519b720bcfc6a25a3a998c`. It searched tracked paths and source references for curriculum text, official titles/objectives, vocabularies, questions, teacher-handbook metadata, image/audio files, and data formats; inspected the existing content license registry, curriculum audit, representative lesson packages, and legacy lesson data. It did not inspect or rewrite Git history, ingest any source download, run a semantic similarity model, or make a legal determination.

The official OCAC series page says it provides textbooks and downloadable text, high-resolution textbook images, audio, and teaching slide decks. This audit therefore does not treat public availability as permission to redistribute those materials. See the [official series page](https://www.huayuworld.org/Ebook/LearnMandarinChildren).

## Classification key

- `SAFE_METADATA`: narrow source/title/order/URL facts recorded as metadata; not a permission finding for associated content.
- `FAIR_USE_CANDIDATE`: reserved for material an Architect may separately assess; it is not a legal conclusion or automatic publishing permission.
- `PERMISSION_REQUIRED`: rights or item-level permission are not recorded for the intended repository/product use.
- `REMOVE_FROM_PUBLIC_REPO`: a future confirmed finding that the public tree contains material that must be removed; this audit does not make that finding.
- `NEEDS_ARCHITECT_REVIEW`: source boundary, authorship, or a documentation claim needs technical/editorial verification before future use.

## Findings

| Tracked path or group | Observed material | Classification | Action in this phase |
| --- | --- | --- | --- |
| `shared/validated-curriculum-slice.json` | OCAC course/book/lesson titles, order, URLs, and paraphrased teacher-handbook objectives for Starter, Basic, and Book 1 lessons 1–3. The Starter L1 and Basic L1 titles conflict with the corresponding package metadata; this audit did not independently resolve which record is correct. | Non-conflicting source identifiers/URLs: `SAFE_METADATA`; disputed title/order fields and objective paraphrases: `NEEDS_ARCHITECT_REVIEW`; future product reuse of paraphrases remains `PERMISSION_REQUIRED`. | Kept unchanged. Do not treat disputed metadata as verified, an approved target graph, or a permission record. |
| `shared/lesson-packages/book1-l01.json` | The `OFFICIAL_OCAC` package is about 25 KB and contains two dialogue blocks, vocabulary entries and usage examples, sentence patterns, objectives, task text, hints, questions, and explanations. These fields lack item-level authorship/source attribution; package-level `TONGXUAN_PEDAGOGY_WRAPPER` does not establish who authored each string. | `PERMISSION_REQUIRED` and `NEEDS_ARCHITECT_REVIEW`. The tracked tree alone cannot establish copying or authorship. | Kept unchanged. Architect must compare the exact package against its source and resolve item-level provenance before any new curriculum is based on it. No legal conclusion is made. |
| `shared/lesson-packages/starter-l01.json` through `starter-l05.json`, `basic-l01.json` | Executable packages use OCAC course metadata; some newer practice items are labeled TongXuan-authored. Starter/Basic L1 have less granular item-level provenance, and the Starter L1 / Basic L1 titles conflict with the validated slice index. | `NEEDS_ARCHITECT_REVIEW`; any unlicensed source-derived text remains `PERMISSION_REQUIRED`. | Kept unchanged as engineering regression fixtures only. No lesson authoring, deletion, or target promotion. |
| `frontend/src/data/ocacTextbooksData.ts`, `learningPathData.ts`, `hanzi5000Database.ts`, `officialCoursePath.ts`, and other `frontend/src/data` records | Legacy sample stories, word/character entries, learning-path and course mappings, and quiz-like data. File comments and item records do not consistently establish authorship, source, and reuse rights. | `NEEDS_ARCHITECT_REVIEW`; do not treat as authoritative curriculum or reuse as a public curriculum source without item-level audit. | Kept unchanged; no semantic source-match claim. These remain engineering fixtures or legacy data until reviewed. |
| `data/commercialization-inventory.json`, `data/license-registry.json`, and `docs/curriculum-audit-v1.md` | The previous content scope did not enumerate nested lesson packages or legacy frontend data. Prior wording that no dialogue/exercise text was copied, and the claim that this title slice was verified, were stronger than the baseline supports. | `NEEDS_ARCHITECT_REVIEW`. | Corrected this audit trail and expanded the source inventory coverage. Exact provenance and title conflicts remain unresolved. No history rewrite. |
| Bundled image, font, and sound assets | Existing registry marks image/font ownership or redistribution rights for review; no asset is newly cleared by this audit. | `NEEDS_ARCHITECT_REVIEW` for item-level ownership/license; no textbook artwork/audio was identified by filename scan. | No asset changes. Do not infer asset clearance from this scan. |
| Tracked PDFs, spreadsheets, slides, and audio datasets | The tracked-path scan found no `.pdf`, `.xls/.xlsx`, `.ppt/.pptx`, `.mp3`, or `.wav` files. | No bulk raw-source corpus was found in those tracked file types. | No downloads or ingestion. This extension scan does not rule out embedded or renamed content. |
| Root `LICENSE` and all content files | Root is MIT; a separate content license boundary was not previously present. | `NEEDS_ARCHITECT_REVIEW` as a repository policy gap, not a finding that every file is MIT-licensed. | Added `CONTENT_LICENSES.md` and a separate source registry. |

## Stop-condition assessment

The tracked current tree contains a content-rich OCAC-labeled Book 1 L1 package and several legacy data collections, but this static audit did not compare every item with source textbooks or establish copying. It found no scanned textbook pages, official audio corpus, or complete mirrored official vocabulary/question-bank dataset in the inspected file inventory. Because source attribution for the exact Book 1 L1 strings is insufficient, the package remains `PERMISSION_REQUIRED` and must receive exact-path Architect review before further curriculum work relies on it. The evidence is not enough to assert either copying or non-copying; this audit is not a legal fair-use or infringement assessment.

## Source-status summary

The machine-readable statuses and conditions are in [`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json). In brief: OCAC, TBCL, and TOCFL/CCCC are `YELLOW`; CC-CEDICT, Tatoeba, and Mozilla Common Voice are `GREEN` with source-specific constraints. No YELLOW source data was downloaded or copied during this audit. Mozilla’s current Common Voice terms ask users not to repost, distribute, or mirror datasets and direct access through Mozilla Data Collective. TongXuan adopts a conservative project policy against mirroring; this audit does not characterize Mozilla’s request as a legal prohibition.

## Audit limits and follow-up

- No complete item-by-item comparison against each source textbook or teacher handbook was performed.
- No automated paraphrase/near-duplicate detector was run; semantic similarity is not established either way.
- The Starter L1 / Basic L1 official title metadata conflict was not resolved against primary pages in this tree; both entries remain unverified pending Architect review.
- License and terms pages were checked on 2026-09-27 and may change. Recheck them before each new ingestion or release.
- Architect should review the exact Book 1 L1 package, Starter/Basic L1 title conflict, and existing handbook paraphrase boundary before approving any derivative curriculum plan.
- This audit does not authorize deleting or rewriting existing data, changing release scope, or declaring a use lawful/unlawful.
