# RELEASE NOTES V90.51

Date: 2026-04-16
Branch: production

## Summary

Full version resync release to align Admin and LIFF surfaces across root, public, and netlify deploy targets.

## Changes

- Synced release version to `V90.51` across mandatory runtime targets:
  - `admin.html`
  - `index.html`
  - `public/admin.html`
  - `public/index.html`
  - `netlify-deploy/admin.html`
  - `netlify-deploy/index.html`
- Updated visible admin version badges to `V90.51` in:
  - `admin.html`
  - `public/admin.html`
  - `netlify-deploy/admin.html`
- Updated LIFF footer version text in root/public/netlify index pages to `V90.51`.
- Updated `SYSTEM_OVERVIEW.md` header and rule reference to `V90.51`.

## Why This Release

Version drift existed between root pages and mirror deploy targets, causing inconsistent version display between Admin and LIFF URLs.

## Verification

- Confirm same `V90.51` appears in title/release markers across six mandatory targets.
- Confirm admin visible version badge is `V90.51` in all deploy surfaces.
- Confirm release flow completed: push `production`, merge into `main`, push `main`.
