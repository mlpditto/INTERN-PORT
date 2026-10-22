# Content Creator (CAFE) division

The social-content division: intern post form, admin content board, separate CAFE points.

## How to get to it (user POV)

Intern (CAFE users): the ＋ opens the content form. Admin: Dashboard ▸ 📸 Content Creator.

## Scripts that drive it

- `cafe-content-qa` — cafe-content.js: other users see nothing new; post form
- `cafe-content-admin-qa` — admin board: month filter, totals, like / reach numbers
- `cafe-points-admin-qa` — scoring a social post adds to cafePts; 🌸 chip only when > 0

## What usually lies

- CAFE visibility is per user (`myUserDoc.division`); the shared harness user is not CAFE, so flip the fixture before expecting the form.
