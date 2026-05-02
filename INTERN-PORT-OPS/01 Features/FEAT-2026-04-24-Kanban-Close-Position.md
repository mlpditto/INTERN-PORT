---
type: feature
status: planned
owner: intern-port-team
updated: 2026-04-24
---

# FEAT-2026-04-24 — Kanban: Close Position on Doing Cards

## Goal
ให้ admin สามารถ "ปิด Position" บน Doing card ได้โดยตรง โดยไม่ต้อง drag หรือผ่าน scoring flow

---

## งานที่ทำเสร็จใน session นี้ (2026-04-24)

- ✅ Quest Review: แทน native `prompt()` ด้วย custom bonus modal (score chips -0.5 / 0 / +0.1 / +0.5 / +1.0)
- ✅ Quest History: เพิ่มคอลัมน์ Participants (avatar + ชื่อ, border สีเขียว/เหลืองตาม review status)
- ✅ New Daily Quest: แสดงชื่อ user ใต้ Target Group picker แบบ live
- ✅ Deploy ขึ้น production ทั้งหมด (commit 616618f)

---

## แผน: Close Position Feature

### แนวทางที่เลือก
**แนวทาง 1 + 2 ควบคู่กัน**
- Task / Project card → ปุ่ม Close บน card
- Daily Quest card → Force Expire

---

### Implementation Plan

#### Phase 1 — Close Button บน Side Quest (Task/Project) Doing Cards

**เป้าหมาย:** เพิ่มปุ่ม `Close Position` บน card ที่อยู่ใน Doing column

**สิ่งที่ต้องทำ:**
1. หาจุด render ของ Side Quest card ใน Doing (~line 21015-21102 ใน admin.html)
2. เพิ่มปุ่ม `Close Position` ข้าง Chat / Delete button
   - Style: สีแดงอ่อน, icon `fa-xmark` หรือ `fa-door-closed`
3. เขียน function `closePosition(id)`:
   ```js
   async function closePosition(id) {
       if (!confirm('ปิด Position นี้?')) return;
       await db.collection('side_quests').doc(id).update({
           status: 'Done',
           closedAt: firebase.firestore.FieldValue.serverTimestamp(),
           closedBy: ALLOWED_EMAIL || 'admin',
           isClosed: true
       });
       showToast('Position ปิดแล้ว', 'success');
   }
   ```
4. ใน Done column: ถ้า `isClosed === true` ให้แสดง badge "Closed" แทน "Done"
5. Archive flow ปกติยังทำงานได้เหมือนเดิม

---

#### Phase 2 — Force Expire บน Daily Quest Doing Cards

**เป้าหมาย:** admin กด Force Close → quest หมดอายุทันที ไม่รับ submission ใหม่

**สิ่งที่ต้องทำ:**
1. หา render ของ Daily Quest card ใน Doing (~line 21331-21400)
2. เพิ่มปุ่ม `Force Close` (icon `fa-stop-circle`, สีส้มเข้ม)
3. เขียน function `forceCloseQuest(questId)`:
   ```js
   async function forceCloseQuest(questId) {
       if (!confirm('Force close quest นี้? จะหยุดรับ submission ทันที')) return;
       await db.collection('quests').doc(questId).update({
           deadline: firebase.firestore.Timestamp.now(),
           forceClosed: true,
           forceClosedAt: firebase.firestore.FieldValue.serverTimestamp(),
           forceClosedBy: ALLOWED_EMAIL || 'admin'
       });
       showToast('Quest ปิดแล้ว', 'success');
   }
   ```
4. User-side: ตรวจ `forceClosed === true` หรือ deadline ผ่านแล้ว → ซ่อนปุ่ม Submit
5. Kanban: Quest ที่ force closed จะหายออกจาก Doing ใน render รอบถัดไปอัตโนมัติ (เพราะ deadline < now)

---

### Files ที่ต้องแก้
- `admin.html` (root) — หลัก
- `public/admin.html` — mirror sync หลัง deploy

### ลำดับการทำงาน
1. Phase 1 ก่อน (ง่ายกว่า ไม่กระทบ Daily Quest logic)
2. Test บน live
3. Phase 2

---

## หมายเหตุ
- `isClosed` field ใหม่ — ไม่กระทบ card เก่าที่ไม่มี field นี้
- Force expire ใช้ `deadline: now()` ซึ่ง render loop ปัจจุบันรองรับอยู่แล้ว (ไม่ต้อง migrate)
- ถ้าอนาคตต้องการ Closed column แยก ค่อย extend จาก Phase 1 ได้
