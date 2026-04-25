# RELEASE NOTES V90.42

Date: 2026-04-16
Branch: production

## Summary

One Piece Theme Phase 2 is now fully refined for AI Digital Lab and Laugh Tale, including scoped theme toggle, themed modals, and dynamic AI Storyteller result cards/actions.

## Changes

- Added scoped One Piece theme toggle button in admin top bar:
  - `⚓ OP OFF` / `🏴‍☠️ OP ON`
  - Scope limited to AI Digital Lab and Laugh Tale only
  - Persisted via localStorage (`MLP_ONEPIECE_SCOPE_THEME`)
- Expanded One Piece visual treatment across scoped sections:
  - Wave/float ambient motion
  - Themed cards, toggles, action controls, and panel surfaces
  - Consistent Grand Line color language
- Applied modal skin alignment for:
  - Podcast Recorder modal (`#podcastRecorderModal`)
  - AI Storyteller modal (`#aiStorytellerModal`)
- Refined dynamic AI Storyteller rendering inside `#ai-storyteller-content`:
  - New card shell for loading/success/error states
  - Badge + header structure
  - One Piece styled action buttons
  - Added actions: Copy Result, Re-run, Save Insight, Close
- Updated remaining storyteller/loading UI copy to English where applicable.

## Scope

- Implemented in `admin.html`.
- Scoped visual changes do not affect tabs outside AI Digital Lab and Laugh Tale.
- Normal theme behavior remains unchanged when One Piece scope toggle is OFF.

## Deployment Artifact

- Theme scope + phase 2 toggle: commit `1da4711`
- Modal skin sync: commit `a8270a3`
- Dynamic storyteller card/action refinement: commit `36751d1`

## Notes

- This release is frontend-only.
- No Firestore schema changes in V90.42.
- No Functions endpoint changes in V90.42.
