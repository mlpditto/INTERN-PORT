# Intern profile & Personal Info

The profile header, Info modal with ⚙ Settings, Personal Info persona cards, Know thyself, avatar.

## How to get to it (user POV)

Intern: home header → tap name / photo → Info modal; Personal Info cards; Know thyself tab.

## Scripts that drive it

- `profile-header-lean-qa` — one 40 px header block: avatar ring, name over pts, Beri, LV, tool rail
- `profile-card-qa` — profile card activity states, timeline modes, Log / Case destinations (both pages)
- `settings-in-info-qa` — ⚙ moved into the Info modal; privacy panel folds under the title
- `personal-info-health-qa` — persona cards start folded, born-at / reference persons / optional Health (admin side too)
- `intern-address-checkin-ring-qa` — two addresses (ID card + current) and the check-in ring
- `know-thyself-qa` — "In my words" chip stored at personality.self with a merge set
- `avatar-open-browser-qa` — tapping the LINE photo inside LIFF opens the app in the phone browser
- `activity-rewards-check` — home activity reward tiles + monthly progress: 8 tiles, quiz dedup, month filter

## What usually lies

- `liff.isInClient()` is stubbed per test; outside LIFF the avatar must do nothing, so a passing click test needs the stub set to true first.
- Persona cards are "one open at a time": opening the second closes the first, so read values before opening the next card.
