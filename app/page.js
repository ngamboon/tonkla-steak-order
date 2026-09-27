import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>ต้นกล้าสเต๊ก</h1>
      <p>ระบบสั่งอาหารสำหรับร้านต้นกล้าสเต๊ก</p>
      <ul>
        <li>
          <Link href="/generate-qr">ไปหน้าสร้าง QR Code (/generate-qr)</Link>
        </li>
        <li>
          <Link href="/kitchen">ไปหน้าครัว (/kitchen)</Link>
        </li>
      </ul>
    </main>
  );
}
