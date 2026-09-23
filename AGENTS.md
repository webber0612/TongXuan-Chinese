# TongXuan Chinese — Agent Operating Rules

This repository uses a role-separated frontend workflow. These rules apply to every agent modifying `frontend/`.

## Design authority

- Product audience: children learning Chinese as beginners, with a parent supervising progress and settings.
- Primary use: a calm, repeatable daily learning loop on desktop and tablet-sized screens; the child must understand the next action without reading a long explanation.
- Brand tone: warm, safe, playful, tactile, and focused. Use soft depth and purposeful motion; avoid noisy mobile-game monetisation patterns, dense dashboards, neon/cyber styling, and generic AI card grids.
- Learning languages and display language are separate. The UI must support Traditional Chinese + Zhuyin and Simplified Chinese + Pinyin together, while the display language may be English or another supported language.

The canonical design skill is the project-local `better-web-ui` installation under `.agents/skills/`. Read the relevant skill before changing UI. Do not use the former personal `frontend-design` skill as the sole design authority.

## Required frontend workflow

1. Read `.better-web-ui.md` and the relevant skill.
2. Identify the child task and the single primary action for the screen.
3. Produce at least three materially different layout/style directions in a short design note before implementing a substantial redesign. Record the selected direction and why it fits the task.
4. Establish hierarchy, spacing, typography, color, radius, elevation, and motion tokens before adding decorative effects.
5. Implement the smallest functional slice. Do not imply a feature is working when it is only a visual placeholder.
6. Verify the result in the browser at `/preview-2` and at a narrow viewport. Check keyboard focus, reduced motion, touch/mouse drag, and overflow.
7. Run `npm run test` and `npm run build` from `frontend/` after UI changes.
8. Perform a separate visual/a11y review using `.agents/roles/frontend-auditor.md`. The implementer may not approve their own visual result without this review checklist.

## Information architecture

- The child home surface prioritizes today's learning task, timeline/calendar, and the learning-mode entry cards.
- Parent controls, display-language configuration, font size, theme, rewards, screen time, and account management are secondary surfaces behind the user/settings menu.
- Do not add configuration controls to the child home hero unless the current task explicitly requires it.
- The four learning domains remain distinct: character recognition, handwriting, pronunciation, and reading aloud. Idioms and grammar are content/mode extensions, not a reason to collapse skill state.

## Visual and interaction constraints

- Prefer real illustrations/assets or purposeful SVG over placeholder emoji and generic icon-only cards.
- Use a controlled media frame with an explicit aspect ratio and a documented crop/contain rule. Never stretch artwork to fit a card.
- Use one primary action per view. Secondary actions should recede visually; settings belong behind progressive disclosure.
- Motion must communicate state, selection, drag, or transition. Respect `prefers-reduced-motion`.
- Do not introduce gradients, glass, shadows, rounded cards, or decorative particles by default. Each effect needs a stated purpose and must not reduce readability.
- Preserve child isolation, display-language separation, learning state boundaries, and existing backend contracts.
- Do not change learning/mastery/scoring behavior while doing visual work unless the task explicitly includes it.

## Review gate

A frontend change is not complete until the review records:

- primary action and information hierarchy;
- responsive behavior and media crop verification;
- visual states: default, hover/focus, pressed, disabled, empty/loading/error where applicable;
- accessibility and reduced-motion behavior;
- tests/build result;
- confirmation that no unrelated learning-domain behavior changed.

When user feedback rejects a direction, discard that direction explicitly. Do not polish a rejected visual concept.

