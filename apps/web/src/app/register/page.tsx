'use client';

import { StudentMascot } from '../../components/animations/student-animation';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AvatarPicker } from '../../components/avatar-picker';
import {
  afterAuthPath,
  api,
  registerStudent,
  type StudentMe,
} from '../../lib/api';
import { useAvatarUpload } from '../../lib/student-avatar';

type Grade = { id: string; level: number; title: string };

export default function RegisterPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [school, setSchool] = useState('');
  const [className, setClassName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [createdStudent, setCreatedStudent] = useState<StudentMe | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const prepareAvatar = useAvatarUpload();

  useEffect(() => {
    api<Grade[]>('/grades')
      .then((list) => {
        setGrades(list);
        if (!list.length)
          setError('Chưa có khối lớp để đăng ký. Hãy liên hệ giáo viên.');
      })
      .catch(() =>
        setError('Chưa tải được danh sách khối lớp. Hãy thử lại sau.'),
      );
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!createdStudent && password !== confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp');
      return;
    }
    if (!gradeId) {
      setError('Hãy chọn khối lớp');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      let student =
        createdStudent ??
        (await registerStudent({
          displayName: displayName.trim(),
          gradeId,
          school: school.trim(),
          className: className.trim(),
          username: username.trim(),
          password,
          confirmPassword,
        }));
      setCreatedStudent(student);
      if (avatarFile) {
        const avatarKey = await prepareAvatar(student.id, avatarFile);
        student = await api<StudentMe>(`/students/${student.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ avatarKey }),
        });
        setCreatedStudent(student);
      }
      router.replace(afterAuthPath(student));
    } catch (error) {
      setError(
        error instanceof TypeError
          ? 'Chưa kết nối được máy chủ. Hãy thử lại.'
          : error instanceof Error
            ? error.message
            : 'Không đăng ký được',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--register">
      <div className="auth-hero">
        <StudentMascot />
        <p className="speech">Tạo tài khoản học nhé!</p>
      </div>
      <div className="auth-body">
        <p className="brand-pill">Học từ vựng</p>
        <h1>{createdStudent ? 'Tài khoản đã sẵn sàng' : 'Tạo tài khoản'}</h1>
        <form className="auth-form auth-form--register" onSubmit={onSubmit}>
          <div className="auth-field">
            <label htmlFor="display-name">Tên của bạn</label>
            <input
              id="display-name"
              disabled={busy || !!createdStudent}
              className="field"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="grade">Khối lớp</label>
            <select
              id="grade"
              disabled={busy || !!createdStudent}
              className="field"
              value={gradeId}
              onChange={(event) => setGradeId(event.target.value)}
              required
            >
              <option value="">Chọn khối lớp</option>
              {grades.map((grade) => (
                <option value={grade.id} key={grade.id}>
                  {grade.title}
                </option>
              ))}
            </select>
          </div>
          <div className="auth-field">
            <label htmlFor="school">
              Trường <span className="auth-optional">(không bắt buộc)</span>
            </label>
            <input
              id="school"
              disabled={busy || !!createdStudent}
              className="field"
              autoComplete="organization"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="class-name">
              Lớp <span className="auth-optional">(không bắt buộc)</span>
            </label>
            <input
              id="class-name"
              disabled={busy || !!createdStudent}
              className="field"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              maxLength={40}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-username">Tên đăng nhập</label>
            <input
              id="register-username"
              disabled={busy || !!createdStudent}
              className="field"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="register-password">Mật khẩu</label>
            <div className="field-row">
              <input
                id="register-password"
                disabled={busy || !!createdStudent}
                className="field"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="btn-inline"
                disabled={busy || !!createdStudent}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="confirm-password">Nhập lại mật khẩu</label>
            <input
              id="confirm-password"
              disabled={busy || !!createdStudent}
              className="field"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
          <AvatarPicker
            id="avatar"
            file={avatarFile}
            disabled={busy}
            onChange={(file) => {
              setAvatarFile(file);
              setError('');
            }}
          />
          {createdStudent ? (
            <p className="ok auth-err" role="status">
              Tài khoản đã được tạo. Bạn có thể vào học ngay, hoặc thử lưu ảnh
              lại.
            </p>
          ) : null}
          {error ? (
            <p className="bad auth-err" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="btn"
            type="submit"
            disabled={busy || grades.length === 0}
          >
            {busy
              ? createdStudent && avatarFile
                ? 'Đang lưu ảnh…'
                : 'Đang tạo…'
              : createdStudent
                ? avatarFile
                  ? 'Thử lưu ảnh'
                  : 'Vào học'
                : 'Tạo tài khoản'}
          </button>
          {createdStudent ? (
            <Link className="btn ghost" href={afterAuthPath(createdStudent)}>
              Vào học, thêm ảnh sau
            </Link>
          ) : null}
        </form>
      </div>
      <p className="auth-switch muted">
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </main>
  );
}
