'use client';

import { StudentLoading } from '../../components/animations/student-animation';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { StudentNav } from '../../components/student-nav';
import { AvatarPicker } from '../../components/avatar-picker';
import { api, getMe, type StudentMe } from '../../lib/api';
import { useAvatarUpload } from '../../lib/student-avatar';

type Grade = { id: string; level: number; title: string };

export default function SettingsPage() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [me, setMe] = useState<StudentMe | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [school, setSchool] = useState('');
  const [className, setClassName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const prepareAvatar = useAvatarUpload();

  useEffect(() => {
    (async () => {
      const student = await getMe();
      if (!student) return router.replace('/login');
      if (!student.gradeId) return router.replace('/onboarding/grade');
      setMe(student);
      setDisplayName(student.displayName);
      setSchool(student.school ?? '');
      setClassName(student.className ?? '');
      setGradeId(student.gradeId);
      setGrades(await api<Grade[]>('/grades'));
    })().catch(() => setError('Chưa tải được cài đặt. Hãy thử lại.'));
  }, [router]);

  async function save() {
    if (!me || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const avatarKey = avatarFile
        ? await prepareAvatar(me.id, avatarFile)
        : undefined;
      const updated = await api<StudentMe>(`/students/${me.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          school: school.trim(),
          className: className.trim(),
          gradeId,
          ...(avatarKey !== undefined ? { avatarKey } : {}),
        }),
      });
      setMe(updated);
      setAvatarFile(null);
      setSaved(true);
      if (updated.gradeId !== me.gradeId) {
        router.replace(`/path/${updated.gradeId}`);
      }
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? 'Chưa kết nối được máy chủ. Hãy thử lại.'
          : cause instanceof Error
            ? cause.message
            : 'Chưa lưu được cài đặt',
      );
    } finally {
      dialogRef.current?.close();
      saving.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me || saving.current) return;
    setError('');
    if (gradeId !== me.gradeId) dialogRef.current?.showModal();
    else void save();
  }

  if (!me) {
    return (
      <main className="settings-screen">
        <StudentLoading>Đang mở cài đặt…</StudentLoading>
        {error ? (
          <p className="bad" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  const currentGrade =
    grades.find((grade) => grade.id === me.gradeId)?.title ?? 'khối hiện tại';
  const nextGrade =
    grades.find((grade) => grade.id === gradeId)?.title ?? 'khối mới';

  return (
    <main className="settings-screen">
      <StudentNav me={me} />
      <div className="settings-heading">
        <p className="brand-pill">Tài khoản của mình</p>
        <h1>Cài đặt</h1>
      </div>
      <form className="settings-form" onSubmit={submit}>
        <div className="settings-fields">
          <AvatarPicker
            id="settings-avatar"
            avatarKey={me.avatarKey}
            displayName={me.displayName}
            file={avatarFile}
            disabled={busy}
            onChange={(file) => {
              setAvatarFile(file);
              setSaved(false);
              setError('');
            }}
          />
          <div className="auth-field">
            <label htmlFor="settings-name">Tên của bạn</label>
            <input
              id="settings-name"
              disabled={busy}
              className="field"
              autoComplete="name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
              }}
              maxLength={80}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="settings-username">Tên đăng nhập</label>
            <input
              id="settings-username"
              className="field"
              value={me.username}
              readOnly
            />
          </div>
          <div className="auth-field">
            <label htmlFor="settings-school">
              Trường <span className="auth-optional">(không bắt buộc)</span>
            </label>
            <input
              id="settings-school"
              disabled={busy}
              className="field"
              value={school}
              onChange={(event) => {
                setSchool(event.target.value);
                setSaved(false);
              }}
              maxLength={120}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="settings-class">
              Lớp <span className="auth-optional">(không bắt buộc)</span>
            </label>
            <input
              id="settings-class"
              disabled={busy}
              className="field"
              value={className}
              onChange={(event) => {
                setClassName(event.target.value);
                setSaved(false);
              }}
              maxLength={40}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="settings-grade">Khối lớp</label>
            <select
              id="settings-grade"
              disabled={busy}
              className="field"
              value={gradeId}
              onChange={(event) => {
                setGradeId(event.target.value);
                setSaved(false);
              }}
              required
            >
              {grades.map((grade) => (
                <option value={grade.id} key={grade.id}>
                  {grade.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? (
          <p className="bad" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="ok" role="status">
            Đã lưu cài đặt.
          </p>
        ) : null}
        <div className="settings-actions">
          <button
            className="btn"
            type="submit"
            disabled={busy || grades.length === 0}
          >
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
          <Link className="btn ghost" href={`/path/${me.gradeId}`}>
            Hủy
          </Link>
        </div>
      </form>
      <dialog
        className="grade-dialog"
        ref={dialogRef}
        aria-labelledby="grade-dialog-title"
      >
        <h2 id="grade-dialog-title">Đổi khối lớp?</h2>
        <p>
          Bạn sẽ chuyển từ {currentGrade} sang {nextGrade}. Tiến độ ở khối cũ
          vẫn được giữ lại.
        </p>
        <div className="settings-actions">
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void save()}
          >
            Đổi khối
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            Ở lại
          </button>
        </div>
      </dialog>
    </main>
  );
}
