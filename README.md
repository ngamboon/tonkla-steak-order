# ต้นกล้าสเต๊ก

ระบบสั่งอาหารสำหรับร้านสเต๊ก "ต้นกล้าสเต๊ก" — Next.js (App Router) + Supabase, deploy บน Vercel

> ⚠️ ดูโน้ตสำคัญเรื่อง Dynamic Route params (เป็น Promise ต้อง unwrap ด้วย `use()`)
> และโครงสร้างฐานข้อมูล Supabase ได้ที่ [`CLAUDE.md`](./CLAUDE.md)

## เริ่มต้นใช้งาน (Local Development)

1. ติดตั้ง dependencies:

   ```bash
   npm install
   ```

2. คัดลอกไฟล์ตัวอย่าง env และใส่ค่าจริงจากโปรเจกต์ Supabase ของคุณ:

   ```bash
   cp .env.local.example .env.local
   ```

   แล้วแก้ไข `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
   ```

3. รันเซิร์ฟเวอร์ dev:

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000)

## Deploy บน Vercel

1. Push โปรเจกต์นี้ขึ้น GitHub repository
2. Import repository เข้า Vercel
3. ตั้งค่า Environment Variables ใน Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel จะรัน `npm run build` และ `npm run start` ให้อัตโนมัติ

## ทดสอบว่า deploy สำเร็จ

หลัง deploy เสร็จ เข้าหน้าแรกแล้วกดลิงก์ไปที่:

- `/generate-qr`
- `/kitchen`

ถ้าทั้งสองหน้าเปิดได้โดยไม่ error แสดงว่า deploy สำเร็จ

## โครงสร้างโปรเจกต์

```
tonkla-steak/
├── app/
│   ├── layout.js
│   ├── page.js
│   ├── generate-qr/
│   │   └── page.js
│   └── kitchen/
│       └── page.js
├── lib/
│   └── supabaseClient.js
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
├── CLAUDE.md
└── README.md
```

## ฐานข้อมูล

โปรเจกต์นี้เชื่อมต่อกับตารางที่มีอยู่แล้วใน Supabase (`sessions`, `menu_categories`,
`menu_items`, `orders`) — รายละเอียดคอลัมน์ทั้งหมดอยู่ใน [`CLAUDE.md`](./CLAUDE.md)
