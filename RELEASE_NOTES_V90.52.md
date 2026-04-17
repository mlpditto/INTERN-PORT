# RELEASE NOTES V90.52

Date: 2026-04-16
Branch: production

## Summary

UI redundancy reduction for LIFF, admin-side visibility diagnostics, and full version sync for active targets at release time.

## Changes

- Added LIFF dashboard redundancy control to hide the top Grand Line tool-card row when a tool section is open.
- Added LIFF minimal header mode for Quiz / Mission / Case / Work sections to reduce duplicate visual hierarchy.
- Added read-only admin diagnostic helper for quiz visibility:
  - `diagnoseUserQuizVisibility(userRef, options)`
  - Alias: `diagnoseQuizVisibilityForUser(userRef, options)`
- Synced release version to `V90.52` across release targets at that time (historical):
  - `admin.html`
  - `index.html`
  - `public/admin.html`
  - `public/index.html`
  - `netlify-deploy/admin.html`
  - `netlify-deploy/index.html`
- Updated `SYSTEM_OVERVIEW.md` top version references to `V90.52`.
- Updated `DEPLOY_ARTIFACT_2026-04-16.md` to reflect this release scope.

## Why This Release

User-facing quiz visibility mismatches required faster root-cause diagnostics in admin, while LIFF workflow needed cleaner UX with less duplicated section chrome.

## Verification

- No diagnostics errors reported in modified runtime HTML files.
- Verified `V90.52` markers in title/release comments/visible badges across all release targets for that release.
- Diagnostic functions exported to `window` and callable from Admin Console.
