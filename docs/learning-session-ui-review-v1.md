# Learning Session UI Review v1

## Review target

The production home route at `/TongXuan-Chinese/` and its `/learning-session` child route. Preview aliases are excluded from the implementation surface; route tests confirm they do not expose the session entry.

## Review checklist

- **Primary action and hierarchy:** the home route adds one `開始今日學習` action beside the existing curriculum link. The session screen puts the selected lesson, target time, task count, and one current task first. Parent controls stay outside the child flow.
- **Responsive behavior and media:** session content has a 680px maximum width, 14px narrow-screen side padding, a single-column-capable choice grid, and a full-width home entry below 560px. This slice adds no illustration or other media requiring crop checks. The browser review used the available desktop viewport; this environment's CUA browser controls do not expose viewport resizing, so an actual narrow viewport remains for reviewer confirmation.
- **Visible states:** the browser showed the lesson-plan state, listening task, phonetic choice task, disabled answer submission before choices, and the mismatch alert when the portal learner had no exact backend profile. A matching learner opened the expected `你好` plan. Pause returns to the home route. Native buttons, fieldsets, and radio controls retain keyboard operation.
- **Keyboard and motion:** Tab reached the first phonetic radio. Session styles include hover, pressed, disabled, and `prefers-reduced-motion` handling. Automated checks cover route isolation and profile matching.
- **Accessibility and localization:** loading uses `role=status`; operational errors use `role=alert`; task updates use a live region. The session copy and entry/error labels follow the six existing display-language choices, independently of the selected learning script.
- **Tests/build:** backend `126 passed`; frontend `37 passed`; `npm run build` passed. The build reports the repository's existing large main-chunk warning.
- **Learning-domain boundary:** task attempts link to the matching scored domain, while listening/speaking gates, rewards, and session completion remain separate. No Book 2–10 learning task or unrelated mastery/scoring rule is added.

## Limits

No real-child trial was conducted; see [real-child-validation-v1.md](real-child-validation-v1.md). Narrow viewport inspection also remains an explicit review item because viewport emulation is unavailable through this session's permitted browser controls.
