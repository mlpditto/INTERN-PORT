---
type: runbook
status: active
owner: intern-port-team
updated: 2026-04-18
---

# Runbook: Deploy Production then FF Main

## Standard Flow

1. Checkout production and pull latest.
2. Verify target HEAD commit.
3. Complete QA session note and mark pass.
4. Push production.
5. Checkout main.
6. Merge with --ff-only from production.
7. Push main.
8. Create release note.

## Required QA Gates

- Profile: Name/Group/Score/Quiz
- KPI: Today/Streak/Next Rank/Certificate
- Voyage Metrics: separate row and always visible
- Smoke: Quiz/Mission/Case/Work no JS error
- LIFF: tested with 1-2 real user accounts

## Mirror Rule

If UI changes, update source and public files together in same cycle.
