# Project Tasks & Updates

> [!IMPORTANT]
> **📢 Version Policy:** ทุกการ Commit หรือการปรับปรุงชุดคำสั่ง ต้องมีการขยับเวอร์ชัน (Versioning) เสมอ ทั้งในหน้า UI และในเอกสาร Markdown นี้ เพื่อป้องกันความสับสนในการ Deploy

## [2026-03-12] Session Updates (V84.3 → V84.4)

### 1. Existing User Reset / Gen Code (V84.4)
- **Gen Enrollment Code for Active Users:** Added a new action button (🔑) in the Users table. 
- **Automated Pre-filling:** Clicking the key button generates a new registration code pre-filled with the existing user's name, group, and dates. This is perfect for users who lost access or need to re-link their profile.
- **Workflow Integration:** Once generated, the admin is automatically navigated to the Pre-registration list to see the code.

## [2026-03-12] Session Updates (V83.0 → V84.3)

### 1. Enrollment Flow Overhaul (V84.3)
- **Multi-Step Enrollment Modal:** Introduced a new three-phase enrollment flow for users:
    - **Code Entry:** Users can enter a 6-digit enrollment code for instant access.
    - **Access Request:** Users without a code can submit a request with their full name, nickname, target group, and internship dates.
    - **Pending Status:** Displays a clear "Pending Review" screen once a request is submitted, preventing access until approved.
- **Strict Registration:** Removed the ability to "Skip" the enrollment process, ensuring all users are identified and approved before participating.
- **Improved Security:** Access requests are stored securely in the `reports` collection for admin review.

### 2. Admin Access Management (V84.3)
- **Pending Requests Dashboard:** Added a new specialized section in the Admin Panel to view and manage incoming access requests.
- **Real-time Review:** Integrated a dedicated listener for `access_request` reports.
- **One-Click Approval:** Admins can approve requests with a single click, which automatically creates the user's profile and grants access.
- **Rejection Flow:** Admins can easily reject and remove invalid requests from the queue.

### 3. Quiz Visibility Refinement (V84.3)
- **Auto-Hide Expired/Unstarted:** Quizzes that have passed their deadline and haven't been started by the user are now hidden from the "Assignments" list to reduce clutter.
- **Clean Dashboard:** Focuses the user's attention on active and in-progress tasks.

## [2026-03-10] Session Updates (V82.2 → V83.0)

### 1. Unified Compact Profile Dates (V83.0)
- **Compact UI Integration:** Moved the "Start Date" and "End Date" inputs natively into the user's profile header, placing them elegantly beneath the user's name and division badging to save vertical space.
- **Removed "BE" (Buddhist Era) Artifacts:** Replaced standard native `<input type="date">` visible UI with a custom formatted text span (e.g., "16 Mar 2026") that reliably hides OS-level Buddhist Era formatting across all iOS/Safari locales.
- **Stylized Countdown Display:** Enhanced the internship countdown visual with a new professional, compact inline-block design featuring a soft background layer for improved aesthetics.
- **Version Bump:** Updated version to V83.0 globally to signify these UI structural updates.

## [2026-03-09] Session Updates (V82.0 → V82.1)

### 1. Quiz Review UI (V82.1)
- **Enhanced Visual Feedback:** Added green background (`#d1e7dd`) specifically for correct answers in the Review Attempt modal. 
- **Card-Style Layout:** Redesigned question review cards with subtle shadows, rounded corners, and clear "Student vs Correct" side-by-side comparison.
- **Improved Comparison Logic:** Fixed a common bug where single-select vs multi-select data structures caused false "Incorrect" markings.

### 2. Admin Dashboard UI (V82.1)
- **Color-Coded Badges:** 
    - **Items Count:** Automatically colors the count badge (Green for 40+, Blue for 20+, Gray for standard) to help identify quiz length.
    - **Score Weighting:** Highlights quizzes with >1.0 total points using colored borders and badges to signify weighted assessments.
- **Layout:** Optimized vertical alignment and spacing in the main quiz management tables for better professional appearance.

## [2026-03-08] Session Updates (V81.2 → V81.3)

### 1. Read-only Interactive Scoring (V81.3)
- **Points & Feedback:** Read-only mode now supports "Correct/Incorrect" feedback if a `correct` index is defined in the quiz settings.
- **Participation Points:** Pure polls (no correct answer) award points just for voting, encouraging engagement. 
- **Scoring Logic:** Updated `submitQuiz` to accurately calculate scores for Read-only quizzes based on user performance on individual pages.
- **Improved Revelation UI:** Content (The Revelation) is strictly hidden until the user selects an option or the timer ends, ensuring the interactive element is not bypassed.

### 2. UI/UX Refinements (V81.3)
- **Smart Sorting:** The Assignments list now sorts by `timestamp` (Newest First) instead of urgency, helping users see newly added tasks at the top.
- **Text Formatting:** Added `text-align: justify` and `trim()` to content revelation blocks for a more polished, professional appearance.
- **Robustness:** Fixed JavaScript reference errors (Can't find variable: container) by isolating variable scopes in rendering functions.

## [2026-03-08] Session Updates (V81.1 → V81.2)

### 1. Collapsed Expired Quizzes (V81.2)
- **Compact View:** Quizzes that have passed their deadline and are in a 'Not Started' state are now automatically collapsed into a slim header.
- **Improved Focus:** This keeps the Assignments list organized, showing full cards only for active tasks that currently require the intern's attention.
- **Expandable Detail:** Users can click the header to see the description, deadline details, and the "Request Late Submission" button.
- **Interactive States:** Quizzes that are 'In Progress' (Started/Allowed) remain fully visible even if they've technically expired, ensuring users can easily complete them.

## [2026-03-08] Session Updates (V81.0 → V81.1)

### 1. Poll-only Timer (V81.1)
- **Timer Refinement:** The `Timer (sec)` for Read-only pages now applies ONLY to the Poll phase. 
- **Auto-Stop:** Once a user selects an option, the timer stops immediately, allowing unlimited reading time for the revealed content.
- **Auto-Reveal on Timeout:** If the timer expires, the system alerts the user and automatically reveals the content so learning is not blocked.
- **Stress-free Reading:** Removed timers from "Standard Page" (Reading style) to promote careful consumption of material.

## [2026-03-08] Session Updates (V80.1 → V81.0)

### 1. Interactive Poll Reveal (V81.0)
- **Interactive Reading:** Added "Interactive Poll" type to Read-only pages. Users must engage with a poll/question before the lesson content is revealed.
- **Engage-to-Learn:** Designed to stimulate curiosity by asking for opinions or guesses before providing the "The Revelation" (Explanation).
- **Smooth Animation:** Added `fadeInUp` animation when content is revealed for a premium feel.
- **Admin Control:** Admins can now toggle between "Standard Page" (Immediate display) and "Interactive Poll (Reveal)" for each lesson page.
- **State Persistence:** User's poll choices are saved and synced, allowing them to resume exactly where they left off with content already revealed.

## [2026-03-08] Session Updates (V79.7 → V80.1)

### 1. Read-only Learning Mode (V80.1)
- **Multi-page Support:** Refactored "Read-only Learning" to support multiple content pages. Each "question" in the admin panel now acts as a dedicated page of lesson content.
- **Interactive Discussions:** Added a per-page discussion feature where users can engage in real-time commentary within a dedicated modal, fostering interactive learning.
- **Tweetstorm Feedback:** Final step of read-only lessons now uses a "Tweetstorm" style reflection (multiple short messages) instead of a single textarea.
- **Customizable Char Limits:** Admins can now choose between **280** (Standard) or **4000** (Premium) character limits for user feedback per tweet.
- **Admin Interface:**
    - New "Feedback Limit" setting in quiz configuration.
    - Updated Page Content editor for each page/question item.
    - Removed legacy "Case Study (Reading)" quiz type to unify the reading experience.
- **Score Logic:** Points are moved to 'pending' upon successful submission of the final reflection, requiring admin review.
- **Deployment:** Successfully pushed to production branch.


## [2026-03-04] Session Updates (V79.6 → V79.7)

### 1. Quiz Pagination (V79.7)
- **Assignments Pagination:** The "Quizzes / แบบทดสอบ" section in LIFF is now paginated, displaying exactly 3 items per page.
- **Scroll Optimization:** When switching pages, the view automatically scrolls to the top of the assignments section for a smoother mobile experience.

### 2. Kanban Card UI Improvement (V79.7)
- **Vertical Shrinkage / Collapsible Description:** Descriptions inside Kanban cards (both in LIFF and Admin panel) are now hidden by default. A toggle "ดูรายละเอียด (Description)" button has been added to expand and collapse the description, saving significant vertical space and reducing height of the boards.

### 3. User Management UI Simplification (V79.7)
- **Integrated Cert Name Editing:** Moved the "Full Name (EN)" and "Nickname/AKA" inputs out of the Users table replacing them with a cleaner static display.
- **Unified Management Modal:** Editing the user's Group or clicking the new edit icon now opens a unified "จัดการข้อมูล (Manage Info)" modal, allowing admins to edit the user's Group, Full Name, and Nickname all in one place.

### 4. Quiz Visibility Logic (V79.7)
- **Filtered Assignments:** Only quizzes that are **Active**, **In Progress** (Requesting/Allowed), or completed with **0 points** are shown in the LIFF Assignments section.
- **Auto-Hide Expired:** Quizzes that reach their deadline are automatically hidden unless the administrator explicitly sets them back to **Active** (reactivated).
- **Completion Logic:** Quizzes with scores > 0 are moved to the History section once approved/pending.

## [2026-03-04] Session Updates (V79.5 → V79.6)

### 1. Pre-Registration System (V79.6)
- **Pre-register Users:** Added ability to add pre-registered users with a "⏳" status before they claim their code.
- **Dynamic User Integration:** Pre-registered users now display seamlessly in the Leaderboard alongside active users.
- **AKA/Nickname Field:** Added a Nickname/AKA input field specifically for the pre-registration modal and inline-editing on the users table.

### 2. Enhanced Certificate Generator (V79.6)
- **Bilingual & Dual Names:** The Certificate modal now explicitly requests "Full Name (EN)" and "AKA/Nickname".
- **Dynamic Render Logic:** `drawCertificate` automatically scales the Full Name and cleverly renders `( AKA : Nickname )` beneath the full name if provided.
- **Bulk Export Support:** The dual-name logic is fully integrated into `generateBulkCert` for generating entire batches with nicknames.

## [2026-02-24] Session Updates (V79.2 → V79.3)

### 1. Homework Countdown & Kanban Improvements (V79.3)
- **12h Deadline:** When assigning homework, a 12-hour deadline is now automatically set for both the quiz and the Kanban card.
- **User Countdown:** Users can now see a live countdown timer on their Kanban cards for homework.
- **UI Cleanup:** Improved the Kanban card rendering to only show descriptions if they exist, providing a cleaner look.

## [2026-02-24] Session Updates (V79.1 → V79.2)

### 1. Admin Modal Visibility Fix (V79.2)
- **Z-Index Fix:** Increased `z-index` for `quizReviewModal` and `pollResultModal` to ensure they appear on top of the `quizParticipantsModal`.
- **Logic Correction:** Updated the correctness styling check in `reviewQuiz` to correctly handle multi-select (array) answers.

## [2026-02-23] Session Updates (V79.0 → V79.1)

### 1. Quiz 0.00 Score Protection (V79.1)
- **Hide Answers for 0.00:** In Dashboard, the "View Answers" button is now hidden if the user's score is 0.00 to prevent answer leaks.
- **Request Retake Button:** Replaced "View Answers" with a "🔄 ขอสอบใหม่ (Request Retake)" button for 0.00 scores.
- **Improved Request Logic:** Updated `requestLateQuiz` to handle retake requests specifically, with a dedicated confirmation message.
- **Security Check:** Added a server-side check (logic-wise) in `viewQuizAnswers` to block viewing if the score is ≤ 0.

## [2026-02-23] Session Updates (V78.8 → V79.0)

### 2. Certificate System & Special Awards (V78.8, V78.98)
- **Multi-Award Support:** Admin can select multiple special awards per user.
- **New Special Awards (V78.98):** Added 5 new premium awards (Iron Will, Quiz Master, Team Player, Rising Star, MVP) with unique seal designs, gradients, and custom shapes.
- **Stacked Seals:** Certificate renders multiple award seals vertically stacked on the right side.

### 2. Leaderboard Performance Stats (V78.9 → V78.96)
- **Min/Max Daily Score:** Now shows specific date and activity breakdown (Quiz, Manual, Work) in the detail popup.
- **Active Days %:** Calculated based on the internship period (Active Days / Total Days passed).
- **Detail Popup (V78.96):** Color-coded bars (Red for Min, Green for Max) and a new multi-column breakdown section showing exact point sources.

### 3. Quiz System & Mobile Accessibility (V78.94, V78.97, V78.99)
- **Kanban Double-Score Prevention (V78.94):** Hide score button on Kanban cards linked to quizes (Scoring is now handled via Quiz Approval only).
- **Manage Quiz UI (V78.97):** Compact question navigation (using icons +, <, >) to fit 10 buttons per row.
- **Mobile Bug Fix (V78.99):**
    - **Enlarged Buttons:** Next/Submit buttons increased to 45px height for better mobile tapping.
    - **Flex Centering:** Modals now use `display: flex` centering instead of `margin-top: 20%` to ensure all buttons are within clickable safe areas of mobile browsers.
    - **Auto-save Progression:** `nextQuizStep` now saves progression to Firestore.
    - **Admin Safety:** Warning message when approving 0.00 score attempts.

### 4. Admin Dashboard UI
- **Refined Kanban:** Badge labels for linked quiz cards and improved scrolling logic.
- **🔍 Popup Chart Viewer:** Click any user row → opens enlarged chart modal (~3x size, 200px height) with hover tooltips and 4 stat cards

### 3. Leaderboard Global Date Range (V78.92)
- **View Range Inputs:** Added Start/End date pickers at top of Leaderboard section
- **Timeline Synchronization:** When dates are set, all user charts render on the same timeline for fair comparison

### 4. Chart Rendering Fix (V78.91 → V78.92)
- **Explicit Bar Styling:** Fixed chart bars disappearing by setting absolute positioning, explicit colors (#4361ee), and minimum heights
- **Marker Improvements:** Replaced class-based markers with inline-styled elements for consistent rendering
- **Flexbox Fix:** Added `min-height: 60px` and `flex: none` to prevent chart container from collapsing

### 5. Documentation
- Updated `SYSTEM_OVERVIEW.md` to V78.93 with all new features documented
- Updated `TASKS.md` with session changelog

---

## [2026-02-21] Session Updates (V78.7)

### 1. Certificate System Enhancements
- **Dynamic Font Scaling:** implemented logic using `ctx.measureText` to automatically reduce font size for recipient names that are too long, ensuring they stay within the certificate bounds without overflowing.
- **Premium Aesthetics:** Maintained the Bilingual (Thai-English) design with Montserrat/Garamond typography.

### 2. Admin Dashboard UI Improvements
- **Quiz Management Modal:**
    - Restructured layout into separate flex-rows for better organization.
    - Added `flex-wrap: wrap` and `min-width` to prevent elements from "falling off" or overflowing in Firefox and smaller screens.
    - Rearranged status checkboxes (Poll, ONE-TIME, Homework, Shuffle) into a dedicated row for better visibility.
- **Global CSS:** Added `* { box-sizing: border-box; }` to ensure consistent padding/border behavior across all browsers.

### 3. Inactive Quiz & Template Management
- **Pagination:** Implemented pagination for the "Inactive / Templates" table (10 items per page) to improve performance and usability when dealing with many quizzes.
- **Status UI Update:** Changed the red "Expired" badge to a grey "Inactive (Expired)" badge to better reflect the state of non-active quizzes and improve the overall visual hierarchy of the table.

### 4. Code Maintenance
- Successfully committed and pushed changes to the `production` branch.
- Verified Kanban/Review workflow logic (Review status indicates items waiting for admin scoring/approval).

---
*Generated by Antigravity AI*
