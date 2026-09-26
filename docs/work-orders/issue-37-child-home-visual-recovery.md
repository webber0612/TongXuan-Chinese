# Work Order — Issue #37 P0 Child Home Visual Recovery

## Objective

Restore the canonical Child Home at `/` so its composition and visual hierarchy again match the Product Owner-approved reference image, without changing the repaired Learning Path logic.

## Exact visual authority

Use this repository image as the visual source of truth:

`資產/主視覺/53c5ee8e-f314-47aa-9f9e-1db2fde451cd.png`

Git blob SHA:

`2dc715fbf73120820d80b62e376561763dd0b53f`

Do not substitute an archived preview page or another mock.

## Canonical production identity

```text
frontend/src/main.tsx
  → frontend/src/AppShell.tsx

/ → ChildPortalPage
/learning-session → LessonPlayerPage
```

## Required visual structure

Desktop reference:
- dark navy persistent left rail;
- yellow active Home item;
- TongXuan brand block;
- greeting/avatar row;
- streak + points + settings controls;
- large scenic hero with child/panda;
- hero copy: 小小一步，大大進步！;
- large yellow CTA: 繼續今天的任務;
- 今日任務 heading + completion/reward summary;
- three large task cards: 認字小挑戰 / 聽中文 / 朗讀練習;
- lower 學習進度 + 我的成就 cards;
- rounded, soft, child-friendly visual language.

Responsive:
- preserve hierarchy at 1024 / 768 / 390px;
- collapse left rail appropriately on narrow screens;
- no horizontal overflow;
- touch targets remain usable.

## Functional mapping requirements

The screenshot is a visual reference only. Production state remains authoritative.

- CTA must enter the current authoritative lesson through `/learning-session`.
- Task cards must call valid current product actions.
- Use real learner progress, points, streaks and achievements where available.
- If data is unavailable, show an explicit empty/unavailable state; do not invent screenshot values.
- Side navigation must use canonical routes only.

## Hard freeze

Do not modify semantics/contracts for:
- backend learning-flow APIs;
- LessonPlayer progression;
- PAUSED authoritative resume;
- fail-closed optional writing skip;
- REVIEW exact backend task identity;
- speaking evidence transaction;
- mastery gates;
- SRS;
- FAST_TRACK;
- REPAIR;
- curriculum provenance/order.

If visual recovery appears to require any of these, stop with:

`VISUAL_RECOVERY_SCOPE_CONFLICT`

## Implementation constraints

Prefer:
- presentational refactor of `ChildPortalPage`;
- small extracted home-only presentational components;
- namespaced CSS such as `.child-home-...`;
- existing licensed/local image assets.

Avoid:
- broad global CSS changes;
- restoring archived preview React pages;
- reintroducing preview routes;
- hard-coded prototype learning state;
- changing LessonPlayer or backend code.

## Required verification

- full frontend Vitest;
- backend suite if any shared contract file changes (ideally none);
- production build;
- canonical import/bundle assertion;
- `git diff --check`;
- browser screenshots at desktop reference size, 1024px, 768px, and 390px;
- no 390px horizontal overflow;
- explicit regression that primary CTA enters `/learning-session`;
- Lesson Player regression suite remains green.

## Stop boundary

Push implementation only to:

`issue-37-child-home-visual-recovery`

Open/update one Draft PR, attach before/after browser captures, then stop for Architect visual + code re-review.
