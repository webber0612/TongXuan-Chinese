# TongXuan Chinese — Learning Path v2 & Lesson Player v1 Specification

## 1. Product Principle & Information Architecture

> **Official curriculum decides what to learn.**  
> **TongXuan Lesson Player decides how to practice it.**  
> **Learner state decides how much, which mode, and whether content can be fast-tracked.**

TongXuan Chinese does not present its pedagogical policy as absolute educational truth. All timings, task counts, mastery thresholds, and step sequences are treated as **configurable product hypotheses** that require continuous empirical calibration with real learners.

---

## 2. Policy Labeling Matrix

Every design and pedagogical rule in Learning Path v2 carries an explicit policy classification label:

| Label | Definition | Examples in v1 |
| :--- | :--- | :--- |
| `[TEXTBOOK_DERIVED]` | Official metadata directly derived from approved OCAC curriculum textbooks (*學華語向前走*). | Lesson titles, target utterances, characters (`你`, `好`), vocabulary words (`你好`), and official lesson sequence. |
| `[SUPPORTED_BY_FRAMEWORK]` | Principles established by established language learning frameworks (ACTFL / CEFR / HSK). | Four-domain separation (Listening, Speaking, Reading/Recognition, Writing); Spaced Repetition (SRS) review scheduling; Meaning-first pedagogy. |
| `[TONGXUAN_HYPOTHESIS]` | Pedagogical wrapper, step sequencing, and duration defaults designed by TongXuan. | 9-step guided sequence; 15–25 minute session target; 75% scored domain gate floor; "這一課我會了" Fast-Track routing. |
| `[EXPERIMENTAL]` | Scaffolding features and independent practice gates subject to active field calibration. | 3-tier native-language scaffold (`FULL` → `TAP_TO_REVEAL` → `HIDDEN`); Local-only speech recording tracking `ATTEMPTED_INDEPENDENTLY` without fake percentage scoring. |

---

## 3. Golden Reference Lesson: Book 1 Lesson 1《你好》

The reference golden implementation is **Book 1 Lesson 1《你好》** (`book1-l01`). Secondary regression fixtures are provided for **Starter Lesson 1** (`starter-l01`, *ㄅㄆㄇㄈ（一）*) and **Basic Lesson 1** (`basic-l01`, *數字一到十*).

### Strict Content Containment Invariant
- Every child-visible task in the official Lesson Player for 《你好》 belongs strictly to `book1-l01`.
- Target vocabulary is strictly `你好`.
- Target characters are strictly `你` and `好`.
- **Legacy authored draft data (`日月與星光` / `日月星辰`) must NEVER appear as the 生字 / 生詞 / 任務 content of 《你好》.**

---

## 4. Deterministic 9-Step Pedagogy Flow (LEARN Mode)

In default `LEARN` mode, the child progresses through a linear, single-column guided sequence:

```text
Step 1: 情境理解 (Situational Context)
   ↓
Step 2: 課文 / 對話 (Sentence in Context)
   ↓
Step 3: 核心生詞 (Vocabulary)
   ↓
Step 4: 認識生字 (Characters)
   ↓
Step 5: 實用句型 (Sentence Pattern)
   ↓
Step 6: 開口使用 (Independent Speaking)
   ↓
Step 7: 筆順書寫 (Handwriting - Adaptive / Skippable)
   ↓
Step 8: 小挑戰 (Exit Ticket / Retrieval Check)
   ↓
Step 9: 課堂結算與 SRS (Session Summary & Mastery Assessment)
```

### Step Details:
1. **Step 1 — 情境理解 `[TONGXUAN_HYPOTHESIS]`**:
   - Understand the communicative greeting context from audio and visual situation ("早晨遇見新朋友打招呼").
   - Character reading is **not** required at this stage.
2. **Step 2 — 課文與對話 `[TEXTBOOK_DERIVED]`**:
   - Hear the target utterance `你好！` and `你好！我叫心美。` in dialogue context.
   - Dual Zhuyin/Pinyin support is provided according to learner locale preference.
3. **Step 3 — 核心生詞 `[SUPPORTED_BY_FRAMEWORK]`**:
   - Whole-word meaning taught before isolated characters.
   - Marked as `ACTIVE` vocabulary.
4. **Step 4 — 認識生字 `[TEXTBOOK_DERIVED]`**:
   - Strictly teaches `你` (7 strokes, 亻 radical) and `好` (6 strokes, 女 radical).
   - Character form, pronunciation, and recognition check.
5. **Step 5 — 實用句型 `[SUPPORTED_BY_FRAMEWORK]`**:
   - Language pattern: `你好！` and `我叫 ___。`
   - Interactive ordering and substitution practice.
6. **Step 6 — 開口使用 `[EXPERIMENTAL]`**:
   - Independent production prompt (speaking greeting aloud).
   - Records state as `ATTEMPTED_INDEPENDENTLY`.
   - **No fake speech accuracy percentages or pseudo-evaluations are output.**
7. **Step 7 — 筆順書寫 `[TONGXUAN_HYPOTHESIS]`**:
   - Placed after comprehension and recognition.
   - Adaptive trace canvas with stroke animation.
   - Skippable for learners with demonstrated proficiency or parents choosing spoken-first paths.
8. **Step 8 — 小挑戰 Exit Ticket `[SUPPORTED_BY_FRAMEWORK]`**:
   - 3–4 retrieval items across independent domains (Listening, Recognition, Vocabulary, Grammar).
   - Domain scores are tracked separately rather than merged into a single averaged hidden score.
9. **Step 9 — 課堂結算與 SRS `[SUPPORTED_BY_FRAMEWORK]`**:
   - Explicitly displays:
     1. **今天的練習完成** (Session Completed)
     2. **本課已練習** (Lesson Practiced)
     3. **本課是否達到目前精熟條件** (Mastery Criteria Met vs In-Progress)
     4. **下一次複習時間** (Next SRS Review Schedule)

---

## 5. Pedagogy Modes

The Lesson Player operates in four distinct deterministic modes:

```text
┌─────────────────────────────────────────────────────────────┐
│                          LESSON PLAYER                      │
├──────────────┬──────────────────┬─────────────┬─────────────┤
│    LEARN     │    FAST_TRACK    │   REVIEW    │   REPAIR    │
│  (15–25 min) │    (3–5 min)     │  (2–5 min)  │ (5–10 min)  │
│ Full 9-step  │ Diagnostic items │ Due SRS     │ Targeted    │
│ sequence     │ ("這一課我會了") │ retrieval   │ remediation │
└──────────────┴──────────────────┴─────────────┴─────────────┘
```

1. **`LEARN` Mode**:
   - For new or unfamiliar content.
   - Target duration: 15–25 minutes (configurable).
2. **`FAST_TRACK` Mode ("這一課我會了") `[TONGXUAN_HYPOTHESIS]`**:
   - Triggered when child clicks `這一課我會了`.
   - Runs 3–4 measurable diagnostic items (Listening, Recognition, Vocabulary, Sentence).
   - **Does NOT immediately grant permanent unverified mastery.**
   - **Pass**: Skips unnecessary instruction, records `READY_FOR_CHECK`, schedules light SRS review.
   - **Fail**: Identifies weak domain(s) and routes directly into `REPAIR` mode.
3. **`REVIEW` Mode `[SUPPORTED_BY_FRAMEWORK]`**:
   - For due Spaced Repetition items.
   - Retrieval checks only; does not replay full instructional blocks.
4. **`REPAIR` Mode `[TONGXUAN_HYPOTHESIS]`**:
   - Targeted practice for weak domains identified during Exit Ticket or Fast Track.
   - Weak writing alone does **not** force re-teaching of listening/speaking.

---

## 6. Native-Language Comprehension Scaffold `[EXPERIMENTAL]`

A first-class native-language support layer (English v1) aids beginner comprehension without becoming permanent bilingual subtitles:

- **`FULL`**: Natural meaning, explanation, and cultural notes visible by default.
- **`TAP_TO_REVEAL`**: Translation hidden behind a friendly "Tap to reveal" button.
- **`HIDDEN`**: English support omitted for immersive practice.

### Invariants:
- Toggling scaffold visibility **never mutates authoritative learning state, scores, or mastery records**.
- Schema separates `literal`, `naturalMeaning`, `paraphrase`, and `notes`.
- All generated translations carry review status: `GENERATED_DRAFT`, `REVIEWED`, `APPROVED`, `REJECTED`. Unreviewed generated drafts cannot be published as approved curriculum text.

---

## 7. Mastery Assessment vs. Session Completion Separation `[SUPPORTED_BY_FRAMEWORK]`

A core design rule of TongXuan is the separation between daily practice completion and verified domain mastery:

- **Session Completion**: The child sat down and completed today's practice sequence (awards daily star rewards and marks streak).
- **Domain Mastery**: Requires valid, domain-specific evidence (e.g. scored recognition accuracy ≥ 75%, listening comprehension pass, speaking attempt).
- **Session completion $\neq$ lesson mastery.**

---

## 8. Single-Column Responsive Layout `[TONGXUAN_HYPOTHESIS]`

To reduce cognitive load for young children:
- The Lesson Player uses **one primary vertical learning column** across all screen sizes (390px mobile, 768px tablet, 1024px+ desktop).
- No multi-column dashboard grid during active lesson execution.
- Exactly one primary action per step.
- Step order is identical across desktop and mobile viewports.

---

## 9. Real-Child Calibration Plan

The following parameters are marked for empirical calibration:
1. **Step Timing Defaults**: Calibrating 1–3 min per step with age 5–9 beginner cohorts.
2. **Scaffold Progression**: Analyzing whether learners transition naturally from `FULL` to `TAP_TO_REVEAL`.
3. **Fast-Track Cutoffs**: Calibrating 100% threshold vs. 85% threshold based on retention in subsequent SRS reviews.
4. **Writing Fatigue Limits**: Capping tracing repetitions at 1–2 per character to avoid motor fatigue in young learners.
