# Deploy Artifact — 2026-04-17 (V90.59)

## Version
**V90.59** — Production release on `production` branch, merged to `main`.

## Summary of Changes Since V90.58

### 1. Voyage Metrics Redesign (`index.html`, `public/index.html`)
- Renamed section from "Lean Voyage Metrics" → **"Voyage Metrics"**
- Replaced Kanban board counters (WIP/Queue/Shipped/Flow) with meaningful scored-item counts:
  - **Quiz** — Number of Quiz attempts with score > 0 (from `usersWorksCache`)
  - **Reflective** — Number of Reflective Logs with `adminBonus > 0`
  - **Case** — Number of Alabasta Cases with `adminBonus > 0` (from `myCasesCache`)
  - **Total** — Sum of all three
- Added `window.myCasesCache` initialization in `loadMyCases()` to enable Case tracking
- Updated flow bar to scale with total scored items count

### 2. Clickable WORKS & Reflective Logs in User Hub (`admin.html`, `public/admin.html`)
- Activity Log items of type `work` are now **clickable** (show ↗ icon, cursor pointer)
- Activity Log items of type `reflective_log` are also **clickable**
- Clicking opens a **detail popup modal** (`workDetailModal`) created dynamically
- **Work detail modal shows:**
  - Title, Status (color-coded), Score, Submitted timestamp, Task type
  - Description (if present)
  - Attachment link (if `fileUrl` present)
  - Teacher/Admin comments (if `comment` present)
- **Reflective log detail modal shows:**
  - Bonus points awarded, date
  - Full log content (scrollable)
  - Admin comment (if present)
- Work document data (`workData`, `workDocId`) is now persisted in `allLogs` during User Hub load

## Version Sync Targets (All Updated to V90.59)

| File | Title |
|------|-------|
| `admin.html` | MEDLIFE+ Admin V90.59 (Turbo) |
| `public/admin.html` | MEDLIFE+ Admin V90.59 (Turbo) |
| `index.html` | Intern Progress Online (V90.59) |
| `public/index.html` | Internship Portfolio (V90.59) |

## Git

- Source branch: `production`
- Deploy target: GitHub Pages via `main`
- Commits included:
  - `6f8a7e3` Update Voyage Metrics: Quiz/Reflective/Case counts with points
  - `da4069a` Add clickable WORKS and Reflective Logs in User Hub Activity Logs
  - (this version bump)

## Verification Checklist

- [x] Version bumped in all 4 runtime targets
- [x] `Voyage Metrics` section header updated
- [x] `myCasesCache` populated in `loadMyCases()`
- [x] `showHubItemDetails()` function added to both admin files
- [x] `createWorkDetailModal()` function added to both admin files
- [x] Work items and Reflective logs show clickable indicators in Activity Logs
- [x] Deploy artifact created
- [x] Pushed to `production` and merged to `main`
