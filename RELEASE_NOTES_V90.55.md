# RELEASE NOTES V90.55

Date: 2026-04-17

## Summary

V90.55 delivers a lean UI refactor for Grand Line Dashboard and runtime stability hardening for reflective log listeners under Firebase auth-gated Firestore rules.

## UX Improvements (Grand Line LEAN)

- Converted top 3 stat cards into one compact summary bar:
  - Current Bounty
  - Next Reward
  - Crew Rank
- Converted metrics display into compact inline chips.
- Added Details toggle for metrics card:
  - Default state: collapsed
  - Zero activity state label: `Metrics (0 activity)`
- Converted tool cards to compact list rows (Quiz/Mission/Case/Work).
- Added status dots for each row.
- Applied single-active highlight model:
  - Only the currently open tool row shows active/in-progress emphasis.
  - Other rows use neutral style to reduce visual noise.
- Tightened row padding while preserving minimum touch target (44px).

## Stability Improvements

- Reflective listeners are guarded by auth-ready flow before opening snapshots.
- Reduced permission-denied race behavior in reflective history loading paths.

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

- No syntax/editor errors in updated runtime HTML files.
- Version markers synced to V90.55 across the historical runtime target set used for this release.
- Public and Netlify mirrors aligned with root runtime behavior.

## Deployment Notes

- Release follows production-first workflow.
- Keep `.vscode/settings.json` excluded from release commit.
