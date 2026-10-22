'use client';

import {
  StudentLoading,
  StudentMascot,
} from '../components/animations/student-animation';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { afterAuthPath, getMe } from '../lib/api';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    getMe()
      .then((me) => {
        if (me) router.replace(afterAuthPath(me));
        else router.replace('/login');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="auth-screen">
      <div className="auth-hero">
        <StudentMascot mode="static" />
      </div>
      <div className="auth-body">
        <p className="brand-pill">Học từ vựng</p>
        <StudentLoading>Đang mở…</StudentLoading>
      </div>
    </main>
  );
}
