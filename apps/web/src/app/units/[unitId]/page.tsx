'use client';

import { StudentLoading } from '../../../components/animations/student-animation';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookText,
  ChevronRight,
  LockKeyhole,
  Star,
  Volume2,
  Grid2X2,
  SpellCheck,
  ListFilter,
  RotateCcw,
} from 'lucide-react';
import { unitLockMessage } from '../../../lib/unit-access';
import { StudentNav } from '../../../components/student-nav';
import { api, getMe, type StudentMe } from '../../../lib/api';
import type { WordbookData } from '../../../lib/learning';

type Activity = 'group' | 'odd_letter' | 'scramble' | 'listen_spell';
type ActivityProgress = {
  correct: number;
  total: number;
  percent: number;
  mastered: boolean;
};
type Unit = {
  id: string;
  title: string;
  gradeId: string;
  open: boolean;
  opensAt: string | null;
  lockReason: string | null;
  groupMode: 'single' | 'board';
  wordCount: number;
  categoryTitles: string[];
  activities: { type: Activity; available: boolean }[];
  progress: Record<Activity, ActivityProgress>;
};

const GAME_INFO = {
  group: {
    label: 'Ghép từ theo nhóm',
    hint: 'Tìm đúng nhóm của từ',
    icon: Grid2X2,
  },
  odd_letter: {
    label: 'Tìm chữ cái thừa',
    hint: 'Chọn chữ không thuộc từ',
    icon: ListFilter,
  },
  scramble: {
    label: 'Sắp xếp chữ cái',
    hint: 'Xếp các chữ thành từ',
    icon: SpellCheck,
  },
  listen_spell: {
    label: 'Nghe và chọn chữ cái',
    hint: 'Nghe rồi điền từ',
    icon: Volume2,
  },
} as const;

export default function UnitPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const router = useRouter();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [me, setMe] = useState<StudentMe | null>(null);
  const [wordbook, setWordbook] = useState<WordbookData | null>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setWordbook(undefined);
    (async () => {
      const me = await getMe();
      if (!active) return;
      if (!me) return router.replace('/login');
      if (!me.gradeId) return router.replace('/onboarding/grade');
      setMe(me);
      const loadedUnit = await api<Unit>(`/units/${unitId}`);
      if (!active) return;
      setUnit(loadedUnit);
      if (loadedUnit.open) {
        try {
          const loadedWordbook = await api<WordbookData>('/learning/wordbook');
          if (active) setWordbook(loadedWordbook);
        } catch {
          if (active) setWordbook(null);
        }
      }
    })().catch((e) => {
      if (active)
        setError(e instanceof Error ? e.message : 'Không tải được unit');
    });
    return () => {
      active = false;
    };
  }, [unitId, router]);

  if (error)
    return (
      <main>
        <p className="bad">{error}</p>
        <Link className="btn ghost" href="/">
          Về nhà
        </Link>
      </main>
    );
  if (!unit)
    return (
      <main>
        <StudentLoading>Đang mở unit...</StudentLoading>
      </main>
    );

  const stars = Object.values(unit.progress).filter(
    (item) => item.mastered,
  ).length;

  return (
    <main className="unit-screen">
      {me ? <StudentNav me={me} /> : null}
      <div className="unit-heading">
        <div>
          <p className="brand-pill">
            Unit {unit.title.replace(/[^0-9]/g, '') || ''}
          </p>
          <h1>{unit.title}</h1>
        </div>
        <span className="unit-star">
          <Star size={20} fill="currentColor" aria-hidden /> {stars}/4
        </span>
      </div>
      <div className="unit-learning-summary">
        <div>
          <strong>{stars}/4 trò chơi đã đạt</strong>
          <span>
            {unit.wordCount} từ · {unit.categoryTitles.join(', ') || 'Từ vựng'}
          </span>
        </div>
        <div
          className="unit-learning-track"
          role="img"
          aria-label={`${stars} trên 4 trò chơi đã đạt`}
        >
          <span style={{ width: `${stars * 25}%` }} />
        </div>
      </div>
      {!unit.open ? (
        <div className="unit-notice">
          <LockKeyhole size={22} aria-hidden />
          <span>{unitLockMessage(unit)}</span>
        </div>
      ) : null}
      <div className="game-list">
        {unit.activities.map(({ type, available }) => {
          const info = GAME_INFO[type];
          const Icon = info.icon;
          const status = unit.progress[type];
          const disabled = !unit.open || !available;
          const body = (
            <>
              <span className="game-icon">
                <Icon size={25} aria-hidden />
              </span>
              <span className="game-copy">
                <strong>{info.label}</strong>
                <small>
                  {disabled
                    ? !unit.open
                      ? 'Chưa mở'
                      : 'Chưa có nội dung'
                    : type === 'group'
                      ? `${unit.groupMode === 'board' ? 'Bảng phân nhóm' : 'Từng từ'}${status.total ? ` · ${status.percent}% đúng · ${status.total} lượt` : ''}`
                      : status.total
                        ? `${status.percent}% đúng · ${status.total} lượt`
                        : info.hint}
                </small>
              </span>
              {status.mastered ? (
                <Star
                  className="game-mastered"
                  size={20}
                  fill="currentColor"
                  aria-label="Đã đạt"
                />
              ) : disabled ? (
                <LockKeyhole size={19} aria-hidden />
              ) : (
                <ChevronRight size={20} aria-hidden />
              )}
            </>
          );
          return disabled ? (
            <div key={type} className="game-row game-row--off">
              {body}
            </div>
          ) : (
            <Link
              key={type}
              className="game-row"
              href={`/play/${type}/${unitId}`}
            >
              {body}
            </Link>
          );
        })}
      </div>
      {unit.open && !unit.activities.some((a) => a.available) ? (
        <p className="unit-empty">
          Unit này chưa có trò chơi. Quay lại sau nhé!
        </p>
      ) : null}
      {unit.open ? (
        <div className="unit-more-actions">
          <Link href="/wordbook">
            <BookText size={21} aria-hidden /> Xem sổ từ{' '}
            <ArrowRight size={18} aria-hidden />
          </Link>
          {wordbook?.reviewAvailable ? (
            <Link href="/review">
              <RotateCcw size={21} aria-hidden /> Ôn nhanh{' '}
              <ArrowRight size={18} aria-hidden />
            </Link>
          ) : (
            <span className="muted" role="status">
              {wordbook === undefined
                ? 'Đang tải từ để ôn…'
                : wordbook === null
                  ? 'Chưa tải được từ để ôn.'
                  : 'Ôn nhanh: cần ít nhất 3 từ có nghĩa để ôn.'}
            </span>
          )}
        </div>
      ) : null}
    </main>
  );
}
