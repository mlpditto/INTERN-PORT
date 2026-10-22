# Divisions, groups, memberships & Look

The Divisions & Groups window, division colours / links / Look, memberships on both sides, the division field rule.

## How to get to it (user POV)

Admin: User Hub ▸ "Groups & Divisions" link; Elite Board rail. Intern: leaderboard peers.

## Scripts that drive it

- `divisions-a2-qa` — division rail → its groups → the picked group
- `divisions-lean-v3-qa` — one-line division panel, ＋ Division, ⇄ Merge
- `group-look-qa` — 🎨 Look: colour · icon · picture per group / division
- `division-link-qa` — 🔗 one link per division, admin only
- `division-color-check` — CU pinned pink; admin colour wins
- `division-pts-beri-qa` — ⋯ placement, hidden in CAFE, 🌸 chip lists cafePts
- `chip-selected-empty-qa` — a chosen empty chip keeps its real colour
- `memberships-admin-qa` — one primary pair + memberships[]; points stay with the primary
- `memberships-intern-qa` — getLeaderboard sends memberships; myDivisionPeers counts members
- `user-division-field-qa` — users.division is admin-set; legacy docs fall back to the group list

## What usually lies

- Group style lives in `quizzes/--group-style--`; a fake db without that doc paints hashed colours and the Look assertions pass for the wrong reason.
