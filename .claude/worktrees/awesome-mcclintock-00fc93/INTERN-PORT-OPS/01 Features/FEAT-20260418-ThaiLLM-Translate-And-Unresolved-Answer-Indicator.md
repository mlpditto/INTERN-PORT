---
type: feature
status: shipped
owner: medlifeplus@gmail.com
branch: main
commit: ed28324
version: V90.60
risk: low
created: 2026-04-18
updated: 2026-04-18
---

# FEAT-20260418-ThaiLLM-Translate-And-Unresolved-Answer-Indicator

## Goal

- Integrate ThaiLLM for Intelligence Translate (Phase 1) in Admin Quiz Editor.
- Improve answer-key completeness visibility by showing unresolved-answer indicators across all questions.

## Scope

- Add ThaiLLM provider support in AI proxy and route model selection from Admin toolbar.
- Add subtle red-dot marker on question navigation buttons when a question has no selected correct answer.
- Add top summary badge: "ยังไม่เฉลย X ข้อ" for quick overview.

## Files Touched

- [x] source file: admin.html
- [x] source file: functions/index.js
- [x] public mirror file: public/admin.html

## Implementation Summary

- ThaiLLM Phase 1
  - Added provider `thaillm` in proxy.
  - Added `THAILLM_API_KEY` as function secret.
  - Added model mapping in client AI core for `thaillm-openthaigpt`.
  - Added ThaiLLM option in Intelligence Translate toolbar.

- Unresolved answer visibility
  - Added `shouldMarkQuestionMissingAnswer(item)` helper.
  - Added red-dot marker on `#quiz-q-nav` buttons for unresolved questions.
  - Replaced exclamation marker with subtle red dot.
  - Added summary badge `#quiz-missing-answer-summary`.
  - Auto-refresh status on toggle, option remove, and pagination refresh.

## Acceptance Criteria

- [x] ThaiLLM appears in Intelligence Translate model toggle.
- [x] Selecting ThaiLLM routes requests to proxy provider `thaillm`.
- [x] Questions without correct answer show red dot in Q nav even when not currently edited.
- [x] Summary badge shows unresolved count and hides when count is zero.
- [x] No diagnostics errors in edited files.

## Test Plan

- Open Admin Quiz Editor and create 3 questions.
- Leave 1 question without any correct option checked.
- Verify that this question shows red dot in Q nav.
- Verify summary badge displays exact unresolved count.
- Check one correct option in unresolved question and confirm dot/summary update instantly.
- Open Intelligence Translate, choose ThaiLLM, run Magic, verify request success through `/api/ai`.

## Rollback Plan

- Revert commit `ed28324` on `main`.
- Redeploy hosting/functions if needed.

## Related

- QA: [[03 QA Sessions/QA-2026-04-18-V90.67]]
- Release: [[04 Releases/Release-Template]]
