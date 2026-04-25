import google.generativeai as genai

# Replace with your actual API key
API_KEY = "YOUR_API_KEY_HERE"  # <-- ใส่ API Key ของคุณตรงนี้

genai.configure(api_key=API_KEY)

print("🔍 กำลังตรวจสอบ Gemini Models ที่ API Key ของคุณสามารถเข้าถึงได้...")
print("=" * 60)

available_models = []
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        model_name = m.name.replace('models/', '')
        available_models.append(model_name)
        print(f"✅ ชื่อที่ต้องใช้: {model_name}")

print("=" * 60)
print(f"📊 พบทั้งหมด {len(available_models)} โมเดล")

# แนะนำโมเดลที่ควรใช้
recommended = []
for model in available_models:
    if 'gemini-3-flash' in model or 'gemini-flash-latest' in model:
        recommended.append(model)

if recommended:
    print("\n🎯 โมเดลที่แนะนำ (Flash Series):")
    for model in recommended:
        print(f"   ⭐ {model}")

# ตรวจสอบโมเดลปัจจุบันที่ใช้ใน admin.html
print("\n🔧 โมเดลปัจจุบันที่ใช้ใน admin.html:")
current_models = [
    "gemini-3-flash",
    "gemini-3-pro", 
    "gemini-flash-latest",
    "gemini-3.1-flash-lite-preview"
]

for model in current_models:
    if model in available_models:
        print(f"   ✅ {model} - ใช้ได้")
    else:
        print(f"   ❌ {model} - ไม่พบใน API Key ของคุณ")

print("\n📝 คำแนะนำ:")
print("1. ใช้ gemini-3-flash-preview สำหรับความเสถียร")
print("2. ใช้ gemini-flash-latest สำหรับเวอร์ชันล่าสุดอัตโนมัติ")
print("3. ใช้ gemini-3.1-flash-lite-preview สำหรับความเร็วสูงสุด")
