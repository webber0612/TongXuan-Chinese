# Curriculum metadata inventory — historical slice (rights review pending)

> This document is not proof that lesson content is licensed, item-authored, or approved. The 2026-09-27 current-tree audit found disputed Starter/Basic L1 titles and insufficient item-level provenance for existing lesson packages. See [content-rights-audit.md](content-rights-audit.md). No new formal curriculum authoring is authorized by this inventory.

Scope for this audit is the OCAC / HuayuWorld series `學華語向前走`: Starter (入門冊), Basic (基礎冊), and Book 1 A lessons 1–3 only. Books 2–10 remain structure-only and have no lessons or exercises in this change.

## Evidence and boundaries

| Segment | Verified titles / order | Source record | Content and rights boundary |
| --- | --- | --- | --- |
| Starter | Historical slice lists 12 lessons and source pages. Starter L1 title conflicts with its current package metadata (`你好` versus `ㄅㄆㄇㄈ（一）`). | [OCAC series hub](https://www.huayuworld.org/Ebook/LearnMandarinChildren), [Starter course pages](https://www.huayuworld.org/Ebook/ebookDetail?EID=623) | The title conflict is unresolved; do not describe all titles as verified until Architect checks the exact primary record. Package content still needs item-level provenance review. |
| Basic | Historical slice lists 12 lessons and source pages. Basic L1 title conflicts with its current package metadata (`你好` versus `數字一到十`). | [Basic course page](https://www.huayuworld.org/Ebook/ebookDetail?EID=627) | The title conflict is unresolved; do not describe all titles as verified until Architect checks the exact primary record. Package content still needs item-level provenance review. |
| Book 1 A | Historical slice lists first three titles and sequence: 你好; 你家有幾個人？; 你們班有幾個同學？ | [Book 1 A](https://www.huayuworld.org/Ebook/ebookDetail?EID=629), [official lesson PDF](https://huayuworld.org/upload/epaper/106/B1-L1-4.pdf) | Existing Book 1 L1 package contains dialogue, vocabulary usage, sentence patterns, objectives, task copy, hints, questions, and explanations without item-level authorship records. It is `PERMISSION_REQUIRED` pending exact-path Architect/source review. Book 1 lesson 4 onward remains out of scope. |

Starter title index: 你好、我七歲、爸爸媽媽、小狗、我的妹妹、我是李大文、大文喜歡紅色、西瓜是圓的、文文喜歡吃蘋果、畫雪人、心美喜歡聽音樂、我是林東明。

Basic title index: 你好、家人、同學、早飯、冬天和夏天、生日、畫雪人、下課以後、在哪裡、爺爺和奶奶、去學校、在家嗎。

## Product mapping

- Official title and source metadata are nested per lesson under `official`. TongXuan-authored teacher-handbook paraphrases, domains, and practice targets remain under `tongxuan`, with the handbook page linked from the paraphrase record.
- No title/objective row in this historical inventory clears item-level provenance or grants permission to redistribute lesson content. `licenseStatus` remains `PERMISSION_REQUIRED`; `commercialReady` is `false`. Root MIT does not relicense OCAC or other third-party content; see [`CONTENT_LICENSES.md`](../CONTENT_LICENSES.md).
- `officialObjectiveSummary` is a concise TongXuan paraphrase of the teacher handbook objectives. Each lesson records the specific handbook page in `objectiveSourceUrl`. These summaries describe source learning outcomes; TongXuan's `practiceTargets` and domain mapping remain separate learning-engine metadata and are not OCAC assessment rubrics.
- The existing 25-level and 10-volume samples are retained as legacy internal samples, and the child onboarding route no longer presents them as the official series. Those labels do not establish item-level rights or formal curriculum approval.
- The canonical machine-readable slice is [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json).

## Accepted limitations for this slice

This historical metadata slice was previously described as verified, but a current-tree check found title conflicts and item-level provenance gaps. Treat affected titles, objective paraphrases, and lesson packages as unverified until exact-source review is complete. Do not infer permission from older statements that content was not imported. Books 2–10 are not expanded.
