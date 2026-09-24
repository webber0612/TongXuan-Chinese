# Frontend reference library

This redesign is reference-led rather than invented from a blank canvas.

## Sources

- [Mobbin](https://mobbin.com/) — shipped mobile/web app screens and complete user flows. Used for compact app bars, bottom navigation, progress surfaces, and touch-sized controls.
- [Figma UI kits](https://help.figma.com/hc/en-us/articles/24037724065943-Start-designing-with-UI-kits) — mature component and spacing references. Used as the structural baseline rather than copying a visual theme.
- [Duolingo shape language](https://blog.duolingo.com/shape-language-duolingos-art-style/) — official explanation of the bright, rounded, friendly language-learning visual system.
- [Duolingo home redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/) — official explanation of a guided learning path and a clearer next step.

## Applied rules

- The child sees one primary action: today's lesson.
- Greeting text is a small context label; it is not the page headline.
- The page headline uses natural Chinese: `今天學：學校`.
- The learning path is sequential and visible without opening a dashboard.
- Weekly progress is horizontally scrollable on narrow screens and expanded on wide screens.
- Learning Desk and Calendar are secondary surfaces, reached through bottom navigation or quiet links.
- Touch targets use a 44px minimum for primary controls.
- Artwork has a controlled frame and `background-size`/position rules; it is never stretched to fill a card.
- Motion is limited to press, selection, elevation, and reduced-motion-safe transitions.

## Deliberately not copied

The implementation does not copy Duolingo artwork, mascot assets, proprietary copy, or a proprietary course layout. It borrows public interaction patterns and applies them to TongXuan's Traditional/Simplified learning model, Zhuyin/Pinyin split, child isolation, and calendar requirements.
