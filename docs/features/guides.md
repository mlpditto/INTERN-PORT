# Guides (intern, admin, deck)

Markdown guides served through guide.js with chip rails, feedback boxes and built PDFs.

## How to get to it (user POV)

Intern: Settings ▸ 📖 Guide. Admin: 📖 header button; 🏴‍☠️ deck badge (deck guide lives in grand-line-deck.md).

## Scripts that drive it

- `intern-guide-qa` — intern guide with a feedback box per section → admin_notifications
- `admin-guide-qa` — admin guide opens once after first login; chip rail
- `guide-feedback-admin-qa` — admin ▸ 📖 Guide feedback list, newest first
- `guide-pdf-qa` — built PDFs match the markdown sha256 in intern-guide.pdf.json

## What usually lies

- Guide pages pull `marked` / `purify` from a CDN; a harness that blocks all network must let those two through (or stub them) or every section is empty.
- Editing a guide .md without rebuilding the PDF fails `guide-pdf-qa` on CI by design.
