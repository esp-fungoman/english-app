'use client';

import { useRef } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { RotateCcw, Undo2 } from 'lucide-react';

export function LetterComposer({
  attemptId,
  bank,
  slots,
  reusable = false,
  picked,
  setPicked,
  locked,
  answerBlocked,
  onAnswer,
}: {
  attemptId: string;
  bank: string[];
  slots: number;
  reusable?: boolean;
  picked: number[];
  setPicked: (next: number[]) => void;
  locked: boolean;
  answerBlocked: boolean;
  onAnswer: (answer: Record<string, unknown>) => Promise<boolean>;
}) {
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const bankRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = (tileIndex: number) => {
    if (
      locked ||
      picked.length >= slots ||
      (!reusable && picked.includes(tileIndex))
    )
      return;
    const position = picked.length;
    setPicked([...picked, tileIndex]);
    requestAnimationFrame(() => slotRefs.current[position]?.focus());
  };
  const remove = (position: number) => {
    if (locked) return;
    const tileIndex = picked[position];
    setPicked(picked.filter((_, index) => index !== position));
    requestAnimationFrame(() => bankRefs.current[tileIndex]?.focus());
  };

  return (
    <div className="letter-workspace">
      <LayoutGroup id={attemptId}>
        <div className="answer-slots" aria-label="Các ô chữ đã chọn">
          {Array.from({ length: slots }, (_, position) => {
            const tileIndex = picked[position];
            return (
              <div className="answer-slot" key={position}>
                {tileIndex !== undefined ? (
                  <motion.button
                    ref={(node) => {
                      slotRefs.current[position] = node;
                    }}
                    layoutId={reusable ? undefined : `tile-${tileIndex}`}
                    type="button"
                    className="letter-tile letter-tile--placed"
                    onClick={() => remove(position)}
                    disabled={locked}
                    aria-label={`Gỡ chữ ${bank[tileIndex]?.toUpperCase()} ở ô ${position + 1}`}
                  >
                    {bank[tileIndex]?.toUpperCase()}
                  </motion.button>
                ) : (
                  <span className="slot-number" aria-hidden>
                    {position + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div
          className="letter-bank"
          aria-label={reusable ? 'Bảng chữ cái A đến Z' : 'Chọn chữ cái'}
        >
          {bank.map((letter, index) =>
            !reusable && picked.includes(index) ? (
              <span key={index} className="letter-placeholder" aria-hidden />
            ) : (
              <motion.button
                ref={(node) => {
                  bankRefs.current[index] = node;
                }}
                key={index}
                layoutId={reusable ? undefined : `tile-${index}`}
                type="button"
                className="letter-tile"
                onClick={() => choose(index)}
                disabled={locked || picked.length >= slots}
                aria-label={`Chọn chữ ${letter.toUpperCase()}, ô ${index + 1} trong khay`}
              >
                {letter.toUpperCase()}
              </motion.button>
            ),
          )}
        </div>
      </LayoutGroup>
      <div className="letter-actions">
        <div className="tile-tools">
          <button
            type="button"
            className="tool-button"
            onClick={() => remove(picked.length - 1)}
            disabled={locked || picked.length === 0}
            title="Gỡ chữ cuối"
          >
            <Undo2 size={20} aria-hidden />
            <span>Gỡ</span>
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={() => setPicked([])}
            disabled={locked || picked.length === 0}
            title="Xóa hết"
          >
            <RotateCcw size={20} aria-hidden />
            <span>Xóa hết</span>
          </button>
        </div>
        <button
          type="button"
          className="btn game-check"
          disabled={locked || answerBlocked || picked.length !== slots}
          onClick={() =>
            void onAnswer({ word: picked.map((index) => bank[index]).join('') })
          }
        >
          Kiểm tra
        </button>
      </div>
    </div>
  );
}
