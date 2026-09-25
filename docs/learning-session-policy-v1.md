# Learning Session Policy v1

## Scope

This flow connects the learner's placement profile to a deterministic, resumable daily session for the validated first lesson in the selected stage:

- Starter Lesson 1: `starter-l01`
- Basic Lesson 1: `basic-l01`
- Book 1 Lesson 1: `book1-l01` (`你好`)

The Book 1 path is the primary golden path. Basic Lesson 1 is the secondary end-to-end regression. No Book 2–10 lesson activity is added. The planner reads validated official titles/objectives and keeps TongXuan-authored practice explicitly marked as such.

## Queue and placement

The child daily queue uses the lowest assessed core placement domain (`recognition`, `reading`, `vocabulary`, `grammar`); age is not used. Due, accessible recognition reviews are planned first, capped at two per session. New curriculum tasks follow. School Queue items remain a separate queue and never enter this session planner.

When the placement lesson becomes mastered, the session report and Daily Queue can point to the next accessible lesson in that same placed stage. The v1 session runner still creates learning tasks only for the three Lesson 1 entries above.

## Session composition

The API accepts a target duration from 15 to 25 minutes; the child UI starts at 18 minutes. The initial planning guide is 20–30% review, 50–60% new lesson practice, and 15–25% closing. Task-minute estimates are approximate. A child can finish sooner, and a due review can be absent; the target is not a requirement to prolong a lesson. The ratios and target are product defaults for later calibration, not educational claims.

The planner does not force every domain into every lesson. A short TongXuan-authored meaning-in-use task can appear in the Book 1 golden flow, but it has no mastery impact. Writing appears only when a placement profile puts writing below the main lesson start. Writing progresses from guided to reduced hint to independent according to saved Hanzi Writer attempts; the optional task can be skipped.

## Task and evidence map

| Task | Authoritative evidence | Mastery effect |
| --- | --- | --- |
| `REVIEW_RECOGNITION`, `RECOGNITION` | Server-scored recognition attempt and linked curriculum evidence | Recognition score only |
| `LISTENING` | Completed reference-listening attempt | Non-score listening gate |
| `VOCABULARY` | Server-scored choice, linked to the vocabulary domain | Vocabulary score only |
| `SENTENCE_PATTERN` | TongXuan-authored deterministic practice choice | None |
| `PHONETICS` | Server comparison against linked Zhuyin/Pinyin readings | Phonetics score only |
| `SPEAKING_ATTEMPT`, `PRONUNCIATION_ATTEMPT` | Completed independent reading-aloud attempt metadata | Non-score gate; no quality score |
| `WRITING_GUIDED`, `WRITING_REDUCED_HINT`, `WRITING_INDEPENDENT` | Hanzi Writer provider event with phase and script mode | Optional writing practice; assisted phases do not count as independent mastery |
| `MINI_CHECK` | Self-report or short retrieval response | No score unless the task has an explicit server scorer |
| `LESSON_WRAP_UP` | Session completion transaction | Session completion only |

The first lessons in the validated slice do not require a reading domain, so v1 does not invent a reading task for them. The Task API and source contracts remain domain-scoped; any future reading activity requires an appropriate linked lesson and scorer before it can affect mastery.

## Session state and stopping

SQLite is authoritative for the session and each task. Refreshing the page loads the current session. Resuming a paused session reuses its ID and completed evidence. The child and session IDs are checked on every read and write.

Stop rules:

- elapsed active time reaches the configured target: pause and defer unfinished tasks;
- three failures on one task: pause, preserve those attempts, and defer the blocking task and remaining work;
- two aborted speaking/pronunciation recordings: pause and defer that attempt and remaining work;
- a parent limit or child choosing to leave: save completed work and pause the rest;
- optional writing reaches its retry cap or is skipped: mark it deferred without blocking session completion or curriculum mastery.

An unfinished task is not converted into a failed mastery score. Resuming resets tasks deferred only by a general stop so the learner can continue. A task blocked by repeated failure or repeated aborted recording stays deferred in that session; a later session can offer an appropriate review/attempt.

## Mastery, completion, rewards, and SRS

These are separate outcomes:

1. Completing a session records `PRACTICED` and runs the existing lesson assessment against linked domain evidence.
2. `MASTERED` is set only when each required scored domain meets its floor and each required non-score gate has independent evidence.
3. Completing the session awards five points once under a unique event key, even if mastery is still `NEEDS_REVIEW`.
4. Recognition and vocabulary attempts update only their corresponding SRS domains. Correct independent review advances the interval; incorrect or assisted responses contract or hold it. Recognition never updates writing or pronunciation state.
5. Non-score speaking/pronunciation attempts never create a numeric quality score.

## Privacy-preserving telemetry and parent report

Telemetry is append-only and separate from authoritative learning state. It records session lifecycle, task duration/type, retry and assistance counts, stop reasons, review result/due age, writing progression, speaking attempts/aborts, mastery transitions, and available seven-day review results. Events do not store selected answer values, child names, raw microphone bytes, or recordings.

The parent-only report API summarizes session duration, task counts, weak domains, deferred tasks, mastery changes, and review-due counts. It reports that raw audio and identifying telemetry are not stored.

## Verification and boundaries

The regression suite covers deterministic plans, placement, due-before-new ordering, locked content exclusion, adaptive recognition/writing, stop behavior, non-score gates, separate mastery/reward state, next-day SRS behavior, resume idempotency, child isolation, telemetry privacy, and the parent report boundary. The frontend session is a focused route launched from the canonical home path; preview aliases do not show the new entry point.

No speech-quality scoring, LLM mastery decisions, School Queue merging, Book 2–10 tasks, or whole-app UI redesign is part of this version.
