# Deploy Artifact - 2026-04-16 (V90.55)

## Scope

- Grand Line dashboard compacted to lean list rows with single active highlight and neutral non-active state.
- Added details toggle for Lean Metrics with default collapsed mode and zero-activity header state.
- Hardened reflective listeners with auth-ready guard to reduce permission-denied race noise.
- Version synced across all six mandatory runtime targets to V90.55.

## Files Included

- admin.html
- index.html
- public/admin.html
- public/index.html
- netlify-deploy/admin.html
- netlify-deploy/index.html
- SYSTEM_OVERVIEW.md
- RELEASE_NOTES_V90.55.md

## Deployment Notes

- This artifact captures LIFF case-permission hotfix + auth bootstrap + version sync in one release unit.
- Local editor preferences file remains excluded from deploy commit.

## Verification

- Editor diagnostics checked for all modified runtime HTML files.
- No editor errors reported after final patch.
- Version verification completed for title/comment/badge/footer markers on six runtime targets.
