# Issue #28 frontend review

Date: 2026-09-25

## Scope and hierarchy

- The production `/` route renders the existing child portal shown in the supplied screenshot. Its daily lesson and stage timeline remain the main content; the layout was preserved.
- The current portal's older levels and characters are now labeled as TongXuan-authored samples. A compact note and the settings menu link to the validated course map.
- `/kids`, `/preview-kids`, `/preview-2`, and `/preview-b` remain compatibility aliases for the production portal. Independent design experiments (`/preview`, `/preview-pixel`, `/preview-reference`, `/preview-directions`, `/learning-desk`, `/learning-calendar`) show an archived notice and a route back home.
- Preview source files are under `frontend/archive/previews/` and are excluded from the Vite application entrypoint. The active portal is `frontend/src/pages/ChildPortalPage.tsx`.
- The validated course map, Course Zero, and Book 1 Lesson 1 are separate routes. It includes 入門冊, 基礎冊, and Book 1 lessons 1–3; Books 2–10 have no added lesson content.
- Expanding a validated course stage shows the source-backed objective summary, teacher-handbook page, and TongXuan practice targets under separate labels.

## Responsive behavior and media

- Browser previewed `/TongXuan-Chinese/`, `/TongXuan-Chinese/preview-2`, and `/TongXuan-Chinese/preview` from the production build.
- At 390 × 844, the production portal fits the viewport without visible horizontal clipping. The source note stacks its course link below its text.
- The lesson page has no illustration or video; the existing small brand logo retains its original fit behavior.

## Interaction states

- Default: the portal retains its selected learner, timeline, and sample lesson. The source note identifies the displayed content as internal sample material.
- Focus: keyboard Tab reaches the learner control and displays a visible focus ring. The note's course button is keyboard reachable.
- Hover/pressed: existing button hover and active states remain; the route change adds no new interaction pattern.
- Disabled: the previous-stage control remains disabled at Stage 1.
- Empty/loading/error: curriculum progress reports the existing backend-unavailable state in the static Pages preview. The verified course route remains available.
- Drag: no draggable surface or drag handler was introduced; touch handling on this page only dismisses the open menu.
- Reduced motion: the global `prefers-reduced-motion: reduce` rule reduces animation and transition duration and disables smooth scrolling.

## Accessibility and behavior boundaries

- The source disclosure uses `role="note"`; its action opens the verified curriculum route.
- The disclosure and course-link copy is translated across all six app display languages.
- The old child portal's sample lesson content remains separate from source-backed official course objectives. Issue #28 mastery, gate, and SRS behavior is implemented in the validated learning slice; the legacy sample route was not expanded to Books 2–10.

## Verification

- Frontend: 12 test files, 36 tests passed.
- Frontend production build passed and emitted `dist/404.html` for GitHub Pages deep links. Vite reported the existing large main chunk warning.
- Backend regression suite run earlier in this task: 96 tests passed.

## Limitation

The public GitHub Pages deployment has no backend configured in this preview environment. The local browser review verified the production route, aliases, archived notice, and source link; it cannot verify live learner data.

## PR #29 re-audit interaction review

- The `/preview-2` production alias still resolves to the current child portal. At 390 × 844 it has no viewport-width overflow; the timeline and lesson content remain in the existing hierarchy.
- The small interaction change is on the existing secondary `/practice` route: reference TTS completion can close a linked listening attempt, and the read-aloud section labels its non-scored attempt as speaking or pronunciation. No layout or curriculum-page redesign was made.
- Native controls remain keyboard reachable with a visible focus outline. Replay and profile-dependent actions retain their disabled states; playback errors remain playback-only and do not create a completion gate. Reduced-motion emulation reports the existing near-zero transition duration.
- Narrow `/practice` review found no document horizontal scroll. The existing OCR file input extends about 13 px past the viewport's right edge inside its section; this unrelated P3 overflow predates this change.
- No drag interaction or new motion was introduced. Scored learning domains and the separation between speaking, pronunciation, and phonetics remain intact.
- Verification for this re-audit: frontend tests passed (36 tests), production build passed, and the full backend suite passed (104 tests).
