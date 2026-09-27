# Parent Google sign-in and child profiles

## Identity and scope

The parent signs in with Google Identity Services. The backend verifies the ID token signature,
issuer, audience, and expiry using `google-auth`; the immutable Google `sub` resolves the
TongXuan parent account. Email and display name are contact/display fields, never account keys.
The backend then issues its own signed application session in an HttpOnly cookie.

Each child profile is stored with a nullable `children.parent_id`. Authenticated parents can
create and list only children linked to their own parent row. Children do not have separate
accounts or login credentials. Production child-scoped routes enforce ownership from the database;
client-supplied `parent_id`, display names, and local PINs do not grant access. The existing
internal bearer-session adapter remains available for approved developer/admin integrations.

## Existing UI placement

The Google sign-in control appears in the existing Parent surface. Child profile creation,
selection by backend ID, and sign-out appear in the existing Settings → Family area. This keeps
parent account management behind the existing secondary settings surface; Home remains unchanged.
Buttons retain visible keyboard focus and use the app's existing form/dialog hierarchy. Loading,
unavailable, and sign-in failure states are exposed as status/alert text with retry. No visual
redesign or token change is part of Issue #66.

When auth is required and no parent is signed in, protected child routes redirect to the existing
Parent surface. After sign-in, the parent explicitly selects a child in Settings; the canonical
child Home and lesson routes use that exact numeric child ID. An unresolved ID fails closed and is
not replaced by a name match or the first child returned by the API.

## Browser security and deployment

Production requires a configured `GOOGLE_CLIENT_ID`, a 32-character application signing secret,
an explicit allowlist of browser origins, HTTPS, persistent database/backup paths, and the
existing reward-confirmation password. Google login uses GIS's double-submit CSRF token; unsafe
cookie-authenticated API writes require both an allowed `Origin` and the matching
`X-CSRF-Token` header. The CORS preflight allowlist includes that header. Logout requires an
allowed `Origin`. See [the production runbook](production-runbook.md) for deployment and rollback
steps.

Schema v5 adds the parent table and nullable ownership link. Existing children and learning data
are preserved without assigning an owner. Such legacy rows remain unowned and are not shown in a
Google parent's profile list. Do not claim them automatically; any future assignment requires a
separately authorized, auditable migration decision.

## Verification boundaries

Verifier, cookie-session, CSRF, ownership, migration, exact-ID UI, error-state, and route tests use
controlled fixtures. Live Google sign-in requires the deployment's actual OAuth client ID and is
not verified in a local test environment without those production credentials. Real parent/child
and device behavior also requires supervised validation.
