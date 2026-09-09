# Profile card Phase 4 QA — V99.02

Run: `node scripts/profile-card-qa.cjs` from the repository root.

Passed:
- Classic inline JavaScript syntax in index/admin (external scripts, modules and JSON/import maps excluded).
- Activity captions: loading, error, empty, today, 86 days ago, missing timestamp.
- Rendered activity states and existing Log/Case navigation destinations using mocks.
- Timeline: personal period, excessive internship span, missing/reversed/invalid dates, valid and completed rotations.
- Actual profile markup/style fixture: long Thai name at 320px and 1440px, no document overflow.
- Activity buttons exceed 44px height at 320px.
- Tab focus has a visible outline; Enter expands More actions.
- Schedule is exposed as a native button.

Limitations / remaining release verification:
- Browser fixture uses synthetic data and no Firebase connection; it does not prove authenticated end-to-end flows.
- Actual LINE LIFF, iOS Safari, Android, VoiceOver/TalkBack and live submission/check-in writes not tested.
- Toolbar coarse-pointer sizing set to 44px; physical touch-device verification remains outstanding.
- No live user data or scoring was modified.
