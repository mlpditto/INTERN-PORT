# 🧪 Tester codes

Owner 2026-11-27. Started when a friend testing a game in LINE could not join a room: they had no account, and an intern code needs the full Register form. Picks:
- B + C: one group code many people can use, also sent as a LINE link
- the admin gets its own 🧪 panel (B)
- the phone asks once to read the device ("user อาจไม่สะดวกพิมพ์ ให้ขอ permission แทน")
- lean · inline · less text · English only

Mockups: mockup-tester-code/tester-lean.png.

## Admin (`public/tester-admin.js`, 🧪 right after 📋 Entry in the User Hub bar)

- One row makes a code: Group · 👥 5/10/20 · ⏳ 3/7/14 d · ＋. It writes `tester_codes/TEST-nnnn` = `{ label, max, used, untilMs, paused, testers }`.
- Each code shows `TEST-nnnn · group · used/max · →end`.
  - 📤 copies `https://liff.line.me/<LIFF>?tester=TEST-nnnn` and opens LINE share.
  - ⏸ / ▶ pauses or resumes the code.
  - Live codes are listed first. Ended codes are dimmed and have no buttons.
- Every tester who joined is listed with their device and the code they used.

## Phone (`public/tester-join.js`)

- Two ways in: type `TEST-nnnn` in the Register box (now 9 characters long), or open the `?tester=` link. Either one skips the full form.
- The screen shows 🧪 group · →end, then **✓ Allow device info**, or Skip → 🤖 · 🍎 · 💻.
- Allow reads what the phone already reports: OS and version, the LINE version, and the screen size.
  - Android: the model code is turned into a sales name for common phones (V2250 → vivo V29), using browser hints when the user agent hides the model.
  - iPhone: iOS never gives the model, so the screen size gives a family (390×844 ≈ iPhone 12–14).
- ▸ Start calls `claimTester`. The users listener then opens the app.
- When the code has ended, the tester sees 🧪 Test ended.

## Server (`functions/tester-claim.js`, callable `claimTester`)

- `{ code, peek }` returns the group, the end date and the places left.
- `{ code, device }` creates `users/{lineUserId}`:
  - group `Tester`, `isTester`, and `isIgnored`, which keeps them out of the leaderboard, 🏆, birthdays and LINE notifications
  - `testerCode`, `testerUntil`, and the device fields, cut to short strings
- It refuses:
  - a missing, paused, ended or full code
  - an existing account (interns keep theirs)
  - a sign-in with no LINE link
- Rules: `tester_codes` is admin-only.
- Deploy: `firebase deploy --only functions:claimTester,firestore:rules`.

## QA

- `scripts/tester-claim-check.cjs`: peek, a claim, every refusal, and the device fields being cut.
- `scripts/tester-join-qa.cjs`: the real index.html as a LINE Android phone.
- `scripts/tester-admin-qa.cjs`: the button's place in admin.html, plus the panel itself.

## What usually lies

- The device reading has not been run on a real phone. The model table covers common phones only; unknown codes show as they are.
- Signed-in and in-LINE flows need the owner.
