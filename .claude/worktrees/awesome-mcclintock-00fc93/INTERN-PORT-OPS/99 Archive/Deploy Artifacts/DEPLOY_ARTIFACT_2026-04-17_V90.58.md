# Deploy Artifact - 2026-04-17 (V90.58)

## Scope

- Alabasta case inbox visibility and review/archive flow improvements
- LIFF profile KPI refinement for rank progression and certificate readiness
- Runtime version synchronization across mandatory deployment targets

## Runtime Changes Included

- Added archived visibility toggle in Alabasta Case Inbox (`Show Archived`).
- Improved reviewed/pending/archived status rendering and counting behavior.
- Updated LIFF profile header KPI strip to include:
  - Today pts
  - Streak
  - Next Rank with required points
  - Certificate eligibility status
- Added dynamic certificate status message:
  - `Certificate: Eligible now ✅` when score >= 30
  - `Certificate: Need X.XX pts` otherwise

## Version Sync Result

Synchronized to `V90.58` in all required runtime targets:

- admin.html
- public/admin.html
- index.html
- public/index.html

## Supporting Docs

- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]]
- RELEASE_NOTES_V90.58.md
- [[06 Runbooks/VERSION_RULES|VERSION_RULES.md]]
- [[06 Runbooks/VERSION_SYNC_POLICY|VERSION_SYNC_POLICY.md]]

## Release Intent

- Source branch: production
- Deployment target: GitHub Pages runtime (`/INTERN-PORT/`)
- Post-release action: merge production into main

## Verification Checklist

- Title markers synchronized
- Visible header badges synchronized
- Head release comments synchronized
- Runtime pages updated in both root/public mirrors
