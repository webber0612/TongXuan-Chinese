AI agents and developers MUST treat only the Canonical Frontend Manifest as implementation targets. Historical preview artifacts are not valid product surfaces.

# Canonical Frontend Manifest

| Surface | Canonical file or route | Status |
|---|---|---|
| TongXuan Web App | `frontend/src/main.tsx` → `frontend/src/AppShell.tsx` | PRODUCTION |
| Child Home / Today | `/` | PRODUCTION |
| Lesson Player | `/learning-session` → `LessonPlayerPage` in the production learning flow | PRODUCTION |
| Legacy `LearningSessionPage` implementation | Removed from active production source; it has no production route or use | HISTORICAL / REMOVED |
| Practice | `/practice` | PRODUCTION |
| Curriculum | `/curriculum` | PRODUCTION |
| Parent | `/parent-dashboard` | PRODUCTION |
| Settings / Me | `/me` | PRODUCTION |
| Historical previews | No production route or executable React source | ARCHIVED / FORBIDDEN_AS_TARGET |

The canonical user route for Child Home / Today is `/`. `/kids` is a compatibility path that immediately replaces its URL with `/`. `/learning-session` is the only production Lesson Player route. `/lesson-player` and `/player` are non-product paths and render the retired-route notice; they never render `LessonPlayerPage`. Historical preview URLs and unknown paths also stay outside the Child Home route and render only the retired-route notice.

## Before modifying UI

Before changing any UI, every AI agent or developer must answer:

1. What is the current branch?
2. What is the production entry point?
3. What is the target route?
4. Which component does that route render at the end?
5. Is that component imported by production `AppShell`?
6. Is there a same-name or similarly named preview/archive page?
7. Does the production build actually include the component?

If any answer cannot be verified, stop modifying UI and report exactly:

`CANONICAL_FRONTEND_NOT_VERIFIED`

## Legacy and archived surface policy

- `/` is the only canonical Child Home / Today route.
- `/kids` redirects to `/` (or the matching base path when hosted under GitHub Pages).
- `/preview-kids`, `/preview-2`, `/preview-b`, `/preview`, `/preview-pixel`, `/preview-reference`, `/preview-directions`, `/learning-desk`, `/learning-calendar`, `/lesson-player`, and `/player` render only the retired-route notice.
- The retired-route notice is not a product page or an implementation target.
- `frontend/archive/previews/` may contain a clearly marked Markdown note only. It must not contain executable React pages.
- Production source, routing, tests, and bundles must not import or include archived preview React implementations.

## Naming inventory

| Match family | Classification | Boundary |
|---|---|---|
| `AppShell.tsx`: `legacy-tombstone`, retired preview URLs, and translated retired-route notice | HISTORICAL | Legacy URLs only show a return-home notice; they do not resolve to a child home alias or archived component. |
| `vite.config.ts`, `package.json` `preview` command, and Vite preview server terminology | DEV_ONLY | Runs the generated production bundle locally; it is not a product route, name, or page. |
| `Mock*` helpers and `.mock*` calls in `*.test.*` files | TEST_ONLY | Vitest fakes are not imported by the production entry. |
| `ChildPortalPage.tsx` authored sample practice section labeled as a TongXuan prototype | PRODUCTION | It is an existing visible supplementary section whose label describes non-official content provenance; it is not a preview route or alternate app surface. This change does not alter its content. |
| `frontend/src/lib/ocrImport.ts` “mockable” local boundary | PRODUCTION | This describes an implementation seam in production code; it is not a preview page or mock route. |
| Former `frontend/src/pages/LearningSessionPage.tsx` implementation | HISTORICAL / REMOVED | It had no production route or imports; the active `/learning-session` route renders `LessonPlayerPage`. |
| Retained TongXuan-authored sample/prototype data in `frontend/src/data/` | HISTORICAL | Non-official legacy data is not an OCAC lesson or implementation target; this architecture change does not alter that data. |
| Old design selectors/comments in `frontend/src/styles.css` (for example `.design-preview`, `.playroom-preview`, `.child-app-preview`, and `.learning-desk-preview`) | HISTORICAL / INERT CSS | These are leftover styles with no matching production React surface. They are not routes, components, or product directions. |
| Archived UI notes under `docs/archive/ui/` | HISTORICAL | Each is marked `DO_NOT_IMPLEMENT` and points to this manifest. Some notes contain obsolete route claims; those claims are superseded. |
| `frontend/archive/previews/*.tsx` | HISTORICAL / REMOVED | Git history preserves prior source; it is absent from the active worktree and production import graph. |

The word `preview` must not name the production website, a production route, or a production page/component. A historical design reference is non-production, non-routing, and non-executable.
