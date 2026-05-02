# LIFF index.html – UI Overview & Major Overhaul Preparation (as of 2026-04-25)

## Current State

- **index.html** คือหน้า LIFF หลักสำหรับนักศึกษา/ผู้ใช้ทั่วไป
- UI หลักประกอบด้วย:
  - **Dashboard**: แสดงสรุปสถานะ, ภารกิจ, และข้อมูลผู้ใช้
  - **Mission (Kanban Board)**: ใช้ SortableJS, มีคอลัมน์ Backlog, Doing, Review, Done (UI แบบ Kanban)
  - **Case Section**: ปัจจุบันใช้ tab bar (Submit New Case, Cases by System) ยังไม่ใช่ UI แบบ Mission/kanban
  - **Quiz/Quest**: ระบบแบบทดสอบและกิจกรรม
  - **Modal/Popup**: ใช้สำหรับฟอร์ม, แจ้งเตือน, และรายละเอียดต่าง ๆ
- **UI/UX** ปัจจุบันเน้นความเรียบง่าย, รองรับมือถือ, ใช้ Flexbox/Responsive Design
- **Version Sync**: ต้อง mirror กับ public/index.html ทุกครั้งที่มีการเปลี่ยนแปลงที่กระทบผู้ใช้

## ปัญหา/ข้อจำกัด

- **UI/UX ของ Case ยังไม่สอดคล้องกับ Mission (Kanban)**
- โค้ดบางส่วนเริ่มซับซ้อน, มี legacy modal/component ที่ควร refactor
- การ sync version ระหว่างไฟล์ root/public ต้องทำด้วยมือ
- ยังไม่มีระบบ changelog UI ที่ละเอียดใน repo

## แผนยกเครื่อง (Major Overhaul Plan)

- **Unified UI/UX**: ปรับ Case section ให้ใช้ UI แบบเดียวกับ Mission (kanban tab, drag & drop, status columns)
- **Componentization**: แยกโค้ด UI เป็น component/reusable function เพื่อง่ายต่อการดูแล
- **UI Consistency**: ปรับปุ่ม, สี, ฟอนต์, และ interaction ให้เหมือนกันทั้งระบบ (LIFF/Admin)
- **Documentation**: เพิ่มบันทึก/คู่มือ UI, changelog, และ release note ทุกครั้งที่มีการเปลี่ยนแปลงสำคัญ
- **Automation**: พัฒนา script/tool สำหรับ sync version และตรวจสอบ UI parity ระหว่าง root/public

## หมายเหตุ

- การยกเครื่องครั้งนี้จะเน้นความต่อเนื่องของประสบการณ์ผู้ใช้, ลดความซับซ้อนของโค้ด, และเพิ่มความง่ายในการพัฒนา/ดูแลในอนาคต
- ทุกการเปลี่ยนแปลงจะมีการบันทึกใน OPS/Release Note และคู่มือการใช้งาน

---

_บันทึกโดย Copilot, 2026-04-25_
