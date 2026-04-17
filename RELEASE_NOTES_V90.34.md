# RELEASE NOTES V90.34

Date: 2026-04-16
Branch: production

## Summary

This release finalizes admin-side UX updates and deploy sync for dashboard/archive flow and quiz editor controls.

## Changes

- Replaced Clone Question icon with sheep emoji (`🐑`) in quiz question editor actions.
- Moved `QUEST HISTORY & ARCHIVE` out of Dashboard and placed it inside `Archive` modal.
- Expanded `Kanban Board` layout to use full available width with responsive grid behavior.
- Synced feedback panel enhancements and UI updates across:
  - `admin.html`
  - `public/admin.html`
  - `netlify-deploy/admin.html`

## Version Sync

Updated release version to `V90.34` across release targets used at that time (historical):

- `admin.html`
- `index.html`
- `public/admin.html`
- `public/index.html`
- `netlify-deploy/admin.html`
- `netlify-deploy/index.html`

Also updated:

- `SYSTEM_OVERVIEW.md`

## Notes

- No backend/API schema changes.
- No Firestore migration required.
