# Release Notes (V90.69) - Primary System UI Refactor (Admin)

## Summary

- Refactored Primary System selection in admin.html from dropdown to LIFF-style button group for improved usability and visual clarity.
- Maintained compatibility with existing data logic (hidden input value sync).

---

## Technical Changes

### Runtime Files

- `admin.html`
  - Replaced `<select id="edit-case-taxonomy-system">` with a button group UI for Primary System selection.
  - Added script to handle button group selection and value sync.

---

## Deployment Status

- ✅ Production branch updated for V90.69 sync.
- ✅ Main branch prepared to receive production merge.
- ✅ Obsidian release notes updated.
