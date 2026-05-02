# 🔥 Quick Data Sync Guide (Manual Method)
## Sync Legacy Cases & Works Without Migration Script

---

## 🎯 The Problem

ข้อมูลเก่าของคุณอยู่ใน `cases` และ `works` collections แต่ unified history ดึงข้อมูลจาก `submissions` collection ใหม่

**วิธีแก้:** ใช้ Firebase Console เพื่อตรวจสอบและ sync ข้อมูล

---

## ✅ วิธีที่ 1: รอ Dual-Write ทำงาน (แนะนำ)

ระบบ **dual-write** ที่เรา implement ไว้จะทำงานอัตโนมัติสำหรับ **ข้อมูลใหม่**:

### ✅ สิ่งที่เกิดขึ้นแล้ว:
- ทุกครั้งที่ submit case ใหม่ → เขียนทั้ง `cases` + `submissions`
- ทุกครั้งที่ submit work ใหม่ → เขียนทั้ง `works` + `submissions`

### ⏳ สำหรับข้อมูลเก่า:
ข้อมูลเก่าจะ **ไม่แสดงใน unified history** จนกว่าจะ migrate

---

## ✅ วิธีที่ 2: Manual Check ใน Firebase Console

### Step 1: ตรวจสอบว่ามีข้อมูลเก่าหรือไม่

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. เลือก project: **intern-port-edfa7**
3. ไปที่ **Firestore Database**

### Step 2: ตรวจสอบ Collections

**ตรวจสอบ cases collection:**
```
1. คลิกที่ 'cases' collection
2. ดูจำนวน documents
3. คลิกที่ document ใดๆ
4. ดู fields: userId, caseId, disease, etc.
```

**ตรวจสอบ works collection:**
```
1. คลิกที่ 'works' collection
2. ดูจำนวน documents
3. คลิกที่ document ใดๆ
4. ดู fields: userId, title, link, etc.
```

**ตรวจสอบ submissions collection:**
```
1. คลิกที่ 'submissions' collection
2. ควรเห็น documents ที่มี submissionType: 'case' หรือ 'work'
3. ถ้ายังไม่มี → ข้อมูลเก่ายังไม่ถูก migrate
```

---

## ✅ วิธีที่ 3: ทดสอบด้วยข้อมูลใหม่

วิธีที่ง่ายที่สุดคือทดสอบด้วยข้อมูลใหม่:

### Step 1: เปิดแอพ
```
https://mlpditto.github.io/INTERN-PORT/
```

### Step 2: Submit Case ใหม่
1. คลิกปุ่ม **➕** (Floating Action Button) มุมขวาล่าง
2. เลือก **Case / 케이스**
3. กรอกข้อมูล:
   - Case No.: TEST-SYNC-001
   - Patient Name: Test Patient
   - Disease System: Respiratory
   - Symptoms: เลือก 1-2 symptoms
4. คลิก **🚀 Submit**

### Step 3: ตรวจสอบ
1. เปิด **Unified History** section
2. **ควรเห็น:** TEST-SYNC-001 แสดงใน timeline ทันที!
3. ✅ แสดงว่า dual-write ทำงานถูกต้อง

### Step 4: ตรวจสอบใน Firebase Console
1. ไปที่ Firestore Database
2. เช็ค **submissions** collection
3. **ควรเห็น:** Document ใหม่ที่มี:
   ```
   submissionType: 'case'
   title: "TEST-SYNC-001 - Respiratory"
   metadata.sourceId: "xxx" (ID จาก cases collection)
   ```

---

## ✅ วิธีที่ 4: Migrate ข้อมูลเก่าด้วย Firebase Console

สำหรับข้อมูลที่มีอยู่ ไม่เยอะมาก สามารถ copy manual ได้:

### Step 1: หา User ที่มีข้อมูลเก่า

```
1. ไปที่ cases collection
2. ดู documents ของ user ที่ต้องการ
3. บันทึก document ID และข้อมูล
```

### Step 2: สร้าง Document ใน submissions

```
1. ไปที่ submissions collection
2. คลิก "Add document"
3. ใส่ข้อมูลตาม format:

submissionType: "case"
userId: "user-id-here"
displayName: "User Name"
title: "CASE001 - Respiratory"
description: "Notes..."
status: "pending"
score: 0
metadata: {
  caseId: "CASE001",
  customer: "Patient Name",
  disease: "Respiratory",
  sourceType: "cases",
  sourceId: "original-doc-id"
}
timestamp: [Server timestamp]
updatedAt: [Server timestamp]
```

---

## 📊 สรุปสถานะข้อมูล

### ข้อมูลที่ควรจะเห็น:

| ข้อมูล | cases collection | submissions collection | Unified History |
|--------|-----------------|----------------------|-----------------|
| **ข้อมูลเก่า** (ก่อน deploy) | ✅ มี | ❌ ไม่มี | ❌ ไม่แสดง |
| **ข้อมูลใหม่** (หลัง deploy) | ✅ มี | ✅ มี | ✅ แสดง |

---

## 🎯 คำแนะนำ

### สำหรับตอนนี้:

1. **ข้อมูลใหม่** จะ sync อัตโนมัติ ✅
2. **ข้อมูลเก่า** มี 2 ตัวเลือก:
   - **Option A:** ปล่อยไว้ (ไม่กระทบการทำงาน)
   - **Option B:** รัน migration script (ต้อง setup service account)

### ถ้าต้องการ Sync ข้อมูลเก่าทั้งหมด:

ทำตามคู่มือนี้:
📄 `MIGRATION-Legacy-to-Unified-Submissions.md`

แต่ถ้าไม่ซีเรียสเรื่องข้อมูลเก่า → **ไม่ต้องทำอะไร** ระบบทำงานปกติอยู่แล้ว!

---

## ✅ Checklist

ทดสอบว่าระบบทำงานถูกต้อง:

- [ ] เปิดแอพ https://mlpditto.github.io/INTERN-PORT/
- [ ] เห็น Floating Action Button (➕) มุมขวาล่าง
- [ ] คลิก FAB → เปิด Unified Modal
- [ ] Submit case ใหม่
- [ ] เปิด Unified History section
- [ ] เห็น case ที่เพิ่ง submit
- [ ] เช็ค Firebase Console → submissions collection มี document ใหม่

**ถ้าทุกข้อเป็น ✅ = ระบบทำงานถูกต้อง!**

---

## 🆘 ยังมีปัญหา?

### ปัญหา: Unified History ว่างเปล่า

**สาเหตุ:** ยังไม่มีข้อมูลใน submissions collection

**วิธีแก้:**
1. Submit case/work ใหม่ 1 ครั้ง
2. เช็ค unified history อีกครั้ง
3. ควรเห็นข้อมูลที่เพิ่ง submit

### ปัญหา: ข้อมูลเก่าไม่แสดง

**สาเหตุ:** ข้อมูลเก่ายังไม่ได้ migrate

**วิธีแก้:**
- **แนะนำ:** ไม่ต้องแก้ (ข้อมูลเก่าก็ยังดูได้จาก sections เดิม)
- **หรือ:** รัน migration script (ดูคู่มือ)

---

**Created:** 2026-04-26  
**Version:** 1.0
