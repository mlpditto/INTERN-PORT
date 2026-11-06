# User Hub (admin profile modal)

The admin per-user modal: header, profile cards, group picker, History timeline, manual adjustments, log work, birthday, LIFF preview.

## How to get to it (user POV)

Admin: Elite Board row ▸ name → User Hub.

## Scripts that drive it

- `user-hub-feedback-pane-qa` — V102.602 💬 quiz feedback per intern (owner pick B, `mockups/user-hub-feedback.html`): a header chip after 🪙 with the count (red dot = a report that still needs a fix, `fbNeedsFix`), tap = the pane replaces the profile cards — filter rail (All · ⭐ ≤ 5 · 💬 comment · 🐞 · 💡 + search), one line per feedback (⭐ · quiz · comment · 💡 next topic · date · triage icon), summary row (30-day bars · avg time · gave feedback on n/N), a row opens the per-quiz Feedback panel on this intern (modal lifted to z 100000 like the Review modal does), ‹ Profile brings the cards back; also the EN|TH switch is ONE chip — flag (twemoji) + the current code
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

- The 💬 pane reads `quiz_feedback` once per hub open and keeps it in `_gsFb` keyed by uid; a late answer for a previous intern is dropped by the uid check, so a harness that resolves reads out of order must still see the newer intern's count. `quiz_attempts` is read only when the pane opens (for n/N); `started` / `allowed` are not "done".
- Age / birthday tests pin the clock; running them unpinned drifts a year on the next birthday.
- The User Hub modal is opened on top of the Elite Board — selectors inside `#userHubModal` only, or the board's own chips match first.
