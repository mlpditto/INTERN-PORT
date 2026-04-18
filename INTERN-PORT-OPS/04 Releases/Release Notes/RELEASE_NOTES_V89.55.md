# Release Notes (V89.55) - Admin Dashboard & UI Visibility Controls

## 🚀 New Features
- **Score Breakdown Dashboard:** Added a new categorization system at the top of the User History modal. Administrators can now instantly see a breakdown of total points across **Quizzes, Works, Logs, Bonus, and Manual Adjustments**.
- **Period Visibility Control:** Introduced a "Hide Period" toggle for individual users. Administrators can now choose to hide the internship Start/End dates in the LIFF app for specific personnel (e.g., testers, staff, or internal developers).

## 🛠 Fixes & Improvements
- **Kanban Board Refactor:** Resolved a critical bug where the Kanban rendering logic would fail due to code corruption.
  - Fixed duplicate rendering blocks for "General Works".
  - Restored missing column counters (Backlog, Review, etc.).
  - Unified data processing for all task types (Quizzes, Reflective Logs, Access Requests).
- **UI Consistency:** Standardized catch labels and reference logic within the admin rendering engine to prevent cascading JavaScript failures.
- **Global Version Sync:** Bumped both Admin Portal and User LIFF to version **V89.55**.
