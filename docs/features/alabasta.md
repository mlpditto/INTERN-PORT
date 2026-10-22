# Alabasta inbox (cases & products)

The admin case / product review inbox: lean panes, status rail, reject chips, bulk delete, product photo tools.

## How to get to it (user POV)

Admin: Dashboard ▸ Alabasta.

## Scripts that drive it

- `alabasta-lean-qa` — lean Case pane header, ⋯ menu, status rail
- `alabasta-product-reject-qa` — Reject modal chip rail, Product pane, inbox banner
- `alabasta-delete-missing-user-qa` — Bulk Delete survives a case whose user doc is gone
- `product-photo-edit-qa` — original captured once; replace / remove / revert paths
- `product-photo-ai-qa` — photo AI: model, prompt rules, image over text, refusals rejected

## What usually lies

- `batch.update()` on a missing doc fails the whole batch — the fixture needs one case whose `users/{id}` is absent.
