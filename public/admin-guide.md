# คู่มือ Admin (Nika) — เริ่มใช้งานครั้งแรก

หน้า: https://mlpditto.github.io/INTERN-PORT/admin.html · ใช้บนคอมหรือมือถือก็ได้ (แท็บเลื่อนแนวนอนได้)

> ฉบับระดับแท็บ — ทุกชื่อปุ่มอ้างจากหน้าจอจริงของ admin.html (ปุ่ม ❓ ในแถบหัวเปิดคู่มือนี้)

---

## 0. 🔑 ล็อกอิน

หน้า **Admin Portal** มี 3 ทาง ใช้ทางใดก็ได้:

| ทาง | วิธี |
|---|---|
| ✨ **Send Login Link** (แนะนำ) | ช่องอีเมลมีอีเมลแอดมินกรอกไว้ให้ → กดปุ่ม → เปิดอีเมล → กดลิงก์ในเมลบนเครื่องเดียวกับที่ขอ |
| **Google** | กดปุ่ม Google แล้วเลือกบัญชีใน popup |
| **LINE** | กดปุ่ม LINE (ใช้ได้เมื่อบัญชี LINE ผูกกับอีเมลแอดมิน) |

**ข้อควรรู้**
- ระบบอนุญาต **อีเมลแอดมินเพียงบัญชีเดียว** (กำหนดในโค้ด) บัญชีอื่นจะเห็น `Access denied for …` ต่อให้ล็อกอิน Google สำเร็จ
- Firefox มักบล็อก popup ของ Google → ใช้ **Send Login Link** แทน (ระบบจะแนะนำและลองส่งลิงก์ให้เองเมื่อ popup ถูกบล็อก)
- ปิด popup กลางทาง → กด Google ใหม่ได้เลย

---

## 1. 🧭 แถบหัว (บนสุดของทุกแท็บ)

| ปุ่ม | ใช้ทำอะไร |
|---|---|
| ☀️ **Nika V…** | ชื่อหน้า + เลขเวอร์ชันที่กำลังใช้ (ใต้ชื่อคืออีเมลที่ล็อกอินอยู่) |
| ➕ **Create** | สร้างของใหม่ — **Task** (การ์ด Kanban) · **Quest** (เควสประจำวัน) · **Event** (ประกาศนัดหมาย) · **Quiz** · **Goals** · **Certificates** |
| 📥 **Archive** | ดูของที่เก็บเข้าคลังแล้ว (Quest, Task ฯลฯ) |
| 📱 **UI** | พรีวิวหน้าของ intern (LIFF Preview) โดยไม่ต้องใช้ LINE |
| 🔮 | ตั้งค่า AI Engine (คีย์/โมเดล) — ถ้าขึ้นว่า "not loaded yet" ให้รีเฟรชหน้า |
| ⚓ | สลับธีม One Piece ของ AI Digital Lab + Laugh Tale |
| **KR / TH** | สลับป้ายกำกับภาษาเกาหลี / ไทย |
| 🌓 | สลับโหมดสว่าง/มืด |
| 👋 **Logout** | ออกจากระบบ |

---

## 2. 🗺️ แผนที่แท็บ — ชื่อเล่น → หน้าที่จริง

| แท็บ | คืออะไร | งานแรกที่ควรทำ |
|---|---|---|
| 📊 **Dashboard** | หน้าแรก: คิวงานรอจัดการ + Kanban + สถิติ | ดูตัวเลขบนแถบชิปด้านบน ตัวไหนไม่ใช่ 0 = มีงานรอ |
| 📦 **Assignments** | จัดการ Quiz, สอบ, ลิงก์รีวิวร้านอาหาร, ร้านรางวัล | ถ้าแท็บมี **badge แดง** = มี Quiz รอตรวจ |
| 👥 **User Hub** | รายชื่อ intern, คะแนน, อันดับ, กลุ่ม | ค้นชื่อ intern → ดูประวัติและคะแนนรายคน |
| 🤖 **AI Digital Lab** | เครื่องมือ AI สำหรับทีม (แชท, สร้างภาพ, Podcast Studio) | ใช้เมื่อต้องการ ไม่มีงานรอ |
| 🏝️ **Laugh Tale** | ตรวจ **Reflections** และ **Quiz feedback** ของ intern | เปิดดู feedback ที่ AI จัดว่า "Needs a fix" |
| 🏜️ **Alabasta** | คิวตรวจ **Case** (เคสผู้ป่วย) และ **Product** (รายการสินค้า) | กรอง Pending → ตรวจทีละเคส |
| 🪨 **Poneglyph** | Codex (**Drug** / **Disease**), My Path, Memories | ตรวจ Drug/Disease draft ที่ intern ส่งมา |

### 📊 Dashboard
- **แถบชิปด้านบน** (กดเพื่อเปิดรายการ): 👤 Access (คำขอเข้าใช้) · 📖 Review (Reflective Review) · 💰 Claimed (คะแนนที่ขอ) · ⏱️ Quiz (รอตรวจ/ส่งช้า) · 💼 Work · 💊 Drug Drafts · 🩺 Disease Drafts · 📥 New Cases
- **Kanban**: Backlog → 🚧 Doing → 👀 Review → ✅ Done (ค้นหา Task ได้, Show archived ดูของเก่า)
- **🚀 Escalated**: บันทึกการเรียนที่ intern กด Escalate เพื่อให้ดูเป็นพิเศษ · **🗑️ Note deletion requests**: คำขอลบบันทึก
- **AI usage · Overview**: สรุปการใช้ AI + heatmap (กดเพื่อเปิด)
- **Quiz Coverage by System**: Quiz ครอบคลุมระบบอวัยวะใดบ้าง
- **LINE pushes this month**: จำนวนข้อความ push เดือนนี้ + **Preview digest** / **Send this now** / **Copy text** (คัดลอกข้อความไปวางในกลุ่มเอง = ไม่เสีย push)

### 📦 Assignments (4 แท็บย่อย)
- 🧠 **Quiz Engine**: รายการ Quiz กรองด้วยชิป (GRADED · TEMPLATE · ONE-TIME · 🔒 LOCKED · 📎 MATERIALS · 🧪 NOT AUDITED · 🏷️ INCOMPLETE) เลือกหลายข้อแล้วใช้ 🚀 Activate · ⏹️ Deactivate · 📄 Export PDF · Merge · 🔍 Compare · 🏷️ AI tags · 🗑️ Delete · 🌐 Translate Missing
- 🎓 **Exam**: ห้องสอบแบบมีเวลา (เลือก Quiz + Host + เวลารวม; สถานะ Lobby / Running / Paused)
- 🔗 **Gourmet World**: ลิงก์รีวิวร้านอาหาร (➕ Add Link, 🖼️ Fetch missing logos; โลโก้ดึงจากลิงก์ / อัปโหลด / 🖼 Image link)
- 🏪 **A Shop for Killers**: ร้านรางวัล Beri — ตั้งชื่อ, ลิงก์, โลโก้, ประเภท, Beri Reward

### 👥 User Hub
- 🏆 **Elite Board** (อันดับ) · ช่องค้นหา · 📅 ช่วงวันที่ของคะแนน · 🏅 **Badge Stats** · 📤 แชร์อันดับ · 🛡️ **Groups & Divisions** · 👥 **Entry** (ลงทะเบียนล่วงหน้า) · ⏳ พรีวิวการหักคะแนนเมื่อไม่เช็กอินรายวัน
- เปิดประวัติรายคน (drill-down) แล้วกรองได้ด้วย Q (Quiz) · W (Work) · L (Logs) · B (Bonus) · M (Manual) · 📍 Check-in · 🪙 Beri

### 🏝️ Laugh Tale
- 📓 **Reflections** (บันทึกสะท้อนคิด) และ 🧠 **Quiz** (feedback ต่อ Quiz) มีแท็บ **Needs a fix · Analysis · Patterns · Comments**
- เลือกโมเดล AI ที่ใช้วิเคราะห์ด้วยชิปโลโก้ผู้ให้บริการ
- 👒 **Straw Hat Mode**: ซ่อน/แสดงตัวตน intern · 📐 แก้ LP Taxonomy · เลือกหลายรายการแล้ว 🗑 Delete selected

### 🏜️ Alabasta
- สลับ 🩺 **Case** / 🛒 **Product** · ชิป All / 📥 Pending / ✅ Reviewed / ❌ Rejected · ช่วงวันที่ · 🔎 ค้นหา · ⬇️ CSV
- **ปฏิเสธเคส**: เลือกเหตุผล (ข้อมูลไม่ครบ · เคสซ้ำ · ไม่เกี่ยวข้อง · อื่นๆ) — intern จะเห็นเหตุผลในประวัติของตัวเอง
- เลือกหลายรายการ → ✅ Bulk Review / 🗑️ Bulk Delete
- เมนู **⋯**: ⚙️ Edit Case Taxonomy · 🔧 **Sync intern view** (ซิงก์เคส/งานที่ตรวจแล้วไปให้ intern เห็น) · 🔎 Scan orphan history (ค้นอย่างเดียว ไม่ลบ)

### 🪨 Poneglyph
- 💊 **Drug Codex** · 🩺 **Disease Codex** (แก้ข้อมูล, แนบลิงก์ไฟล์ดาวน์โหลด) · **My Path** (บันทึกการเรียนของแอดมินเอง + 🧭 AI Learning Path) · 🎟️ **Memories** (กิจกรรมที่จบแล้วและตราประทับ)
- 📊 **Monitor: Intern Learning Paths** ดูบันทึก LP ของ intern · 🗑️ Trash
- การแก้/ลบบันทึกของ intern ต้องกรอก **เหตุผล** เพื่อเก็บ audit log (ลบแบบ soft-delete กู้คืนได้จาก Trash)

---

## 3. 📅 งานประจำวัน (ตัวอย่างลำดับ)

1. เปิด **Dashboard** → ดูชิปด้านบน ตัวที่ไม่ใช่ 0 คือคิวงาน
2. ดู badge แดงที่ 📦 **Assignments** → ตรวจ Quiz ที่รอ
3. **Alabasta** → กรอง Pending → ตรวจ Case / Product
4. **Laugh Tale** → ดู "Needs a fix" ของ Quiz feedback

---

## 4. ⚠️ ระวัง

- **ทุกอย่างเขียนลงข้อมูลจริง (production)** — รวมถึงเมื่อเปิดหน้านี้จากเครื่องตัวเอง (localhost) ไม่มีโหมดทดลอง
- ปุ่ม **Delete / Bulk Delete / Archive** ย้อนไม่ได้ในบางรายการ — ตรวจรายการที่เลือกก่อนกดยืนยัน
- **Send this now** (Dashboard) ส่ง LINE จริงเข้ากลุ่ม ถ้าแค่ต้องการข้อความให้ใช้ **Copy text**
- ถ้าตรวจ/ปฏิเสธเคสแล้ว intern ยังเห็นสถานะเก่า ลองกด Alabasta → ⋯ → 🔧 Sync intern view

## 5. 🔧 แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| `Access denied for …` | ล็อกอินด้วยบัญชีแอดมินที่ระบุเท่านั้น |
| Google popup ไม่ขึ้น | ใช้ ✨ Send Login Link (โดยเฉพาะ Firefox) |
| ขึ้น `Admin required` ตอนกดบางปุ่ม | ออกจากระบบ → ล็อกอินใหม่ → ถ้ายังขึ้น แจ้งเจ้าของระบบ (บัญชียังไม่มีสิทธิ์ฝั่งเซิร์ฟเวอร์) |
| ปุ่ม 🔮 ขึ้น "not loaded yet" | รีเฟรชหน้า |
| ตัวเลข/รายการดูเก่า | รีเฟรชหน้า (Ctrl+F5) — เปลี่ยนเวอร์ชันแล้วเบราว์เซอร์อาจยังใช้ไฟล์เก่า ดูเลขเวอร์ชันข้างชื่อ Nika |
