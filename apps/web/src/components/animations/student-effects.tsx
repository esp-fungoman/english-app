'use client';

import { Flame, Inbox, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StudentAnimation } from './student-animation';

export function CorrectAnswerPop({ answerKey }: { answerKey: string | null }) {
  if (!answerKey) return null;
  return (
    <StudentAnimation
      key={answerKey}
      asset="right-answer"
      trigger={answerKey}
      className="correct-answer-pop"
      durationMs={1000}
      completion="fallback"
    />
  );
}

export function StreakFire({ days }: { days: number }) {
  if (days < 1) return null;
  return (
    <StudentAnimation
      asset="streak-fire"
      className="streak-fire"
      durationMs={3000}
      completion="fallback"
      fallback={<Flame aria-hidden="true" />}
    />
  );
}

// The selected No Data asset exceeds the 20 KB budget; retain the agreed icon fallback.
export function EmptyStateArt() {
  return (
    <span className="empty-state-art" aria-hidden="true">
      <Inbox />
    </span>
  );
}

const trophiesSeenInPage = new Set<string>();
export function GradeTrophy({
  studentId,
  gradeId,
  complete,
}: {
  studentId: string;
  gradeId: string;
  complete: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!complete) return;
    const key = `english-grade-trophy-seen:${studentId}:${gradeId}`;
    if (trophiesSeenInPage.has(key)) return;
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {
      /* Use the page set. */
    }
    trophiesSeenInPage.add(key);
    setVisible(true);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* Celebration remains usable. */
    }
  }, [complete, studentId, gradeId]);
  if (!visible || !complete) return null;
  return (
    <section className="grade-trophy" aria-label="Hoàn thành cả khối">
      <StudentAnimation
        asset="reward-trophy"
        className="grade-trophy-art"
        durationMs={3000}
        completion="fallback"
        fallback={<Trophy aria-hidden="true" />}
      />
      <p>Hoàn thành cả khối! 🏆</p>
    </section>
  );
}
