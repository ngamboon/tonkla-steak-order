export const metadata = {
  title: 'ต้นกล้าสเต๊ก',
  description: 'ระบบสั่งอาหารร้านต้นกล้าสเต๊ก',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
