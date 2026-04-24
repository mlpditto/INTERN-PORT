# INTERN-PORT Version Sync Policy

## Objective

Ensure release version consistency across all deploy surfaces and both git branches.

## Authoritative Source

- This file defines operational sync policy.
- [[06 Runbooks/VERSION_RULES|VERSION_RULES.md]] defines version semantics and increment logic.

If policy and notes conflict, follow this file and then update notes.

## Mandatory Sync Targets Per Release

Every release-impact commit must keep these files on the same release version:

- admin.html
- index.html
- public/admin.html
- public/index.html

Supporting docs to keep aligned in same release:

- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]]
- RELEASE_NOTES_Vxx.xx.md

## Branch Policy

- Develop on production only.
- Do not commit release changes directly on main.

Release sequence:

1. git checkout production
2. git add .
3. git commit -m "Vxx.xx: summary"
4. git push origin production
5. git checkout main
6. git merge production --no-ff -m "Merge production: Vxx.xx summary"
7. git push origin main
8. git checkout production

## Release Gate Checklist

Before pushing production:

1. Titles reflect same Vxx.xx in four targets
2. Any visible version badge reflects same Vxx.xx
3. Release notes file exists and matches Vxx.xx
4. [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]] header/version notes updated
5. Working tree clean except intended changes

## Verification Commands

PowerShell quick checks:

Select-String -Path admin.html,index.html,public/admin.html,public/index.html -Pattern "<title>"

Select-String -Path admin.html,index.html,public/admin.html,public/index.html -Pattern "V[0-9]+\.[0-9]+"

git branch -v
git status --short

## Drift Handling Procedure

If versions diverge across targets:

1. Pick one target version as canonical next release version
2. Sync all four targets to that version in one commit
3. Add release note describing resync
4. Push production and merge to main immediately

## Allowed No-Bump Cases

Skip version bump only for:

- docs-only changes
- local scripts/scratch changes
- git metadata/config changes

Any user-visible runtime behavior change requires version bump and sync.

## Current Enforcement Window

As of 2026-04-17, Netlify targets were retired; enforce four-target sync only.

Last updated: 2026-04-15
