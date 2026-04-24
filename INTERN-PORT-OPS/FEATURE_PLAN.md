# INTERN-PORT — Feature Improvement Plan
> วิเคราะห์และเสนอแนะโดย Claude | อัปเดต: 2026-04-24

---

## 🔴 Priority 1 — Quick Wins (ทำได้เร็ว ผลชัดเจน)

### 1. 🔔 Push Notification แจ้งเตือน Real-time
- **ปัญหา:** นักศึกษาต้องเปิดแอปเองเพื่อดูว่ามี feedback หรือ quest ใหม่
- **แนวทาง:** ใช้ Firebase Cloud Messaging (FCM) — stack มีอยู่แล้ว
- **Trigger:** แอดมิน review งาน, Quest ใหม่ถูกเพิ่ม, คะแนนถูกปรับ
- **ความยาก:** ⭐⭐ | **Impact:** 🔥🔥🔥
- **Status:** [ ] Pending

### 2. 📊 Progress Dashboard ภาพรวมในหน้าเดียว
- **ปัญหา:** KPI กระจายอยู่หลายส่วน ดูภาพรวมยาก
- **แนวทาง:** หน้า "My Journey" รวม — วันที่เหลือ, คะแนนสะสม, Quiz pass rate, Cases บันทึก, Streak — แบบ visual card
- **ความยาก:** ⭐⭐ | **Impact:** 🔥🔥🔥
- **Status:** [ ] Pending

### 3. 🗓️ Deadline & Calendar View
- **ปัญหา:** ไม่มี calendar — intern ไม่รู้ว่า quest/quiz มีกำหนดส่งเมื่อไร
- **แนวทาง:** Mini calendar ใน Mission tab แสดง due date ของแต่ละ task สีตาม urgency
- **ความยาก:** ⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

### 4. 🌙 Dark Mode
- **ปัญหา:** White background ล้วน อ่านยากตอนกลางคืนหรือในโรงพยาบาล
- **แนวทาง:** CSS variable รองรับ dark theme + บันทึก preference ใน localStorage
- **ความยาก:** ⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

---

## 🟠 Priority 2 — Feature Gaps (ฟีเจอร์ที่ควรมีแต่ยังขาดอยู่)

### 5. 🤖 AI Auto-Feedback สำหรับ Reflective Log
- **ปัญหา:** แอดมินต้องรีวิว reflective log ด้วยตัวเองทุกรายการ
- **แนวทาง:** ใช้ Claude/Gemini (มี AI proxy อยู่แล้ว) วิเคราะห์ reflective log เบื้องต้น — ประเมิน depth of reflection, suggest improvement — แอดมินแค่ approve/adjust
- **ประโยชน์:** ลด admin workload ได้มาก
- **ความยาก:** ⭐⭐⭐ | **Impact:** 🔥🔥🔥
- **Status:** [ ] Pending

### 6. 📋 Quiz Template Library
- **ปัญหา:** สร้าง quiz ทีละข้อ ไม่มี template
- **แนวทาง:** ระบบ template quiz ตามหมวด (Pharmacology, Clinical Reasoning, Ethics) + import จาก CSV หรือ AI generate จาก topic
- **ความยาก:** ⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

### 7. 📁 Portfolio Export (PDF)
- **ปัญหา:** นักศึกษาจบแล้วไม่มีเอกสารสรุปการฝึกงาน
- **แนวทาง:** Generate PDF Portfolio ส่วนตัว — รวม cases, quiz scores, reflective highlights, badges
- **ความยาก:** ⭐⭐⭐ | **Impact:** 🔥🔥🔥
- **Status:** [ ] Pending

### 8. 🔍 Global Search (Admin)
- **ปัญหา:** ไม่มี search — หา student หรือ case เฉพาะต้องเลื่อนหา
- **แนวทาง:** Search bar ใน admin ที่ search ข้าม collections — users, cases, quizzes, works — แสดงผลแบบ grouped
- **ความยาก:** ⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

---

## 🟡 Priority 3 — Technical / Quality of Life

### 9. ⚡ Code Split / Lazy Load (admin.html)
- **ปัญหา:** admin.html ใหญ่ 25,632 บรรทัด (~1.6MB) โหลดช้า
- **แนวทาง:** แยก section ใหญ่ (AI Lab, Podcast) ออกเป็น HTML fragment โหลดเมื่อคลิก tab
- **ความยาก:** ⭐⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

---

## 🟢 Priority 4 — Advanced / Long-term

### 10. 📈 Analytics ขั้นสูงสำหรับแอดมิน
- กราฟ trend คะแนนของ cohort ทั้งรุ่น
- เปรียบเทียบ performance ระหว่าง interns
- Alert เมื่อ intern มีคะแนนต่ำผิดปกติ
- **ความยาก:** ⭐⭐⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

### 11. 🎯 Adaptive Quiz (AI-driven difficulty)
- ใช้ประวัติ quiz attempt ปรับระดับความยากข้อถัดไป
- Intern ที่ทำได้ดีได้โจทย์ยากขึ้น, ทำได้ไม่ดีได้ hint เพิ่ม
- **ความยาก:** ⭐⭐⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

### 12. 🏆 Cohort Comparison & Benchmarking
- เปรียบเทียบ performance ของ intern แต่ละรุ่น
- วิเคราะห์ว่าหลักสูตรไหนให้ผลดีที่สุด
- **ความยาก:** ⭐⭐⭐⭐ | **Impact:** 🔥🔥
- **Status:** [ ] Pending

---

## 📊 Summary Table

| # | Feature | ความยาก | Impact | Priority |
|---|---|---|---|---|
| 1 | Push Notification | ⭐⭐ | 🔥🔥🔥 | P1 |
| 2 | Progress Dashboard | ⭐⭐ | 🔥🔥🔥 | P1 |
| 3 | Calendar View | ⭐⭐ | 🔥🔥 | P1 |
| 4 | Dark Mode | ⭐ | 🔥🔥 | P1 |
| 5 | AI Auto-Feedback | ⭐⭐⭐ | 🔥🔥🔥 | P2 |
| 6 | Quiz Template | ⭐⭐ | 🔥🔥 | P2 |
| 7 | Portfolio Export | ⭐⭐⭐ | 🔥🔥🔥 | P2 |
| 8 | Global Search | ⭐⭐ | 🔥🔥 | P2 |
| 9 | Code Split | ⭐⭐⭐ | 🔥🔥 | P3 |
| 10 | Advanced Analytics | ⭐⭐⭐⭐ | 🔥🔥 | P4 |
| 11 | Adaptive Quiz | ⭐⭐⭐⭐ | 🔥🔥 | P4 |
| 12 | Cohort Benchmarking | ⭐⭐⭐⭐ | 🔥🔥 | P4 |
