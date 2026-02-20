---
description: How to deploy the INTERN-PORT application to production
---

# Deploy Workflow

## ⚠️ IMPORTANT: Site is hosted on GitHub Pages, NOT Firebase Hosting

The custom domain `mlp-int.work` is served by **GitHub Pages** (via CNAME file).  
`firebase deploy` goes to `intern-port-edfa7.web.app` which is **NOT** the production site.

## Steps

// turbo-all

1. Stage all changes:
```
git add -A
```

2. Commit with a descriptive message:
```
git commit -m "V78.x: description of changes"
```

3. **Push to GitHub** (this triggers GitHub Pages deployment):
```
git push origin production
```

4. Wait ~1-2 minutes for GitHub Pages to rebuild, then verify at:
   - https://mlp-int.work/admin.html (Admin Panel)
   - https://mlp-int.work/index.html (User LIFF App)

## Version Number Locations

Update version in **both** files before deploying:

| File | Line | Format |
|------|------|--------|
| `admin.html` | Line 7 | `<title>MLP INTERNSHIP PORT V78.x</title>` |
| `index.html` | Line 8 | `<title>Internship Portfolio (V78.x)</title>` |

## Branch

- Production branch: `production`
- Remote: `origin` → `https://github.com/mlpditto/INTERN-PORT.git`

## Quick Deploy (One-liner)

```powershell
git add -A; git commit -m "V78.x: changes"; git push origin production
```
