> **HISTORICAL_REFERENCE_ONLY — DO_NOT_IMPLEMENT**
>
> This archived brief records a rejected UI direction. Do not implement or polish it. Use [`docs/frontend-architecture.md`](../../frontend-architecture.md) for the canonical frontend.

# `/preview-directions` revision brief

## Current direction

The previous mobile-first card dashboard and the later storybook experiment are rejected and must not be polished further. The active direction is a genuine guided course path: one unit, a visible sequence of lesson nodes, clear complete/current/locked states, and one obvious next lesson.

## Preserve

Keep the warm child-focused visual language, generated illustrations, 5+1 timeline, user/streak/points cues, and the familiar home → learning desk → calendar flow. The five-direction comparison UI was a development aid and is intentionally removed from the child-facing preview.

## Correct

The current preview repeats the five learning modules inside the selected home preview and again in the imagined learning desk. This makes the next action ambiguous.

The corrected flow is:

`Course path → current lesson node → Learning Desk → complete lesson → unlock next node`

The home preview must not show five module launch cards. The Learning Desk owns the five modules: 認字、筆畫、發音、朗讀、成語.

The calendar must be a separate large surface with daily stars, Master vocabulary count, skill-separated progress, weak areas, completion history, and BOSS/streak information.

## Three correction directions considered

1. **Card dashboard** — a large lesson card with a linear path below. Rejected because it reads like a dashboard rather than a course journey.
2. **Storybook room** — a decorative illustrated scene with floating lesson objects. Rejected because the path relationship was too weak and the screen became a visual composition instead of a curriculum map.
3. **Guided course path** — one unit banner, a directional path with complete/current/locked lesson nodes, and a single next action. **Selected.**

## Acceptance gate

- `/preview-directions` remains the review URL.
- The preview contains one final child-facing entry, not a direction picker.
- The path itself is the primary navigation and shows the next lesson without opening a dashboard.
- Complete/current/locked states are visually and semantically distinct.
- The current node is the only emphasized action; future nodes are visible but not actionable.
- The five modules appear together only on the Learning Desk surface.
- Calendar metrics appear together only on the Calendar surface.
- Home, Desk, and Calendar are visibly distinct screens in the preview switcher.
- No mastery, scoring, or backend behavior changes.
