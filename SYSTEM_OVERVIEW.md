# MLP Internship Portfolio (V87.41) Overview

> [!IMPORTANT]
> **📢 กฎการพัฒนา (Development Rule):** ทุกครั้งที่มีการปรับปรุงฟีเจอร์หรือแก้ไขบั๊ก (Code Improvement) **"ต้องอัพเดทเวอร์ชัน (Version)"** ในไฟล์ `admin.html`, `index.html` และเอกสารประกอบเสมอ เพื่อการติดตามที่ถูกต้อง (Version Consistency)

ระบบเว็บแอปพลิเคชันสำหรับจัดการการฝึกงานและระบบ Gamification (สะสมคะแนน) เพื่อจูงใจและติดตามความก้าวหน้าของนักศึกษาฝึกงาน

## 🛠 Tech Stack & Libraries
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla) - Responsive Design & Dark Mode
- **Framework & Backend:** 
    - **LINE LIFF SDK:** ยืนยันตัวตนผ่าน LINE (User)
    - **Firebase (v8):** 
        - **Firestore:** ฐานข้อมูล NoSQL แบบ Real-time
        - **Firebase Auth:** Login ฝั่ง Admin (Magic Link)
- **Libraries:**
    - **SortableJS:** ระบบลากวาง (Drag & Drop) ใน Kanban
    - **jsPDF & html2canvas:** สำหรับสร้างไฟล์ PDF ใบรับรองอิเล็กทรอนิกส์
    - **Font Awesome 6:** ชุดไอคอนมาตรฐาน

---

## 📂 แฟ้มข้อมูลหลักในระบบ (System Files)
1. **`index.html` (User Interface):** ระบบหลักสำหรับนักศึกษา (Dashboard, Kanban, Quiz, Quest) ทำงานผ่าน LINE LIFF
2. **`admin.html` (Admin Dashboard):** ระบบหลังบ้านสำหรับผู้ดูแล (Review, Users, Quiz Setup, Certification)
3. **`admin-git.html` (Admin Git Tools):** ระบบช่วยจัดการ Version Control และการเขียนไฟล์ผ่านหน้าจอ Admin (สำหรับนักพัฒนา)
4. **`404.html` (Error Page):** หน้าแสดงผลกรณีไม่พบไฟล์ในระบบ
5. **`firebase-config.js`:** ไฟล์ตั้งค่าการเชื่อมต่อกับ Firebase โปรเจกต์ `mlp-intern-port`
6. **`style.css`:** ไฟล์ CSS หลักที่ใช้ร่วมกันทั้งระบบเพื่อคุม Theme (Navy & Gold)
7. **`sw.js` (Service Worker):** (Optional) สำหรับ PWA Capabilities

---

## 📱 ระบบฝั่งผู้ใช้งาน (LIFF - `index.html`)

### 1. Dashboard & Profile
- **Identity:** ดึงข้อมูลจาก LINE Profile (ชื่อ, รูปภาพ) อัตโนมัติ **พร้อมระบบ Sync ข้อมูลล่าสุดลง Database** (V74)
- **Real-time Score:** แสดงคะแนนสะสมปัจจุบันที่ได้รับการอัปเดตทันทีเมื่อมีการเปลี่ยนแปลง
- **Internship Tracking:** บันทึกวันเริ่ม-จบฝึกงาน ระบบจะคำนวณวันคงเหลือ และแสดงปุ่ม "ขอใบรับรอง" เมื่อฝึกงานครบกำหนด
- **✨ Group Badges (V77.16):** แสดงป้ายกำกับกลุ่ม (Group Badge) พร้อมสีประจำกลุ่มที่ชัดเจน (เช่น EXTERN สีส้ม, INTERN สีม่วง)

### 2. ภารกิจหลัก (Kanban Board)
- **Status Columns:** แบ่งเป็น Backlog (งานรอมอบหมาย), Doing (กำลังทำ), Review (ส่งตรวจ), และ Done (เสร็จสิ้น)
- **Project Cards:** แสดงการ์ดงานเด่นชัด (สีชมพู) สำหรับงานที่เป็น Project สำคัญ
- **Chat System:** ระบบพูดคุยรายคนภายในแต่ละภารกิจ (Comment) สามารถ Tag แอดมินหรือเพื่อนได้ พร้อมแสดงสถานะแบบ Real-time
- **Dynamic Timers:** แสดงเวลานับถอยหลังภารกิจบนการ์ดกรณีเป็นภารกิจแบบจำกัดเวลา

### 3. ภารกิจประจำวัน (Daily Quests)
- **Timed Challenges:** กดรับภารกิจและทำภายในเวลาที่กำหนด (เช่น 30-60 นาที)
- **Submission:** ส่งคำตอบเป็นข้อความ ระบบจะล็อคการส่งหากหมดเวลา
- **Failure & Cooldown:** หากทำไม่ทันหรือตอบผิด แอดมินสามารถ Reset ให้ใหม่ หรือผู้ใช้ต้องรอเวลา Cooldown (15-30 นาที) ตามที่กำหนด

### 4. ระบบแบบทดสอบ (Quiz & Evaluation)
- **Visibility:** เห็นเฉพาะแบบทดสอบที่ถึงเวลา Schedule และยังไม่หมด Deadline
- **Question Logic:** 
    - **Timed Questions:** จับเวลาถอยหลังรายข้อ (วินาที) หากหมดเวลาจะข้ามข้อให้อัตโนมัติ
    - **⏱️ Flexible Timer Mode (V78.1):** เลือกโหมดจับเวลาได้ 2 แบบ:
        - **Per Question:** จับเวลาแยกแต่ละข้อ (Default)
        - **Total Time:** เวลารวมทั้งชุด ผู้ใช้บริหารเวลาเองได้อิสระ หมดเวลา Auto-submit
    - **Set All Timer:** ปุ่ม One-click ตั้งเวลาทุกข้อพร้อมกัน
- **🧠 Quiz System (V78.91-V79.7)**:
    - รองรับข้อสอบรุปแบบ Choice และ Short Answer (Tweetstorm style)
    - ระบบสลับข้อสอบและตัวเลือกอัตโนมัติ (Shuffle)
    - **LIFF Pagination (V79.7):** เปลี่ยนการแสดงผลแบบทดสอบใน LIFF (หัวข้อ 퀴즈) เป็นแบบแบ่งหน้า (Pagination) แสดงผล 3 รายการต่อหน้า พร้อมปุ่มถัดไป/ย้อนกลับ เพื่อแก้ปัญหาหน้าจอยาวและโหลดข้อมูลล้นหน้าจอเกินไป
    - **V79.1 Update**: เพิ่มระบบป้องกันการดูเฉลยกรณีได้คะแนน 0.00 โดยระบบจะซ่อนปุ่ม "ดูเฉลย" และแสดงปุ่ม **"ขอสอบใหม่ (Request Retake)"** แทน เพื่อให้ผู้เรียนได้ขอโอกาสทำใหม่โดยไม่เห็นเฉลยล่วงหน้า
    - **V79.0 Update**: เพิ่มปุ่ม **Review Practice** ในหน้า Admin (รูปแว่นขยาย) ให้แอดมินสามารถดูคำตอบที่ผู้ใช้ส่งในโหมดฝึกซ้อม (`practice_done`) ได้โดยตรง
    - **V78.99 Update**: ปรับปรุง UI ให้รองรับมือถือ (Mobile Accessibility) โดยการขยายปุ่ม Next/Submit ให้ใหญ่ขึ้น (45px) และใช้ Flexbox Centering สำหรับ Modal เพื่อป้องกันปุ่มล้นหน้าจอ หรือกดไม่ได้บน iPhone/Safe Area
    - ระบบ Auto-save ความคืบหน้าระหว่างทำข้อสอบ
    - ระบบแจ้งเตือน Admin หากมีการอนุมัติคะแนน 0.00 เพื่อป้องกันความผิดพลาดทางเทคนิค
- **✅ Multi-Correct & Smart Shuffle (V78.5):** 
    - รองรับข้อสอบที่คำตอบถูกมากกว่า 1 ข้อ ระบบใช้ปุ่มแบบ Robust Checkbox และ Z-index Control
    - **🔀 Smart Shuffle (Option 1+2):** 
        - เพิ่ม Option ให้แอดมินเลือกเปิด/ปิดการสุ่มตัวเลือก (Shuffle Choices) ราย Quiz ได้
        - หากเปิดการสุ่ม ระบบจะสุ่มเฉพาะข้อแรกๆ และล็อคข้อสุดท้าย (Anchor) ไว้เสมอ เพื่อรองรับโจทย์ประเภท "ถูกทุกข้อ" หรือ "ไม่มีข้อใดถูก" ไม่ให้สับสน
- **✨ Premium Electronic Certificate (V78.6):** 
    - ปรับปรุงดีไซน์ใบรับรองใหม่แบบ **บิณฑบาต (Bilingual)** ภาษาไทย-อังกฤษคู่ขนาน
    - ใช้ Typography ระดับพรีเมียม (Garamond & Montserrat) พร้อมระบบ Auto-fit ชื่อผู้รับ
    - เพิ่มระดับความปลอดภัยด้วย Watermark, Serial Number และ Digital QR Placeholder
    - ดีไซน์ทันสมัยด้วย Gold Accent และ Modern Navy Curve สำหรับพิมพ์ลงกระดาษ A4

## [2026-03-30] Session Updates (V87.40 → V87.41)

### 1. Reflective Logs & Works History Fix (V87.41)
- **Data Fetching:** Removed `.orderBy("timestamp", "desc")` from `loadReflectiveLogs`, `loadMyReflectiveLogs`, and `loadMyWorks` in `index.html`.
- **Root Cause Resolution:** This prevents silent Firestore query failures caused by missing composite indexes when querying `.where()` and `.orderBy()` on different fields simultaneously.
- **Client-Side Sorting:** The UI now correctly relies on `Array.sort()` internally in `renderHistory()` and `renderReflectiveLogs()` to maintain chronological order without database constraints.
- **Feedback Loop Restored:** Administrators' feedback on daily reflective logs is now successfully fetched and displayed, allowing users to claim their bonus points automatically.

## [2026-03-25] Session Updates (V87.27 → V87.28)

### 1. AI Vision Scan Fix (V87.28)
- **Multimodal Routing:** Fixed a critical bug in `processQuizVision` where incorrect argument ordering prevented the AI from receiving the image data.
- **Local Key Support:** Improved `callUniversalAI` to correctly handle `visionData` (multimodal) when falling back to local Gemini and GPT API keys.
- **Gemini JSON Mode:** Enabled JSON response support for Gemini models to ensure structured extraction from images.
- **Homogenized API:** Standardized how vision data is passed across different providers (Proxy, Gemini, GPT) to ensure stability.

## [2026-03-25] Session Updates (V87.16 → V87.27)

### 1. Quiz Timer UI Fix (V87.27)
- **Overflow Prevention:** Widened the timer input fields and removed browser spin buttons to prevent the "60s" value from being cut off (เวลายังตกขอบ).
- **Logical Re-positioning:** Moved the per-question timer from the far-right side to the left side, immediately following the **Question Type** toggle, to utilize available space and improve the content-editing workflow.

### 2. AI Design Lab Strict Framework (V87.27)
- **Structural Prompting:** Implemented a mandatory 5-component framework for Infographic generation: **Task, Context, Core Instruction, Constraint, and Output**.
- **AI-Powered Suggester:** The AI enhancer now automatically suggests and fills in missing components based on the user's rough idea, ensuring professional and actionable image generation prompts.
- **Improved UI Hints:** Added dynamic placeholder text in the Design Lab to guide users through the new structured prompting workflow.
## [2026-03-25] Session Updates (V87.15 → V87.16)

### 1. Logical UI Reorganization (V87.16)
- **Tool Grouping:** Reorganized the main toolbar and question cards into two distinct sections: **Core Tools** (Type, Count, Timer, Navigation) and **AI Toolkit** (Smart Paste, Model/Language selection, AI Analysis).
- **Consolidated AI Toolkit:** Grouped all AI-related interactions into a singular, unified "Smart Bar" with a custom background and distinct iconography.
- **Workflow Optimization:** Moved question-specific timers next to the type selector for better content-focused editing. Consolidated navigation controls for faster quiz traversal.

## [2026-03-25] Session Updates (V87.14 → V87.15)

### 1. High-Contrast Selector UI (V87.15)
- **Enhanced Toggle Selection:** Replaced the subtle white-on-gray selection with a distinct, high-contrast style.
- **Color Coding:** Active items now feature a solid primary background (Blue for individual questions, Purple for the main Quiz Analyzer).
- **Clear Visual State:** Added a 1.5px border and a slight lift effect (`translateY`) to clearly distinguish the selected AI Model or Language from other options.

## [2026-03-25] Session Updates (V87.13 → V87.14)

### 1. One-Click Copy & Duplicate (V87.14)
- **Content Copy:** Added a "Copy" button to each question header to quickly copy the question and all its options to the clipboard.
- **Instant Duplication:** Added a "Clone" button to duplicate any question (including options and timer settings) with a single click.
- **Visual Feedback:** Added icon transitions (checkmark) and toast notifications to confirm successful copy/duplicate actions.

## [2026-03-25] Session Updates (V87.12 → V87.13)

### 1. Smart AI Item Fixes (V87.13)
- **Structured Analysis:** AI now returns structured JSON results, allowing the UI to parse and display specific improvement cards.
- **Individual Question Fixes:** Added "Fix Qx" buttons for each item identified by AI as redundant or sub-optimal, enabling targeted improvements without replacing the entire quiz.
- **Title Suggestions:** AI now suggests both a Full Title and a Short Title, with "Apply" buttons to quickly update quiz metadata.
- **Improved Popup UI:** Modernized the analysis result display with clear separation between general summary, individual improvements, and bulk actions.

## [2026-03-25] Session Updates (V87.11 → V87.12)

### 1. Blended Quiz Toolkit UI (V87.12)
- **Seamless Toolbar:** Fully blended the Quiz Editor tools into a single, cohesive row-based toolbar.
- **Eliminated Separators:** Removed the internal divider line and separate row structure to create a more integrated, tool-focused experience.
- **Dynamic Layout:** Uses a continuous flex-flow to group the Question Counter, Timer settings, AI Analysis, and Navigation tools without visual breaks.
- **Enhanced Spacing:** Refined gaps and padding to maintain clarity while consolidating elements vertically.

## [2026-03-25] Session Updates (V87.10 → V87.11)

### 1. Unified Quiz Toolkit UI (V87.11)
- **Consolidated Toolbar:** Merged the Timer/AI configuration bar and the Question navigation bar into a single, unified premium card.
- **Header Integration:** Moved the "Questions (count)" label into the unified toolbar header, eliminating the separate `<h3>` element to reduce vertical clutter.
- **Navigation Flow:** Reorganized the tool layout to ensure functional buttons (+, Import, Arrows) are grouped together, while the question pagination numbers are placed at the end to prevent them from separating the action tools.
- **Premium Aesthetics:** Added glassmorphism effects, improved shadows, and consistent padding to match the high-end portal design.

## [2026-03-23] Session Updates (V86.14 → V86.16)

### 1. Reflective Log Detail View (Admin)
- **Interactive History:** Admin can now click on any 'Reflective Log' entry in the User History list to open a detailed modal.
- **Full Content & Feedback:** The modal displays the original log content, student's mood, and the admin's feedback/score, making it easier to review past entries.

### 2. Mandatory Feedback Reading (User)
- **Feedback-First Claiming:** Reflective log feedback and bonus points are now hidden behind a "Read Feedback & Claim Points" button in the user's history.
- **Acknowledge points:** Users must open the feedback modal to read the mentor's comments before they can click the button to claim their bonus points.
- **Auto-Closing Modal:** The feedback modal automatically closes after a successful claim to provide a smooth experience.

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

## [2026-03-08] Session Updates (V80.1 → V81.0):**
    - ระบบรองรับ **รางวัลพิเศษหลายรายการ** บนใบรับรองเดียว (เช่น Zero-to-One + Good Reporter + Beta User)
    - Admin เลือกรางวัลผ่าน Checkbox แทน Radio Button
    - ตราประทับรางวัลจะซ้อนกันแบบ Stacked Display
    - เพิ่มรางวัล **"🧪 Beta User Award"** พร้อมดีไซน์ตราประทับสีพิเศษ (Pink-Purple Gradient)
- **Approval Workflow:** เมื่อทำเสร็จ คะแนนจะขึ้นสถานะ **"รออนุมัติ (Pending)"** (แสดงเป็นทศนิยม 3 ตำแหน่ง) แต้มจะยังไม่เข้าระบบทันทีจนกว่าผู้ดูแลจะกดยืนยัน

### 5. [AI] Gemini AI Integration (V86.14)
- **AI-Powered Mentor Feedback:** บูรณาการ Gemini 1.5 Flash API ในหน้า Admin เพื่อช่วยวิเคราะห์และเสนอแนะคำติชม (Feedback) สำหรับบันทึกสะท้อนคิด (Reflective Logs) ของนักศึกษา
- **One-Click Suggestion (V86.14):**     - ปุ่ม "AI Suggest" ในหน้าต่างตรวจบันทึกสะท้อนคิด เพิ่มตัวเลือกภาษา (**TH, EN, CN, KO, JP**)
    - ระบบจะวิเคราะห์เนื้อหาและสร้างฟีดแบ็กสั้นๆ (2-3 ประโยค) ในภาษาที่เลือกให้อัตโนมัติ เพื่อรองรับนักศึกษาต่างชาติ
- **AI Quiz Translation & Enhancement (V86.14):**     - เพิ่มปุ่ม **"AI Suggest"** พร้อมตัวเลือกภาษา (**EN, Chinese, Korean, Japanese**) ใน Quiz Editor
    - ระบบจะแปลโจทย์และตัวเลือกจากไทยเป็นภาษาเป้าหมาย พร้อมปรับปรุงเนื้อหาให้มีความเป็นทางการและท้าทายมากขึ้น
    - ใช้ Gemini JSON Mode เพื่อรักษาโครงสร้างของชุดข้อสอบและลำดับเฉลยให้ถูกต้องแม่นยำ
- **Developer Security:** เก็บ API Key ไว้ใน `firebase-config.js` (Client-side) เพื่อการพัฒนาที่รวดเร็ว (สำหรับ Production แนะนำให้ย้ายไป Firebase Functions)

### 6. [AI] Research Assistant & Knowledge Base (V86.35 - Active)
- **Intelligent Knowledge Base:** ระบบจัดการฐานความรู้ (Knowledge Base) ในหน้า Research แอดมินสามารถอัพโหลดเอกสาร (Text, PDF Metadata) เพื่อใช้เป็นแหล่งข้อมูลในการอ้างอิง (Grounded Data)
- **Grounded Q&A (RAG):** ระบบถาม-ตอบอัจฉริยะที่ใช้หลักการ Retrieval-Augmented Generation โดย AI จะค้นหาเนื้อหาที่เกี่ยวข้องจาก Knowledge Base ก่อนนำไปประมวลผลคำตอบ เพื่อความถูกต้องและแม่นยำ (NotebookLM Experience)
- **Premium Research UI:** อินเทอร์เฟซหน้าจอวิจัยระดับพรีเมียม พร้อมระบบ Chat-style Interaction และแถบจัดการแหล่งข้อมูล (Active Sources) ที่ใช้งานง่าย
- **Source-aware AI:** AI สามารถระบุสถานะการใช้งานแหล่งข้อมูล (Knowledge Base Source Used) ในคำตอบ เพื่อให้แอดมินทราบว่าข้อมูลนั้นถูกดึงมาจากไฟล์ที่อัพโหลดจริง

### 7. [AI] Design Lab & Infographic Assets (V86.60 - Active)
- **AI-Powered Visualization:** ระบบสร้างภาพและอินโฟกราฟิกอัจฉริยะ (AI Design Lab) เพื่อใช้ในการตกแต่งใบเซอร์ติฟิเคต กิจกรรม หรือการสร้างคอนเทนต์ในระบบ
- **Google Vertex AI Integration:** รองรับการเชื่อมต่อกับ **Google Vertex AI (Imagen 3)** โดยตรงผ่าน REST API เพื่อสร้างภาพคุณภาพสูงในระดับสตูดิโอ (Studio-grade generation)
- **Multi-Model Engine:** แอดมินสามารถเลือกใช้เครื่องมือสร้างภาพได้หลากหลาย เช่น **OpenAI DALL-E 3** หรือ **Imagen 3** ตามความเหมาะสมของงาน
- **Visual Styles & Templates:** มาพร้อมตัวเลือกสไตล์สำเร็จรูป (Lifestyle, Vector, 3D Illust, Infographic) ที่ช่วยควบคุมอารมณ์ของภาพให้คงเส้นคงวากับตัวโปรเจกต์
- **Story Visualization:** ฟีเจอร์ "Visualize Story" ในหน้า Laugh Tale ช่วยให้แอดมินสามารถเปลี่ยนข้อความ Reflection ของอินเทิร์นให้กลายเป็นภาพประกอบ (Illustrated Card) ได้ทันทีในคลิกเดียว
- **Seamless Asset Management:** ภาพที่สร้างขึ้นสามารถพรีวิว ดาวน์โหลด หรือคัดลอก Base64 เพื่อนำไปใช้เป็น Quest Image ในระบบ Daily Quest ได้อย่างรวดเร็ว
- **[Security] Data Integrity & Stability (V86.14):**     - **Quiz UI Optimization (V86.14):** ย้ายกลุ่มปุ่ม Smart Paste และ AI Controls ขึ้นไปบรรทัดเดียวกับหัวข้อ "Question" เพื่อประหยัดพื้นที่แนวตั้งและทำให้การทำงานไหลลื่นขึ้น
    - **CRITICAL FIX:** แก้ไขบั๊กหน้าจอการทำข้อสอบค้างที่ 0s และกด Next ไม่ได้ ซึ่งเกิดจาก Syntax Error ของฟังก์ชันบันทึกเวลาที่ไปซ้อนทับกัน
    - **UI Decluttering (V86.14):** ถอดปุ่ม "Test API" ออกจาก Header เพื่อความสวยงามและลดความซับซ้อน (เนื่องจากรุ่น AI ได้รับการยืนยันแล้ว)
    - **Go-Live Optimization (V86.14):** ปรับปรุงปุ่ม "On" (Go Live) ให้ฉลาดขึ้น หากแอดมินเปิดใช้งานแบบทดสอบที่หมดเวลาแล้ว ระบบจะเสนอให้รีเซ็ต Deadline ทันที เพื่อให้งานย้ายไปอยู่ตาราง Active และผู้ใช้เข้าทำได้
    - **Gemini 2.5 Upgrade (V86.14):** ปรับปรุงชื่อรุ่น AI เป็น **Gemini 2.5 Flash/Pro** ตามสิทธิ์การใช้งานจริงใน Google AI Studio เพื่อรองรับฟีเจอร์ใหม่และประสิทธิภาพที่สูงขึ้น
    - **Per-question Duration Tracking:** เพิ่มระบบบันทึกระยะเวลาที่ผู้ใช้ใช้ในแต่ละข้อ (Second-level precision) และแสดงผลในหน้า Admin ตอนตรวจงาน เพื่อช่วยวิเคราะห์พฤติกรรมการทำข้อสอบ
    - **Submission Fix:** แก้ไขปัญหาการส่งคำตอบแบบ Single Choice ให้เป็น Array เสมอ เพื่อป้องกันข้อผิดพลาดในการตรวจคำตอบอัตโนมัติ (Fix 0 Score Bug)
    - **Robust Submission (V78.4):** เพิ่มระบบป้องการการกด Submit ซ้ำ (Button Lock) และการล็อคปุ่มนำทาง (Prev/Next) ขณะกำลังประมวลผล เพื่อป้องกันสถานะไฟล์ขัดแย้ง
    - **Non-blocking BG Tasks:** แยกการทำงานเบื้องหลัง (เช่น Kanban Sync, Duration Adjustment) ออกจากการประมวลผลหลัก ทำให้ผู้ใช้งานได้รับผลลัพธ์การส่งทันทีโดยไม่ต้องรอระบบอื่น
    - **Fault-tolerant:** ระบบบันทึกข้อมูลแบบ Auto-save ทุกข้อ พร้อมระบบ Safety Timeout (30s) ที่จะปลดล็อคให้ส่งใหม่ได้หากระบบฐานข้อมูลตอบสนองช้า
- **[Poll] Poll Mode (Anonymous):** หากแบบทดสอบถูกตั้งเป็นโหมดโพล คำตอบของผู้ใช้จะถูกเก็บแบบไม่ระบุตัวตน (Anonymous) โดยแยกไปที่คอลเลกชัน `poll_responses` เพื่อความเป็นส่วนตัวสูงสุด แต่ยังได้รับคะแนนตามสัดส่วนที่กำหนดเมื่ออาจารย์อนุมัติงาน
- **[Learning] Read-only Learning Mode (V86.14):** 
    - **Multi-page Curriculum:** โหมดการเรียนรู้แบบหัวข้อต่อเนื่อง (Lesson Pages) โดยแต่ละข้อที่แอดมินสร้างจะกลายเป็น 1 หน้าเนื้อหา (Multi-page Pagination)
    - **Interactive Discussion:** เพิ่มระบบกระดานข่าว/พูดคุย (Discussion Panel) ในทุกหน้าเนื้อหา เพื่อให้ผู้เรียนสามารถแลกเปลี่ยนความคิดเห็นหรือถามคำถามเกี่ยวกับเนื้อหาส่วนนั้นๆ ได้ทันที
    - **Tweetstorm Reflection:** ระบบสรุปบทเรียน (Reflection) ในขั้นตอนสุดท้ายแบบ Twitter Style (Tweetstorm) โดยผู้เรียนสามารถเพิ่มข้อความสั้นๆ หลายชุดเพื่อสรุปสิ่งที่ได้เรียนรู้
    - **Customizable Char Limits:** แอดมินสามารถกำหนดขีดจำกัดตัวอักษรต่อข้อความได้ (280 ตัวอักษรสำหรับ Standard หรือ 4000 ตัวอักษรสำหรับเนื้อหาเชั้นสูง)
    - **Admin Review:** แอดมินสามารถตรวจอ่าน Feedback ทั้งหมดที่เรียงต่อกันแบบสรุป (Flattened Feed) พร้อมระบบให้เหรียญรางวัลพิเศษ (Beta User) สำหรับความเห็นที่ยอดเยี่ยม
    - **Approval Workflow:** เมื่อส่ง Reflection ระบบจะตั้งสถานะเป็น 'Pending' เพื่อรอการตรวจสอบและอนุมัติคะแนนจากผู้สอนโดยตรง
    - **Collapsed Expired Quiz (V81.2):** ระบบ "ยุบบัตรแบบทดสอบที่หมดเวลา" (Collapse Expired) ในหน้า Assignments โดยแบบทดสอบที่เลยกำหนดส่งแล้วจะแสดงผลในรูปแบบแถวสั้น (Header-only) เพื่อไม่ให้รกพื้นที่ แต่ผู้เรียนยังสามารถกดขยาย (Expand) เพื่อขออนุญาตแอดมินทำเลทได้ตามปกติ
    - **Interactive Poll Reveal (V81.1):** ฟีเจอร์ "ตอบเพื่อเปิดเผย" (Choice to Reveal) ในโหมด Read-only
- **📝 Subjective Exam:** รองรับคำถามแบบข้อเขียน (Short Answer) โดยผู้ใช้สามารถพิมพ์ตอบได้ยาวตามต้องการ และระบบตรวจจับการส่งแบบหลายบรรทัด (Tweetstorm) โดยจะทำการ Flatten ข้อมูลให้อัตโนมัติเพื่อป้องกัน Error ของ Firestore แต่ยังคงการแสดงผลที่สวยงามในหน้าแอดมิน (V72.2)

### 5. การส่งงานทั่วไป (General Works)
- **Simple Form:** ส่งหัวข้องานและแนบลิงก์ผลงาน (เช่น Google Drive, GitHub)
- **Status Tracking:** ติดตามสถานะ (รอตรวจ/แก้ไข/ตรวจแล้ว) พร้อมคะแนนที่ได้รับรายชิ้น

### 6. ตารางอันดับ (Leaderboard V78.93)
- **Explicit Sorting:** ระบบจัดอันดับผู้ใช้งานตามคะแนนสูงสุด (Descending) อย่างชัดเจน
- **Top 3 Highlights:** แสดงอันดับ 1 (ทอง), 2 (เงิน), 3 (ทองแดง) ด้วยสีเจาะจงเพื่อให้เห็นผู้ชนะชัดเจน
- **Group Filtering:** แสดงผลอันดับภายในกลุ่มของตนเอง พร้อมตัวบ่งชี้ตำแหน่งที่ชัดเจน

---

## 🛠 ระบบฝั่งผู้ดูแล (Admin Dashboard - `admin.html`)

### 1. การบริหารจัดการงาน (Review & Approval)
- **Work Review:** ตรวจสอบงานทั่วไปที่นักศึกษาส่งมา ให้คะแนน และคอมเมนต์สถานะ
- **Quiz Approval:** 🆕 แท็บพิเศษสำหรับตรวจสอบผลการทำแบบทดสอบ และกดยืนยันคะแนน (Approve) เพื่อนำแต้มเข้าสู่บัญชีผู้ใช้
    - **Live Recalculation (V77.16):** ระบบคำนวณคะแนนใหม่ทันทีที่เปิดดู (On-the-fly) เพื่อแก้ไขปัญหาคะแนนเป็น 0 ในเคสเก่าที่เคยมีบั๊ก
- **History Logs:** ดูประวัติการให้คะแนนอย่างละเอียด (Time-series) และสามารถย้อนคะแนน (Revert/Delete) ได้กรณีผิดพลาด
- **[Preview] UI Preview (V86.14):** ระบบจำลองหน้าจอ LIFF (Mobile View) บน Admin Dashboard ที่สามารถเลือกจำลองเป็น **"รายบุคคล"** ได้ เพื่อตรวจสอบการแสดงผลและข้อมูลของผู้ใช้งานคนนั้นๆ โดยเฉพาะ พร้อมระบบป้องกันไม่ให้การ Preview ไปพ่นข้อมูลทับหรืออัปเดต Activity ของผู้ใช้งานจริง- **✨ Visual Review Pipeline (V77.22):** เพิ่มการแสดงภาพ Profile ของผู้ส่งงานในตาราง **"รออนุมัติ (Pending Review)"** และตารางงานทั่วไป เพื่อให้ผู้ดูแลสามารถเห็นตัวตนผู้ส่งได้ทันที พร้อมระบบ Auto-lookup ภาพล่าสุดจากฐานข้อมูลผู้ใช้กรณีข้อมูลเก่าไม่มีรูปแนบ

### 2. การจัดการภารกิจ (Kanban Management & Focused Review)
- **Drag & Drop Console:** ย้ายสถานะงานของนักศึกษาได้ทันทีผ่านหน้า Admin
- **[Points] Reflective Log Points Claim (V86.16):** ระบบใหม่ที่บังคับให้ผู้ใช้งานต้องเปิดอ่านฟีดแบ็กจากแอดมินก่อนจึงจะกดรับคะแนนโบนัสได้ เพื่อกระตุ้นการสื่อสารระหว่างพี่เลี้ยงและนักศึกษา
- **✨ Reflective Log Detail Viewer:** แอดมินสามารถคลิกดูเนื้อหาบันทึกฉบับเต็มและคอมเมนต์ย้อนหลังได้โดยตรงจากตารางประวัติ (History Table)
- **✨ Admin Dashboard Tabs (V84.9):** ระบบแท็บแยกตามกลุ่ม (Junior, INTERN, EXTERN) ช่วยให้แอดมินโฟกัสการตรวจงานได้รวดเร็วขึ้น พร้อมแท็บ "ALL" เพื่อดูภาพรวมทั้งหมด
- **✨ Reflective Log Review (Dashboard):** รวมส่วนตรวจบันทึกสะท้อนคิดรายวันไว้ที่หน้า Dashboard หลัก เพื่อให้แอดมินให้คะแนนและคอมเมนต์ได้ทันที สะดวกกว่าเดิม
- **Priority & Assignee:** มอบหมายงานให้ผู้ใช้รายคนหรือเป็นกลุ่ม กำหนดความสำคัญ (Low/Medium/High)
- **Project Flag:** กำหนดประเภทงานเป็น Project เพื่อการติดตามที่เข้มข้นขึ้น
- **Archive System:** ย้ายงานที่เสร็จสิ้นแล้วเข้าสู่คลังจัดเก็บ (Archive) เพื่อลดความหนาแน่นของผู้ใช้งาน
- **🏝️ Laugh Tale웃음 이야기 (V84.9):** 
    - ระบบจัดเก็บ "เรื่องราวดีๆ" (Great Stories) ที่แอดมินคัดเลือกมาจาก Reflective Logs
    - แอดมินกด "Collect" เพื่อย้ายบันทึกที่ตรวจแล้วเข้าสู่คลังแสดงผลแบบพรีเมียม (Masonry Grid)
    - ช่วยสร้างแรงบันดาลใจและเก็บรักษาโมเมนต์การเรียนรู้ที่ยอดเยี่ยมไว้ในระบบอย่างถาวร
- **🔗 Kanban-Quiz Integration (V78.3):** ระบบเชื่อมโยง Kanban Board กับ Quiz/Homework แบบอัตโนมัติ:
    - **Auto-create Card:** เมื่อ Admin มอบการบ้าน ระบบสร้าง Kanban Card (📚 HW: ชื่อ Quiz) ใน Backlog ให้อัตโนมัติ พร้อมรูปและชื่อผู้รับงาน
    - **Auto-move Doing:** เมื่อ User เริ่มทำ Quiz การบ้าน → Card ขยับจาก Backlog ไป **Doing** อัตโนมัติ
    - **Auto-move Review:** เมื่อ User ส่งคำตอบ → Card ขยับไป **Review** อัตโนมัติ
    - **Auto-move Done:** เมื่อ Admin Approve คะแนนครบทุกคน → Card ขยับไป **Done** อัตโนมัติ
    - **Linked Quiz ID:** Card เก็บ `linkedQuizId` ไว้เพื่อ Sync สถานะแบบ Real-time
    - **Smart Cleanup:** ถ้ายกเลิกการบ้าน (ลบ User ออกหมด) → Card จะถูกลบออกจาก Board อัตโนมัติ

### 3. การจัดการแบบทดสอบ (Quiz Setup - V77)
- **Enhanced UI (V77):** ปรับปรุงหน้าจอจัดการให้เป็นระเบียบและลดความผิดพลาด
    - **Precise Scheduling:** รูปแบบวันเวลา Start/Deadline เป็น Day/Month/Year (24h) ชัดเจน
    - **Dynamic Options:** เพิ่ม/ลบตัวเลือก (Choice) ได้ไม่จำกัด (ขั้นต่ำ 2 ข้อ) พร้อมรันลำดับเลขให้อัตโนมัติ
    - **Multi-select Correct:** เลือกคำตอบที่ถูกได้มากกว่า 1 ข้อผ่านระบบ Checkbox (สีตรงกับ Theme หลัก)
    - **Long Text Support:** ส่วนแสดงคำตอบที่ถูกรองรับข้อความยาวแบบไม่ตัดบรรทัด
- **Smart Features (V77.22):**
    - **Auto-save:** ระบบบันทึกแบบร่างอัตโนมัติขณะพิมพ์ (Draft) ป้องกันข้อมูลหาย
    - **Templates:** บันทึกโครงสร้างเข้อสอบเป็นแม่แบบ (Template) เพื่อนำกลับมาใช้ซ้ำได้ง่าย
    - **🎯 Advanced Smart Paste (V77.22):** ระบบก๊อปวางโจทย์อัจฉริยะที่ฉลาดขึ้น:
        - **Thai Character Support:** รองรับตัวเลือกนำหน้าแบบไทย (**ก. ข. ค. ง.**)
        - **Indent Detection:** รองรับโจทย์ที่ก๊อปมาจาก Word/PDF ที่ใช้การย่อหน้า (Indentation) แทนตัวเลขนำหน้า
        - **Auto-type Switch:** สลับโหมดคำถามเป็น "Choice" ให้อัตโนมัติเมื่อตรวจพบตัวเลือก
        - **Multi-platform support:** รองรับการขึ้นบรรทัดใหม่จากทั้ง Windows และ Mac
    - **✨ Improved Quiz UI (V77.22):**
        - **Target Group Dropdown:** ปรับช่อง Target Group ให้เป็นรายการเลือก (Dropdown) เพื่อความรวดเร็วและลดความผิดพลาดในการพิมพ์กลุ่มหลัก (IT, Public, Intern, etc.)
        - **Question Navigation Bar:** เพิ่มแถบปุ่มตัวเลขข้อ (Box Navigation) ระหว่างปุ่ม Add New และ Prev/Next ช่วยให้กระโดดข้ามไปข้อที่ต้องการได้ทันที
        - **Progress Color Coding:** ปุ่มเลขข้อจะเปลี่ยนเป็น **สีเขียวอ่อน** เมื่อข้อนั้นมีการเลือกคำตอบที่ถูกไว้แล้ว ช่วยให้ Admin ตรวจสอบได้ทันทีว่าข้อไหนยังไม่ได้เฉลย
        - **Visual Highlighting:** ในส่วนการเลือกเฉลย เมื่อติ๊กถูกที่ข้อใด บรรทัดของตัวเลือกนั้นจะ **Highlight สีเขียวอ่อน** ทันที เพื่อให้สังเกตง่ายและลดความสับสนขณะทำเฉลย
        - **Bias Reduction:** ข้อที่เพิ่มใหม่จะไม่ถูกเลือกเฉลยไว้ล่วงหน้า (Empty Default) เพื่อป้องกันความลำเอียงในการออกข้อสอบ
    *   **✨ Audience Group (V77.7):** ระบบแยกเนื้อหาตามกลุ่มเป้าหมาย:
        *   **Audience Segmentation:** Admin สามารถกำหนดกลุ่มให้ User และกำหนดกลุ่มเป้าหมายให้ Quiz/Quest ได้ (เช่น IT, Marketing, Public)
        *   **Dynamic Filtering:** User จะเห็นเฉพาะเนื้อหาที่ตรงกับกลุ่มของตัวเองเท่านั้น
        *   **Permission Flow (V77.6):** ระบบขออนุญาตทำแบบทดสอบหลังหมดเวลา โดย User ต้องกด "Request" และรอ Admin อนุมัติ (สถานะ Allowed) ก่อนจึงจะเริ่มทำได้
    *   **✨ Leaderboard & Divisions (V77.16):** ระบบจัดอันดับแยกตามส่วนงานและลีกการแข่งขัน:
        *   **Group vs Division Logic:** 
            *   **Group (กลุ่ม):** คือ "หน่วยงาน" หรือ "แผนก" ที่นักศึกษาสังกัด (เช่น IT, Marketing, Pharmacist) ความสำคัญคือหนึ่งคนสังกัดได้ 1 กลุ่มเพื่อรับภารกิจและแบบทดสอบที่ตรงสาย
            *   **Division (ดิวิชั่น):** คือ "ลีก" หรือ "กระดานจัดอันดับ" ที่นำหลายๆ กลุ่มมารวมแข่งกัน (เช่น "Professional League" อาจประกอบด้วยกลุ่ม IT + Dev)
        *   **✨ Auto-Generated Group Tabs (V77.16):** ระบบสร้างแท็บ Leaderboard แยกรายกลุ่ม (Group) ให้อัตโนมัติโดยไม่ต้องตั้งค่า ช่วยให้ดูอันดับแยกตามกลุ่มได้ทันที (tab ต่อจาก All)
        *   **Interactive Leaderboard:** ระบบแสดงชื่อ Division แยกเป็นแท็บชัดเจน ช่วยให้ดูอันดับเฉพาะกลุ่มที่สนใจได้ง่ายขึ้น
        *   **Automated Updates:** ระบบคำนวณอันดับแบบ Real-time ตามคะแนนสะสม และคำนวณคะแนนเฉลี่ย (Average) รายดิวิชั่นเพื่อเปรียบเทียบมาตรฐาน
        *   **Submission Stability:** ปรับปรุงความเสถียรในการส่งคำตอบ ป้องกันอาการปุ่มค้าง (Stuck on Processing) ด้วยระบบ Safety Timeout และ Concurrent Write
        *   **Smart Input Selection:** ระบบปรับเปลี่ยนรูปแบบการเลือก Radio/Checkbox อัตโนมัติตามจำนวนเฉลย
    *   **✨ Flexible Visibility & Insight (V77.18):**
        *   **Global Students Ranking:** แท็บ "Others" ถูกปรับปรุงเป็น **"👥 Students"** แสดงอันดับรวมของนักศึกษาทุกคนในระบบ (Global Ranking) เรียงตามคะแนนจริง โดยแสดงผลอันดับรวมไว้ที่บนสุดในหน้า All ด้วย
        *   **Blind Leaderboard (V77.18):** ระบบจัดอันดับแบบ "กึ่งนิรนาม" สำหรับฝั่งนักศึกษา โดย User จะเห็นตัวตน (ชื่อ/รูป) เฉพาะของตนเองเท่านั้น ส่วนอันดับอื่นจะเห็นเพียงลำดับที่และคะแนน เพื่อรักษาความเป็นส่วนตัวแต่ยังคงบรรยากาศการแข่งขัน
        *   **Full Listing:** ยกเลิกการจำกัดการแสดงผลเฉพาะ Top 20 เพื่อให้นักศึกษาทุกคนเห็นลำดับที่จริงของตนเองเทียบกับทั้งกลุ่ม
        *   **Participant Tracking (V77.17):** 
            *   **Count Badge:** เพิ่มการแสดงจำนวนผู้เข้าร่วมสอบ (Badge Count) บนการ์ดแบบทดสอบทันทีเพื่อดูภาพรวมความสนใจ
            *   **Detailed List:** Admin สามารถเรียกดูรายชื่อผู้เข้าสอบในแต่ละ Quiz ได้โดยละเอียดผ่านไอคอน 👥 เพื่อดูคะแนน สถานะ และเวลาที่ส่งงานรายคน พร้อมระบบ **"Reset"** (เพื่อให้ทำใหม่ได้) 
            *   **Hide Scores Option:** ตัวเลือก **"Hide Scores"** สำหรับซ่อนคะแนนชั่วคราวเพื่ออำนวยความสะดวกในการจับภาพหน้าจอ (Capture) รายชื่อผู้ส่งงานโดยไม่เปิดเผยคะแนนส่วนตัว
        *   **Visibility Control (V77.13):** Admin สามารถตั้งค่าการมองเห็นเมนู (Status, Kanban, Assignments, **General Work**) แยกตามกลุ่มนักศึกษาได้ ทำให้แอป LIFF ปรับเปลี่ยนหน้าตาตามความเหมาะสมของแต่ละสายงาน
    *   **✨ UI/UX & Logic Optimizations (V79.7):**
        *   **Kanban Board Shrinkage:** การ์ดใน Kanban Board (ทั้ง LIFF และ Admin) จะซ่อนรายละเอียด (Description) ไว้เป็นค่าเริ่มต้นและใช้ปุ่ม Toggle เพื่อประหยัดพื้นที่แนวตั้ง
        *   **Smart Quiz Visibility:** แบบทดสอบในหน้าแรกจะแสดงผลเฉพาะรายการที่ **"Active"**, **"กำลังทำค้างไว้"**, หรือ **"ได้ 0 คะแนน"** เท่านั้น รายการที่หมดเวลาจะถูกซ่อนอัตโนมัติจนกว่าแอดมินจะสั่ง Active ใหม่
        *   **Unified User Management:** รวมหน้าต่างแก้ไขกลุ่ม (Group) และชื่อสำหรับออกใบประกาศ (Cert Name) เข้าด้วยกันเป็น Modal เดียว เพื่อความรวดเร็วในการจัดการข้อมูลนักศึกษา
        *   **Quiz Pagination:** ระบบจัดการการบ้าน/แบบทดสอบใน LIFF รองรับการแบ่งหน้า (Pagination) หน้าละ 3 รายการ พร้อมระบบ Auto-scroll เมื่อเปลี่ยนหน้า เพื่อประสิทธิภาพในการโหลดและความสวยงามบนอุปกรณ์มือถือ
        *   **Enhanced Group UI (V77.16):** ปรับปรุงการแสดงผลกลุ่ม (Groups) ให้มีสีสันที่แตกต่างกันชัดเจน **(EXTERN=ส้ม, INTERN=ม่วง)** และเพิ่มไอคอนประจำสายงาน เพื่อช่วยในการแยกแยะและจัดการข้อมูลได้รวดเร็วยิ่งขึ้น ทั้งในหน้า Admin และหน้าโปรไฟล์ของนักศึกษา
        *   **Division Badge:** เพิ่มการแสดงป้าย Division บนหน้าโปรไฟล์ User เพื่อให้ทราบลีกการสะสมคะแนนของตนเอง
    *   **🚀 Immediate Go Live:** ปุ่ม **"Go Live"** เพื่อเปิดสอบทันที (ตั้งเวลาเริ่มเป็นปัจจุบันและ Active ทันที) และ **"End Now"** เพื่อยุติการสอบทันที
    - **Real-time Countdown:** แสดงเวลานับถอยหลังสำหรับแบบทดสอบที่กำลังดำเนินการอยู่ (Active)
- **Dual Naming:** กำหนดชื่อแบบเต็ม (Full Title) และชื่อย่อ (Short Title)
- **Proportional Scoring:** กำหนดคะแนนเต็ม (Total Score) ระบบจะคำนวณสัดส่วนคะแนนจากจำนวนข้ออัตโนมัติ
- **Per-question Timers:** กำหนดเวลาคิดรายข้อแยกกันได้ (วินาที)
- **Reposting:** ปุ่มสำหรับ Reset ข้อมูลเวลาเพื่อนำแบบทดสอบเดิมมาใช้ใหม่ได้ทันที
- **🗳️ Poll & Subjective Control (V74):**
    *   **Poll Mode Toggle:** เลือกเปิดโหมดโหวตแบบไม่ระบุตัวตน โดยระบบจะซ่อนส่วน "เฉลยคำตอบ" อัตโนมัติขณะสร้าง
    *   **📝 SUBJECTIVE Label:** ระบบตรวจจับคำถามอัตนัย (ข้อเขียน) อัตโนมัติและติดป้ายกำกับแยกชัดเจน
    *   **📊 Result Summary:** ปุ่มดูสรุปผลสถิติแบบเรียลไทม์:
        *   คำถามแบบตัวเลือก: แสดงเป็น **กราฟแท่ง (Progress Bar)** พร้อมเปอร์เซ็นต์
        *   คำถามแบบข้อเขียน: แสดงรายการคำตอบทั้งหมดของทุกคนในหน้าเดียว (ถ้าเป็นโพลจะซ่อนชื่อ ถ้าเป็นข้อสอบปกติจะแสดงชื่อผู้ตอบกำหน้าคำตอบ)
        *   **Participant Management (V74):** สามารถลบผู้เข้าร่วมออกจาก Pool ได้ หากเป็น Quiz ที่ให้คะแนนแล้ว ระบบจะ **Revert Score (หักคะแนนคืน)** ให้อัตโนมัติพร้อมบันทึก Log
- **📖 Case Study Mode (V77.23):** 
    - **Contextual Learning:** รองรับข้อสอบแบบอ่านเนื้อหา (Passage/Case) ยาว 4-5 บรรทัด แล้วตอบคำถามต่อเนื่องกันหลายข้อ
    - **Collapsible Reader:** ในฝั่ง User มีระบบ "Read Case" แบบพับเก็บได้ (Collapsible) เพื่อประหยัดพื้นที่หน้าจอขณะทำข้อสอบ แต่ยังสามารถเปิดอ่านได้ตลอดเวลา
    - **Persistent Context:** เนื้อหา Case จะปรากฏอยู่ด้านบนของทุกข้อในชุดข้อสอบนั้นๆ เพื่อให้ผู้ใช้สามารถอ้างอิงข้อมูลได้ทันที
- **⚡ Advanced Quiz Mgmt (V77.24-27):**
    - **Countdown Presets:** ปุ่มลัดสำหรับแอดมินในการตั้งเวลานับถอยหลัง (1ชม. - 168ชม.)
    - **Dynamic Duration Adjustment:** เมื่อมีผู้เข้าสอบคนแรกทำเสร็จ ระบบจะลดเวลาที่เหลืออยู่ของข้อสอบลง 10% อัตโนมัติ เพื่อกระตุ้นความเร็ว
    - **Question Time Accumulation:** เวลาที่เหลือจากข้อที่ทำเสร็จก่อนกำหนด จะถูกนำไปสะสมเพิ่มให้ในข้อถัดไป
    - **Exit & Abandonment Guard:** การออกจากหน้าจอทำข้อสอบระหว่างทำ (Refresh/Close) จะถือว่าเป็นพยายามครั้งที่ล้มเหลว (Abandoned) และถูกล็อค ห้ามเข้าทำต่อจนกว่าแอดมินจะอนุมัติใหม่
    - **Safety Briefing:** ระบบแจ้งเตือนเงื่อนไขก่อนเริ่มทำข้อสอบจริง เพื่อป้องกันความผิดพลาดของผู้ใช้
    - **UI Optimization (V77.25):** ส่วนเลือกเลขข้อในหน้าแอดมิน ปรับให้แสดงผลแบบหลายแถว (Wrap) ได้เมื่อมีจำนวนข้อมาก เพื่อความสะดวกในการกดโดยไม่ต้องเลื่อนแถบแนวนอน
    - **Quiz Duplication (V77.26):** ปุ่ม **"Duplicate" (Copy)** เพื่อคัดลอกแบบทดสอบเดิมมาเป็นชุดใหม่ทันที ช่วยให้การแบ่งชุดข้อสอบหรือสร้างเวอร์ชันใหม่ทำได้รวดเร็วขึ้น
    - **Work History Consolidation (V77.27):** ระบบรวบรวมประวัติการส่งงานทั้งหมด (แบบทดสอบที่ตรวจแล้ว/รอตรวจ, ภารกิจประจำวัน, และงานทั่วไป) ไว้ในรายการเดียวแบบ Consolidated View ช่วยให้ผู้ใช้งานติดตามความคืบหน้าของตนเองได้ง่ายขึ้น และแยกส่วนออกจากภารกิจที่ยังไม่ได้ทำ (Pending Tasks) อย่างชัดเจน
- **📚 Homework Mode (V78.2):**
    - **User-level Assignment:** Admin สามารถมอบการบ้านให้ User เฉพาะรายได้ (ไม่จำเป็นต้องส่งให้ทั้งกลุ่ม)
    - **Searchable User Picker:** ระบบค้นหาชื่อ + เลือก User ได้ทั้งในฟอร์มสร้าง Quiz และจาก Quick Assign Modal
    - **Quick HW Assign Button (📚):** ปุ่มลัดบนตาราง Quiz ที่สามารถกดมอบการบ้านได้ทันทีโดยไม่ต้องเข้าแก้ไข Quiz ทั้งหมด
    - **Select All / Clear:** ปุ่มเลือกทั้งหมด (ตาม Target Group) และล้างทั้งหมด
    - **Visual Chips:** แสดง User ที่ถูกเลือกเป็น Chip สีเขียวพร้อมปุ่มลบ
    - **Badge Display:** แสดง Badge 📚 HW (จำนวนคน) ในตาราง Admin และ Badge 📚 การบ้าน ในฝั่ง User
    - **Homework Icon:** เปลี่ยน Icon จาก 🧠 เป็น 📚 (หนังสือสีเขียว) เมื่อเป็นการบ้าน
    - **Visibility Control:** เฉพาะ User ที่ถูก Assign เท่านั้นถึงจะเห็น Quiz ของการบ้าน
    - **Compact Action Buttons:** ปุ่ม Action ในตาราง Quiz ถูกจัดเป็น 2 แถวเพื่อลดความกว้าง
    - **🔗 Kanban Integration (V78.3):** เชื่อมโยงกับ Kanban Board แบบอัตโนมัติ — Card จะถูกสร้างและขยับตามสถานะ (Backlog→Doing→Review→Done) ตาม Flow การทำการบ้านของ User (ดูรายละเอียดในหัวข้อ Kanban Management)

### 4. การจัดการผู้ใช้งาน (User & Leaderboard)
- **User Search & Control:** ค้นหานักศึกษา ดูประวัติอย่างละเอียด
- **Manual Adjustment:** เพิ่ม/ลดคะแนนด้วยมือพร้อมบันทึกเหตุผล
- **Leaderboard:** แสดงอันดับ Ranking 20 อันดับแรกแบบอัตโนมัติ พร้อมสถานะวันคงเหลือของการฝึกงานแต่ละคน
- **⏳ Pre-Registration System (V79.6):** เพิ่มรายชื่อการจองฝึกงานล่วงหน้า โดยสามารถเพิ่มชื่อภาษาอังกฤษและชื่อเล่น (Nickname) ของนักศึกษาเข้าสู่ Leaderboard ได้เลย (แสดงสถานะ ⏳ Pending Reg.)

### 5. ระบบใบรับรอง (Certification)
- **Cert Request Queue:** ตรวจสอบคำร้องขอใบรับรอง
- **Interactive Preview:** พรีวิวใบรับรองก่อนพิมพ์ แก้ไขวันเริ่ม-วันจบได้
- **PDF Generation:** สร้างไฟล์ PDF พร้อมลายน้ำและรูปแบบมาตรฐานขององค์กร
- **📦 Bulk Export:** ระบบส่งออกใบรับรองของนักศึกษาทุกคนที่มีข้อมูลครบถ้วนออกมาเป็นไฟล์ PDF ชุดเดียวในคลิกเดียว (V72.4)
- **✨ Premium Redesign (V72.5):** ปรับโฉมใบรับรองใหม่ให้มีความหรูหรา:
    *   ดีไซน์แบบ Navy & Gold พร้อมตราประทับสีทอง (Golden Seal)
    *   ระบบ Preview แบบ Responsive ที่ขยาย/ย่อรูปภาพให้พอดีกับหน้าจอเสมอ
    *   **Full Name Support (V73):** เพิ่มช่อง "ชื่อ-นามสกุล จริง" แยกต่างหากจาก Display Name เพื่อใช้สำหรับออกใบรับรองโดยเฉพาะ พร้อมระบบ Auto-save
    *   **✨ Dual Seal Layers (V77.21):** ระบบตราประทับแบบซ้อนชั้น โดยตรา **Excellence Award (สีทอง)** จะแสดงผลที่ตำแหน่งหลักเสมอ และหากได้รางวัลพิเศษ (**Special Award**) ตราพิเศษจะแสดงผลในขนาดที่เล็กลงอยู่ด้านบน เพื่อให้เห็นเกียรติประวัติทั้งสองส่วนบนใบเดียว
    *   **Bilingual Names (V79.6):** รองรับระบบ 2 ชื่อบนใบรับรอง (ชื่อจริง-นามสกุลอังกฤษ และ AKA/Nickname แทรกด้านล่างอัตโนมัติ) เพื่อให้ใบรับรองมีความเป็นสากลและตรงตามตัวตนของผู้รับ

### 6. ระบบวิเคราะห์และติดตามผล (Analytics & Leaderboard - V78.93)
- **Daily Score Chart:** แสดงกราฟแท่งคะแนนรายวันในตาราง Leaderboard ทำให้เห็นพัฒนาการและความสม่ำเสมอของผู้ใช้งานแต่ละคน
- **Visual Milestones:** กราฟแสดงจุด Date Start และ Date End ของการฝึกงาน พร้อม Marker บอกตำแหน่ง "วันนี้" (Today) เพื่อให้ทราบความคืบหน้าของระยะเวลาฝึกงาน
- **🛠️ Chart Data Fix (V77.20):** ปรับปรุงระบบการดึงข้อมูลกราฟให้ใช้การกรองฝั่ง Client แทนการใช้ Composite Index ของ Firebase เพื่อแก้ปัญหาหน้ากราฟไม่โหลดหรือ Error ในโครงการที่ยังไม่ได้ตั้งค่า Index
- **📊 Performance Stats (V78.9):**
    - **Min/Max Daily Score:** แสดงคะแนนรายวันต่ำสุดและสูงสุดของแต่ละ User ใต้กราฟ
    - **🔥 Longest Streak (V78.93):** คำนวณจำนวนวันที่ได้คะแนนต่อเนื่องมากที่สุด โดย Scan ตั้งแต่วันเริ่มฝึกงาน (`startDate`) จนถึงวันปัจจุบัน พร้อม **แสดงช่วงวันที่** ของ Streak นั้น (เช่น `5 วัน (28 ม.ค. - 1 ก.พ.)`) เพื่อดูความขยันในแต่ละช่วง
    - **Active Days:** นับจำนวนวันทั้งหมดที่มีกิจกรรม (คะแนน > 0)
- **🔍 Popup Chart Viewer (V78.93):**
    - กดที่แถว User ใน Leaderboard → เปิด **Modal Popup** แสดงกราฟขยาย ~3 เท่า (200px)
    - แสดง Header (รูป + ชื่อ + Level + ช่วงฝึกงาน + Score)
    - กราฟพร้อม Hover tooltip แสดงคะแนนรายวัน
    - สถิติ 4 ตัว: Min Daily, Max Daily, Longest Streak (+ ช่วงวันที่), Active Days
- **📅 Global Date Range (V78.92):**
    - เพิ่มช่อง Input "View Range" (Start-End) ด้านบน Leaderboard
    - ใช้กำหนดช่วงเวลาเปรียบเทียบกราฟของน้องทุกคนบน Timeline เดียวกัน
    - หากไม่กรอก ระบบจะใช้ startDate/endDate ของแต่ละ User ตามปกติ

---

## 📁 โครงสร้างข้อมูล (Firestore Schema)
- `users`: ข้อมูลโปรไฟล์ คะแนน วันเวลาฝึกงาน และ `fullName` (สำหรับใบรับรอง)
- `side_quests`: ข้อมูลภารกิจใน Kanban และประวัติการแชท
- `quests`: ภารกิจประจำวัน (Daily Quests)
- `quest_submissions`: ประวัติการตอบภารกิจประจำวัน
- `quizzes`: แม่แบบแบบทดสอบและการตั้งเวลา (รองรับสถานะ `isTemplate` และ `isActive`)
- `quiz_attempts`: ผลการทำแบบทดสอบที่รอหรือได้รับอนุมัติแล้ว
- `works`: ข้อมูลการส่งงานทั่วไป
- `checkin_logs`: บันทึกประวัติการได้/เสียคะแนนทั้งหมด (Audit Trail)
- `poll_responses`: (NEW!) คำตอบแบบไม่ระบุตัวตนจากโหมด Poll
- `reflective_logs`: (NEW! V84.8) บันทึกสะท้อนคิดรายวัน พร้อมอารมณ์และคอมเมนต์จากแอดมิน

---

## 🛡️ Finalized Firebase Security Rules
เพื่อให้ระบบปลอดภัยและรองรับฟีเจอร์ใหม่ทั้งหมด แนะนำให้ใช้กฎชุดนี้ใน Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ✅ ฟังก์ชันเช็ค Admin (เมล medlifeplus@gmail.com)
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'medlifeplus@gmail.com';
    }

    // 1. Users
    match /users/{userId} {
      allow read, create, update: if true;
      allow delete: if isAdmin();
    }

    // 2. Works
    match /works/{workId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }

    // 3. Quests
    match /quests/{questId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 4. Quest Submissions
    match /quest_submissions/{subId} {
      allow read, create, update: if true;
      allow delete: if isAdmin();
    }
    
    // 5. Check-in Logs
    match /checkin_logs/{logId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }
    
    // 6. Side Quests
    match /side_quests/{taskId} {
      allow read: if true;
      allow create, update: if true;
      allow delete: if isAdmin();
      
      match /comments/{commentId} {
        allow read, create: if true;
      }
    }
    
    // 7. Reports
    match /reports/{reportId} {
      allow create: if true;
      allow read, update, delete: if isAdmin();
    }

    // 8. Quizzes
    match /quizzes/{quizId} {
      allow read: if true; 
      allow write: if isAdmin();
    }

    // 9. Quiz Attempts
    match /quiz_attempts/{attemptId} {
      allow create, update, read: if true;
      allow delete: if isAdmin();
    }

    // 🔥 10. Poll Responses
    match /poll_responses/{pollId} {
      allow create: if true;
      allow read: if isAdmin();
      allow update, delete: if false;
    }

    // 🔥 11. Reflective Logs (V84.8)
    match /reflective_logs/{docId} {
      allow read, create: if true;
      allow update, delete: if true; 
    }
  }
}
```

### 7. ระบบบันทึกสะท้อนคิดรายวัน (Reflective Log - V84.8)
- **Daily Mission Integration:** รวมอยู่ในส่วน "ภารกิจ (Side Quests)" เพื่อให้นักศึกษาบันทึกสิ่งที่ได้เรียนรู้ในแต่ละวันได้ทันที
- **Gamification:** รับ 0.1 คะแนนอัตโนมัติทันทีที่ส่ง พร้อมระบบสะสม **Streak (🔥)** เพื่อกระตุ้นความสม่ำเสมอ
- **Feedback Loop:** แอดมินสามารถคอมเมนต์ตอบกลับและให้คะแนนโบนัสพิเศษ (Bonus Point) รายคนได้
- **Emoji Mood:** เลือกสถานะอารมณ์ประจำวันเพื่อสื่อสารความรู้สึกกับผู้ดูแล

### 8. ระบบขอเข้าใช้งาน (Access Request System - V84.3)
- **Pending Review Interface:** ส่วนจัดการคำขอเข้าใช้งานใหม่ที่ผู้ใช้ส่งมาจากหน้า LIFF
- **Automated User Onboarding:** ระบบอนุมัติพร้อมสร้าง User Profile ให้อัตโนมัติ พร้อมรองรับข้อมูล **"สถาบัน / ที่ทำงาน (Institute)"** (V86.14)
- **Live Sync:** ดึงข้อมูลจากคอลเลกชัน `reports` (ประเภท `access_request`) แบบ Real-time

### 9. ระบบ AI อัจฉริยะ (Universal AI Provider - V86.14)
- **Multi-Model Support:** รองรับทั้ง **Google Gemini (2.5 Flash/Pro)** และ **OpenTyphoon (v2.5/v2.1)**
- **OpenAI Compatible:** ใช้มาตรฐาน OpenAI API สำหรับการเชื่อมต่อกับ OpenTyphoon เพื่อความรวดเร็วและแม่นยำในภาษาไทย
- **Automated Work Feedback:** ระบบช่วยเขียนคอมเมนต์และฟีดแบ็กให้นักศึกษาอัตโนมัติ (getAISuggestion)
- **Quiz Intelligence:** ระบบแปลภาษาและยกระดับคุณภาพของคำถามใน Quiz เพื่อมาตรฐานระดับสากล (aiEnhanceQuestion)
- **Global Localization (V86.14.a):**
    - **Full English Admin UI:** แปลภาษาในหน้า Admin Dashboard (`admin.html`) เป็นภาษาอังกฤษทั้งหมด 100% เพื่อรองรับการใช้งานระดับสากล
    - **Standardized Messaging:** ปรับปรุงข้อความแจ้งเตือน (Alerts), กล่องยืนยัน (Confirmation Prompts) และข้อความแนะนำ (Placeholders) ให้เป็นภาษาอังกฤษที่กระชับและเข้าใจง่าย
    - **Visual Cleanup:** แก้ไขปัญหาการแสดงผลตัวอักษรผิดเพี้ยน (Broken Encoding) และเปลี่ยนไอคอนสัญลักษณ์จากอักขระพิเศษเป็น Emojis และ Font Awesome Icons ที่เป็นมาตรฐาน
    - **Date & Time Formatting:** ปรับการแสดงผลวันที่และเวลาให้ใช้รูปแบบ `en-US` (เช่น Mar 23, 2026) ทั่วทั้งระบบเพื่อความสม่ำเสมอ

---
*บันทึกภาพรวมระบบสะท้อนความจริง (V87.28) โดย Antigravity AI*
