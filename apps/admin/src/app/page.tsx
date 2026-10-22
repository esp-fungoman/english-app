'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API, errorText, request } from '../lib/admin';
export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/admin/auth/me`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok && !controller.signal.aborted)
          router.replace('/content');
      })
      .catch(() => {});
    return () => controller.abort();
  }, [router]);
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      router.replace('/content');
    } catch (error) {
      setError(errorText(error));
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="login-logo">
          <span className="brand-symbol">
            Aa<span>✦</span>
          </span>{' '}
          Vườn từ vựng
        </div>
        <div className="login-story-content">
          <p className="eyebrow">KHÔNG GIAN GIÁO VIÊN</p>
          <h1>
            Gieo một từ mới.
            <br />
            Mở ngàn khám phá.
          </h1>
          <p>
            Chăm chút kho từ vựng, kết nối bài học và chuẩn bị hành trình học
            tiếng Anh cho các em.
          </p>
          <div className="login-word-cards" aria-hidden>
            <span>
              <b>apple</b>
              <small>quả táo · noun</small>
            </span>
            <span>
              <b>discover</b>
              <small>khám phá · verb</small>
            </span>
            <span className="login-star">✦</span>
          </div>
        </div>
        <p className="login-footer">
          Những bài học tốt bắt đầu từ sự chuẩn bị.
        </p>
      </section>
      <section className="login-form-area">
        <div className="login-form-wrap">
          <span className="login-tag">DÀNH CHO QUẢN TRỊ VIÊN</span>
          <h2>Chào mừng trở lại</h2>
          <p className="muted">Đăng nhập để tiếp tục chuẩn bị bài học.</p>
          <form onSubmit={(event) => void login(event)} className="form-stack">
            <label>
              Tên đăng nhập
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Nhập tên đăng nhập"
                disabled={busy}
              />
            </label>
            <label>
              Mật khẩu
              <span className="password-field">
                <input
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
            </label>
            {error ? (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="button button-primary login-submit"
              disabled={busy}
            >
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập →'}
            </button>
          </form>
          <p className="login-help">
            Sử dụng tài khoản do người quản lý cung cấp.
          </p>
        </div>
      </section>
    </main>
  );
}
