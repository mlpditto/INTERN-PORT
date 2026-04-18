# Release Notes (V89.76) - Unified AI Lifecycle Fix

## 🛠 Fixes & Improvements
- **AI Tagging Error Resolved:** Fixed the critical "window.callUniversalAI is not a function" error that occurred when triggering AI Tagging before the page finished loading.
- **Unified Module Execution:** Moved `autoTagQuizAI` from the head script to the core module script. This ensures that the calling logic and the AI engine dependencies (`callUniversalAI`) initialize synchronously.
- **Initialization Safety Net:** Added explicit checks in the tagging sequence to gracefully handle cases where the AI module is still in its deferred loading state, preventing console errors and providing clear feedback.
- **Global Version Synchronization:** 
    - Updated **`admin.html`** to V89.76 (Title & Load Logs).
    - Updated **`index.html`** to V89.76 (Title Synchronization).
    - Updated **[[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]]** with the new version and session details.

## 🚀 Deployment Instructions (Turbo Mode)
To deploy these changes to both the server and GitHub Pages, run the following commands in order:

```bash
# 🛠️ 1. บันทึกงานใน production
git add .
git commit -m "V89.76: Unified AI Lifecycle Fix for Tagging Reliability"
git push origin production

# 🌐 2. ส่งงานไปที่ main (GitHub Pages)
git checkout main
git merge production
git push origin main

# 🔙 3. กลับมาทำงานต่อที่ production
git checkout production
```

---
*Created on 2026-04-11 22:30 UTC+7*

