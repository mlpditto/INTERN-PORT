# Session summary — INTERN-PORT

วันที่: 14 กันยายน 2026 · Asia/Bangkok

## สถานะล่าสุด

- Production: **V100.36**
- PR: https://github.com/mlpditto/INTERN-PORT/pull/1227
- Commit: `569eb8042ed0d83e6e431ddebc614ca2d5cfed28`
- GitHub Pages run: `34818855626` — สำเร็จ
- User: https://mlpditto.github.io/INTERN-PORT/
- Admin: https://mlpditto.github.io/INTERN-PORT/admin.html
- Worktree ที่ใช้: `D:/20_Code/INTERN-PORT-feedback-warm`
- Trunk และ PR base: `production`

## Releases ใน session

| Version | PR | งานที่ส่งขึ้น Production |
|---|---|---|
| V100.25 | #1216 | การ์ด Quiz / Log / Case รายเดือน และ SMART GOALS ใน Schedule |
| V100.26 | #1217 | Monthly targets แสดงผลงานจริง, live %, และ Past activity |
| V100.27 | #1218 | ย่อ Journal / Case; โบนัสส่ง Case ใหม่ 0.01 → 0.1 |
| V100.28 | #1219 | Monthly / Quarterly / Yearly, target stepper, preview และ shared monthly Quiz target |
| V100.29 | #1220 | ปุ่ม Monthly / Period inline พร้อมคำอธิบายไทย |
| V100.30 | #1221 | Assign goal ตามกลุ่มและตารางติดตาม; แก้ merge comparison ที่ไวต่อลำดับฟิลด์ |
| V100.31 | #1222 | User Hub เหลือ Units / Entry / Progress / Decay; รวม Goals และ Certificates |
| V100.32 | #1223 | Pending requests เหนือ Hidden; Logs นับ Journal ทั้งหมด; Schedule help ไม่ถูกตัด |
| V100.33 | #1224 | ย้ายไอคอนช่วยเหลือข้าง Edit dates; Public / Groups ในฟอร์ม Agenda |
| V100.34 | #1225 | Monthly cards เน้นตัวเลข; Set targets จุดเดียว; Certificate / Next level / Streak strip |
| V100.35 | #1226 | Thai help popup; Agenda ส่วนตัวก่อน Admin จัดผู้ชม; Date เต็มแถวและเวลา 24h |
| V100.36 | #1227 | Shared Training dates popup จากหน้าหลักและ Schedule; Activity ไม่มีฟอร์มแทรก |

PR ทุกหมายเลขเปิดได้ที่ `https://github.com/mlpditto/INTERN-PORT/pull/<number>`

## พฤติกรรมสำคัญ

### Goals และความคืบหน้า

- Monthly แสดงจำนวน Quiz / Journal / Case ที่ส่งในเดือนปฏิทินตามเวลา Bangkok
- Quiz นับชุดไม่ซ้ำในรอบนั้น ไม่รวม practice; สถานะที่นับคือ approved / pending / completed / graded
- ยังไม่มี target: แสดงจำนวนอย่างเดียว ไม่แสดงเปอร์เซ็นต์
- Period สำหรับ Lifelong เลือก Quiz รายเดือน / ไตรมาส / ปี
- เป้า Quiz รายเดือนซิงก์กับ Monthly targets ทั้งสองทาง โดยไม่เขียนทับเป้ารายไตรมาส/ปี
- Internship ใช้ช่วงวันเริ่ม–สิ้นสุดฝึกงาน
- Past activity พับได้; มีประวัติสะสมและรอบก่อน
- Popup ภาษาไทยอธิบาย Agenda / Activity / SMART GOALS และตัวอย่าง 12 / 30 = 40%

### Admin assigned goals

- User Hub → Progress → Goals
- เลือกกลุ่ม, จำนวน Quiz / Journal / Case, วันเริ่ม–สิ้นสุด, Preview แล้ว Confirm
- ตรึงรายชื่อผู้รับ ณ เวลามอบหมาย สูงสุด 500 คนต่อรายการ
- ผู้ใช้เห็น Assigned by admin แยกจาก Personal goals
- ตาราง Admin แสดงรายคน จำนวน/เป้า/% และ Completed / In progress / Upcoming / Overdue
- Firestore `assigned_goals`: Admin สร้างได้ ผู้รับอ่านได้ ผู้ใช้แก้ไม่ได้
- รุ่นนี้ยังไม่มีแก้/ยกเลิก assignment; rules ปิด update/delete
- Retry ใช้ document ID เดิมเพื่อหลีกเลี่ยงการสร้างซ้ำ

### Journal และ Case

- Logs ใน Admin เดิมนับเฉพาะที่มี adminComment หรือ adminBonus
- เปลี่ยนเป็นจำนวนเอกสาร `reflective_logs` ทั้งหมดที่ userId ตรงกัน
- Case ใหม่ได้ +0.1 ผ่าน batch เดิมที่เพิ่ม users.score และเขียน checkin_logs ชนิด case_submit_bonus
- ไม่ได้เติมคะแนนย้อนหลังให้ Case เก่า

### Agenda

- ตัวเลือก Public / Groups ฝั่งผู้ใช้ที่เพิ่มใน V100.33 ถูกยกเลิกใน V100.35 ตามข้อสรุปใหม่
- Agenda ใหม่มี targetGroups ว่าง ผู้สร้างและ Admin เห็นก่อน
- Admin กำหนดผู้ชมจากปุ่ม Audience: Public / กลุ่ม / ไม่เลือกเพื่อให้ส่วนตัว
- Listener รวมรายการตาม audience กับรายการที่ตนสร้าง โดย deduplicate ตาม ID
- Rules ป้องกันผู้ใช้เปลี่ยน audience เอง และจำกัดการอ่านตามผู้สร้าง/Public/กลุ่ม
- Date เต็มแถว มีวันที่แบบยาว; Start / End ใช้ HH:mm แบบ 24 ชั่วโมงและ validation
- แสดงระยะเวลาจาก Start / End
- ไม่ได้แก้ audience ของกิจกรรมเก่าย้อนหลัง

### Training dates

- ปัญหาเดิม: Edit dates วาดฟอร์มใน Activity แต่ไม่สลับแท็บ ทำให้ดูเหมือนกดไม่ทำงาน
- วันที่บนหน้าหลักและไอคอนดินสอใน Schedule เปิด popup เดียวกัน
- Start / End, presets 4w / 6w / 8w / 12w, จำนวนวัน/สัปดาห์, Cancel / Save inline
- ใช้ validation และ saveMyDates เดิม
- Activity ไม่แทรกฟอร์มวันที่ใต้ปฏิทินอีก
- ไม่ได้แก้ปี 1988 ในข้อมูลบัญชีจริงโดยอัตโนมัติ

### Merge Quiz

- Canonical sort map keys ก่อน JSON comparison เพื่อไม่ให้ลำดับฟิลด์ทำให้เกิด Source changed
- ลำดับ arrays เช่นคำถามยังมีความหมายและถูกตรวจจับ
- หากต้นฉบับเปลี่ยนจริง ให้ Reload sources และทบทวนใหม่
- ยังตรวจทั้งเอกสาร ไม่ใช่เฉพาะคำถาม

## ไฟล์หลัก

- public/index.html — Schedule, UI ผู้ใช้, listener และ shared date editor
- public/admin.html — User Hub, Journal counts, Audience editor
- public/monthly-progress.js / .css — monthly cards และ target editor
- public/internship-progress.js / .css — Period goals, sharing, help และ date styling
- public/assigned-goals.js / .css — มอบหมายและติดตามเป้า
- public/hub-progress-menu.js / .css — Goals / Certificates menu
- public/invite-ticket.js / .css — Agenda form
- public/quiz-merge.js — source comparison
- firestore.rules — assigned goals และ event visibility
- scripts/assigned-goals-qa.cjs — date boundaries, deduplication และ merge regression

## การทดสอบและ deployment

- JavaScript QA: scripts/quiz-feedback-qa.cjs
- Version QA: scripts/update-version-qa.cjs
- Node syntax และ git diff checks ตามการเปลี่ยนแปลง
- Playwright DOM tests: dialogs, live %, mobile overflow, routing, Escape/focus, audience form และ Training dates
- Firestore mocks: shared target persistence และโบนัส Case
- Firestore Emulator: assigned-goal permissions/validation และ private Agenda/owner/audience queries
- PR checks ผ่านก่อน merge; GitHub Pages workflow สำเร็จ
- Deploy Firestore rules ใน V100.30 และ V100.35 ไป intern-port-edfa7
- หลัง deploy ตรวจเทียบไฟล์สำคัญบนเว็บจริงกับ release
- ไม่ได้สร้างข้อมูลจริงเพื่อทดสอบ หรือทดสอบครบทุกอุปกรณ์/LINE LIFF

## ข้อจำกัดที่ควรรู้

1. Monthly Journal ใช้ cache เดิมที่รวม Daily Reflection และ Learning Notes แต่ Admin Logs / Assigned Journal ใช้ reflective_logs เท่านั้น ยอดจึงอาจต่างกัน
2. การนับ userId อาจไม่รวมข้อมูลที่ยังผูกบัญชีเก่าหลังเชื่อมบัญชี
3. Monthly targets เป็น map ที่ใช้ต่อเดือนถัดไป ไม่ใช่ snapshot เป้าทุกเดือน
4. Goal history บันทึกรอบที่เคยเปิดและคำนวณจาก attempts ที่มี ไม่ใช่ immutable snapshot ครบทุกรอบ
5. ระยะฝึกงานเดิมใช้ end-start แต่การนับผลงานรวมวันสิ้นสุด ควรตกลงมาตรฐาน inclusive/exclusive หากปรับต่อ
6. Training dates ทดสอบเส้นทาง save ด้วย mock; การเขียนจริงยังใช้ writer/validation เดิม
7. หาก Agenda listener แจ้ง permission denied ควรตรวจ group field และการเชื่อมบัญชี
8. Case bonus ใช้ flow เดิมที่จับข้อผิดพลาดโบนัสแยกจากการส่ง Case ไม่ได้เพิ่มระบบย้อนหลังในรอบนี้

## บริบทที่สืบต่อมาก่อน V100.25

- Scorecard/Rewrites และ grouped model selectors
- AI Curate: elapsed timer, cached result, History / Run again, remove/split/backup
- AI usage overview, heatmaps, hourly usage และ top-3 model bubble
- Quiz merge: source title, reorder, points/question และ soft-hide originals
- Compact dashboard filters, ซ่อนคิวว่าง, hover ชื่อ Quiz เต็ม
- English quiz-start confirmation พร้อม Thai hover และ Korean chip
- Internship/Lifelong goals และ export PNG ความคืบหน้า

## งานค้าง

ไม่มี implementation ที่รับไว้แล้วรอ merge/deploy ณ V100.36
เอกสารสรุปนี้สร้างภายหลัง deployment และยังไม่ได้ commit/push
