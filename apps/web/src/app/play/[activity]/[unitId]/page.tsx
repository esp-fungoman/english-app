'use client';

import { CorrectAnswerPop } from '../../../../components/animations/student-effects';
import { usePreloadAnswerAnimation } from '../../../../components/animations/student-animation';

import { getResultMood } from '../../../../lib/result-mood';
import { ResultReaction } from '../../../../components/animations/result-reaction';

import {
  StudentAnimation,
  StudentLoading,
} from '../../../../components/animations/student-animation';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'motion/react';
import {
  ArrowLeft,
  BookText,
  Check,
  CircleHelp,
  Grid2X2,
  ListFilter,
  RotateCcw,
  SpellCheck,
  Star,
  Volume2,
} from 'lucide-react';
import { GameQuestion } from '../../../../components/GameQuestion';
import { unitLockMessage } from '../../../../lib/unit-access';
import { GroupBoard } from '../../../../components/GroupBoard';
import {
  ExitDialog,
  HowToPlayDialog,
  PlayFeedback,
  PlayHeader,
} from '../../../../components/PlayUi';
import { ApiError, api, apiUrl, getMe } from '../../../../lib/api';
import {
  GAME_DETAILS,
  letterChoices,
  isGameTipDismissed,
  setGameTipDismissed,
  sessionKey,
  type Activity,
  type AnswerResult,
  type GameSession,
} from '../../../../lib/game';

type Phase = 'loading' | 'intro' | 'playing' | 'result';
const gameIcons = {
  group: Grid2X2,
  odd_letter: ListFilter,
  scramble: SpellCheck,
  listen_spell: Volume2,
};

function canSpeak() {
  return (
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

export default function PlayPage() {
  const { activity: rawActivity, unitId } = useParams<{
    activity: string;
    unitId: string;
  }>();
  const activity = rawActivity as Activity;
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [answerPopKey, setAnswerPopKey] = useState<string | null>(null);
  usePreloadAnswerAnimation(phase === 'playing');
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null,
  );
  const [studentId, setStudentId] = useState('');
  const [unitTitle, setUnitTitle] = useState('');
  const [introMode, setIntroMode] = useState<'single' | 'board'>('single');
  const [canStart, setCanStart] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [groupWordCount, setGroupWordCount] = useState<number | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [exitOpen, setExitOpen] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [tipOpen, setTipOpen] = useState(false);
  const [wasMastered, setWasMastered] = useState<boolean | null>(null);
  const [earnedStar, setEarnedStar] = useState(false);
  const pendingMs = useRef(0);
  const questionMs = useRef(0);
  const tickActive = useRef<() => void>(() => {});
  const heartbeatTask = useRef<Promise<void> | null>(null);
  const masteryRefresh = useRef<Promise<void> | null>(null);
  const speechTimer = useRef<number | null>(null);
  const speechRun = useRef(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const introHelpButton = useRef<HTMLButtonElement>(null);
  const tipReturnFocus = useRef<HTMLButtonElement | null>(null);
  const autoTipShownFor = useRef('');

  const key =
    studentId && Object.hasOwn(GAME_DETAILS, activity)
      ? sessionKey(studentId, unitId, activity)
      : '';
  const placementsKey = key ? `${key}:placements` : '';
  const item = session?.items[index];
  const tileDraftKey =
    item && session
      ? `${key}:tiles:${session.id}:${item.attemptId}${activity === 'scramble' ? ':alphabet' : ''}`
      : '';

  const flushHeartbeat = useCallback(async () => {
    if (!session) return;
    if (heartbeatTask.current) await heartbeatTask.current;
    if (pendingMs.current < 1) return;
    const delta = Math.min(Math.floor(pendingMs.current), 30_000);
    pendingMs.current -= delta;
    const task = (async () => {
      try {
        await api(`/play/sessions/${session.id}/heartbeat`, {
          method: 'PATCH',
          body: JSON.stringify({ activeMsDelta: delta }),
        });
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 403) {
          setAccessBlocked(true);
          setError(reason.message);
          pendingMs.current = 0;
        } else pendingMs.current += delta;
      }
    })();
    heartbeatTask.current = task;
    await task;
    if (heartbeatTask.current === task) heartbeatTask.current = null;
  }, [session]);

  useEffect(() => {
    if (!Object.hasOwn(GAME_DETAILS, activity)) {
      setError('Trò chơi không tồn tại');
      setPhase('intro');
      return;
    }
    let cancelled = false;
    (async () => {
      const me = await getMe();
      if (!me) return router.replace('/login');
      if (!me.gradeId) return router.replace('/onboarding/grade');
      const unit = await api<{
        title: string;
        gradeId: string;
        groupIncludePreviousUnits: boolean;
        groupWordCount: number;
        open: boolean;
        opensAt: string | null;
        lockReason: string | null;
        groupMode: 'single' | 'board';
        activities: { type: Activity; available: boolean }[];
        progress: Record<Activity, { mastered: boolean }>;
      }>(`/units/${unitId}`);
      if (cancelled) return;
      const available =
        unit.open &&
        unit.activities.some(
          (entry) => entry.type === activity && entry.available,
        );
      setCanStart(available);
      setLockMessage(unit.open ? '' : unitLockMessage(unit));
      setUnitTitle(unit.title);
      setGroupWordCount(
        activity === 'group' && unit.groupIncludePreviousUnits
          ? unit.groupWordCount
          : null,
      );
      setIntroMode(unit.groupMode);
      setWasMastered(unit.progress?.[activity]?.mastered ?? null);
      setStudentId(me.id);
      const speechReady = canSpeak();
      setAudioAvailable(speechReady);
      if (
        (activity === 'listen_spell' || activity === 'scramble') &&
        !speechReady
      ) {
        setPhase('intro');
        return;
      }
      const savedId = sessionStorage.getItem(
        sessionKey(me.id, unitId, activity),
      );
      if (savedId) {
        try {
          const saved = await api<GameSession>(`/play/sessions/${savedId}`);
          if (
            !cancelled &&
            saved.unitId === unitId &&
            saved.activityType === activity &&
            !saved.endedAt
          ) {
            setSession(saved);
            if (saved.groupMode === 'board') {
              if (saved.items.every((entry) => entry.correct !== null)) {
                setPlacements(
                  Object.fromEntries(
                    saved.items
                      .map((entry) => [
                        entry.attemptId,
                        entry.selectedCategoryId,
                      ])
                      .filter((entry) => entry[1]),
                  ) as Record<string, string>,
                );
                sessionStorage.removeItem(
                  `${sessionKey(me.id, unitId, activity)}:placements`,
                );
              } else {
                let draft: Record<string, string> = {};
                try {
                  draft = JSON.parse(
                    sessionStorage.getItem(
                      `${sessionKey(me.id, unitId, activity)}:placements`,
                    ) ?? '{}',
                  );
                } catch {
                  // Ignore a damaged local draft.
                }
                const ids = new Set(
                  saved.items.map((entry) => entry.attemptId),
                );
                const groups = new Set(
                  saved.boardGroups?.map((group) => group.id),
                );
                setPlacements(
                  Object.fromEntries(
                    Object.entries(draft).filter(
                      ([id, groupId]) => ids.has(id) && groups.has(groupId),
                    ),
                  ),
                );
              }
            }
            const next = saved.items.findIndex((item) => item.correct === null);
            setIndex(next < 0 ? saved.items.length : next);
            setPhase('playing');
            return;
          }
        } catch {
          // A deleted or expired session starts fresh.
        }
        sessionStorage.removeItem(sessionKey(me.id, unitId, activity));
        sessionStorage.removeItem(
          `${sessionKey(me.id, unitId, activity)}:placements`,
        );
      }
      if (!cancelled) {
        if (!available)
          setError(
            unit.open && activity === 'group' && unit.groupMode === 'board'
              ? 'Bảng phân nhóm chưa có đủ từ và nhóm để chơi. Bạn quay lại unit nhé.'
              : 'Trò chơi này chưa mở. Bạn hãy chọn trò khác nhé.',
          );
        setPhase('intro');
      }
    })().catch((reason) => {
      if (!cancelled) {
        setError(
          reason instanceof Error ? reason.message : 'Không mở được trò chơi',
        );
        setPhase('intro');
      }
    });
    return () => {
      cancelled = true;
      speechRun.current += 1;
      window.speechSynthesis?.cancel();
      if (speechTimer.current) window.clearTimeout(speechTimer.current);
    };
  }, [activity, unitId, router]);

  useEffect(() => {
    if (phase !== 'playing' || accessBlocked || !session || session.endedAt)
      return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const delta = Math.min(now - last, 2000);
      last = now;
      if (
        !exitOpen &&
        !tipOpen &&
        document.visibilityState === 'visible' &&
        document.hasFocus()
      ) {
        pendingMs.current += delta;
        questionMs.current += delta;
      }
      if (pendingMs.current >= 15_000) void flushHeartbeat();
    };
    tickActive.current = tick;
    const interval = window.setInterval(tick, 1000);
    const pagehide = () => {
      tick();
      if (pendingMs.current < 1) return;
      const delta = Math.min(Math.floor(pendingMs.current), 30_000);
      pendingMs.current -= delta;
      void fetch(apiUrl(`/play/sessions/${session.id}/heartbeat`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-App-Request': '1' },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({ activeMsDelta: delta }),
      });
    };
    window.addEventListener('pagehide', pagehide);
    return () => {
      tickActive.current = () => {};
      window.clearInterval(interval);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [phase, session, flushHeartbeat, exitOpen, tipOpen, accessBlocked]);

  useEffect(() => {
    if (
      phase !== 'intro' ||
      !studentId ||
      !Object.hasOwn(GAME_DETAILS, activity)
    )
      return;
    const visit = `${studentId}:${unitId}:${activity}`;
    if (autoTipShownFor.current === visit) return;
    autoTipShownFor.current = visit;
    if (!isGameTipDismissed(studentId, activity)) {
      tipReturnFocus.current = introHelpButton.current;
      setTipOpen(true);
    }
  }, [phase, studentId, unitId, activity]);

  useEffect(() => {
    if (phase === 'playing') questionHeading.current?.focus();
    if (phase === 'result') resultHeading.current?.focus();
  }, [index, phase]);

  useEffect(() => {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    if (speechTimer.current) window.clearTimeout(speechTimer.current);
    speechTimer.current = null;
    setSpeaking(false);
    setHeard(false);
    setAudioError(false);
  }, [index, phase]);

  useEffect(() => {
    if (
      !tileDraftKey ||
      !item ||
      item.correct !== null ||
      (activity !== 'scramble' && activity !== 'listen_spell')
    )
      return;
    const { bank, slots } = letterChoices(activity, item.prompt);
    try {
      const saved = JSON.parse(sessionStorage.getItem(tileDraftKey) ?? '[]');
      if (
        Array.isArray(saved) &&
        bank &&
        saved.length <= slots &&
        saved.every(
          (value) =>
            Number.isInteger(value) && value >= 0 && value < bank.length,
        ) &&
        (activity === 'scramble' || new Set(saved).size === saved.length)
      ) {
        setPicked(saved);
        return;
      }
    } catch {
      // Ignore an invalid local draft.
    }
    setPicked([]);
  }, [tileDraftKey, item?.attemptId, activity]);

  async function start() {
    if (busy || !studentId || !canStart || accessBlocked) return;
    if (
      (activity === 'listen_spell' || activity === 'scramble') &&
      !canSpeak()
    ) {
      setAudioAvailable(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (phase === 'result' && masteryRefresh.current) {
        await masteryRefresh.current;
      }
      if (
        phase === 'playing' &&
        session?.groupMode === 'board' &&
        session.items.every((entry) => entry.correct !== null)
      ) {
        tickActive.current();
        await flushHeartbeat();
        await api(`/play/sessions/${session.id}/end`, { method: 'POST' });
        try {
          const unit = await api<{
            progress: Record<Activity, { mastered: boolean }>;
          }>(`/units/${unitId}`);
          setWasMastered(unit.progress?.[activity]?.mastered ?? null);
        } catch {
          setWasMastered(null);
        }
      }
      const created = await api<GameSession>('/play/sessions', {
        method: 'POST',
        body: JSON.stringify({ unitId, activityType: activity }),
      });
      sessionStorage.setItem(key, created.id);
      sessionStorage.removeItem(placementsKey);
      pendingMs.current = 0;
      questionMs.current = 0;
      setSession(created);
      setPlacements({});
      setIndex(0);
      setPicked([]);
      setFeedback(null);
      setEarnedStar(false);
      setAccessBlocked(false);
      setPhase('playing');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(reason instanceof Error ? reason.message : 'Không bắt đầu được');
    } finally {
      setBusy(false);
    }
  }

  function speak() {
    const item = session?.items[index];
    const word = String(item?.prompt.speechText ?? item?.prompt.lemma ?? '');
    if (!word || !canSpeak()) {
      setAudioError(true);
      setError(
        'Thiết bị này chưa hỗ trợ đọc từ. Hãy thử trình duyệt khác nhé.',
      );
      return;
    }
    const run = ++speechRun.current;
    window.speechSynthesis.cancel();
    if (speechTimer.current) window.clearTimeout(speechTimer.current);
    setError('');
    setAudioError(false);
    setHeard(true);
    setSpeaking(true);
    const parts =
      activity === 'listen_spell' ? [word, ...word.split('')] : [word];
    const finishSpeech = () => {
      if (run !== speechRun.current) return;
      if (speechTimer.current) window.clearTimeout(speechTimer.current);
      speechTimer.current = null;
      setSpeaking(false);
    };
    const failSpeech = (message: string) => {
      if (run !== speechRun.current) return;
      speechRun.current += 1;
      window.speechSynthesis.cancel();
      if (speechTimer.current) window.clearTimeout(speechTimer.current);
      speechTimer.current = null;
      setSpeaking(false);
      setHeard(false);
      setAudioError(true);
      setError(message);
    };
    parts.forEach((part, partIndex) => {
      // Some voices announce uppercase input as "capital A".
      const utterance = new SpeechSynthesisUtterance(
        partIndex === 0 ? part : part.toLowerCase(),
      );
      utterance.lang = 'en-US';
      utterance.rate = partIndex === 0 ? 0.82 : 0.72;
      if (partIndex === parts.length - 1) utterance.onend = finishSpeech;
      utterance.onerror = () =>
        failSpeech(
          'Không phát được âm thanh. Hãy thử lại hoặc dùng trình duyệt khác nhé.',
        );
      window.speechSynthesis.speak(utterance);
    });
    speechTimer.current = window.setTimeout(
      () => failSpeech('Âm thanh chưa phát xong. Hãy thử nghe lại nhé.'),
      Math.max(6000, parts.length * 1500),
    );
  }

  async function answer(value: Record<string, unknown>): Promise<boolean> {
    if (
      !session ||
      busy ||
      feedback ||
      index >= session.items.length ||
      (audioError && (activity === 'scramble' || activity === 'listen_spell'))
    )
      return false;
    tickActive.current();
    setBusy(true);
    setError('');
    try {
      const item = session.items[index];
      const result = await api<AnswerResult>(
        `/play/attempts/${item.attemptId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            answer: value,
            durationMs: Math.floor(questionMs.current),
          }),
        },
      );
      setSession((current) =>
        current
          ? {
              ...current,
              items: current.items.map((entry, position) =>
                position === index
                  ? {
                      ...entry,
                      correct: result.correct,
                      correction: result.correction,
                    }
                  : entry,
              ),
            }
          : current,
      );
      setFeedback(result);
      setAnswerPopKey(result.correct ? `${session.id}:${result.id}` : null);
      if (tileDraftKey) sessionStorage.removeItem(tileDraftKey);
      void flushHeartbeat();
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Chưa lưu được câu trả lời. Thử lại nhé.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function placeWord(attemptId: string, categoryId: string | null) {
    if (
      !session ||
      busy ||
      session.items.every((entry) => entry.correct !== null)
    )
      return;
    setPlacements((current) => {
      const next = { ...current };
      if (categoryId) next[attemptId] = categoryId;
      else delete next[attemptId];
      sessionStorage.setItem(placementsKey, JSON.stringify(next));
      return next;
    });
  }

  async function checkBoard() {
    if (!session || busy || session.groupMode !== 'board') return;
    if (session.items.some((entry) => !placements[entry.attemptId])) return;
    tickActive.current();
    setBusy(true);
    setError('');
    try {
      const recorded = await api<GameSession>(
        `/play/sessions/${session.id}/group-board/submit`,
        {
          method: 'POST',
          body: JSON.stringify({
            answers: session.items.map((entry) => ({
              attemptId: entry.attemptId,
              categoryId: placements[entry.attemptId],
            })),
          }),
        },
      );
      setSession(recorded);
      setAnswerPopKey(
        recorded.items.some((entry) => entry.correct === true)
          ? `${session.id}:board`
          : null,
      );
      setPlacements(
        Object.fromEntries(
          recorded.items
            .map((entry) => [entry.attemptId, entry.selectedCategoryId])
            .filter((entry) => entry[1]),
        ) as Record<string, string>,
      );
      sessionStorage.removeItem(placementsKey);
      void flushHeartbeat();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Chưa kiểm tra được. Thử lại nhé.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!session || busy) return;
    tickActive.current();
    setBusy(true);
    setError('');
    await flushHeartbeat();
    try {
      await api(`/play/sessions/${session.id}/end`, { method: 'POST' });
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(placementsKey);
      if (tileDraftKey) sessionStorage.removeItem(tileDraftKey);
      setSession({ ...session, endedAt: new Date().toISOString() });
      setCompletedSessionId(session.id);
      setPhase('result');
      masteryRefresh.current = api<{
        progress: Record<Activity, { mastered: boolean }>;
      }>(`/units/${unitId}`)
        .then((unit) => {
          const mastered = unit.progress?.[activity]?.mastered;
          setEarnedStar(wasMastered === false && mastered === true);
          setWasMastered(typeof mastered === 'boolean' ? mastered : null);
        })
        .catch(() => {
          setEarnedStar(false);
          setWasMastered(null);
        });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Chưa kết thúc được vòng chơi. Thử lại nhé.',
      );
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!session || busy) return;
    if (index + 1 >= session.items.length) {
      void finish();
      return;
    }
    setFeedback(null);
    if (tileDraftKey) sessionStorage.removeItem(tileDraftKey);
    setPicked([]);
    questionMs.current = 0;
    setIndex(index + 1);
  }

  async function exit() {
    if (busy) return;
    if (!session || phase !== 'playing') return router.push(`/units/${unitId}`);
    tickActive.current();
    setBusy(true);
    await flushHeartbeat();
    try {
      await api(`/play/sessions/${session.id}/end`, { method: 'POST' });
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(placementsKey);
      if (tileDraftKey) sessionStorage.removeItem(tileDraftKey);
      speechRun.current += 1;
      window.speechSynthesis?.cancel();
      setExitOpen(false);
      router.push(`/units/${unitId}`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403)
        setAccessBlocked(true);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Không thoát được. Thử lại nhé.',
      );
      setExitOpen(false);
      setBusy(false);
    }
  }

  function updatePicked(next: number[]) {
    setPicked(next);
    if (tileDraftKey)
      sessionStorage.setItem(tileDraftKey, JSON.stringify(next));
  }

  function requestExit() {
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setExitOpen(true);
  }

  function stay() {
    setExitOpen(false);
  }

  function requestHelp(button: HTMLButtonElement) {
    tickActive.current();
    speechRun.current += 1;
    window.speechSynthesis?.cancel();
    if (speechTimer.current) window.clearTimeout(speechTimer.current);
    speechTimer.current = null;
    setSpeaking(false);
    tipReturnFocus.current = button;
    setTipOpen(true);
  }

  function closeTip() {
    setTipOpen(false);
  }

  const details = Object.hasOwn(GAME_DETAILS, activity)
    ? GAME_DETAILS[activity]
    : undefined;
  const GameIcon = details ? gameIcons[activity] : undefined;
  const correctCount =
    session?.items.filter((entry) => entry.correct === true).length ?? 0;
  const resultMood = getResultMood(correctCount, session?.items.length ?? 0);

  const boardMode = activity === 'group' && session?.groupMode === 'board';
  const boardChecked = Boolean(
    boardMode && session?.items.every((entry) => entry.correct !== null),
  );

  return (
    <MotionConfig reducedMotion="user">
      <main className="play-screen">
        {phase === 'loading' ? (
          <StudentLoading>Đang mở trò chơi...</StudentLoading>
        ) : null}

        {phase === 'intro' ? (
          <>
            <div className="play-intro-nav">
              <Link className="back-link" href={`/units/${unitId}`}>
                <ArrowLeft size={19} aria-hidden /> Về unit
              </Link>
              {details ? (
                <button
                  ref={introHelpButton}
                  type="button"
                  className="icon-button play-help-button"
                  title="Cách chơi"
                  aria-label="Cách chơi"
                  disabled={busy}
                  onClick={(event) => requestHelp(event.currentTarget)}
                >
                  <CircleHelp size={23} aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="play-intro">
              <span className="play-intro-icon" aria-hidden>
                {GameIcon ? <GameIcon size={34} /> : null}
              </span>
              <p className="brand-pill">
                {unitTitle || 'Trò chơi'} ·{' '}
                {groupWordCount === null
                  ? 'Tối đa 8 từ'
                  : `Toàn bộ ${groupWordCount} từ hợp lệ`}
              </p>
              <h1>{details?.label ?? 'Trò chơi'}</h1>
              {activity === 'group' ? (
                <p className="play-mode">
                  {introMode === 'board' ? 'Bảng phân nhóm' : 'Từng từ'}
                </p>
              ) : null}
              <p className="lede">
                {activity === 'group' && introMode === 'board'
                  ? 'Xếp các từ vào đúng nhóm. Chọn hoặc kéo từ để di chuyển nhé.'
                  : details?.instruction}
              </p>
              {(activity === 'listen_spell' || activity === 'scramble') &&
              !audioAvailable ? (
                <p className="game-alert">
                  Thiết bị này chưa hỗ trợ đọc từ. Hãy thử bằng trình duyệt có
                  âm thanh nhé.
                </p>
              ) : null}
              {lockMessage ? <p className="game-alert">{lockMessage}</p> : null}
              {error ? (
                <p className="bad game-error" role="alert">
                  {error}
                </p>
              ) : null}
              {canStart && studentId && audioAvailable ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => void start()}
                  disabled={busy}
                >
                  {busy ? 'Đang chuẩn bị...' : 'Bắt đầu'}
                </button>
              ) : (
                <Link className="btn ghost" href={`/units/${unitId}`}>
                  Về unit
                </Link>
              )}
            </div>
          </>
        ) : null}

        {phase === 'playing' && session && details ? (
          <>
            {accessBlocked ? (
              <div className="game-alert" role="alert">
                Unit đang khóa hoặc chưa đến giờ mở. Câu đã trả lời vẫn được
                giữ.{' '}
                <button
                  className="tool-button"
                  type="button"
                  onClick={requestExit}
                >
                  Về unit
                </button>
              </div>
            ) : null}
            <PlayHeader
              label={details.label}
              count={
                boardMode
                  ? session.items.filter((entry) => placements[entry.attemptId])
                      .length
                  : index + (feedback ? 1 : 0)
              }
              total={session.items.length}
              board={boardMode}
              onExit={requestExit}
              onHelp={requestHelp}
              busy={busy}
              exitButtonRef={exitButton}
            />
            {boardMode ? (
              <>
                <h1
                  className="question-title"
                  ref={questionHeading}
                  tabIndex={-1}
                >
                  {boardChecked
                    ? 'Cùng xem kết quả nhé!'
                    : 'Xếp từ vào nhóm nào?'}
                </h1>
                <div className="answer-pop-anchor">
                  <CorrectAnswerPop
                    answerKey={
                      boardChecked && answerPopKey === `${session.id}:board`
                        ? answerPopKey
                        : null
                    }
                  />
                  <GroupBoard
                    items={session.items}
                    groups={session.boardGroups ?? []}
                    placements={placements}
                    onPlace={placeWord}
                    onCheck={() => void checkBoard()}
                    busy={busy || accessBlocked}
                    checked={boardChecked}
                  />
                </div>
                {boardChecked ? (
                  <div className="board-actions">
                    <button
                      className="btn"
                      type="button"
                      disabled={busy || !canStart}
                      onClick={() => void finish()}
                    >
                      Xem kết quả
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => void start()}
                    >
                      Chơi lại
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={busy}
                      onClick={requestExit}
                    >
                      Về unit
                    </button>
                  </div>
                ) : null}
              </>
            ) : item ? (
              <>
                <h1
                  className="question-title"
                  ref={questionHeading}
                  tabIndex={-1}
                >
                  {details.instruction}
                </h1>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={item.attemptId}
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  >
                    <GameQuestion
                      activity={activity}
                      item={item}
                      picked={picked}
                      setPicked={updatePicked}
                      feedback={feedback}
                      busy={busy || accessBlocked}
                      speaking={speaking}
                      heard={heard}
                      audioError={audioError}
                      onSpeak={speak}
                      onExit={requestExit}
                      onAnswer={answer}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="answer-pop-anchor">
                  <CorrectAnswerPop
                    answerKey={
                      feedback?.correct &&
                      answerPopKey === `${session.id}:${feedback.id}`
                        ? answerPopKey
                        : null
                    }
                  />
                  <PlayFeedback
                    activity={activity}
                    feedback={feedback}
                    isLast={index + 1 === session.items.length}
                    busy={busy || accessBlocked}
                    onNext={next}
                  />
                </div>
              </>
            ) : (
              <div className="play-all-done">
                <Check size={32} aria-hidden />
                <h1>Đã xong các câu!</h1>
                <button
                  className="btn"
                  type="button"
                  onClick={() => void finish()}
                  disabled={busy}
                >
                  Xem kết quả
                </button>
              </div>
            )}
            {error ? (
              <p className="bad game-error" role="alert">
                {error}
              </p>
            ) : null}
            <ExitDialog
              open={exitOpen}
              busy={busy}
              onStay={stay}
              onLeave={() => void exit()}
              returnFocusRef={exitButton}
            />
          </>
        ) : null}

        {phase === 'result' && session && details ? (
          <motion.div
            className="result-screen"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
          >
            <div className="result-celebration">
              {completedSessionId === session.id &&
              resultMood !== 'tryAgain' ? (
                <StudentAnimation
                  asset="confetti-burst"
                  trigger={session.id}
                  className="result-confetti"
                />
              ) : null}
              <motion.span
                key={earnedStar ? 'earned' : 'complete'}
                className={`result-star${earnedStar ? ' result-star--earned' : ''}`}
                initial={
                  earnedStar ? { scale: reducedMotion ? 1 : 0.7 } : false
                }
                animate={{ scale: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.35 }}
              >
                {earnedStar ? (
                  <StudentAnimation
                    asset="star-celebration"
                    trigger={
                      completedSessionId === session.id ? session.id : false
                    }
                    fallback={
                      <Star size={46} fill="currentColor" aria-hidden />
                    }
                  />
                ) : (
                  <Check size={46} aria-hidden />
                )}
              </motion.span>
            </div>
            <p className="brand-pill">{details.label}</p>
            <h1 ref={resultHeading} tabIndex={-1}>
              Hoàn thành rồi!
            </h1>
            <p className="result-score">
              Đúng {correctCount}/{session.items.length} từ
            </p>
            <ResultReaction mood={resultMood} sessionId={session.id} />
            {earnedStar ? (
              <p className="result-mastered">
                Bạn vừa đạt một sao cho trò này!
              </p>
            ) : null}
            <p className="lede">Mỗi lần luyện là một lần giỏi hơn.</p>
            {error ? (
              <p className="bad" role="alert">
                {error}
              </p>
            ) : null}
            <button
              className="btn"
              type="button"
              disabled={busy || !canStart}
              onClick={() => void start()}
            >
              <RotateCcw size={20} aria-hidden /> Chơi lại
            </button>
            <Link className="btn ghost" href={`/units/${unitId}`}>
              Về unit
            </Link>
            <Link className="result-wordbook-link" href="/wordbook">
              <BookText size={20} aria-hidden /> Xem sổ từ
            </Link>
          </motion.div>
        ) : null}

        {details && (phase === 'intro' || phase === 'playing') ? (
          <HowToPlayDialog
            open={tipOpen}
            activity={activity}
            groupMode={session?.groupMode ?? introMode}
            dismissed={isGameTipDismissed(studentId, activity)}
            canSavePreference={Boolean(studentId)}
            onDismissalChange={(dismissed) =>
              setGameTipDismissed(studentId, activity, dismissed)
            }
            onClose={closeTip}
            returnFocusRef={tipReturnFocus}
          />
        ) : null}
      </main>
    </MotionConfig>
  );
}
