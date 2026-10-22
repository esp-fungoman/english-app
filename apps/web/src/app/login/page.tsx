'use client';

import { StudentMascot } from '../../components/animations/student-animation';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { afterAuthPath, loginStudent } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const student = await loginStudent({ username, password });
      router.replace(afterAuthPath(student));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đăng nhập được');
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-hero">
        <StudentMascot />
        <p className="speech">Vào học thôi!</p>
      </div>
      <div className="auth-body">
        <p className="brand-pill">Học từ vựng</p>
        <h1>Đăng nhập</h1>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="username">Tên đăng nhập</label>
          <input
            id="username"
            className="field"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="password">Mật khẩu</label>
          <div className="field-row">
            <input
              id="password"
              className="field"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="btn-inline"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          {error ? (
            <p className="bad auth-err" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Đang vào…' : 'Vào học thôi'}
          </button>
        </form>
      </div>
      <p className="auth-switch muted">
        Chưa có tài khoản? <Link href="/register">Tạo tài khoản</Link>
      </p>
    </main>
  );
}
