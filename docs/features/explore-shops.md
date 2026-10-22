# Explore shops & reviews

Explore tiles, the Open tooltip, the review sheet, and the admin Explore Links cards with logo / category tools.

## How to get to it (user POV)

Intern: home ▸ Explore. Admin: Dashboard ▸ Review Links.

## Scripts that drive it

- `explore-tiles-qa` — one tinted tile, whole tile opens, two best unearned double-width
- `explore-open-tooltip-qa` — the cap note is the Open button tooltip (Thai in data-th-title)
- `review-stars-qa` — lean review sheet: ★ rating, quick tags, counter, ฿ + Send
- `review-links-lean-qa` — admin cards: 48 px logo, icon-only pause + delete
- `review-link-image-url-qa` — logo from a direct picture link (server + modal row)
- `shop-logo-search-check` — findShopLogo: one search call → guarded fetch → title compare (offline)
- `shop-logo-search-ui-qa` — 🔎 Search: found pictures arrive unticked, amber when the name differs
- `shop-category-check` — Jev suggests a category per shop, failures isolated
- `shop-category-ui-qa` — ⚡ Categories: ≥ 80 % ticked, doubtful amber

## What usually lies

- Jev / logo callables are stubbed; a stub that always succeeds hides the "failures isolated" paths — keep one shop failing.
