'use client';

import { StudentMascot } from '../../../components/animations/student-animation';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getMe } from '../../../lib/api';

type Grade = { id: string; level: number; title: string };

export default function GradeOnboardingPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await getMe();
      if (!me) {
        router.replace('/login');
        return;
      }
      if (me.gradeId) {
        router.replace(`/path/${me.gradeId}`);
        return;
      }
      setStudentId(me.id);
      const list = await api<Grade[]>('/grades');
      setGrades(list);
    })().catch((e) => setErr(String(e)));
  }, [router]);

  async function pick(gradeId: string) {
    if (!studentId || busy) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/students/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ gradeId }),
      });
      router.replace(`/path/${gradeId}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Không chọn được khối');
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen auth-screen--grade">
      <div className="auth-hero">
        <StudentMascot />
        <p className="speech">Chọn đúng khối lớp của mình nha!</p>
      </div>
      <div className="auth-body">
        <p className="brand-pill">Bước 1</p>
        <h1>Bạn học khối mấy?</h1>
        <p className="lede">Chọn một khối để vào đường unit.</p>
        <div className="grade-grid">
          {grades.map((g) => (
            <button
              key={g.id}
              type="button"
              className="grade-tile"
              disabled={busy}
              onClick={() => pick(g.id)}
            >
              <span className="grade-num">{g.level}</span>
              <span>{g.title}</span>
            </button>
          ))}
        </div>
        {err ? <p className="bad auth-err">{err}</p> : null}
      </div>
    </main>
  );
}
