'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { errorText, request } from '../lib/admin';
const links = [
  ['/content', 'Aa', 'Từ vựng'],
  ['/units', '◷', 'Unit & lịch học'],
  ['/categories', '⌗', 'Category'],
  ['/import', '↑', 'Nhập Excel'],
];
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (path === '/') return;
    const controller = new AbortController();
    setReady(false);
    setError('');
    request('/admin/auth/me', { signal: controller.signal })
      .then(() => setReady(true))
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorText(error));
      });
    return () => controller.abort();
  }, [path, retry]);
  if (path === '/') return children;
  async function logout() {
    setLeaving(true);
    setError('');
    try {
      await request('/admin/auth/logout', { method: 'POST' });
      router.replace('/');
    } catch (error) {
      setError(errorText(error));
      setLeaving(false);
    }
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/content" className="admin-brand">
          <span className="brand-symbol">
            Aa<span>✦</span>
          </span>
          <span>
            Vườn từ vựng<small>Không gian giáo viên</small>
          </span>
        </Link>
        <p className="nav-caption">QUẢN LÝ NỘI DUNG</p>
        <nav aria-label="Điều hướng Admin">
          {links.map(([href, icon, title]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden>
                {icon}
              </span>
              {title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span aria-hidden>✧</span>
          <strong>Mỗi từ, một khám phá</strong>
          <p>Chuẩn bị những bài học nhỏ cho hành trình lớn.</p>
        </div>
        <button
          className="logout-button"
          disabled={leaving}
          onClick={() => void logout()}
        >
          {leaving ? 'Đang đăng xuất…' : '↗ Đăng xuất'}
        </button>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            Thư viện học tập <span className="topbar-separator">/</span>{' '}
            {links.find(([href]) => href === path)?.[2] ?? 'Nội dung'}
          </span>
          <span className="admin-identity">
            <span className="avatar">GV</span> Quản trị viên
          </span>
        </header>
        <main className="admin-content">
          {error ? (
            <div className="notice notice-error" role="alert">
              {error}{' '}
              <button
                className="text-button"
                onClick={() => setRetry(retry + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : null}
          {ready ? (
            children
          ) : !error ? (
            <p role="status">Đang mở không gian quản lý…</p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
