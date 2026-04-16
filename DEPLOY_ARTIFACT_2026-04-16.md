# Deploy Artifact - 2026-04-16 (V90.53)

## Scope

- Hotfix for LIFF case submission permission issue (Missing or insufficient permissions).
- Added Firebase anonymous auth bootstrap before LIFF Firestore workflows.
- Added submitCase retry path on permission-denied after auth bootstrap.
- Version synced across all six mandatory runtime targets to V90.53.

## Files Included

- admin.html
- index.html
- public/admin.html
- public/index.html
- netlify-deploy/admin.html
- netlify-deploy/index.html
- SYSTEM_OVERVIEW.md
- RELEASE_NOTES_V90.53.md

## Deployment Notes

- This artifact captures LIFF case-permission hotfix + auth bootstrap + version sync in one release unit.
- Local editor preferences file remains excluded from deploy commit.

## Verification

- Editor diagnostics checked for all modified runtime HTML files.
- No editor errors reported after final patch.
- Version verification completed for title/comment/badge/footer markers on six runtime targets.
