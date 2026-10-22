'use client';

import { useState, type ReactNode } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { motion, useReducedMotion } from 'motion/react';
import { CornerDownLeft } from 'lucide-react';
import type { GameItem } from '../lib/game';
import { gameDragSensors } from './game-drag-sensors';

type Group = { id: string; titleVi: string };
type Placements = Record<string, string>;

function WordTile({
  item,
  selected,
  checked,
  onSelect,
}: {
  item: GameItem;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { ref, isDragging } = useDraggable({
    id: item.attemptId,
    disabled: checked,
  });
  const wrong = checked && item.correct === false;
  return (
    <motion.div
      layout
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="board-tile-wrap"
    >
      <button
        ref={ref}
        type="button"
        className={`board-tile${selected ? ' board-tile--selected' : ''}${wrong ? ' board-tile--wrong' : ''}${checked && item.correct ? ' board-tile--right' : ''}`}
        aria-pressed={!checked && selected}
        aria-label={`${String(item.prompt.lemma)}${wrong ? `, nhóm đúng: ${item.correction?.label}` : ''}`}
        disabled={checked}
        onClick={(event) => {
          event.stopPropagation();
          if (!isDragging) onSelect();
        }}
      >
        <span>{String(item.prompt.lemma)}</span>
        {wrong ? <small>Đúng: {item.correction?.label}</small> : null}
      </button>
    </motion.div>
  );
}

function DropArea({
  id,
  label,
  children,
  onChoose,
  isBank = false,
  selected,
  checked,
}: {
  id: string;
  label: string;
  children: ReactNode;
  onChoose: () => void;
  isBank?: boolean;
  selected: boolean;
  checked: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({ id, disabled: checked });
  return (
    <div
      ref={ref}
      className={`board-area${isBank ? ' board-area--bank' : ''}${isDropTarget ? ' board-area--target' : ''}${selected ? ' board-area--choose' : ''}${checked ? ' board-area--checked' : ''}`}
      onClick={() => {
        if (!checked) onChoose();
      }}
    >
      <button
        className="board-area-title"
        type="button"
        disabled={checked}
        onClick={(event) => {
          event.stopPropagation();
          onChoose();
        }}
      >
        {label}
      </button>
      <div className="board-area-words">{children}</div>
    </div>
  );
}

export function GroupBoard({
  items,
  groups,
  placements,
  onPlace,
  onCheck,
  busy,
  checked,
}: {
  items: GameItem[];
  groups: Group[];
  placements: Placements;
  onPlace: (attemptId: string, categoryId: string | null) => void;
  onCheck: () => void;
  busy: boolean;
  checked: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const placedCount = items.filter((item) => placements[item.attemptId]).length;
  const correctCount = items.filter((item) => item.correct === true).length;
  const place = (categoryId: string | null) => {
    if (!selectedId || checked || busy) return;
    onPlace(selectedId, categoryId);
    setSelectedId(null);
  };
  const tile = (item: GameItem) => (
    <WordTile
      key={item.attemptId}
      item={item}
      selected={selectedId === item.attemptId}
      checked={checked}
      onSelect={() =>
        setSelectedId((current) =>
          current === item.attemptId ? null : item.attemptId,
        )
      }
    />
  );

  return (
    <DragDropProvider
      sensors={gameDragSensors}
      onDragEnd={(event) => {
        if (event.canceled || checked || busy) return;
        const attemptId = String(event.operation.source?.id ?? '');
        const targetId = String(event.operation.target?.id ?? '');
        if (!items.some((item) => item.attemptId === attemptId)) return;
        if (targetId === 'bank') onPlace(attemptId, null);
        else if (groups.some((group) => group.id === targetId))
          onPlace(attemptId, targetId);
        setSelectedId(null);
      }}
    >
      <p className="board-selection-hint" aria-live="polite">
        {!checked && selectedId ? 'Chọn một nhóm cho từ này' : ''}
      </p>
      <div className={`board-layout${checked ? ' board-layout--checked' : ''}`}>
        <DropArea
          id="bank"
          label={checked ? 'Kết quả phân nhóm' : 'Từ chưa xếp'}
          isBank
          selected={Boolean(selectedId && placements[selectedId])}
          checked={checked}
          onChoose={() => place(null)}
        >
          {checked ? (
            <p className="board-bank-summary">
              Đúng {correctCount}/{items.length} từ
            </p>
          ) : (
            <>
              {items.filter((item) => !placements[item.attemptId]).map(tile)}
              {selectedId && placements[selectedId] ? (
                <span className="board-return">
                  <CornerDownLeft size={17} aria-hidden /> Đưa từ về đây
                </span>
              ) : null}
            </>
          )}
        </DropArea>
        <div className="board-groups">
          {groups.map((group) => (
            <DropArea
              key={group.id}
              id={group.id}
              label={group.titleVi}
              selected={Boolean(selectedId)}
              checked={checked}
              onChoose={() => place(group.id)}
            >
              {items
                .filter((item) => placements[item.attemptId] === group.id)
                .map(tile)}
            </DropArea>
          ))}
        </div>
      </div>
      {!checked ? (
        <button
          className="btn game-check"
          type="button"
          disabled={busy || placedCount !== items.length}
          onClick={onCheck}
        >
          {busy ? 'Đang kiểm tra...' : 'Kiểm tra'}
        </button>
      ) : null}
    </DragDropProvider>
  );
}
