'use client';

import {
  CorrectAnswerPop,
  EmptyStateArt,
} from '../../components/animations/student-effects';
import { usePreloadAnswerAnimation } from '../../components/animations/student-animation';

import { getResultMood } from '../../lib/result-mood';
import { ResultReaction } from '../../components/animations/result-reaction';

import {
  StudentAnimation,
  StudentLoading,
} from '../../components/animations/student-animation';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookText,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { ExitDialog } from '../../components/PlayUi';
import {
  api,
  ApiError,
  apiUrl,
  getMe,
  speakWord,
  type StudentMe,
} from '../../lib/api';
import {
  reviewSessionKey,
  type ReviewSession,
  type WordbookData,
} from '../../lib/learning';

type Phase = 'loading' | 'intro' | 'playing' | 'result';

export default function ReviewPage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [answerPopKey, setAnswerPopKey] = useState<string | null>(null);
  usePreloadAnswerAnimation(phase === 'playing');
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null,
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [error, setError] = useState('');
  const [audioAvailable, setAudioAvailable] = useState(false);
  const pendingMs = useRef(0);
  const heartbeatTask = useRef<Promise<void> | null>(null);
  const lastTick = useRef(Date.now());
  const heading = useRef<HTMLHeadingElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const key = me?.gradeId ? reviewSessionKey(me.id, me.gradeId) : '';

  const flushTime = useCallback(async () => {
    if (!session) return;
    if (heartbeatTask.current) await heartbeatTask.current;
    while (pendingMs.current >= 1) {
      const delta = Math.min(Math.floor(pendingMs.current), 30_000);
      pendingMs.current -= delta;
      const task = api(`/learning/review/sessions/${session.id}/heartbeat`, {
        method: 'PATCH',
        body: JSON.stringify({ activeMsDelta: delta }),
      })
        .then(() => {})
        .catch((reason) => {
          if (reason instanceof ApiError && reason.status === 403) {
            setAccessBlocked(true);
            setError(reason.message);
            pendingMs.current = 0;
            return;
          }
          pendingMs.current += delta;
          throw new Error('Chưa lưu được thời gian ôn.');
        });
      heartbeatTask.current = task;
      try {
        await task;
      } finally {
        if (heartbeatTask.current === task) heartbeatTask.current = null;
      }
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    setAudioAvailable(
      typeof window.speechSynthesis?.speak === 'function' &&
        typeof window.SpeechSynthesisUtterance === 'function',
    );
    (async () => {
      const student = await getMe();
      if (!student) return router.replace('/login');
      if (!student.gradeId) return router.replace('/onboarding/grade');
      if (!active) return;
      setMe(student);
      const savedKey = reviewSessionKey(student.id, student.gradeId);
      const savedId = sessionStorage.getItem(savedKey);
      if (savedId) {
        try {
          const saved = await api<ReviewSession>(
            `/learning/review/sessions/${savedId}`,
          );
          if (!active) return;
          if (!saved.endedAt) {
            setSession(saved);
            setAvailable(true);
            const next = saved.questions.findIndex(
              (question) => question.correct === null,
            );
            if (next < 0) {
              setPhase('result');
              try {
                await api(`/learning/review/sessions/${saved.id}/end`, {
                  method: 'POST',
                });
                sessionStorage.removeItem(savedKey);
                if (active)
                  setSession({ ...saved, endedAt: new Date().toISOString() });
              } catch {
                if (active)
                  setError('Chưa kết thúc được lượt ôn. Hãy thử lại.');
              }
            } else {
              setIndex(next);
              setPhase('playing');
            }
            return;
          }
        } catch {
          // A removed or no-longer-available round cannot be resumed.
        }
        sessionStorage.removeItem(savedKey);
      }
      const wordbook = await api<WordbookData>('/learning/wordbook');
      if (active) {
        setAvailable(wordbook.reviewAvailable);
        setPhase('intro');
      }
    })().catch(() => {
      if (active) {
        setError('Chưa mở được Ôn nhanh. Hãy thử lại.');
        setPhase('intro');
      }
    });
    return () => {
      active = false;
      window.speechSynthesis?.cancel();
    };
  }, [router]);

  useEffect(() => {
    if (phase !== 'playing' || !session || accessBlocked) return;
    lastTick.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const delta = Math.min(now - lastTick.current, 2000);
      lastTick.current = now;
      if (
        !exitOpen &&
        document.visibilityState === 'visible' &&
        document.hasFocus()
      )
        pendingMs.current += delta;
      if (pendingMs.current >= 15_000) void flushTime().catch(() => {});
    };
    const interval = window.setInterval(tick, 1000);
    const pagehide = () => {
      tick();
      const delta = Math.min(Math.floor(pendingMs.current), 30_000);
      if (delta < 1) return;
      pendingMs.current -= delta;
      void fetch(apiUrl(`/learning/review/sessions/${session.id}/heartbeat`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-App-Request': '1' },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({ activeMsDelta: delta }),
      });
    };
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [phase, session, flushTime, exitOpen, accessBlocked]);

  useEffect(() => {
    if (phase === 'playing') heading.current?.focus();
    window.speechSynthesis?.cancel();
  }, [index, phase]);

  async function start() {
    if (busy || (!available && phase !== 'result')) return;
    setBusy(true);
    setError('');
    try {
      if (phase === 'result' && session && !session.endedAt) {
        await api(`/learning/review/sessions/${session.id}/end`, {
          method: 'POST',
        });
        if (key) sessionStorage.removeItem(key);
      }
      const created = await api<ReviewSession>('/learning/review/sessions', {
        method: 'POST',
      });
      if (key) sessionStorage.setItem(key, created.id);
      pendingMs.current = 0;
      setSession(created);
      setIndex(0);
      setPhase('playing');
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 400 &&
        reason.message.startsWith('Chưa đủ từ có nghĩa tiếng Việt để ôn')
      ) {
        setAvailable(false);
        setSession(null);
        setPhase('intro');
      }
      setError(
        reason instanceof Error ? reason.message : 'Chưa bắt đầu được lượt ôn.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function answer(wordId: string) {
    const question = session?.questions[index];
    if (!question || question.correct !== null || busy || accessBlocked) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{
        selectedWordId: string;
        correctWordId: string;
        correct: boolean;
      }>(`/learning/review/sessions/${session.id}/answers`, {
        method: 'POST',
        body: JSON.stringify({ questionId: question.id, wordId }),
      });
      setAnswerPopKey(result.correct ? `${session.id}:${question.id}` : null);
      setSession(
        (current) =>
          current && {
            ...current,
            questions: current.questions.map((item) =>
              item.id === question.id
                ? {
                    ...item,
                    selectedWordId: result.selectedWordId,
                    correctWordId: result.correctWordId,
                    correct: result.correct,
                  }
                : item,
            ),
          },
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(
        reason instanceof Error ? reason.message : 'Chưa lưu được câu trả lời.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!session || busy) return;
    if (index + 1 < session.questions.length) {
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    try {
      await flushTime();
      await api(`/learning/review/sessions/${session.id}/end`, {
        method: 'POST',
      });
      if (key) sessionStorage.removeItem(key);
      setSession({ ...session, endedAt: new Date().toISOString() });
      setCompletedSessionId(session.id);
      setPhase('result');
    } catch {
      setError('Chưa kết thúc được lượt ôn. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  function requestExit() {
    if (busy) return;
    window.speechSynthesis?.cancel();
    setExitOpen(true);
  }

  function stay() {
    if (!busy) setExitOpen(false);
  }

  async function exit() {
    if (busy) return;
    setBusy(true);
    try {
      await flushTime();
      if (session)
        await api(`/learning/review/sessions/${session.id}/end`, {
          method: 'POST',
        });
      if (key) sessionStorage.removeItem(key);
      window.speechSynthesis?.cancel();
      setExitOpen(false);
      router.push(me?.gradeId ? `/path/${me.gradeId}` : '/');
    } catch {
      setError('Chưa thoát được lượt ôn. Hãy thử lại.');
      setExitOpen(false);
      setBusy(false);
    }
  }

  const question = session?.questions[index];
  const correctChoice = question?.choices.find(
    (choice) => choice.id === question.correctWordId,
  );
  const score =
    session?.questions.filter((item) => item.correct === true).length ?? 0;

  const resultMood = getResultMood(score, session?.questions.length ?? 0);

  return (
    <main className="review-screen">
      {phase === 'loading' ? (
        <StudentLoading>Đang mở Ôn nhanh…</StudentLoading>
      ) : null}
      {phase === 'intro' ? (
        <section
          className={`review-intro${available === false ? ' review-unavailable' : ''}`}
        >
          <Link
            className="review-back"
            href={me?.gradeId ? `/path/${me.gradeId}` : '/'}
          >
            <ArrowLeft size={20} aria-hidden /> Hành trình
          </Link>
          {available === false ? <EmptyStateArt /> : null}
          <p className="learning-kicker">Ôn nhanh</p>
          <h1>
            {available === false
              ? 'Chưa đủ từ có nghĩa để ôn.'
              : available === null
                ? 'Chưa mở được Ôn nhanh'
                : 'Nhớ lại những từ mình đã học'}
          </h1>
          {available === true ? (
            <p>
              Chọn từ tiếng Anh đúng với nghĩa tiếng Việt. Tối đa 5 câu, không
              ảnh hưởng sao của unit.
            </p>
          ) : (
            <>
              <p>
                {available === false
                  ? 'Cần ít nhất 3 từ có nghĩa tiếng Việt khác nhau trong các unit đang mở. Học thêm trong unit hoặc xem Sổ từ nhé.'
                  : 'Mình có thể vào học hoặc mở Sổ từ trong lúc chờ nhé.'}
              </p>
              <p className="review-note">
                Ôn nhanh không ảnh hưởng sao của unit.
              </p>
            </>
          )}
          {accessBlocked ? (
            <p className="game-alert" role="alert">
              Nội dung đang khóa. Câu đã trả lời vẫn được giữ.{' '}
              <button
                className="tool-button"
                type="button"
                onClick={() => setExitOpen(true)}
              >
                Về hành trình
              </button>
            </p>
          ) : null}
          {error ? (
            <p className="bad" role="alert">
              {error}
            </p>
          ) : null}
          {available === true ? (
            <button
              className="btn review-main-action"
              type="button"
              disabled={busy}
              onClick={() => void start()}
            >
              {busy ? 'Đang chuẩn bị…' : 'Bắt đầu'}{' '}
              <ArrowRight size={22} aria-hidden />
            </button>
          ) : (
            <div className="review-unavailable-actions">
              <Link
                className="btn"
                href={me?.gradeId ? `/path/${me.gradeId}` : '/'}
              >
                Về hành trình <ArrowRight size={22} aria-hidden />
              </Link>
              <Link className="btn ghost" href="/wordbook">
                <BookText size={22} aria-hidden /> Mở sổ từ
              </Link>
            </div>
          )}
        </section>
      ) : null}
      {phase === 'playing' && session && question ? (
        <>
          <header className="review-header">
            <button
              ref={exitButton}
              className="icon-button"
              type="button"
              aria-label="Thoát lượt ôn"
              title="Thoát"
              disabled={busy}
              onClick={requestExit}
            >
              <X size={24} aria-hidden />
            </button>
            <span>Ôn nhanh</span>
            <strong>
              {index + 1}/{session.questions.length}
            </strong>
          </header>
          <div
            className="review-progress"
            aria-label={`Câu ${index + 1} trên ${session.questions.length}`}
          >
            <span
              style={{
                width: `${((index + 1) / session.questions.length) * 100}%`,
              }}
            />
          </div>
          <AnimatePresence mode="wait">
            <motion.section
              key={question.id}
              className="review-question"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
            >
              <p className="learning-kicker">Nghĩa của từ nào?</p>
              <h1 ref={heading} tabIndex={-1}>
                {question.meaningVi}
              </h1>
              <div className="review-choices">
                {question.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`review-choice ${question.correct !== null && choice.id === question.correctWordId ? 'review-choice--correct' : ''} ${question.correct === false && choice.id === question.selectedWordId ? 'review-choice--wrong' : ''}`}
                    disabled={
                      question.correct !== null || busy || accessBlocked
                    }
                    onClick={() => void answer(choice.id)}
                  >
                    {choice.lemma}
                  </button>
                ))}
              </div>
            </motion.section>
          </AnimatePresence>
          {error ? (
            <p className="bad" role="alert">
              {error}
            </p>
          ) : null}
          {question.correct !== null ? (
            <div className="answer-pop-anchor">
              <CorrectAnswerPop
                answerKey={
                  question.correct &&
                  answerPopKey === `${session.id}:${question.id}`
                    ? answerPopKey
                    : null
                }
              />
              <div
                className={`review-feedback ${question.correct ? 'review-feedback--good' : ''}`}
                role="status"
                aria-live="polite"
              >
                <strong>
                  {question.correct
                    ? 'Đúng rồi!'
                    : `Từ đúng là ${correctChoice?.lemma ?? ''}.`}
                </strong>
                {correctChoice ? (
                  <button
                    type="button"
                    className="review-hear"
                    onClick={() => speakWord(correctChoice.lemma)}
                    title={
                      audioAvailable
                        ? 'Nghe phát âm'
                        : 'Thiết bị chưa hỗ trợ âm thanh'
                    }
                    disabled={!audioAvailable}
                  >
                    <Volume2 size={21} aria-hidden /> Nghe từ
                  </button>
                ) : null}
                <button
                  className="btn review-main-action"
                  type="button"
                  disabled={busy}
                  onClick={() => void next()}
                >
                  {index + 1 === session.questions.length
                    ? 'Xem kết quả'
                    : 'Tiếp tục'}{' '}
                  <ArrowRight size={21} aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
          <ExitDialog
            open={exitOpen}
            busy={busy}
            onStay={stay}
            onLeave={() => void exit()}
            returnFocusRef={exitButton}
            title="Rời Ôn nhanh?"
            description="Câu đã trả lời vẫn được lưu. Câu chưa trả lời sẽ không tính vào lượt này."
            leaveLabel="Về hành trình"
          />
        </>
      ) : null}
      {phase === 'result' && session ? (
        <motion.section
          className="review-result"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.3 }}
        >
          {completedSessionId === session.id && resultMood !== 'tryAgain' ? (
            <div className="result-celebration">
              <StudentAnimation
                asset="confetti-burst"
                trigger={session.id}
                className="result-confetti"
              />
            </div>
          ) : null}
          <p className="learning-kicker">Ôn nhanh xong rồi</p>
          <h1>
            {score}/{session.questions.length} từ đúng
          </h1>
          <ResultReaction mood={resultMood} sessionId={session.id} />
          <p>Mình có thể ôn lại bất cứ lúc nào.</p>
          <div className="review-result-actions">
            <button
              className="btn"
              type="button"
              onClick={() => void start()}
              disabled={busy}
            >
              <RotateCcw size={21} aria-hidden /> Ôn lại
            </button>
            <Link
              className="btn ghost"
              href={me?.gradeId ? `/path/${me.gradeId}` : '/'}
            >
              Về hành trình
            </Link>
          </div>
          {error ? (
            <p className="bad" role="alert">
              {error}
            </p>
          ) : null}
        </motion.section>
      ) : null}
    </main>
  );
}
