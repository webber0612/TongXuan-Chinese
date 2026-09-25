# Archived preview pages

These pages were moved out of `src/pages` because they were prototypes and static design experiments, not the production child portal. The app does not import or route to these files, and frontend builds exclude this directory.

The current GitHub Pages root and its legacy aliases (`/kids`, `/preview-kids`, `/preview-2`, `/preview-b`) use `frontend/src/pages/ChildPortalPage.tsx`. That production page retains the shipped child-portal layout. The aliases are kept as compatibility routes; separate design experiments route to the archived notice. The former `KidsPrototypesPage` source was extracted into the active `ChildPortalPage`; it is not an archived preview.

Keep this directory as read-only history. Make product changes in the active route components under `src/pages` and `src/AppShell.tsx`.
