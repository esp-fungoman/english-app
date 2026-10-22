'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import {
  letterChoices,
  type Activity,
  type AnswerResult,
  type GameItem,
} from '../lib/game';
import { LetterComposer } from './LetterComposer';
import { SingleGroupQuestion } from './SingleGroupQuestion';
import { WordImage } from './word-image';

type Props = {
  activity: Activity;
  item: GameItem;
  picked: number[];
  setPicked: (picked: number[]) => void;
  feedback: AnswerResult | null;
  busy: boolean;
  speaking: boolean;
  heard: boolean;
  audioError: boolean;
  onSpeak: () => void;
  onExit: () => void;
  onAnswer: (answer: Record<string, unknown>) => Promise<boolean>;
};

type Choice = { id: string; titleVi: string };

export function GameQuestion({
  activity,
  item,
  picked,
  setPicked,
  feedback,
  busy,
  speaking,
  heard,
  audioError,
  onSpeak,
  onExit,
  onAnswer,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [selectedLetter, setSelectedLetter] = useState<number | null>(null);
  const locked = busy || feedback !== null;
  const prompt = item.prompt;

  const speaker = (label: string) => (
    <motion.button
      type="button"
      className={`speaker-button${speaking ? ' speaker-button--speaking' : ''}`}
      onClick={onSpeak}
      disabled={busy}
      aria-label={label}
      title={label}
      animate={
        speaking && !reducedMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }
      }
      transition={
        speaking && !reducedMotion
          ? { repeat: Infinity, duration: 0.9 }
          : { duration: 0.15 }
      }
    >
      <Volume2 size={30} aria-hidden />
      <span>{speaking ? 'Đang đọc...' : heard ? 'Nghe lại' : 'Nghe từ'}</span>
    </motion.button>
  );

  if (activity === 'group') {
    return (
      <SingleGroupQuestion
        word={String(prompt.lemma ?? '')}
        choices={(prompt.choices as Choice[]) ?? []}
        speaker={speaker(`Nghe từ ${String(prompt.lemma ?? '')}`)}
        feedback={feedback}
        locked={locked}
        onAnswer={onAnswer}
        onSpeak={onSpeak}
      />
    );
  }

  if (activity === 'odd_letter') {
    const letters = (prompt.letters as string[]) ?? [];
    async function selectLetter(index: number) {
      if (locked) return;
      setSelectedLetter(index);
      if (!(await onAnswer({ letterIndex: index }))) setSelectedLetter(null);
    }
    return (
      <div className="game-question-body odd-letter-stage">
        <div className="word-cue">
          <span>Từ của bạn</span>
          <strong>{String(prompt.lemma ?? '')}</strong>
        </div>
        <div className="letter-bank odd-bank" aria-label="Chọn chữ cái thừa">
          <AnimatePresence mode="popLayout">
            {letters.map((letter, index) => {
              const chosen = selectedLetter === index;
              const right =
                feedback &&
                !feedback.correct &&
                feedback.correction.letterIndex === index;
              if (chosen && feedback?.correct) return null;
              return (
                <motion.button
                  key={`${item.attemptId}-${index}`}
                  layout
                  type="button"
                  className={`letter-tile${chosen ? ' letter-tile--chosen' : ''}${right ? ' letter-tile--answer' : ''}${chosen && feedback && !feedback.correct ? ' letter-tile--wrong' : ''}`}
                  onClick={() => void selectLetter(index)}
                  disabled={locked}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: reducedMotion ? 0 : -16,
                    scale: reducedMotion ? 1 : 0.8,
                  }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                  aria-label={`Chữ ${letter}, vị trí ${index + 1}${right ? ', chữ thừa' : ''}`}
                >
                  {letter.toUpperCase()}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const isListen = activity === 'listen_spell';
  const { bank, slots } = letterChoices(activity, prompt);
  return (
    <div
      className={`game-question-body spelling-stage${isListen ? ' spelling-stage--listen' : ''}`}
    >
      <div className="audio-cue">
        {isListen && item.imageKey ? (
          <WordImage
            imageKey={item.imageKey}
            alt="Minh họa cho từ đang nghe"
            className="game-word-image"
          />
        ) : null}
        {speaker(isListen ? 'Nghe từ và từng chữ cái' : 'Nghe từ')}
        {audioError ? (
          <div className="audio-retry">
            <p>Chưa nghe được. Bạn có thể thử lại.</p>
            <button type="button" className="tool-button" onClick={onExit}>
              Về unit
            </button>
          </div>
        ) : null}
      </div>
      <LetterComposer
        attemptId={item.attemptId}
        bank={bank}
        slots={slots}
        reusable={activity === 'scramble'}
        picked={picked}
        setPicked={setPicked}
        locked={locked}
        answerBlocked={audioError}
        onAnswer={onAnswer}
      />
    </div>
  );
}
