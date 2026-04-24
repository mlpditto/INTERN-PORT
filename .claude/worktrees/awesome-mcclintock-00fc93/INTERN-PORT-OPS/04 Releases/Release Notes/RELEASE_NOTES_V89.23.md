# Intern Portfolio - Release V89.23

## 📋 Release Summary

**Version:** V89.23  
**Date:** 2026-04-10 13:05 UTC+7  
**GitHub Pages:** https://mlpditto.github.io/INTERN-PORT/admin.html

---

## 🎯 What's New

### 1. Flexible Quiz Grading: "ให้คะแนนตามจริง" (V89.23)
- **Actual Score Approval:** Added a new button in the Review Quiz Attempt modal that allows admins to approve an attempt based on the currently graded correct count.
- **Proportional Point Distribution:** Unlike the "Approve All" button (which grants 100%), the "Actual Score" button calculates points proportionally (e.g., if a student gets 7/10, they receive 70% of the quiz's total points).
- **Manual Marker Integration:** Admins can now mark specific questions as correct manually, and then use the "Actual Score" button to finalize the grade with those adjustments.

### 2. Quiz Editor Enhancements (V89.22 - Recent)
- **Toolbar Fixes:** Resolved issues with the Copy and Clone question buttons in the Quiz Editor.
- **AI Integration Stability:** Fixed deprecated Gemini model names and improved JSON response parsing for AI-powered quiz analysis.

---

## 🔧 Technical Changes

### Files Modified
- `admin.html` - Implemented `approveQuizAttemptActual` and UI button. Updated to V89.23.
- `index.html` - Version Update to V89.23.
- [[06 Runbooks/SYSTEM_OVERVIEW|SYSTEM_OVERVIEW.md]] - Sync to V89.23.
- [[06 Runbooks/VERSION_SYNC_POLICY|VERSION_SYNC_POLICY.md]] - Sync to V89.23.

---

## 🚀 Deployment Status
- ✅ Admin Portal: Updated (V89.23)
- ✅ User Portal: Updated (V89.23)
- ✅ Cloud Functions: Status V89.23
- ✅ Documentation: Refreshed

---

*Last updated: 2026-04-10 13:05 UTC+7*

