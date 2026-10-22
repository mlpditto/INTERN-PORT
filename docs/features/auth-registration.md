# Auth, registration & access requests

LIFF sign-in, enrollment code, Request Access, pre-register, and the admin end of those requests.

## How to get to it (user POV)

Intern: first open → Register / enrollment modal; Profile ▸ Request Access. Admin: Dashboard ▸ Access Requests; User Hub ▸ Pre-register.

## Scripts that drive it

- `deleted-user-ghost-qa` — a deleted users/{uid} lands on Register, never a 0-point ghost
- `require-registration-check` — every score / Beri / submit entry starts with requireRegistered()
- `listener-auth-race-qa` — quest_submissions listener waits for Firebase Auth (Firefox "Read denied" toast)
- `request-division-optional-qa` — Request Access asks for an optional Division, not a group
- `prereg-division-qa` — Pre-register: Division / Group / Also-in chips, code carries memberships
- `access-requests-one-surface-qa` — a pending request shows once (table), not again as a Kanban card

## What usually lies

- Background writers that `set(..., {merge:true})` on a missing user doc recreate the ghost; stub Firestore must report the doc as missing, not empty.
- The intern harness needs `window.userId` AND `window.myUserDoc`; with only one of them the page sits on the Register modal and every later selector is hidden.
