---
type: bug
status: mitigated
severity: high
owner: intern-port-team
date: 2026-04-18
updated: 2026-04-18
area: auth/security
---

# BUG-2026-04-18-LIFF-Preview-Permission

## Summary

- พบความเสี่ยงในการใช้ LIFF preview mode ผ่าน query string (`mode=preview&userId=...`) ซึ่งอาจถูกใช้ดูข้อมูลข้าม user ได้ถ้าไม่มีการคุมเพิ่มในฝั่ง permission
- สถานะปัจจุบัน: mitigated (มี quick hardening แล้ว)

## Evidence

- Preview mode เปิดจาก query string ในหน้า user app
- Firestore rules เปิด read/write สำหรับผู้ใช้ที่ authenticate แล้วค่อนข้างกว้าง

## Changes Applied

- เพิ่ม guard ในหน้า user app ทั้ง source/public เพื่อบล็อก forced preview (`userId`) เมื่อไม่ใช่ localhost
- behavior ใหม่:
  - localhost: ใช้ preview userId ได้เพื่อ dev/debug
  - deployed env: ปฏิเสธ preview userId และแสดงสถานะความปลอดภัย

## Files Updated

- index.html
- public/index.html

## Risk Remaining

- ยังต้องย้ายจาก client-side gating ไปสู่ server-side authorization ที่ชัดเจนกว่า
- rules ปัจจุบันยังไม่ใช่ owner-or-admin model เต็มรูปแบบ

## Recommended Next Step

- เพิ่ม Firebase custom claims (`admin=true`) และปรับ Firestore rules ให้เป็น owner-or-admin
- สำหรับ cross-user preview ที่ production ให้ทำผ่าน Cloud Function ที่ตรวจสิทธิ์ก่อนคืนข้อมูล

## Validation Notes

- ตรวจ syntax แล้วไม่พบ error ใหม่ในไฟล์ที่แก้
- patch นี้ลดความเสี่ยงทันที แต่ยังไม่ใช่ final security model
