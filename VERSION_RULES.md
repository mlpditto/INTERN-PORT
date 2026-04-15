# INTERN-PORT Version Rules

## Scope
These rules apply to all runtime entry pages and mirrored deployment copies.

## Current Version Baseline
- Current baseline family: V90.xx
- Version string format: VMAJOR.MINOR where MINOR is two digits when needed (example: V90.29)

## Single Version Rule
Any release commit that changes app behavior must use one shared version number across all required targets.

Required targets:
- admin.html
- index.html
- public/admin.html
- public/index.html
- netlify-deploy/admin.html
- netlify-deploy/index.html

If one target is intentionally excluded, the commit message must explicitly state why.

## Where Version Must Be Updated
At minimum for each required target:
- HTML title
- Any visible header badge version, if present
- Top release comment near document head, if present

Project-level sync references:
- SYSTEM_OVERVIEW.md header/version notes
- Release note file name and heading (example: RELEASE_NOTES_V90.30.md)

## Increment Policy
Use simple, predictable bumps:
- Patch/UI hotfix: V90.29 -> V90.30
- Feature release: V90.29 -> V90.40 (optional grouped jump)
- Breaking architecture: V90.xx -> V91.00

Recommended default: increment by +0.01 for each production release commit.

## Branch Flow (Mandatory)
All development and fixes start from production branch.

Required flow:
1. Commit and push on production
2. Merge production into main
3. Push main
4. Return to production for ongoing work

This prevents version drift between deploy branch and public branch.

## Commit Message Standard
Use this template for release-impact commits:
- V90.30: short summary

Examples:
- V90.30: Fix Rising Star badge text overflow
- V90.31: Improve reflective leaderboard filtering

## Pre-Push Checklist
Before push origin production:
1. Confirm one shared version exists in all six required targets
2. Confirm release notes match the same version
3. Confirm SYSTEM_OVERVIEW.md references latest version
4. Run quick search check for title/version mismatch

## Quick Verification Commands
PowerShell examples:

Select-String -Path admin.html,index.html,public/admin.html,public/index.html,netlify-deploy/admin.html,netlify-deploy/index.html -Pattern "<title>"

Select-String -Path admin.html,index.html,public/admin.html,public/index.html,netlify-deploy/admin.html,netlify-deploy/index.html -Pattern "V90\."

## Exceptions
Version bump may be skipped only when both conditions are true:
1. Change is docs-only or tooling-only
2. No runtime HTML/JS/CSS behavior changed

If any runtime page behavior changes, version bump is required.

## Enforcement Priority
When conflicts exist between old notes and this file, this file wins.

Last updated: 2026-04-15
