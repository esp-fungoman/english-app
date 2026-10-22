import './global.css';
import { AdminShell } from '../components/admin-shell';
export const metadata = {
  title: 'Vườn từ vựng · Admin',
  description: 'Quản lý kho từ vựng và lịch học',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
