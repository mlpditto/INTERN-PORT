# MLP Internship Portfolio (V78.6) Overview

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
- **✅ Multi-Correct & Smart Shuffle (V78.5):** 
        - รองรับข้อสอบที่คำตอบถูกมากกว่า 1 ข้อ ระบบใช้ปุ่มแบบ Robust Checkbox และ Z-index Control
        - **🔀 Smart Shuffle (Option 1+2):** 
            - เพิ่ม Option ให้แอดมินเลือกเปิด/ปิดการสุ่มตัวเลือก (Shuffle Choices) ราย Quiz ได้
            - หากเปิดการสุ่ม ระบบจะ **สุ่มเฉพาะข้อแรกๆ และล็อคข้อสุดท้าย (Anchor)** ไว้เสมอ เพื่อรองรับโจทย์ประเภท "ถูกทุกข้อ" หรือ "ไม่มีข้อใดถูก" ไม่ให้สับสน
- **🎓 Premium Electronic Certificate (V78.6):** 
    - ปรับปรุงดีไซน์ใบรับรองใหม่แบบ **บิณฑบาต (Bilingual)** ภาษาไทย-อังกฤษคู่ขนาน
    - ใช้ Typography ระดับพรีเมียม (Garamond & Montserrat) พร้อมระบบ Auto-fit ชื่อผู้รับ
    - เพิ่มระดับความปลอดภัยด้วย Watermark, Serial Number และ Digital QR Placeholder
    - ดีไซน์ทันสมัยด้วย Gold Accent และ Modern Navy Curve สำหรับพิมพ์ลงกระดาษ A4
- **Approval Workflow:** เมื่อทำเสร็จ คะแนนจะขึ้นสถานะ **"รออนุมัติ (Pending)"** (แสดงเป็นทศนิยม 3 ตำแหน่ง) แต้มจะยังไม่เข้าระบบทันทีจนกว่าผู้ดูแลจะกดยืนยัน
- **🛡️ Data Integrity & Stability (V78.4):** 
    - **Submission Fix:** แก้ไขปัญหาการส่งคำตอบแบบ Single Choice ให้เป็น Array เสมอ เพื่อป้องกันข้อผิดพลาดในการตรวจคำตอบอัตโนมัติ (Fix 0 Score Bug)
    - **Robust Submission (V78.4):** เพิ่มระบบป้องการการกด Submit ซ้ำ (Button Lock) และการล็อคปุ่มนำทาง (Prev/Next) ขณะกำลังประมวลผล เพื่อป้องกันสถานะไฟล์ขัดแย้ง
    - **Non-blocking BG Tasks:** แยกการทำงานเบื้องหลัง (เช่น Kanban Sync, Duration Adjustment) ออกจากการประมวลผลหลัก ทำให้ผู้ใช้งานได้รับผลลัพธ์การส่งทันทีโดยไม่ต้องรอระบบอื่น
    - **Fault-tolerant:** ระบบบันทึกข้อมูลแบบ Auto-save ทุกข้อ พร้อมระบบ Safety Timeout (30s) ที่จะปลดล็อคให้ส่งใหม่ได้หากระบบฐานข้อมูลตอบสนองช้า
- **🗳️ Poll Mode (Anonymous):** หากแบบทดสอบถูกตั้งเป็นโหมดโพล คำตอบของผู้ใช้จะถูกเก็บแบบไม่ระบุตัวตน (Anonymous) โดยแยกไปที่คอลเลกชัน `poll_responses` เพื่อความเป็นส่วนตัวสูงสุด แต่ยังได้รับคะแนนตามสัดส่วนที่กำหนดเมื่ออาจารย์อนุมัติงาน
- **📝 Subjective Exam:** รองรับคำถามแบบข้อเขียน (Short Answer) โดยผู้ใช้สามารถพิมพ์ตอบได้ยาวตามต้องการ และระบบตรวจจับการส่งแบบหลายบรรทัด (Tweetstorm) โดยจะทำการ Flatten ข้อมูลให้อัตโนมัติเพื่อป้องกัน Error ของ Firestore แต่ยังคงการแสดงผลที่สวยงามในหน้าแอดมิน (V72.2)

### 5. การส่งงานทั่วไป (General Works)
- **Simple Form:** ส่งหัวข้องานและแนบลิงก์ผลงาน (เช่น Google Drive, GitHub)
- **Status Tracking:** ติดตามสถานะ (รอตรวจ/แก้ไข/ตรวจแล้ว) พร้อมคะแนนที่ได้รับรายชิ้น

### 6. ตารางอันดับ (Leaderboard V77.16)
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
- **✨ UI Preview (V77.17):** ระบบจำลองหน้าจอ LIFF (Mobile View) บน Admin Dashboard ช่วยให้สามารถตรวจสอบการแสดงผลของฝั่งผู้ใช้งานได้ทันทีโดยไม่ต้องใช้โทรศัพท์จริง
- **✨ Visual Review Pipeline (V77.22):** เพิ่มการแสดงภาพ Profile ของผู้ส่งงานในตาราง **"รออนุมัติ (Pending Review)"** และตารางงานทั่วไป เพื่อให้ผู้ดูแลสามารถเห็นตัวตนผู้ส่งได้ทันที พร้อมระบบ Auto-lookup ภาพล่าสุดจากฐานข้อมูลผู้ใช้กรณีข้อมูลเก่าไม่มีรูปแนบ

### 2. การจัดการภารกิจ (Kanban Management)
- **Drag & Drop Console:** ย้ายสถานะงานของนักศึกษาได้ทันทีผ่านหน้า Admin
- **Priority & Assignee:** มอบหมายงานให้ผู้ใช้รายคนหรือเป็นกลุ่ม กำหนดความสำคัญ (Low/Medium/High)
- **Project Flag:** กำหนดประเภทงานเป็น Project เพื่อการติดตามที่เข้มข้นขึ้น
- **Archive System:** ย้ายงานที่เสร็จสิ้นแล้วเข้าสู่คลังจัดเก็บ (Archive) เพื่อลดความหนาแน่นของผู้ใช้งาน
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

### 6. ระบบวิเคราะห์และติดตามผล (Analytics & Leaderboard - V73)
- **Daily Score Chart:** แสดงกราฟแท่งคะแนนรายวันในตาราง Leaderboard ทำให้เห็นพัฒนาการและความสม่ะเสมอของผู้ใช้งานแต่ละคน
- **Visual Milestones:** กราฟแสดงจุด Date Start และ Date End ของการฝึกงาน พร้อม Marker บอกตำแหน่ง "วันนี้" (Today) เพื่อให้ทราบความคืบหน้าของระยะเวลาฝึกงาน
- **🛠️ Chart Data Fix (V77.20):** ปรับปรุงระบบการดึงข้อมูลกราฟให้ใช้การกรองฝั่ง Client แทนการใช้ Composite Index ของ Firebase เพื่อแก้ปัญหาหน้ากราฟไม่โหลดหรือ Error ในโครงการที่ยังไม่ได้ตั้งค่า Index

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
  }
}
```

---
*บันทึกภาพรวมระบบฉบับสมบูรณ์ (V78.6) โดย Antigravity AI*
