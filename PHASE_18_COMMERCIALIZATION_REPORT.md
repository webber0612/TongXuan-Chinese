# Phase 18 — Commercialization Gate & Release Audit Report

## Scope

Implemented the Phase 18 Commercialization Gate from Issue #21 on `phase18/commercialization-gate`,
based on merged main `1ca8037`. No commercial release, legal conclusion, paid license purchase,
or Phase 19 work was started.

## Registry

- `data/license-registry.json` now inventories technical dependencies, learning content, images,
  audio, fonts, datasets, third-party APIs, and parent-provided School Queue content.
- Every resource records source/provenance/license fields, usage status, private/commercial flags,
  `technical_usable`, `commercial_ready`, commercial evidence, inventory entries, action, and notes.
- Inventory reconciliation compares the registry with actual frontend package manifests, backend
  requirements, public assets, content, datasets, and provider/adapter identifiers. Entries with
  `technical_usable=false` are explicitly excluded from runtime/build.
- `data/commercialization-inventory.json` is the source-of-truth manifest for repository paths;
  deterministic scanning ignores generated/cache/vendor directories and fails on newly added
  provider/adapter, seed/content/dataset, or asset files that are not registered. It also checks
  `frontend/package-lock.json` root package inventory, covers every registered adapter including
  `frontend/src/lib/tts.ts`, and fails on stale or renamed registered paths.
- Commercial replacement records track current source/license, issue, candidate, license option,
  estimated work, status, and resolution evidence. Every unresolved replacement-required resource
  has exactly one non-orphan registry record.
- Parent-provided School Queue content remains `USER_PROVIDED_SCHOOL_CONTENT`, private/family
  scoped, and is never promoted to public Curriculum by the gate.

## Gate behavior

- Family target: non-commercial-ready resources produce visible warnings; `PROHIBITED` fails.
- Commercial target: only `COMMERCIAL_OK` plus `commercial_ready=true` passes; all other statuses
  are blockers.
- `/api/admin/commercialization/readiness` and `scripts/commercialization_gate.py` expose the
  deterministic readiness counts and per-resource results for developer/admin use only. The API
  requires a server-verified HMAC session with `developer` or `admin` role; unauthenticated and
  `parent` sessions are denied. There is no role-setting header bypass.
- The registry enforces typed booleans, provenance completeness, the full status/flag truth table,
  commercial evidence for `COMMERCIAL_OK`, and replacement status/evidence rules.
- School Queue writes force `USER_PROVIDED_SCHOOL_CONTENT`, `PRIVATE_OK`, private learning only,
  no public Curriculum reuse, no commercial reuse, and child-scoped ownership server-side.
- Parent Dashboard has no commercialization readiness fields or endpoint dependency.
- The implementation makes no legal or paid-license claim; open licensing/legal decisions remain
  Product Owner decisions.

## Verification

- Backend: `80 passed` with `PYTHONPATH=backend`.
- Frontend: `26 passed` with Vitest.
- Production build: passed with Vite/PWA assets generated.
- Regression coverage includes registry category/provenance completeness, Family warnings,
  Commercial failures, replacement records and inventory reconciliation, server-verified admin
  authorization with parent denial, School Queue private ownership/child isolation, and admin
  endpoint frontend routing. Drift tests prove registered inventory, missing registration,
  package-lock drift, and stale registered paths.

## Product Owner blockers

The Commercial target intentionally reports blockers for resources whose commercial rights are not
evidenced. Resolving them requires paid licensing, replacement, or legal/ownership decisions; this
implementation does not choose among those options.
- The current Commercial audit remains `FAIL` until the Product Owner resolves the recorded
  dependency, content, School Queue, dataset, manifest, and adapter review decisions.

## Delivery

- Branch: `phase18/commercialization-gate`.
- Based on merged main `1ca8037`.
- Commit and push completed; do not merge automatically.
- Stop at Phase 18; do not start Phase 19.
