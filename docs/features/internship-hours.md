# Internship hours

Hours from the MLP time clock: pairing, sync writes, the User Hub bar, the intern Period card goal.

## How to get to it (user POV)

Admin: User Hub row ▸ ⏱. Intern: Personal Info ▸ 📅 Period.

## Scripts that drive it

- `intern-hours-qa` — pairing, name link, sync writes, hours bar, ⏱ setter
- `intern-hours-goal-qa` — Period card: goal states grey → pending → amber → n / goal h

## What usually lies

- Hours sync only when `internHoursTarget > 0`; a fixture without the target proves nothing about the sync.
