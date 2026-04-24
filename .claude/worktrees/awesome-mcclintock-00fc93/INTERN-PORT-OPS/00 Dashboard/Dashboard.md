---
type: dashboard
status: active
owner: intern-port-team
updated: 2026-04-19
---

# INTERN-PORT OPS Dashboard

## Current Focus

- [ ] Complete QA session for next release
- [ ] Verify LIFF with 1-2 real accounts
- [ ] Confirm source/public UI mirror changes

## Today Update (2026-04-19)

- ThaiLLM hardening shipped: switched proxy endpoint to HTTPS and added proxy-failure fallback path (ThaiLLM -> Typhoon -> Gemini).
- Commit 4dba3f6: Poneglyph hardening + PDF metadata toggle + Firestore rules/index updates.
- Commit 643c529: ThaiLLM HTTPS + fallback improvements (source/public mirror + functions proxy).
- Branch sync status confirmed: origin/main and origin/production now point to the same latest commit.
- Safety guard kept: local dump files remain excluded from accidental tracking.

## Quick Links

- [[00 Dashboard/Doc Directory]]
- [[01 Features/Feature-Template]]
- [[03 QA Sessions/QA-Template]]
- [[03 QA Sessions/QA-2026-04-18-V90.67]]
- [[02 Bugs/BUG-2026-04-18-LIFF-Preview-Permission]]
- [[04 Releases/Release-Template]]
- [[99 Archive/Deploy Artifacts/GIT_MARKDOWN_ARTIFACT_2026-04-18_SESSION_CLOSE]]
- [[99 Archive/Migration-Log-2026-04-18]]
- [[00 Dashboard/Daily-Template]]
- [[06 Runbooks/Runbook-Deploy-Production-Main]]

## Open Items (Tasks plugin)

```tasks
not done
path does not include 99 Archive
sort by due
```

## In Progress Notes (Dataview)

```dataview
TABLE type, status, owner, branch, version, updated
FROM ""
WHERE status = "in-progress" OR status = "blocked"
SORT updated desc
```

## Latest QA Sessions (Dataview)

```dataview
TABLE date, owner, version, branch, commit, qa_result
FROM "03 QA Sessions"
WHERE type = "qa"
SORT date desc
LIMIT 10
```

## Latest Releases (Dataview)

```dataview
TABLE date, version, branch, commit, deploy_result, main_ff_result
FROM "04 Releases"
WHERE type = "release"
SORT date desc
LIMIT 10
```

## Latest Migrated Docs (Dataview)

```dataview
TABLE file.link AS Document, file.folder AS Folder, dateformat(file.mtime, "yyyy-MM-dd HH:mm") AS Updated
FROM ""
WHERE contains(file.path, "04 Releases/Release Notes/") OR contains(file.path, "99 Archive/Deploy Artifacts/") OR contains(file.path, "99 Archive/Reports/") OR contains(file.path, "06 Runbooks/")
SORT file.mtime desc
LIMIT 20
```
