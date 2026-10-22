# Submit New, cases, events & the ＋ tab

The intern ＋ launcher (Submit New), case / product / event forms, My Cases rows, and the admin e-mail on a new case.

## How to get to it (user POV)

Intern: the ＋ sunset tab on the right edge ▸ Submit New. Home ▸ My Cases.

## Scripts that drive it

- `fab-edge-tab-qa` — the ＋ is a sunset tab on the right edge, above the Safari bar
- `submit-new-lean-qa` — Submit New lean: chips, pinned Submit, one-row Case form
- `submit-product-launcher-qa` — the Product launcher opens the in-modal Product pane
- `submit-event-qa` — new invites start private (invite-ticket.js)
- `case-studio-ui-check` — Case studio UI (Playwright)
- `my-cases-rows-qa` — My Cases as timeline rows on desktop (≥ 701 px)
- `case-mail-notify-check` — notifyAdminOnNewCase mails the admin; LINE + mail independent

## What usually lies

- `[hidden]` loses to `display:flex` on the preview row — assert computed display, not the attribute.
- Phone vs desktop rows differ at 701 px; the phone harness (390 px) cannot see the desktop rows.
