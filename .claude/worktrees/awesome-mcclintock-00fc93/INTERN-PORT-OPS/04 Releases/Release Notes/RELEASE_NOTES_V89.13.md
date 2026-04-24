# Intern Portfolio - Release V89.13

## 📋 Release Summary

**Version:** V89.13  
**Date:** 2026-04-08 13:25 UTC+7  
**GitHub Pages:** https://mlpditto.github.io/INTERN-PORT/admin.html

---

## 🎯 What's New

### 1. Selection Counter in Bulk Extract (V89.13)
- **Real-time Counter:** Added a dynamic "Selected: X / Total" counter in the Bulk Extract & Move modal.
- **Visual Feedback:** The counter changes style when questions are selected, providing better UX.
- **Auto-Sync:** Counter updates instantly when clicking "Select All", "Clear All", or individual checkboxes.

### 2. Bug Fixes (V89.13)
- **Fixed Bulk Export Error:** Resolved `TypeError: can't access property "value"` by correcting the quiz ID reference from `quiz-id-hidden` to `edit-quiz-id`.

---

## 🔧 Technical Changes

### Files Modified
- `admin.html` - Implemented counter logic and fixed ID reference bug.
- `index.html` - Version Update to V89.13
- `functions/index.js` - Version comment sync to V89.13
- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]] - Sync to V89.13
- [[06 Runbooks/VERSION_SYNC_POLICY|VERSION_SYNC_POLICY.md]] - Sync to V89.13

---

## 🚀 Deployment Status
- ✅ Admin Portal: Updated (V89.13)
- ✅ User Portal: Updated (V89.13)
- ✅ Cloud Functions: Status V89.13
- ✅ Documentation: Refreshed

---

*Last updated: 2026-04-08 13:25 UTC+7*

