# Intern Portfolio - Release V89.25

## 📋 Release Summary

**Version:** V89.25  
**Date:** 2026-04-10 13:45 UTC+7  
**GitHub Pages:** https://mlpditto.github.io/INTERN-PORT/admin.html

---

## 🎯 What's New

### 1. Granular Template Control (V89.25)
- **Toggle Template Status:** Added a new action button (⭐ Star icon) in the Quiz Dashboard that allows admins to manually toggle the "Template" status for any quiz.
- **Improved Badge Logic:** Overhauled the "TEMPLATE" badge logic. Previously, all inactive quizzes were automatically labeled as templates. Now, the badge strictly follows the `isTemplate` property in the database, allowing for a clearer distinction between old/inactive quizzes and actual master templates.

### 2. UI Updates
- **Interactive Action Bar:** The new toggle button provides immediate visual feedback (Yellow for Template, Grey for Normal) and updates the database in real-time.

---

## 🔧 Technical Changes

### Files Modified
- `admin.html` - Implemented `toggleTemplateStatus`, updated `renderQuizzes` logic, and added the UI toggle button. Version sync to V89.25.
- `index.html` - Version Update to V89.25.
- `SYSTEM_OVERVIEW.md` - Sync to V89.25.
- `VERSION_SYNC_POLICY.md` - Sync to V89.25.

---

## 🚀 Deployment Status
- ✅ Admin Portal: Updated (V89.25)
- ✅ User Portal: Updated (V89.25)
- ✅ Cloud Functions: Status V89.25
- ✅ Documentation: Refreshed

---

*Last updated: 2026-04-10 13:45 UTC+7*
