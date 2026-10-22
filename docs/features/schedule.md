# Schedule, check-in, goals & holidays

The intern Schedule page (week strip, month card, agenda buckets, check-in pill, FIN), goals, holidays on both sides.

## How to get to it (user POV)

Intern: home ▸ Schedule. Admin: Events form ▸ 🎌 Holidays panel; Dashboard 🗓 strip.

## Scripts that drive it

- `schedule-ui-qa` — one-page Schedule: range row, week strip rings, month card, agenda list, tiles
- `schedule-s1-qa` — month card names its month and folds (clock pinned to Thu 22 Oct 2026)
- `schedule-s2-qa` — "Day N / M" bar + days left under the title (clock pinned)
- `schedule-r4-qa` — This week / Next week follow the strip's Mon–Sun weeks; Next week folds
- `schedule-checkin-fin-qa` — 🔥 check-in pill inline in the TODAY header; 💰 FIN moved into Schedule
- `schedule-holidays-qa` — holidays for the intern's nationality + approved health / cat days; Nationality dropdown
- `auto-checkin-check` — opening the app checks the intern in (open / manual / activity sources, no browser)
- `fin-sync-check` — FIN cross-device sync: two fake devices, one Firestore doc, transaction stub
- `assigned-goals-qa` — assigned goal date boundaries, dedup, merge map order
- `internship-progress-ko-qa` — Schedule help sheet + SMART GOALS editor in Korean mode
- `holidays-admin-qa` — admin 🎌 panel: pick country + year, tick, save to holidays/<CC>_<year>; Dashboard strip
- `th-holidays-check` — public/th-holidays.json + its ICS builder on a fixture

## What usually lies

- **Weekday trap.** Fixtures placed "+2 / +3 days" fall into the FOLDED Next week bucket from Friday on (weeks are Mon–Sun since V101.184). `schedule-ui-qa` failed Fri–Sun on CI too until it opened `window._schNextExpanded` + `schRenderAgenda()` around the list read (2026-10-23). Pin the clock (s1 / s2 do) or open the fold before asserting.
- Run with `TZ=Asia/Bangkok`; CI pins it. A fixture date built with `toISOString().slice(0,10)` is the UTC date — yesterday until 07:00 Bangkok.
