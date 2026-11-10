# Documents, Import CV & certificates

The 📎 Documents sheet with two-model AI review and history, 📄 Import CV, certificate files.

## How to get to it (user POV)

Admin: User Hub row rail ▸ 📎 Documents / 📄 Import CV; Certificates.

Intern: ⋯ on the profile card ▸ the 🏅 ring on the month row turns into 🎓 (tap = request) once the points gate is reached or on the last day; ⏳ sent, 🎓✓ approved. A 2-step how-to (cert-tour.js) shows once per device.

## Scripts that drive it

- `documents-round1-qa` — opaque names show as "CV #n", round-1 layout
- `apd-docs-lean-qa` — one head line, rows = icon · name · size · 🤖 ↗ 🗑
- `apd-lean-rails-qa` — review models A / B as provider-first rails
- `apd-ai-btn-qa` — 🤖 widens to Review ×2, vendor dots, count after
- `apd-review-history-qa` — ⧉ copies an opinion; runs kept in applicant_reviews
- `admin-cv-import-qa` — Import CV compare rules (new / same / differs)
- `cv-import-model-rail-qa` — Import CV rail before a file is picked; pick remembered
- `cv-review-two-models-qa` — 💬 Review ×2 on the imported text
- `certificate-files-check` — private snapshots, first original preserved, upload failure
- `cert-request-ring-qa` — 🏅 ring = request (🎓 / ⏳ / 🎓✓, fits 30px), last-day request below the gate (V101.300: on the bar, no big grad slot), how-to once per device
- `cert-step-bar-qa` — V101.299 day bar right label = cert step (🏅 +n · 🎓 Request · ⏳ · ⬇️ PDF), 🎓 pin at the bar end, survives a date redraw
- `cert-classic-frame-qa` — the frame follows the layout: 🌊 Wada = thin wave line, ⚡ Naru = Classic (navy band, rosette holds the QR); signature (Great Vibes) left + DATE ISSUED (today · period · hours) right, both frames, 4 languages
- `cert-name-row-qa` — Name row pick A (V102.623): one row, icons in the boxes, 🖨️ = print box, ✂️ → editable First / Last + ✓ Save (no confirm), Thai in EN = amber + ⚠️, both layouts
- `cert-issue-deliver-qa` — Certificate Request card rail (🎓 Issue · 📄 PDF · 👤 Hub · 💬 Chat · 🗑); intern 🎓✓ → sheet ⬇️ PDF via `getMyCertificate` (LINE ID token) + 📤 verify-link share

## What usually lies

- Uploads go to Storage `applicant-docs/<owner>/<sha256>.<ext>`; the stub must return a stable sha or "first original preserved" cannot be told from a re-upload.
