# Deploy Artifact - 2026-04-16 (V90.52)

## Scope

- Grand Line Dashboard redundancy reduced in LIFF by auto-hiding tool-card row while a section is open.
- Minimal section-header mode added for Quiz / Mission / Case / Work to reduce duplicated visual layers.
- Admin diagnostic helper added to explain why a user cannot see specific quizzes (read-only).
- Version synced across all six mandatory runtime targets to V90.52.

## Files Included

- admin.html
- index.html
- public/admin.html
- public/index.html
- netlify-deploy/admin.html
- netlify-deploy/index.html
- SYSTEM_OVERVIEW.md
- RELEASE_NOTES_V90.52.md

## Deployment Notes

- This artifact captures LIFF UI compaction + admin diagnostics + version sync in one release unit.
- Local editor preferences file remains excluded from deploy commit.

## Verification

- Editor diagnostics checked for all modified runtime HTML files.
- No editor errors reported after final patch.
- Version verification completed for title/comment/badge/footer markers on six runtime targets.
