'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import {
  BookOpen,
  BookText,
  ChartNoAxesColumn,
  ChevronDown,
  LogOut,
  Settings,
} from 'lucide-react';
import { logoutStudent, type StudentMe } from '../lib/api';
import { StudentAvatar } from './student-avatar';

export function StudentNav({ me }: { me: StudentMe }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    settingsRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await logoutStudent();
      router.replace('/login');
    } catch {
      setError('Chưa đăng xuất được. Hãy thử lại.');
      setBusy(false);
    }
  }

  const journeyActive =
    pathname.startsWith('/path/') || pathname.startsWith('/units/');

  return (
    <header className="student-topbar">
      <nav className="student-topbar-links" aria-label="Điều hướng học tập">
        <Link
          href={me.gradeId ? `/path/${me.gradeId}` : '/onboarding/grade'}
          className={`topbar-link ${journeyActive ? 'topbar-link--active' : ''}`}
          aria-current={journeyActive ? 'page' : undefined}
        >
          <BookOpen size={20} aria-hidden /> Hành trình
        </Link>
        <Link
          href="/wordbook"
          className={`topbar-link ${pathname === '/wordbook' ? 'topbar-link--active' : ''}`}
          aria-current={pathname === '/wordbook' ? 'page' : undefined}
        >
          <BookText size={20} aria-hidden /> Sổ từ
        </Link>
        <Link
          href="/report"
          className={`topbar-link ${pathname === '/report' ? 'topbar-link--active' : ''}`}
          aria-current={pathname === '/report' ? 'page' : undefined}
        >
          <ChartNoAxesColumn size={20} aria-hidden /> Báo cáo
        </Link>
      </nav>
      <div className="student-profile" ref={rootRef}>
        <button
          type="button"
          className="profile-trigger"
          ref={triggerRef}
          title={me.displayName}
          aria-label={`Tài khoản của ${me.displayName}`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="profile-avatar" aria-hidden>
            <StudentAvatar
              avatarKey={me.avatarKey}
              displayName={me.displayName}
            />
          </span>
          <span className="profile-name">{me.displayName}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
        {open ? (
          <div className="profile-popover" id={menuId}>
            <Link
              href="/settings"
              ref={settingsRef}
              onClick={() => setOpen(false)}
            >
              <Settings size={19} aria-hidden /> Cài đặt
            </Link>
            <button type="button" onClick={() => void logout()} disabled={busy}>
              <LogOut size={19} aria-hidden /> Đăng xuất
            </button>
            {error ? (
              <p className="bad" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
