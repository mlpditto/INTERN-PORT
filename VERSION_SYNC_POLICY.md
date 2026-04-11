# Intern Admin Portal - Version & Git Development Rules (V89.49)

## 🎯 Golden Rule: Absolute Version Sync

**Intern Admin Portal title on GitHub Pages MUST always match the current version number and badge.**
No exceptions. All components (Admin, User, Functions) must be synchronized before a major push.

---

## 🚀 Best Practices: Git Workflow

เพื่อให้เวอร์ชันมีความสอดคล้องกัน (Version Sync) และการแสดงผลหน้าเว็บถูกต้องเสมอ ให้ปฏิบัติดังนี้:

### 1. แก้ไขโค้ดที่ `production` เสมอ
ห้ามแก้ไขโค้ดที่ branch `main` โดยตรง การพัฒนาทั้งหมดต้องเกิดขึ้นบน branch **`production`** เท่านั้น

### 2. อัปเดตเวอร์ชันทุกครั้ง
ทุกครั้งที่มีการ Commit ให้เปลี่ยนเลขเวอร์ชันในไฟล์เหล่านี้:
-   **`admin.html`**: แก้ไข `<title>` และปุ่ม `Badge` (Vxx.xx)
-   **`index.html`**: แก้ไข `<title>`
-   **`SYSTEM_OVERVIEW.md`**: ระบุเวอร์ชันล่าสุดที่หัวข้อและท้ายไฟล์

### 3. Deploy กลาโหม (Turbo Mode) ⚡
เมื่อทำการแก้ไขและทดสอบเสร็จสิ้น ให้รวบรวมคำสั่งเพื่อ Push ทั้ง 2 Branch (เพื่ออัปเดตทั้ง Server และ GitHub Pages) ดังนี้:

```bash
# 🛠️ 1. บันทึกงานใน production (Development Branch)
git add .
git commit -m "Vxx.xx: รายละเอียดงานที่ทำ"
git push origin production

# 🌐 2. ส่งงานไปที่ main เพื่ออัปเดต GitHub Pages (Public URL)
git checkout main
git merge production
git push origin main

# 🔙 3. กลับมาทำงานต่อที่ production (Stay on Development)
git checkout production
```

---

## 📋 Version Update Checklist

### **Before EVERY commit:**
- [ ] `<title>` Tag: `Intern Admin Portal (Vxx.xx)`
- [ ] `Header Badge`: `<span ...>Vxx.xx</span>` ในส่วน Dashboard
- [ ] `Header Comment`: `<!-- Vxx.xx: Description -->`
- [ ] `Console Log`: `console.log('%c Vxx.xx loaded OK ', ...)`

---

## 🔍 Verification
หลังจากการ Deploy (Turbo Mode) ให้รอประมาณ 2-5 นาทีแล้วตรวจสอบที่:
- **Production URL:** [https://mlp-int.work/admin.html](https://mlp-int.work/admin.html)
- **Public URL:** [https://mlpditto.github.io/INTERN-PORT/admin.html](https://mlpditto.github.io/INTERN-PORT/admin.html)

**หากพบว่าเลขเวอร์ชันไม่ตรงกัน ให้ใช้ "Turbo Mode" ซ้ำอีกครั้งเพื่อยืนยันการ Sync ข้อมูล**

---
*อัปเดตกฎล่าสุดเมื่อ: V89.14 - 2026-04-08*
