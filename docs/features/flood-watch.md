# Flood watch

Open-Meteo / canal-gauge flood alerts: the intern popup, the profile river strip, the 10 km summary, district tables and tiers in functions.

## How to get to it (user POV)

Intern: popup on open when not calm; profile card river strip; History rail card.

## Scripts that drive it

- `flood-popup-lean-qa` — blend popup: green pill + two flat rows when ok
- `profile-card-river-qa` — river flow is an in-flow strip on the profile card
- `flood-10km-check` — popnixNear() summary within 10 km; nothing written when calm
- `flood-district-check` — 2554 / 2569 district tables + Nominatim name normaliser
- `flood-tier-check` — tiers 1–4 from the nearest gauge with the ~6 h lead time

## What usually lies

- Open-Meteo is stubbed in the browser harnesses; the functions checks run the real tier logic on fixed gauge numbers — change the thresholds in both places.
