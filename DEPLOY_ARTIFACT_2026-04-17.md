# Deployment Artifact - 2026-04-17

## Scope

- LIFF runtime stability fixes and data-loading resiliency
- LIFF UI redundancy reduction in Grand Line / Quiz surface
- Score consistency fix between profile score and history score display
- Netlify deployment target retirement and documentation/policy updates

## Key Runtime Changes

- Added missing quiz runtime state globals to prevent boot-time ReferenceError.
- Added Firebase auth readiness gating before Firestore listeners start.
- Added Firestore listener error handling and recovery messaging for permission/auth issues.
- Unified quiz history score display to use persisted `quiz_attempts.score` as single source of truth.

## UI Simplification

- Reduced duplicated Quiz status/tool indicators in LIFF sections.
- Removed stale Quiz tool bindings after UI deduplication.
- Kept Mission/Case/Work tool actions while removing overlapping Quiz tool surface.

## Deployment Surface

- Netlify mirror artifacts removed from repository.
- Active sync policy retained for root/public runtime pairs only.

## Files Included

- Runtime HTML updates: `index.html`, `public/index.html`, `admin.html`, `public/admin.html`
- Versioning/policy docs: `VERSION_RULES.md`, `VERSION_SYNC_POLICY.md`
- Release notes normalization: `RELEASE_NOTES_V90.00.md`, `RELEASE_NOTES_V90.33.md`, `RELEASE_NOTES_V90.34.md`, `RELEASE_NOTES_V90.35.md`, `RELEASE_NOTES_V90.36.md`, `RELEASE_NOTES_V90.44.md`, `RELEASE_NOTES_V90.51.md`, `RELEASE_NOTES_V90.52.md`, `RELEASE_NOTES_V90.53.md`, `RELEASE_NOTES_V90.55.md`
- Removed directory: `netlify-deploy/`

## Branch / Release Intent

- Source branch: `production`
- Target publication: GitHub Pages runtime (`/INTERN-PORT/`)
- Post-release sync: merge `production` into `main`

## Notes

- This artifact summarizes the deployment bundle committed on 2026-04-17.
