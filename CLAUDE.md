# ต้นกล้าสเต๊ก — โน้ตอ้างอิงโปรเจกต์

โปรเจกต์ระบบสั่งอาหารสำหรับร้านสเต๊ก "ต้นกล้าสเต๊ก"
Stack: Next.js (App Router, JavaScript), Supabase, deploy บน Vercel

## ⚠️ สำคัญมาก: Next.js เวอร์ชันนี้ params เป็น Promise

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด (15.x) ซึ่ง `params` (และ `searchParams`)
ใน Dynamic Route **ไม่ใช่ object ธรรมดาอีกต่อไป แต่เป็น Promise**

**ต้อง unwrap ด้วย `use()` จาก React เสมอ** เมื่อจะสร้างหน้าแบบ Dynamic Route
(เช่น หน้าสั่งอาหารตามโต๊ะ `/order/[tableId]` ที่จะสร้างในขั้นตอนถัดไป)

ตัวอย่างรูปแบบที่ถูกต้อง (Client Component):

```jsx
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  const { tableId } = use(params);
  // ...
}
```

หรือถ้าเป็น Server Component (async function):

```jsx
export default async function OrderPage({ params }) {
  const { tableId } = await params;
  // ...
}
```

ห้ามเขียนแบบเดิม `params.tableId` ตรง ๆ เด็ดขาด เพราะจะ error หรือได้ค่า
`undefined` บน Next.js เวอร์ชันนี้

## โครงสร้างฐานข้อมูล Supabase (มีอยู่แล้ว — ใช้อ้างอิง ไม่ต้องสร้างใหม่)

### `sessions`
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | primary key |
| table_number | หมายเลขโต๊ะ |
| adult_count | จำนวนผู้ใหญ่ |
| child_count | จำนวนเด็ก |
| status | สถานะของ session |
| created_at | เวลาที่สร้าง |

### `menu_categories`
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | primary key |
| name | ชื่อหมวดหมู่เมนู |
| sort_order | ลำดับการแสดงผล |

### `menu_items`
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | primary key |
| category_id | อ้างอิงไปยัง `menu_categories.id` |
| name | ชื่อเมนู |

### `orders`
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | primary key |
| session_id | อ้างอิงไปยัง `sessions.id` |
| table_number | หมายเลขโต๊ะ |
| items | jsonb — รายการอาหารที่สั่ง |
| status | สถานะออเดอร์ |
| created_at | เวลาที่สร้าง |

## Environment Variables

ตั้งค่าใน `.env.local` (local) และใน Vercel Project Settings → Environment Variables (production):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

ดูตัวอย่างได้ใน `.env.local.example`

## Supabase Client

ใช้ client ที่สร้างไว้แล้วที่ `lib/supabaseClient.js`:

```js
import { supabase } from '@/lib/supabaseClient';
```

## หน้าที่มีอยู่ตอนนี้ (สำหรับทดสอบ deploy)

- `/` — หน้าแรก แสดงชื่อร้านและลิงก์ทดสอบ
- `/generate-qr` — หน้า placeholder (จะสร้างฟังก์ชันสร้าง QR Code ในขั้นตอนถัดไป)
- `/kitchen` — หน้า placeholder (จะสร้างหน้าจอครัวในขั้นตอนถัดไป)
