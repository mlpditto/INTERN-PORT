# RELEASE NOTES V90.44

Date: 2026-04-16
Branch: production

## Summary

Version synchronization release to fix stale public version display and align release targets at that time.

## Changes

- Synced release version to `V90.44` across release targets at that time (historical):
  - `admin.html`
  - `index.html`
  - `public/admin.html`
  - `public/index.html`
  - `netlify-deploy/admin.html`
  - `netlify-deploy/index.html`
- Updated visible admin version badges to `V90.44` in:
  - `admin.html`
  - `public/admin.html`
  - `netlify-deploy/admin.html`
- Updated release comment headers to `V90.44` in all historical targets for this release.
- Updated `SYSTEM_OVERVIEW.md` header/rule version reference to `V90.44`.

## Why This Release

Public URL still displayed `V90.41` because the runtime HTML titles and badge strings were not bumped in the deployed targets, even though newer commits existed.

## Verification

- Confirm all historical target files for this release contain `V90.44` in title/release comment.
- Confirm admin header badge shows `V90.44`.
- Confirm branch sync sequence: `production` push, then merge to `main`, then push `main`.
