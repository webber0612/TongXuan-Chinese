# TongXuan Chinese — Agent Operating Rules

## Product work governance

- Only the project-scoped `product_governor` and `implementation_engineer` agents are permanent product roles. The root task coordinates; it must not simulate either role. Do not add permanent frontend, backend, or test agent roles.
- Before product implementation, Product Governor must inspect repository and external review evidence and emit a formal `PM_DECISION`. Only `APPROVE` or `REDUCE` can issue an executable `TASK_CONTRACT`; `DEFER`, `REJECT`, and `REQUEST_EVIDENCE` gate Coding completely.
- Implementation Engineer follows the contract's scope, non-goals, constraints, acceptance, verification, and stop conditions. Material evidence conflicts require `ESCALATION_TO_PM` before expanding or changing scope.
- After implementation, Product Governor independently records `PM_ACCEPTANCE` as `ACCEPT`, `REVISE`, or `REJECT`. `ACCEPT` means ready for Owner / Architect review and never authorizes merge.
- Treat brainstorming as non-authoritative. Follow explicit Owner decisions over canonical repository architecture and merged decisions, then observed production behavior and repository evidence, accepted contracts and PR decisions, discovery packets, and issue suggestions. Label `FACT`, `EXISTING DECISION`, `PROPOSAL`, `ASSUMPTION`, and `OPEN QUESTION` accurately.
- Do not introduce learning, mastery, scoring, adaptive, SRS, or curriculum mechanisms incidentally. Product changes need explicit contract acceptance criteria. Preserve the current PR / branch when the task says to continue it; never merge unless explicitly authorized.

## Evidence ownership and acceptance gates

- Every executable TASK_CONTRACT assigns each acceptance item to exactly one evidence owner: AUTOMATED, CODEX_RUNTIME, OWNER_DEVICE, or EXTERNAL. Report evidence with that owner; one category never substitutes for another.
- REQUEST_EVIDENCE is non-executable. It may identify missing evidence, who can obtain it, and a concrete collection method, but it does not authorize Coding or convert missing evidence into a pass. Do not request Owner-device or external evidence from Coding when that evidence is not obtainable in the workspace.
- The independent PM_ACCEPTANCE records verification_matrix, owner_validation_required, release_blockers, and required_changes separately. The matrix records owner, evidence, result, and limits. required_changes lists only in-contract implementation work needed now; pending Owner-device evidence belongs in owner_validation_required, and later release or external review gates belong in release_blockers. Coding can be accepted with Owner validation still required.
- There are two gates: an initial PM_DECISION of APPROVE or REDUCE may issue the executable contract; after implementation, a separate Product Governor must record PM_ACCEPTANCE. ACCEPT means ready for Owner / Architect review and never authorizes merge.
- Every PM invocation must run in a fresh parent session explicitly started with --sandbox read-only. A later writable parent live override can supersede the PM agent TOML, so never invoke or spawn PM from a workspace-write parent. Verify the effective sandbox at both PM gates. Run Coding separately in workspace-write.
- Keep exactly two permanent product agents: product_governor and implementation_engineer.

This repository uses a role-separated frontend workflow. These rules apply to every agent modifying `frontend/`.

## Canonical frontend guardrail

When asked to modify the TongXuan website/UI, always modify the canonical TongXuan Web App declared in `docs/frontend-architecture.md`.

Do not use archived previews, legacy preview routes, screenshots, or experimental branches as the implementation target unless the issue explicitly names that artifact.

- A filename containing `Preview` does not mean it is the latest UI.
- A URL opening successfully does not mean it is production.
- An isolated component test passing does not prove the production UI was changed.
- Verify the production import chain before changing UI.
- Before changing UI, answer the seven checks in `docs/frontend-architecture.md` (branch, production entry, target route, final component, AppShell import, similarly named archived surface, and production build inclusion). If any answer is unknown, stop and report `CANONICAL_FRONTEND_NOT_VERIFIED`.

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
6. Verify the result through the canonical `/` route and at a narrow viewport. Check keyboard focus, reduced motion, touch/mouse drag, and overflow. Legacy URLs are not visual verification targets.
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

