# Curriculum audit v1 — validated slice

Scope for this audit is the OCAC / HuayuWorld series `學華語向前走`: Starter (入門冊), Basic (基礎冊), and Book 1 A lessons 1–3 only. Books 2–10 remain structure-only and have no lessons or exercises in this change.

## Evidence and boundaries

| Segment | Verified titles / order | Source record | Content and rights boundary |
| --- | --- | --- | --- |
| Starter | 12 lesson titles, lessons 1–12. A contains 1–6; B contains 7–12. Zhuyin and Pinyin editions are represented as corresponding editions. | [OCAC series hub](https://www.huayuworld.org/Ebook/LearnMandarinChildren), [Starter A Zhuyin](https://www.huayuworld.org/Ebook/ebookDetail?EID=623), [Starter B Zhuyin](https://www.huayuworld.org/Ebook/ebookDetail?EID=624), [Starter A Pinyin](https://www.huayuworld.org/Ebook/ebookDetail?EID=625), [Starter B Pinyin](https://www.huayuworld.org/Ebook/ebookDetail?EID=626), [Starter teacher handbook PDF](https://www.huayuworld.org/upload/eBookstore/PDF/%E7%AC%AC%E4%BA%8C%E8%AA%9E%E8%A8%80%E6%95%99%E6%9D%90/070.%E5%AD%B8%E8%8F%AF%E8%AA%9E%E5%90%91%E5%89%8D%E8%B5%B0%E5%85%A5%E9%96%80%E5%86%8A-%E6%95%99%E5%B8%AB%E6%89%8B%E5%86%8A.pdf) | Lesson titles/order and paraphrased teacher-handbook objectives are stored with source pages. TongXuan-authored practice targets remain separate. No textbook dialogue, vocabulary lists, workbook prompts, artwork or audio are copied. |
| Basic | 12 lesson titles, lessons 1–12. A contains 1–6; B contains 7–12. | [Basic A](https://www.huayuworld.org/Ebook/ebookDetail?EID=627), [Basic B](https://www.huayuworld.org/Ebook/ebookDetail?EID=628), [Basic teacher handbook PDF](https://www.huayuworld.org/upload/eBookstore/PDF/%E7%AC%AC%E4%BA%8C%E8%AA%9E%E8%A8%80%E6%95%99%E6%9D%90/071.%E5%AD%B8%E8%8F%AF%E8%AA%9E%E5%90%91%E5%89%8D%E8%B5%B0%E5%9F%BA%E7%A4%8E%E5%86%8A-%E6%95%99%E5%B8%AB%E6%89%8B%E5%86%8A.pdf) | Same content boundary. Basic is the official bridge from Starter to Book 1. Lesson objectives are paraphrased and link to their handbook pages. |
| Book 1 A | First three titles and sequence only: 你好; 你家有幾個人？; 你們班有幾個同學？ | [Book 1 A](https://www.huayuworld.org/Ebook/ebookDetail?EID=629), [official lesson PDF](https://huayuworld.org/upload/epaper/106/B1-L1-4.pdf) | The source handbook objectives were paraphrased for the audit; full lesson content is not imported. Book 1 lesson 4 onward is out of scope. |

Starter title index: 你好、我七歲、爸爸媽媽、小狗、我的妹妹、我是李大文、大文喜歡紅色、西瓜是圓的、文文喜歡吃蘋果、畫雪人、心美喜歡聽音樂、我是林東明。

Basic title index: 你好、家人、同學、早飯、冬天和夏天、生日、畫雪人、下課以後、在哪裡、爺爺和奶奶、去學校、在家嗎。

## Product mapping

- Official metadata is stored per lesson: `sourceKind`, `sourceName`, `sourceUrl`, `sourceBook`, `sourceLesson`, `provenanceStatus`, `licenseStatus`, and `commercialReady`.
- The verified title/objective status does not imply permission to redistribute lesson content. `licenseStatus` is `PERMISSION_REQUIRED`; `commercialReady` is `false`.
- `officialObjectiveSummary` is a concise TongXuan paraphrase of the teacher handbook objectives. Each lesson records the specific handbook page in `objectiveSourceUrl`. These summaries describe source learning outcomes; TongXuan's `practiceTargets` and domain mapping remain separate learning-engine metadata and are not OCAC assessment rubrics.
- The existing 25-level and 10-volume samples are retained as `TONGXUAN_AUTHORED` / `INTERNAL_DRAFT` / `INTERNAL_ONLY`, and the child onboarding route no longer presents them as the official series.
- The canonical machine-readable slice is [validated-curriculum-slice.json](../shared/validated-curriculum-slice.json).

## Accepted limitations for this slice

Official titles, order, and handbook objective pages are verified for the validated slice. Lesson-level practice activities are not shipped because the source lesson text, media, and workbook material still require permission and item-level registration. Books 2–10 are not expanded.
