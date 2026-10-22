'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CircleHelp, Star, X } from 'lucide-react';
import { GAME_DETAILS, type Activity, type AnswerResult } from '../lib/game';
import { GAME_TIPS, GROUP_BOARD_TIPS } from '../lib/game-tips';

export function PlayHeader({
  label,
  count,
  total,
  board,
  onExit,
  onHelp,
  busy,
  exitButtonRef,
}: {
  label: string;
  count: number;
  total: number;
  board: boolean;
  onExit: () => void;
  onHelp: (button: HTMLButtonElement) => void;
  busy: boolean;
  exitButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const reducedMotion = useReducedMotion();
  const progress = total ? Math.min(100, (count / total) * 100) : 0;
  return (
    <header className="play-header">
      <div className="play-header-controls">
        <button
          ref={exitButtonRef}
          type="button"
          className="icon-button"
          title="Thoát trò chơi"
          aria-label="Thoát trò chơi"
          disabled={busy}
          onClick={onExit}
        >
          <X size={23} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-button play-help-button"
          title="Cách chơi"
          aria-label="Cách chơi"
          disabled={busy}
          onClick={(event) => onHelp(event.currentTarget)}
        >
          <CircleHelp size={23} aria-hidden />
        </button>
      </div>
      <div className="play-progress">
        <div className="play-progress-line">
          <strong>{label}</strong>
          <span>
            {board
              ? `${count}/${total} từ đã xếp`
              : `Câu ${Math.min(count + 1, total)}/${total}`}
          </span>
        </div>
        <div
          className="play-progress-track"
          role="progressbar"
          aria-label={board ? 'Từ đã xếp' : 'Câu đã hoàn thành'}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={count}
        >
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          />
        </div>
      </div>
    </header>
  );
}

export function HowToPlayDialog({
  open,
  activity,
  groupMode,
  dismissed,
  canSavePreference,
  onDismissalChange,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  activity: Activity;
  groupMode: 'single' | 'board';
  dismissed: boolean;
  canSavePreference: boolean;
  onDismissalChange: (dismissed: boolean) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [dontShowAgain, setDontShowAgain] = useState(dismissed);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDontShowAgain(dismissed);
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open, dismissed, returnFocusRef]);

  const tips =
    activity === 'group' && groupMode === 'board'
      ? GROUP_BOARD_TIPS
      : GAME_TIPS[activity];
  return (
    <dialog
      ref={dialogRef}
      className="play-exit-dialog play-tip-dialog"
      aria-labelledby="play-tip-title"
      aria-describedby="play-tip-steps"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <h2 id="play-tip-title">Cách chơi</h2>
      <p className="play-tip-game">
        {GAME_DETAILS[activity].label}
        {activity === 'group'
          ? ` · ${groupMode === 'board' ? 'Bảng phân nhóm' : 'Từng từ'}`
          : ''}
      </p>
      <ul id="play-tip-steps" className="play-tip-steps">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {activity === 'scramble' || activity === 'listen_spell' ? (
        <p className="play-tip-audio">
          Hãy bật âm thanh. Nếu chưa nghe được, thử nghe lại hoặc về unit nhé.
        </p>
      ) : null}
      <label className="play-tip-dismiss">
        <span className="play-tip-checkbox">
          <input
            type="checkbox"
            checked={dontShowAgain}
            disabled={!canSavePreference}
            onChange={(event) => {
              const checked = event.target.checked;
              setDontShowAgain(checked);
              onDismissalChange(checked);
            }}
          />
          <Check size={17} aria-hidden />
        </span>
        Không hiện lại
      </label>
      <div className="play-exit-actions">
        <button
          ref={closeButtonRef}
          type="button"
          className="btn"
          onClick={onClose}
        >
          Đóng
        </button>
      </div>
    </dialog>
  );
}

function correctionText(activity: Activity, result: AnswerResult) {
  if (activity === 'group')
    return `Nhóm đúng: ${result.correction.label ?? ''}`;
  if (activity === 'odd_letter')
    return `Chữ thừa là ${String(result.correction.letter ?? '').toUpperCase()}, ở vị trí ${Number(result.correction.letterIndex ?? 0) + 1}.`;
  return `Từ đúng là ${String(result.correction.word ?? '').toUpperCase()}.`;
}

export function PlayFeedback({
  activity,
  feedback,
  isLast,
  busy,
  onNext,
}: {
  activity: Activity;
  feedback: AnswerResult | null;
  isLast: boolean;
  busy: boolean;
  onNext: () => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div
      className={`answer-footer${feedback ? ' answer-footer--visible' : ''}`}
    >
      <div className="feedback-space" aria-live="polite" aria-atomic="true">
        {feedback ? (
          <motion.div
            key={feedback.id}
            className={`game-feedback ${feedback.correct ? 'game-feedback--ok' : 'game-feedback--try'}`}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            {feedback.correct ? (
              <Check size={26} aria-hidden />
            ) : (
              <Star size={26} aria-hidden />
            )}
            <span>
              <strong>
                {feedback.correct ? 'Đúng rồi!' : 'Mình cùng nhớ nhé'}
              </strong>
              {!feedback.correct ? (
                <small>{correctionText(activity, feedback)}</small>
              ) : null}
            </span>
          </motion.div>
        ) : null}
      </div>
      {feedback ? (
        <button
          className="btn continue-button"
          type="button"
          disabled={busy}
          onClick={onNext}
        >
          {isLast ? 'Xem kết quả' : 'Tiếp tục'}
        </button>
      ) : null}
    </div>
  );
}

export function ExitDialog({
  open,
  busy,
  onStay,
  onLeave,
  returnFocusRef,
  title = 'Rời trò chơi?',
  description = 'Câu đã trả lời vẫn được lưu. Câu chưa trả lời sẽ không tính điểm.',
  leaveLabel = 'Về unit',
}: {
  open: boolean;
  busy: boolean;
  onStay: () => void;
  onLeave: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  title?: string;
  description?: string;
  leaveLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef]);
  return (
    <dialog
      ref={dialogRef}
      className="play-exit-dialog"
      aria-labelledby="play-exit-title"
      aria-describedby="play-exit-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onStay();
      }}
    >
      <h2 id="play-exit-title">{title}</h2>
      <p id="play-exit-description">{description}</p>
      <div className="play-exit-actions">
        <button type="button" className="btn" disabled={busy} onClick={onStay}>
          Ở lại
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={onLeave}
        >
          {leaveLabel}
        </button>
      </div>
    </dialog>
  );
}
