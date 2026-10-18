# Grand Line Deck — วิธีทำภาพ วิดีโอ และเสียง

แท็บ **AI Digital Lab** → โหมด 3 อย่างด้านบน: 🏴 Miss Goldenweek · 🧭 Research Log · 🐳 Laboon กดป้าย 🏴‍☠️ เมื่อไรก็ได้เพื่อเปิดคู่มือนี้อีก

---

## 1. 🖼 ภาพ

**ที่ไหน:** 🏴 Miss Goldenweek

1. เลือกสไตล์ใน **Visual Style Collection** ด้านซ้าย (Pirate Crew Life, Jolly Roger Vector, 3D Devil Fruit, Grand Line Map, Oda Manga Style, Wano Arc Anime) สไตล์จะถูกใส่ในทุก prompt
2. บรรยายภาพในช่อง **🪄 Vision** สูตรข้างหัวข้อคือ *Context + Goal + Source + Expectations* พิมพ์ไทยได้
3. บน toolbar ใต้ช่อง ✒ คือ **โมเดล enhancer** (แปลงข้อความเป็น prompt อังกฤษที่มีโครงสร้าง แท็บโลโก้เลือกเจ้า ชิปเลือกรุ่น) แล้วเลือก **engine**: **Nano Banana 2.1** (Google ถูกสุด เหมาะกับไดอะแกรม/อินโฟกราฟิก) หรือ **Image 2** (OpenAI เก่งตัวหนังสือ)
4. กด **✨ Create** ระบบจะโชว์ prompt อังกฤษให้แก้หรือยืนยันก่อน แล้ว engine ค่อยวาด
5. ภาพขึ้นในการ์ดพรีวิว จากนั้นดาวน์โหลด ส่งเข้า Codex หรือวาดใหม่ด้วยอีก engine ได้

> ภาพเก่าอยู่ใน **Codex Gallery** ด้านล่าง (กรองตามประเภท กด Refresh) ใต้ภาพบอกว่า engine ไหนวาด

---

## 2. 🎬 วิดีโอ

**ที่ไหน:** 🏴 Miss Goldenweek → ชิป **Clip 9:16** ในแถว engine

1. เลือกสไตล์ แล้วเขียน **หัวข้อซีรีส์** ใน Vision (เช่น "การให้คำปรึกษา warfarin ผู้ป่วยใหม่" ไทยได้)
2. กด **🎬 Clip 9:16** ปุ่มจะเปลี่ยนเป็น **Plan 10 episodes** และช่องเปลี่ยนเป็นโหมดซีรีส์
3. กด **Plan 10 episodes** โมเดล ✒ enhancer (text อย่างเดียว ไม่มีค่าวิดีโอ) วางแผน 10 ตอน: ชื่อ EN/TH, วัตถุประสงค์, key fact 1 ข้อ, บทพูด 1 ประโยค, ภาพ 1 ภาพ การ์ด **Episodes** จะขึ้นมา กด ✏️ แก้ในแถวได้
4. กด **▶** ที่ตอนที่ต้องการ จะถามราคาก่อน **≈ $0.80 · 8 s** กดยืนยัน Gemini Omni Flash จะเรนเดอร์คลิปแนวตั้ง 9:16 720p มีเสียง มีนาฬิกาจับเวลา (ปกติไม่ถึงนาที รอได้ถึง 12 นาที)
5. คลิปเล่นในการ์ดพรีวิวพร้อมเลข EP โมเดล เวลาเรนเดอร์ และราคา แล้วเลือก
   - **⬇ Download** ได้ MP4 (720×1280, H.264 + AAC)
   - **💾 Save** ทางเขียนเดียว: MP4 ไป Storage `teach-clips/{series}/EPnn.mp4` + เอกสารซีรีส์ใน `clip_series`
   - **✕ Discard** ไม่เก็บอะไร
6. ทำตอนถัดไปด้วย ▶ ของตอนนั้น ตั้งใจไม่มีปุ่ม "เรนเดอร์ทั้งหมด" ยืนยันทีละคลิป

> คุณภาพเสียงพูดไทยของ Omni Flash ยังต้องฟังก่อนเผยแพร่ engine ที่ถูกกว่า (Veo 3.1 Lite ≈ $0.40/คลิป) ต้องแก้ proxy ก่อน

---

## 3. 🐳 เสียง

**ที่ไหน:** 🐳 Laboon สตูดิโอพอดแคสต์/เสียงพูด ("Brook, Soul King")

1. **Step 1 · Transcript** วางหรือพิมพ์สคริปต์ในช่องใหญ่ **Polish** ให้ AI เกลาตามตัวเลือกใต้ปุ่ม: Target Length, Script Format (พูดคนเดียว/บทสนทนา), Podcast Style, Summary Level ข้าง ๆ มีเทมเพลตบทสนทนาและตัวช่วยออกเสียง (CMU phoneme สำหรับคำอังกฤษยาก)
2. **Config (แถบขวา)** 1. Model Selection (backend TTS และรุ่นเสียง) 2. Production Language 3. Voice Rendering Mode 4. Performance Direction (น้ำเสียง จังหวะ การเน้น) บนมือถือเป็น drawer
3. **Step 3 · Produce** เลือก Audio Encoding กับ Sample Rate แล้วกด **Generate** เครื่องเล่นเสียงจะขึ้นใต้สคริปต์ **Send to Podcast** ส่งต่อไป flow พอดแคสต์ **Reset** ล้างสตูดิโอ

> TTS คิดเงินต่อตัวอักษรตาม backend สคริปต์ 5 นาทีไม่กี่เซนต์ เสียงไทยใช้ได้ทั้ง Cloud TTS และ Gemini TTS ลองประโยคสั้น ๆ ก่อน

---

## 4. 🧭 Research Log

**ที่ไหน:** 🧭 Research Log แชตกับโมเดลวิจัยบนฐานความรู้

- พิมพ์คำถามใน **Query Brain** (สูตร Context + Goal + Source + Expectations เหมือนกัน) แล้วส่ง **Suggest Prompts** ให้ตัวอย่างคำถาม
- 📎 **Attach Image for Vision Analysis** แนบรูปไปกับคำถาม (สไลด์ ฉลาก กราฟ)
- **Focus on KB Only** ในแถบข้างให้ตอบจากเอกสารที่อัปโหลดเท่านั้น **Manage Documents** เพิ่ม/ลบเอกสาร
- **Clear Chat** เริ่มใหม่ ส่วนนี้ไม่เขียนฐานข้อมูล เป็นกระดาษทดสำหรับเตรียมภาพ คลิป และสคริปต์ด้านบน
