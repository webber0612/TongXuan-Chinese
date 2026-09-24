# Frontend entry architecture

## Decision

The child-facing home has one job: answer “what do I learn today?” It contains one primary daily learning card, the five-day timeline, and a secondary link to the full learning calendar.

The five learning modules are not repeated on the home page. They live together in one Learning Desk:

1. 認字
2. 筆畫
3. 發音
4. 朗讀
5. 成語

The child enters the Learning Desk by selecting the daily card. The desk uses tabs to switch modules while preserving the same daily content and progress context. This reduces duplicate choices and keeps the first decision below the child’s working-memory limit.

## Routes

- `/preview-2` — child home fake entry: daily card + 5+1 timeline.
- `/learning-desk` — unified five-module learning surface.
- `/learning-calendar` — full-screen month report with stars, Master vocabulary, completion rate, skill-separated progress, and weakness suggestions.

## Calendar report

The calendar is a read-only summary surface. It may show:

- daily completion and star results;
- Master vocabulary count;
- separate skill progress for recognition, handwriting, pronunciation, reading aloud, and idiom;
- recent weak areas and the next suggested review;
- streak and BOSS checkpoint status.

It must not mutate mastery or learning state merely by opening, switching months, or refreshing.

## Typography

The UI uses GenSen Rounded for a warmer child-facing tone, with Noto CJK fallback for coverage. The font is an open font under SIL OFL 1.1. Handwriting practice is separate: Hanzi Writer renders stroke paths and records trace attempts; it does not depend on the UI font or a database “font”.

## Interaction rules

- Home card: select to enter the Learning Desk.
- Timeline: select a day; arrows move between days.
- Learning Desk: switch one module at a time; keep the current child and day visible.
- Calendar: open as a full screen; use non-destructive filters and month navigation.
- Use motion for selection, orientation, drag, and completion feedback only; honor reduced motion.

