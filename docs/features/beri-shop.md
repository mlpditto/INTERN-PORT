# Beri (rewards shop, ¥→฿)

The intern Beri shop and the admin Beri Reward / "A Shop for Killers" panels.

## How to get to it (user POV)

Intern: home ▸ Beri shop. Admin: Dashboard ▸ Beri Rewards / redemptions.

## Scripts that drive it

- `beri-shop-qa` — 499/500 boundary, permanent unlock, old requests, disclosure
- `beri-reward-image-price-check` — card + row templates with image + full price (no browser)
- `beri-reward-save-qa` — Save closes the modal before the upload; network via controlled promises
- `beri-shop-lean-qa` — lean admin panel: no paragraph, give-Beri handlers
- `beri-baht-rate-check` — ¥→฿ helpers: cache = no network, source chain falls through

## What usually lies

- The rate helpers read `localStorage` first; a test that forgets to clear it never exercises the network chain.
