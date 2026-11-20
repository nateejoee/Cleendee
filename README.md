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
- ไฟล์ `public/_redirects` ทำให้ทุกหน้าเปิดได้ตรงๆ
