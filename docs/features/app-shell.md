# App shell & modals

What both pages do before any feature: script syntax, version banner, toasts, modal stacking.

## How to get to it (user POV)

Intern: open the LIFF app (new-version banner, toasts). Admin: any modal that opens over the User Hub.

## Scripts that drive it

- `inline-script-syntax-check` — every inline <script> in both pages parses, module scripts included
- `update-version-qa` — the version title stays inside the byte range old tabs poll
- `update-banner-lean-qa` — intern "new version" banner is one ~32 px row
- `index-toast-fit-qa` — intern toast fits its message (no 250 px floor)
- `admin-toast-fit-qa` — admin toast fits its message, wraps at the 560 px cap
- `divisions-modal-over-userhub-qa` — Divisions & Groups paints above the User Hub, Visibility above that
- `liff-preview-over-userhub-qa` — the LIFF Preview phone frame paints above the User Hub

## What usually lies

- A modal that is still `display:none` measures 0 px high and 0 px wide — a size assertion then passes for nothing. Assert `display:flex` (or wait a rAF after opening) before measuring.
- The intern page's global `button { min-height:48px }` and admin's `.gs-profile-card button { min-height:44px }` silently win over component CSS; check computed heights, not the stylesheet.
