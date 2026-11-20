# CleenDee คลีนดี

เว็บแอปจ้างแม่บ้านในจังหวัดชุมพร (ไทย / English) — React + Vite + Supabase

## รันในเครื่อง
```
npm install
npm run dev
```

## ขึ้นเว็บบน Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (มีค่าเริ่มต้นในโค้ดแล้ว)
- `wrangler.jsonc` ตั้งให้ทุกหน้าเปิดได้ตรงๆ (single-page-application)

## โครงสร้างที่เพิ่ม (20/11/69)
- `src/lib/theme.tsx` ธีมสี (ค่าเริ่มต้น กรมท่า-ทอง แบบหรู) · โหมดมืด · เอฟเฟกต์เรืองแสง — เลือกได้ที่หน้าบัญชี
- `src/lib/fx.tsx` ลูกเล่น: การ์ดจางขึ้นไล่กัน ตัวเลขนับขึ้น พลุกระดาษ เวลาแบบสั้น แถบโหลดขอบบน ปุ่มกลับขึ้นบน แถบออฟไลน์
- คนที่ยังไม่เข้าสู่ระบบดูได้แค่หน้าแรก บริการ และโปรไฟล์แม่บ้าน หน้าอื่นขึ้นหน้า "เข้าสู่ระบบตอนนี้" (`Member` ใน `App.tsx`)
- ภาษา: เครื่องที่ไม่ใช่ภาษาไทยเปิดเป็นภาษาอังกฤษ
- รูปใน `src/assets/ill/` สร้างจาก ChatGPT (ภาพถ่ายเสมือนจริงแนวหรู)
