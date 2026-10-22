'use client';

import { useRef, useState, type ReactNode } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { motion, useReducedMotion } from 'motion/react';
import type { AnswerResult } from '../lib/game';
import { gameDragSensors } from './game-drag-sensors';

type Choice = { id: string; titleVi: string };

function WordTile({
  word,
  locked,
  cardRef,
  onSpeak,
}: {
  word: string;
  locked: boolean;
  cardRef: (node: HTMLButtonElement | null) => void;
  onSpeak: () => void;
}) {
  const { ref, isDragging } = useDraggable({ id: 'word', disabled: locked });
  return (
    <button
      ref={(node) => {
        ref(node);
        cardRef(node);
      }}
      type="button"
      className={`word-card${isDragging ? ' word-card--dragging' : ''}`}
      disabled={locked}
      aria-label={`Nghe hoặc kéo từ ${word} vào một nhóm`}
      title="Nghe từ hoặc kéo vào nhóm"
      onClick={() => {
        if (!isDragging) onSpeak();
      }}
    >
      {word}
    </button>
  );
}

function GroupTarget({
  choice,
  locked,
  feedback,
  chosenId,
  targetRef,
  onChoose,
  reducedMotion,
}: {
  choice: Choice;
  locked: boolean;
  feedback: AnswerResult | null;
  chosenId: string | null;
  targetRef: (node: HTMLButtonElement | null) => void;
  onChoose: (choice: Choice) => void;
  reducedMotion: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: choice.id,
    disabled: locked,
  });
  const correct =
    feedback &&
    !feedback.correct &&
    feedback.correction.categoryId === choice.id;
  const wrong = feedback && !feedback.correct && chosenId === choice.id;
  return (
    <motion.button
      ref={(node) => {
        ref(node);
        targetRef(node);
      }}
      type="button"
      className={`category-choice${isDropTarget ? ' category-choice--target' : ''}${correct ? ' category-choice--answer' : ''}${wrong ? ' category-choice--wrong' : ''}`}
      onClick={() => onChoose(choice)}
      disabled={locked}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: reducedMotion ? 0 : 0.16 }}
    >
      {choice.titleVi}
    </motion.button>
  );
}

export function SingleGroupQuestion({
  word,
  choices,
  speaker,
  feedback,
  locked,
  onAnswer,
  onSpeak,
}: {
  word: string;
  choices: Choice[];
  speaker: ReactNode;
  feedback: AnswerResult | null;
  locked: boolean;
  onAnswer: (answer: Record<string, unknown>) => Promise<boolean>;
  onSpeak: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const targetRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const submitting = useRef(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [flight, setFlight] = useState({ x: 0, y: 0 });

  const choose = async (choice: Choice, fromDrag = false) => {
    if (locked || submitting.current) return;
    submitting.current = true;
    if (!fromDrag && !reducedMotion) {
      const card = cardRef.current?.getBoundingClientRect();
      const target = targetRefs.current[choice.id]?.getBoundingClientRect();
      if (card && target)
        setFlight({
          x: target.left + target.width / 2 - (card.left + card.width / 2),
          y: target.top + target.height / 2 - (card.top + card.height / 2),
        });
    }
    setChosenId(choice.id);
    const saved = await onAnswer({ categoryId: choice.id });
    setFlight({ x: 0, y: 0 });
    if (!saved) setChosenId(null);
    submitting.current = false;
  };

  return (
    <DragDropProvider
      sensors={gameDragSensors}
      onDragEnd={(event) => {
        if (event.canceled || event.operation.source?.id !== 'word') return;
        const choice = choices.find(
          (entry) => entry.id === event.operation.target?.id,
        );
        if (choice) void choose(choice, true);
      }}
    >
      <div className="single-group-stage game-question-body">
        <div className="group-word">
          <motion.div
            className="word-flight"
            animate={{
              x: flight.x,
              y: flight.y,
              scale: chosenId && !feedback ? 0.92 : 1,
            }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            <WordTile
              word={word}
              locked={locked}
              cardRef={(node) => {
                cardRef.current = node;
              }}
              onSpeak={onSpeak}
            />
          </motion.div>
          {speaker}
        </div>
        <div className="category-choices">
          {choices.map((choice) => (
            <GroupTarget
              key={choice.id}
              choice={choice}
              locked={locked}
              feedback={feedback}
              chosenId={chosenId}
              targetRef={(node) => {
                targetRefs.current[choice.id] = node;
              }}
              onChoose={(target) => void choose(target)}
              reducedMotion={Boolean(reducedMotion)}
            />
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}
