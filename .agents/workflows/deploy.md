---
description: Deploy Hosting and Functions to Firebase (V87.55+)
---

// turbo-all

1. บันทึกและผลักดันโค้ดไปยัง Production
   ```bash
   git add .
   git commit -m "V87.55: Critical Fix & Claude Integration via Workflow"
   git push origin production
   ```

2. Deploy ไปยัง Firebase (ครบชุด)
   ```bash
   powershell -ExecutionPolicy Bypass -Command "firebase deploy --only 'hosting,functions'"
   ```
