# RELEASE NOTES V90.57

Date: 2026-04-17
Branch: production

## Summary

Moved KPI summary chips (Current Bounty, Next Reward) into the Profile Header row under intern date fields for faster visibility, and removed duplicate KPI rendering from the Grand Line dashboard.

## Changes

- Repositioned KPI chips into Profile Header (below Start/End Date row) in:
  - index.html
  - public/index.html
- Kept existing IDs as single source of truth:
  - bounty-current
  - bounty-next
- Removed duplicate KPI block from Grand Line dashboard section in:
  - index.html
  - public/index.html
- Added responsive style tuning for profile KPI chips on mobile breakpoints in:
  - index.html
  - public/index.html

## Why This Release

Previously, KPI values were displayed lower in the page inside Grand Line, requiring extra scrolling and duplicating summary context. This release surfaces KPI values earlier in the profile area and prevents duplicate-ID/UI drift risks.

## Verification

- Live source check confirms KPI IDs appear once each and are under Profile Header container:
  - https://mlpditto.github.io/INTERN-PORT/index.html
- Confirmed Grand Line no longer contains KPI HTML block with bounty IDs.
- Confirmed mobile CSS override exists for profile-kpi-strip under max-width: 768px.
- Local syntax/problem scan reports no issues in updated pages:
  - index.html
  - public/index.html
