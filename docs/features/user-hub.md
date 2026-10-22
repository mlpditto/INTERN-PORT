# User Hub (admin profile modal)

The admin per-user modal: header, profile cards, group picker, History timeline, manual adjustments, log work, birthday, LIFF preview.

## How to get to it (user POV)

Admin: Elite Board row ▸ name → User Hub.

## Scripts that drive it

- `user-hub-header-lean-qa` — one-line header: person · LINE ID · code · EN/TH · points · Beri
- `user-hub-tabs-qa` — always-visible profile + inline collapsible group picker
- `user-hub-card-head-qa` — profile card header is one ~34 px row
- `hub-cards-multi-open-copy-qa` — any number of cards open; ⧉ Copy all
- `userhub-lean-v185-qa` — History collapses decay rows, Activity legend, ⓘ, radar tooltips
- `history-chip-timeline-qa` — User Hub ▸ History = chip rail + one timeline by day (vm)
- `history-groups-qa` — History groups: stable ids, separate currencies, legacy rows
- `manual-adjust-lean-qa` — Edit Manual Adjustment: pills, fake Firestore
- `log-work-file-qa` — 📤 Log work for user: link OR file stored like Import CV
- `profile-addresses-qa` — Contact: current + ID-card + extra labelled addresses
- `gs-birthday-age-qa` — Birthday read value shows the age (pinned clock)
- `birthday-this-month-qa` — 🎂 chip on rows + header note (Bangkok time)
- `hub-avatar-camp-qa` — tap photo: Camp user grey + 🙈, one tap brings back
- `user-preview-title-row-qa` — 📱 LIFF Preview buttons; Rewrites 🏷️ titles row
- `row-rail-docs-check` — row rail: 📎 Documents in the 📅 slot, 📅 in ⋯ (static)
- `user-hub-division-pick-qa` — two-step group picker: Division then its groups

## What usually lies

- Age / birthday tests pin the clock; running them unpinned drifts a year on the next birthday.
- The User Hub modal is opened on top of the Elite Board — selectors inside `#userHubModal` only, or the board's own chips match first.
