'use client';

import {
  StreakFire,
  EmptyStateArt,
} from '../../components/animations/student-effects';

import { StudentLoading } from '../../components/animations/student-animation';

import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StudentNav } from '../../components/student-nav';
import { api, getMe, type StudentMe } from '../../lib/api';
import { GAME_DETAILS, type Activity } from '../../lib/game';
import type { WordbookData } from '../../lib/learning';

type Report = {
  studentName: string;
  minutesThisWeek: number;
  dailyActivity: { date: string; minutes: number }[];
  unitsCompleted: number;
  unitsTotal: number;
  wordsLearned: number;
  streakDays: number;
  activityPercents: Record<string, number>;
  weakestActivity: Activity | null;
  tip: string;
};

export default function ReportPage() {
  const router = useRouter();
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  const [me, setMe] = useState<StudentMe | null>(null);
  const [reviewAvailable, setReviewAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await getMe();
      if (!me) {
        router.replace('/login');
        return;
      }
      if (!me.gradeId) {
        router.replace('/onboarding/grade');
        return;
      }
      setMe(me);
      const report = await api<Report>('/reports/weekly');
      setData(report);
      api<WordbookData>('/learning/wordbook')
        .then((wordbook) => setReviewAvailable(wordbook.reviewAvailable))
        .catch(() => {});
    })().catch((e) => setErr(String(e)));
  }, [router]);

  if (!me)
    return (
      <main className="report-screen">
        <StudentLoading>Đang tải báo cáo…</StudentLoading>
        {err ? (
          <p className="bad" role="alert">
            {err}
          </p>
        ) : null}
      </main>
    );
  return (
    <main className="report-screen">
      <StudentNav me={me} />
      {err ? (
        <p className="bad" role="alert">
          {err}
        </p>
      ) : null}
      {!data ? <StudentLoading>Đang tải báo cáo…</StudentLoading> : null}
      {data ? (
        <>
          <header className="report-heading">
            <p className="brand-pill">Tuần này</p>
            <h1>Báo cáo của {data.studentName}</h1>
          </header>
          <dl className="report-stats">
            <div>
              <dt>Phút luyện</dt>
              <dd>{data.minutesThisWeek}</dd>
            </div>
            <div>
              <dt>Unit hoàn thành</dt>
              <dd>
                {data.unitsCompleted}/{data.unitsTotal}
              </dd>
            </div>
            <div>
              <dt>Từ đã học</dt>
              <dd>{data.wordsLearned}</dd>
            </div>
            <div>
              <dt>Ngày liên tiếp</dt>
              <dd className="streak-value">
                {data.streakDays}
                <StreakFire days={data.streakDays} />
              </dd>
            </div>
          </dl>
          <section className="report-week" aria-labelledby="report-week-title">
            <div className="report-section-heading">
              <h2 id="report-week-title">Mỗi ngày một chút</h2>
              <span>Phút luyện trong tuần</span>
            </div>
            <div className="report-week-bars">
              {data.dailyActivity.map((day, index) => (
                <div
                  key={day.date}
                  className="report-week-day"
                  aria-label={`${['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'][index]}: ${day.minutes} phút`}
                >
                  <span className="report-week-value">{day.minutes || ''}</span>
                  <span className="report-week-track">
                    <span
                      style={{
                        height: `${Math.max(day.minutes ? 10 : 0, (day.minutes / Math.max(1, ...data.dailyActivity.map((entry) => entry.minutes))) * 100)}%`,
                      }}
                    />
                  </span>
                  <span>
                    {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][index]}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section
            className="report-activities"
            aria-labelledby="report-activities-title"
          >
            <h2 id="report-activities-title">Các trò chơi</h2>
            {Object.keys(data.activityPercents).length === 0 ? (
              <div className="report-empty-art">
                <EmptyStateArt />
                <p className="muted">Chưa có lượt chơi.</p>
              </div>
            ) : null}
            <div className="report-activity-list">
              {Object.entries(data.activityPercents).map(
                ([activity, percent]) => (
                  <div className="report-activity" key={activity}>
                    <div className="report-activity-label">
                      <strong>
                        {GAME_DETAILS[activity as Activity]?.label ?? activity}
                      </strong>
                      <span>{percent}%</span>
                    </div>
                    <div
                      className="report-track"
                      role="img"
                      aria-label={`${percent}% đúng`}
                    >
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, percent))}%`,
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
          <p className="report-tip">{data.tip}</p>
          <div className="report-next-action">
            <div>
              <strong>
                {reviewAvailable
                  ? 'Ôn lại những từ mình đã học'
                  : 'Tiếp tục hành trình'}
              </strong>
              <span>
                {reviewAvailable
                  ? 'Một lượt ôn ngắn, không làm đổi sao của unit.'
                  : 'Chọn một trò chơi trong unit đang mở.'}
              </span>
            </div>
            <Link
              href={
                reviewAvailable
                  ? '/review'
                  : me.gradeId
                    ? `/path/${me.gradeId}`
                    : '/'
              }
            >
              {reviewAvailable ? <RotateCcw size={20} aria-hidden /> : null}
              {reviewAvailable ? 'Ôn nhanh' : 'Vào học'}{' '}
              <ArrowRight size={19} aria-hidden />
            </Link>
          </div>
        </>
      ) : null}
    </main>
  );
}
