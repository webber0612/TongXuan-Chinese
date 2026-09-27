# Repository content-rights audit — 2026-09-28

## Scope and method

This is a static source/provenance inventory refreshed against main baseline `e4532a70ea03e54ce6ce797757f597259190409d`. It reviewed the existing source registry, evidence references, content-license boundary, representative lesson packages, legacy lesson data, image/font assets, and the previous audit findings. It did not inspect or rewrite Git history, ingest any source download, run a semantic similarity model, or make a legal determination.

The official OCAC series page says it provides textbooks and downloadable text, high-resolution textbook images, audio, and teaching slide decks. This audit therefore does not treat public availability as permission to redistribute those materials. See the [official series page](https://www.huayuworld.org/Ebook/LearnMandarinChildren).

## Classification key

- `OWNED`: item-level ownership evidence supports the recorded project use.
- `OPEN_LICENSED`: source evidence identifies an open license, and the item is within that license's scope and conditions.
- `REFERENCE_ONLY`: metadata or policy reference; not a publishable content source.
- `RIGHTS_UNCLEAR`: source, authorship, or reuse permission is not established; blocked from publishable curriculum artifacts.
- `THIRD_PARTY_RESTRICTED`: identified material whose recorded terms do not allow the proposed artifact use; blocked.

The machine-readable [public-repository audit](../shared/content-sources/public-repo-audit.json) currently inventories **34 tracked content-sensitive paths**: **31 `RIGHTS_UNCLEAR`**, **3 `REFERENCE_ONLY`**, and none cleared as `OWNED`/`OPEN_LICENSED` or positively identified as `THIRD_PARTY_RESTRICTED`. “None identified” is not evidence that restricted material is absent. Each entry records only the path, category, source/evidence references, byte count, and SHA-256; no file content is copied into the inventory. Source relationships distinguish official course/title metadata from item-content authorship claims. The [rights gate](../scripts/open_curriculum_rights_gate.py) fails on missing/new candidate paths, digest drift, unresolved evidence, attempts to apply root MIT to external content, and blocked files proposed for a publishable artifact. The 31 unclear paths remain present in the already-public baseline; this gate blocks their reuse in publishable curriculum artifacts but does not clear or remove them from the repository. Their public retention versus item-level proof/replacement requires an Owner decision.

## Findings

| Tracked path or group | Observed material | Classification | Action in this phase |
| --- | --- | --- | --- |
| `shared/validated-curriculum-slice.json` | OCAC course/book/lesson titles, order, URLs, and paraphrased teacher-handbook objectives for Starter, Basic, and Book 1 lessons 1–3. The Starter L1 and Basic L1 titles conflict with corresponding package metadata. | Machine audit: `RIGHTS_UNCLEAR`. Source identifiers/URLs do not establish rights for paraphrases or resolve the title conflict. | Kept unchanged. Do not treat disputed metadata as an approved target graph or permission record. |
| `shared/lesson-packages/*.json` | Existing packages mix official-course metadata, TongXuan labels, objectives, lesson activities, task text, and examples. Item-level author/source/rights evidence is incomplete. | Machine audit: `RIGHTS_UNCLEAR`. The tree alone cannot establish copying, non-copying, or authorship. | Kept unchanged as blocked engineering/regression fixtures. No new lesson authoring, deletion, or target promotion in this workstream. |
| `frontend/src/data/*` and embedded content in `backend/app/curriculum.py`, `learning.py`, and `sprint_b.py` | Legacy sample stories, word/character entries, course mappings, and seed/learning data have incomplete item-level provenance. | Machine audit: `RIGHTS_UNCLEAR`. No semantic source-match claim was made. | Kept unchanged as existing baseline; blocked from new publishable curriculum artifacts pending path/item review. |
| `data/commercialization-inventory.json` and `data/license-registry.json` | Rights and dependency reference registries; they do not grant rights to listed assets or curriculum content. | Machine audit: `REFERENCE_ONLY`. | Retained as policy/reference metadata; not content-source permission. |
| Bundled image and font assets | Item-level owner, license, and redistribution evidence remains incomplete in the tracked audit. | Machine audit: `RIGHTS_UNCLEAR`; included license text alone does not establish that it covers adjacent font binaries. | No asset changes. Do not infer asset clearance from this scan. |
| Tracked PDFs, spreadsheets, slides, and audio datasets | The tracked-path scan found no `.pdf`, `.xls/.xlsx`, `.ppt/.pptx`, `.mp3`, or `.wav` files. | No bulk raw-source corpus was found in those tracked file types. | No downloads or ingestion. This extension scan does not rule out embedded or renamed content. |
| Root `LICENSE` and `CONTENT_LICENSES.md` | Root MIT covers project software as intended; the content boundary says it does not grant third-party content rights. The policy does not establish ownership of every existing item. | Machine audit: `REFERENCE_ONLY`. | Preserve source-specific licenses; never treat repository presence or root MIT as item-level content clearance. |

## Stop-condition assessment

The tracked current tree contains a content-rich OCAC-labeled Book 1 L1 package and several legacy data collections, but this static audit did not compare every item with source textbooks or establish copying. It found no scanned textbook pages, official audio corpus, or complete mirrored official vocabulary/question-bank dataset in the inspected file inventory. Because item-level source/authorship rights remain unresolved, Book 1 L1 and the other 30 `RIGHTS_UNCLEAR` paths cannot be used in publishable content. The evidence is not enough to assert either copying or non-copying; this audit is not a legal fair-use or infringement assessment.

## Source-status summary — refreshed evidence

The machine-readable statuses, evidence digests, and explicit policy decisions are in [`shared/content-sources/source-registry.json`](../shared/content-sources/source-registry.json). OCAC, TBCL, and TOCFL/CCCC remain `YELLOW` / reference-only. CC-CEDICT and Tatoeba are `GREEN` only with recorded conditions and item-level checks. Common Voice is now `UNKNOWN` because the current terms response did not expose operative clauses in the capture. TongXuan-authored material is `UNKNOWN` at source level until each item's rights evidence exists. No YELLOW/RED/UNKNOWN source was converted into a publishable payload. The tree scan does not establish the ownership or legality of existing baseline files.

## Audit limits and follow-up

- No complete item-by-item comparison against each source textbook or teacher handbook was performed.
- No automated paraphrase/near-duplicate detector was run; semantic similarity is not established either way.
- The Starter L1 / Basic L1 official title metadata conflict was not resolved against primary pages in this tree; both entries remain unverified pending Architect review.
- Rights evidence was refreshed on 2026-09-28. UTF-8 response-text SHA-256 values and byte sizes are recorded in the registry; they identify the captured representations but do not preserve their contents or prove a legal claim. Recheck current terms before ingestion or release.
- Architect should review the exact Book 1 L1 package, Starter/Basic L1 title conflict, and existing handbook paraphrase boundary before approving any derivative curriculum plan.
- This audit does not authorize deleting or rewriting existing data, changing release scope, or declaring a use lawful/unlawful.
