# RELEASE NOTES V90.53

Date: 2026-04-16

## Summary

V90.53 delivers a production hotfix for LIFF case submission failures caused by missing Firebase auth context under Firestore rules requiring authenticated requests.

## Fixed

- LIFF users could see error `Missing or insufficient permissions.` when submitting a case.
- Root cause: LIFF identity existed, but Firebase Auth session was not guaranteed before writing to Firestore `cases`.

## Changes

- Added `ensureFirebaseAuth()` in LIFF runtime pages to bootstrap Firebase anonymous auth when no current user exists.
- Updated `submitCase()` flow to:
  - attempt auth bootstrap before write,
  - retry once on `permission-denied` after re-checking auth,
  - preserve user-facing success/failure UX.
- Synced runtime/admin version labels to V90.53 across required deploy mirrors.

## Files Updated

- index.html
- public/index.html
- netlify-deploy/index.html
- admin.html
- public/admin.html
- netlify-deploy/admin.html
- SYSTEM_OVERVIEW.md
- DEPLOY_ARTIFACT_2026-04-16.md

## Validation

- Firestore write path for case submission now includes authenticated context bootstrap.
- No syntax errors introduced in updated runtime files.
- Version markers aligned to V90.53 across the historical runtime target set for this release.

## Deployment Notes

- Deploy from `production`, then merge back to `main`.
- Keep mirror sync policy enforced for active root/public runtime pairs.
