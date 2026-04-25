# RELEASE NOTES V90.36

Date: 2026-04-16
Branch: production

## Summary

Admin-side AI Hub now includes a Gemini TTS Studio prototype for generating and previewing speech from text.

## Changes

- Added **Gemini 3.1 Flash TTS Studio** inside AI Digital Lab (admin side).
- Added controls for:
  - Voice preset selection
  - Language code selection
  - Performance notes
  - Transcript input
- Added actions:
  - Generate Audio
  - Stop
  - Clear
  - Download WAV
  - Use highlighted/selected text as transcript
- Added retry handling for intermittent no-audio responses.
- Added PCM-to-WAV conversion fallback for browser playback compatibility.

## Scope

- Implemented in `admin.html` (prototype phase for admin-first validation).
- `public/admin.html` and `netlify-deploy/admin.html` were unchanged functionally in this release (historical context).

## Version Sync

Updated version string to `V90.36` across release targets used at that time (historical):

- `admin.html`
- `index.html`
- `public/admin.html`
- `public/index.html`
- `netlify-deploy/admin.html`
- `netlify-deploy/index.html`

Also updated:

- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]]

## Notes

- No backend schema changes.
- No Firebase Functions endpoint changes in this release.

