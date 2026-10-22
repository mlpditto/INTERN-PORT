# Quiz feedback (intern sheet, admin panel)

The "How was this quiz?" sheet, its AI next-topic chips, the reminder popup, and the admin feedback panel with bonus / repair.

## How to get to it (user POV)

Intern: after a quiz, or the reminder popup. Admin: Quiz Engine ▸ 💬 Feedback panel.

## Scripts that drive it

- `quiz-feedback-lean-qa` — lean sheet with EN | 한 | ไทย capsule, rating chips, topic
- `quiz-feedback-ai-qa` — ✨ AI next-topic chips: skeleton → chips, proxy answered by the script
- `quiz-feedback-remind-qa` — "feedback not given yet" rules (pending / inPeriod / decide)
- `quiz-user-ui-check` — quiz + feedback responsive at four widths, language callback, topic dedup
- `quiz-feedback-qa` — admin panel model chips: one per catalogue model, legacy defaults migrate
- `quiz-feedback-lean-signal-qa` — admin panel: one row of pills, slim AI Insight, icon filter rail, ⏰ Signal
- `feedback-empty-praise-qa` — a 10/10 with no comment is kept behind a 👍 chip, still counted
- `feedback-addon-bonus-qa` — 🎁 add-on credits 0–1.0 once per quiz as its own checkin_logs row
- `feedback-delete-keeps-quiz-points-qa` — deleting a feedback never takes quiz points
- `feedback-revert-repair-qa` — ↩️ Repair finds only the old revert rows and gives the score back

## What usually lies

- `pointsEarned` on a feedback doc is a snapshot, not a credit — a fixture that treats it as points will "prove" the wrong subtraction.
- The AI chips test answers the proxy itself (route interception); if the route pattern misses, the sheet shows the skeleton forever and the wait times out rather than failing clearly.
