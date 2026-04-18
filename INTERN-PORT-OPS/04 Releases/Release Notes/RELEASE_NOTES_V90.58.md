# Release Notes V90.58

Release date: 2026-04-17
Version: V90.58

## Summary

This release aligns Admin and LIFF runtime behavior around Alabasta scoring flow, profile KPI clarity, and certificate eligibility visibility. It also synchronizes version markers across required runtime targets.

## Highlights

- Added safer Alabasta archive visibility controls with "Show Archived" filtering in admin inbox views.
- Added submit/review score flow support for Alabasta-related handling and archive-oriented review visibility.
- Updated LIFF profile header KPIs to emphasize:
  - Today points
  - Streak
  - Next rank progression
- Replaced milestone-style phrasing with rank-based progression text:
  - `Next Rank: Lv.X ... (Requires Y pts)`
- Added certificate eligibility status in profile header:
  - `Certificate: Eligible now ✅` when score >= 30
  - `Certificate: Need X.XX pts` when score < 30

## Version Sync (Mandatory Targets)

The following runtime targets are synchronized to V90.58:

- admin.html
- public/admin.html
- index.html
- public/index.html

## Documentation Updated

- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]]
- RELEASE_NOTES_V90.58.md (this file)
- DEPLOY_ARTIFACT_2026-04-17_V90.58.md

## Notes

- This release follows production-first branch flow and four-target runtime version sync policy.
