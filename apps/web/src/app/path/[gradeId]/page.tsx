'use client';

import {
  GradeTrophy,
  StreakFire,
} from '../../../components/animations/student-effects';

import {
  StudentLoading,
  StudentMascot,
} from '../../../components/animations/student-animation';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookText,
  ChevronRight,
  Grid2X2,
  ListFilter,
  LockKeyhole,
  RotateCcw,
  SpellCheck,
  Star,
  Volume2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { unitLockMessage } from '../../../lib/unit-access';
import { StudentNav } from '../../../components/student-nav';
import { api, getMe, type StudentMe } from '../../../lib/api';
import { GAME_DETAILS, type Activity } from '../../../lib/game';
import type { WordbookData } from '../../../lib/learning';

type Node = {
  id: string;
  title: string;
  sortOrder: number;
  open: boolean;
  opensAt: string | null;
  lockReason: string | null;
  hasContent: boolean;
  stars: number;
  complete: boolean;
};
type Grade = { id: string; level: number; title: string };
type WeeklyPreview = {
  minutesThisWeek: number;
  unitsCompleted: number;
  unitsTotal: number;
  wordsLearned: number;
  streakDays: number;
};
type UnitDetail = {
  activities: { type: Activity; available: boolean }[];
  progress: Record<
    Activity,
    { percent: number; mastered: boolean; total: number }
  >;
};
const gameIcons = {
  group: Grid2X2,
  odd_letter: ListFilter,
  scramble: SpellCheck,
  listen_spell: Volume2,
};

export default function PathPage() {
  const { gradeId } = useParams<{ gradeId: string }>();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [gradeTitle, setGradeTitle] = useState('');
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [report, setReport] = useState<WeeklyPreview | null | undefined>();
  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null);
  const [wordbook, setWordbook] = useState<WordbookData | null | undefined>();
  const [previousStars, setPreviousStars] = useState<Record<string, number>>(
    {},
  );
  const [earned, setEarned] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setNodes(null);
    setReport(undefined);
    setUnitDetail(null);
    setWordbook(undefined);
    setError('');
    (async () => {
      const student = await getMe();
      if (!student || !active) {
        if (active) router.replace('/login');
        return;
      }
      if (!student.gradeId) return router.replace('/onboarding/grade');
      if (student.gradeId !== gradeId)
        return router.replace(`/path/${student.gradeId}`);
      setMe(student);
      const [path, grades] = await Promise.all([
        api<Node[]>(`/grades/${gradeId}/path`),
        api<Grade[]>('/grades').catch(() => []),
      ]);
      if (!active) return;
      setGradeTitle(
        grades.find((grade) => grade.id === gradeId)?.title ?? 'Khối của mình',
      );

      const key = `journey-stars:${student.id}:${gradeId}`;
      let seen: Record<string, number> = {};
      try {
        const saved = sessionStorage.getItem(key);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
          seen = parsed as Record<string, number>;
      } catch {
        // A stale snapshot should never stop the path from loading.
      }
      seen = Object.fromEntries(
        Object.entries(seen).filter(
          ([, stars]) => typeof stars === 'number' && Number.isFinite(stars),
        ),
      );
      setPreviousStars(seen);
      setEarned(
        path
          .filter((node) => node.stars > (seen[node.id] ?? node.stars))
          .map((node) => node.id),
      );
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify(
            Object.fromEntries(path.map((node) => [node.id, node.stars])),
          ),
        );
      } catch {
        // Progress still renders when browser storage is unavailable.
      }
      setNodes(path);
      const next =
        path
          .filter((node) => node.open && node.hasContent)
          .find((node) => !node.complete) ??
        path.find((node) => node.open && node.hasContent);
      if (next)
        api<UnitDetail>(`/units/${next.id}`)
          .then((value) => {
            if (active) setUnitDetail(value);
          })
          .catch(() => {});
      api<WordbookData>('/learning/wordbook')
        .then((value) => {
          if (active) setWordbook(value);
        })
        .catch(() => {
          if (active) setWordbook(null);
        });
      api<WeeklyPreview>('/reports/weekly')
        .then((value) => {
          if (active) setReport(value);
        })
        .catch(() => {
          if (active) setReport(null);
        });
    })().catch(() => {
      if (active) setError('Chưa tải được hành trình. Hãy thử lại.');
    });
    return () => {
      active = false;
    };
  }, [gradeId, router]);

  const playable = nodes?.filter((node) => node.open && node.hasContent) ?? [];
  const nextUnit = playable.find((node) => !node.complete) ?? playable[0];
  const reviewing = Boolean(
    nextUnit && playable.every((node) => node.complete),
  );
  const previewWords =
    wordbook?.units.flatMap((unit) => unit.words).slice(0, 3) ?? [];

  if (!me) {
    return (
      <main className="path-screen">
        <StudentLoading>Đang mở hành trình…</StudentLoading>
      </main>
    );
  }

  return (
    <main className="path-screen">
      <StudentNav me={me} />
      <div className="home-intro home-intro--mascot">
        <StudentMascot className="journey-mascot" />
        <div>
          <p className="muted tight">{gradeTitle || 'Hành trình học tập'}</p>
          <h1>Chào {me.displayName}!</h1>
          <p className="muted path-lede">Mình học một chút mỗi ngày nhé.</p>
        </div>
      </div>
      {error ? (
        <div role="alert">
          <p className="bad">{error}</p>
          <button
            className="btn ghost btn-sm"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tải lại
          </button>
        </div>
      ) : null}
      {!error && nodes === null ? (
        <StudentLoading>Đang mở hành trình…</StudentLoading>
      ) : null}
      {nodes ? (
        <>
          <GradeTrophy
            key={`${me.id}:${gradeId}`}
            studentId={me.id}
            gradeId={gradeId}
            complete={
              nodes.length > 0 && nodes.every((node) => node.complete === true)
            }
          />
          <section
            className="home-overview"
            aria-label="Bước tiếp theo và tiến độ"
          >
            <div className="home-next">
              <p className="home-eyebrow">
                {reviewing ? 'Ôn lại' : 'Bước tiếp theo'}
              </p>
              {nextUnit ? (
                <>
                  <h2>{nextUnit.title}</h2>
                  <p>
                    {reviewing
                      ? 'Bạn đã hoàn thành các unit đang mở. Cùng ôn lại nhé!'
                      : 'Chọn một trò chơi để tiếp tục hành trình.'}
                  </p>
                  <Link
                    className="btn home-next-action"
                    href={`/units/${nextUnit.id}`}
                  >
                    {reviewing ? 'Ôn lại unit' : 'Mở unit'}{' '}
                    <ArrowRight size={22} aria-hidden />
                  </Link>
                </>
              ) : (
                <>
                  <h2>Chưa có unit để chơi</h2>
                  <p>
                    {nodes.length
                      ? 'Các unit của khối này chưa mở hoặc chưa có nội dung.'
                      : 'Khối này chưa có unit. Hãy quay lại sau nhé!'}
                  </p>
                </>
              )}
            </div>
            <div className="home-weekly">
              <div className="home-weekly-heading">
                <h2>Tiến độ của mình</h2>
                <Link href="/report">
                  Xem báo cáo <ArrowRight size={17} aria-hidden />
                </Link>
              </div>
              {report === undefined ? (
                <StudentLoading>Đang tải tiến độ…</StudentLoading>
              ) : null}
              {report === null ? (
                <p className="muted">Chưa tải được tiến độ tuần này.</p>
              ) : null}
              {report ? (
                <div className="home-weekly-stats">
                  <div>
                    <strong>{report.minutesThisWeek}</strong>
                    <span>phút luyện tuần này</span>
                  </div>
                  <div>
                    <strong>
                      {report.unitsCompleted}/{report.unitsTotal}
                    </strong>
                    <span>unit đã hoàn thành</span>
                  </div>
                  <div>
                    <strong>{report.wordsLearned}</strong>
                    <span>từ đã học</span>
                  </div>
                  <div>
                    <strong className="streak-value">
                      {report.streakDays}
                      <StreakFire days={report.streakDays} />
                    </strong>
                    <span>ngày liên tiếp</span>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
          <div className="home-learning-grid">
            {nodes.length > 0 ? (
              <section className="home-journey" aria-labelledby="journey-title">
                <div className="home-section-heading">
                  <h2 id="journey-title">Các unit</h2>
                  <span>{gradeTitle}</span>
                </div>
                <div className="unit-path">
                  {nodes.map((node, index) => {
                    const enabled = node.open && node.hasContent;
                    const gained = earned.includes(node.id);
                    const featured = node.id === nextUnit?.id && enabled;
                    const inner = (
                      <>
                        <span className="node-number">
                          {enabled ? (
                            node.sortOrder
                          ) : (
                            <LockKeyhole size={21} aria-hidden />
                          )}
                        </span>
                        <span className="node-copy">
                          <strong>{node.title}</strong>
                          <small>
                            {enabled
                              ? node.complete
                                ? 'Đã hoàn thành'
                                : 'Chọn để chơi'
                              : node.open
                                ? 'Chưa có nội dung'
                                : unitLockMessage(node)}
                          </small>
                          {enabled ? (
                            <span className="node-progress" aria-hidden>
                              <motion.span
                                initial={{
                                  width: `${Math.max(0, Math.min(4, previousStars[node.id] ?? node.stars)) * 25}%`,
                                }}
                                animate={{
                                  width: `${Math.max(0, Math.min(4, node.stars)) * 25}%`,
                                }}
                                transition={{
                                  duration: reducedMotion ? 0 : 0.26,
                                }}
                              />
                            </span>
                          ) : null}
                        </span>
                        {enabled ? (
                          <>
                            <motion.span
                              className="node-stars"
                              animate={
                                gained && !reducedMotion
                                  ? { scale: [1, 1.2, 1] }
                                  : { scale: 1 }
                              }
                              transition={{ duration: 0.34, delay: 0.18 }}
                            >
                              <Star size={19} fill="currentColor" aria-hidden />{' '}
                              {node.stars}/4
                            </motion.span>
                            <ChevronRight size={21} aria-hidden />
                          </>
                        ) : null}
                      </>
                    );
                    return (
                      <motion.div
                        key={node.id}
                        className={`path-row ${featured ? 'path-row--featured' : ''}`}
                        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: reducedMotion
                            ? 0
                            : Math.min(index * 0.035, 0.32),
                        }}
                      >
                        {featured ? (
                          <div className="home-featured-unit">
                            <Link
                              className="home-featured-heading"
                              href={`/units/${node.id}`}
                            >
                              <span className="node-number">
                                {node.sortOrder}
                              </span>
                              <span className="node-copy">
                                <strong>{node.title}</strong>
                                <small>
                                  {node.complete
                                    ? 'Đã hoàn thành · Chơi lại'
                                    : 'Chọn một trò chơi để bắt đầu'}
                                </small>
                              </span>
                              <motion.span
                                className="node-stars"
                                animate={
                                  gained && !reducedMotion
                                    ? { scale: [1, 1.2, 1] }
                                    : { scale: 1 }
                                }
                                transition={{
                                  duration: reducedMotion ? 0 : 0.34,
                                }}
                              >
                                <Star
                                  size={19}
                                  fill="currentColor"
                                  aria-hidden
                                />{' '}
                                {node.stars}/4
                              </motion.span>
                              <ChevronRight size={21} aria-hidden />
                            </Link>
                            <span
                              className="node-progress home-featured-progress"
                              aria-hidden
                            >
                              <motion.span
                                initial={{
                                  width: `${Math.max(0, Math.min(4, previousStars[node.id] ?? node.stars)) * 25}%`,
                                }}
                                animate={{
                                  width: `${Math.max(0, Math.min(4, node.stars)) * 25}%`,
                                }}
                                transition={{
                                  duration: reducedMotion ? 0 : 0.26,
                                }}
                              />
                            </span>
                            <div className="home-game-shortcuts">
                              {unitDetail ? (
                                unitDetail.activities.map(
                                  ({ type, available }) => {
                                    const Icon = gameIcons[type];
                                    const status = unitDetail.progress[type];
                                    const copy = (
                                      <>
                                        <Icon size={24} aria-hidden />
                                        <span>
                                          <strong>
                                            {GAME_DETAILS[type].label}
                                          </strong>
                                          <small>
                                            {status?.mastered
                                              ? 'Đã đạt'
                                              : status?.total
                                                ? `${status.percent}% đúng`
                                                : 'Chưa luyện'}
                                          </small>
                                        </span>
                                        {status?.mastered ? (
                                          <Star
                                            size={18}
                                            fill="currentColor"
                                            aria-label="Đã đạt"
                                          />
                                        ) : null}
                                      </>
                                    );
                                    return available ? (
                                      <Link
                                        key={type}
                                        href={`/play/${type}/${node.id}`}
                                      >
                                        {copy}
                                      </Link>
                                    ) : (
                                      <span
                                        className="home-game-off"
                                        key={type}
                                      >
                                        {copy}
                                      </span>
                                    );
                                  },
                                )
                              ) : (
                                <StudentLoading>
                                  Đang tải trò chơi…
                                </StudentLoading>
                              )}
                            </div>
                          </div>
                        ) : enabled ? (
                          <Link
                            href={`/units/${node.id}`}
                            className="node"
                            aria-label={`${node.title}, ${node.stars} trên 4 sao`}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div
                            className="node node--disabled"
                            aria-label={`${node.title}, ${node.open ? 'chưa có nội dung' : 'đang khóa'}`}
                          >
                            {inner}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            <aside className="home-side-rail" aria-label="Học và ôn tập">
              <section className="home-rail-section">
                <p className="home-eyebrow">
                  <RotateCcw size={18} aria-hidden /> Ôn nhanh
                </p>
                <h2>Nhớ lại tối đa 5 từ</h2>
                <p>
                  Chọn từ đúng với nghĩa tiếng Việt. Lượt ôn không làm đổi sao
                  của unit.
                </p>
                {wordbook?.reviewAvailable ? (
                  <Link className="home-rail-action" href="/review">
                    Bắt đầu ôn <ArrowRight size={19} aria-hidden />
                  </Link>
                ) : (
                  <span className="muted">
                    {wordbook === undefined
                      ? 'Đang tải từ…'
                      : wordbook === null
                        ? 'Chưa tải được từ để ôn.'
                        : 'Cần ít nhất 3 từ có nghĩa để ôn.'}
                  </span>
                )}
              </section>
              <section className="home-rail-section">
                <p className="home-eyebrow">
                  <BookText size={18} aria-hidden /> Sổ từ
                </p>
                <h2>Từ của mình</h2>
                {previewWords.length ? (
                  <ul className="home-word-preview">
                    {previewWords.map((word) => (
                      <li key={word.id}>
                        <strong>{word.lemma}</strong>
                        <span>
                          {word.meaningVi || word.categories[0] || 'Từ vựng'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    {wordbook === undefined
                      ? 'Đang tải sổ từ…'
                      : wordbook === null
                        ? 'Chưa tải được sổ từ.'
                        : 'Các từ trong unit đang mở sẽ hiện ở đây.'}
                  </p>
                )}
                <Link className="home-rail-action" href="/wordbook">
                  Mở sổ từ <ArrowRight size={19} aria-hidden />
                </Link>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}
