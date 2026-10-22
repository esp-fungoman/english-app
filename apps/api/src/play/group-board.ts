import { ActivityType } from '@prisma/client';
import { CategoryChoice, isUsableWord, RoundWord, shuffle } from './round';

export type BoardWord = RoundWord & { id: string };

export function buildGroupBoard<T extends BoardWord>(
  words: T[],
  categories: CategoryChoice[],
): { words: T[]; groups: CategoryChoice[] } | null {
  const usable = words.filter((word) =>
    isUsableWord(ActivityType.group, word, categories),
  );
  const choices = shuffle(categories);
  if (usable.length < 2 || choices.length < 2) return null;

  for (
    let size = Math.min(4, choices.length, usable.length);
    size >= 2;
    size--
  ) {
    const find = (
      start: number,
      selected: CategoryChoice[],
    ): {
      words: T[];
      groups: CategoryChoice[];
    } | null => {
      if (selected.length === size) {
        const groupIds = new Set(selected.map((group) => group.id));
        const candidates = shuffle(
          usable.filter((word) => {
            const accepted = word.categories.filter((entry) =>
              groupIds.has(entry.categoryId),
            );
            return accepted.length > 0 && accepted.length < selected.length;
          }),
        );
        const matched: T[] = [];
        const used = new Set<string>();
        const match = (index: number): boolean => {
          if (index === selected.length) return true;
          for (const word of candidates) {
            if (
              used.has(word.id) ||
              !word.categories.some(
                (entry) => entry.categoryId === selected[index].id,
              )
            )
              continue;
            used.add(word.id);
            matched.push(word);
            if (match(index + 1)) return true;
            matched.pop();
            used.delete(word.id);
          }
          return false;
        };
        if (!match(0)) return null;
        const remaining = candidates.filter((word) => !used.has(word.id));
        return {
          words: shuffle([
            ...matched,
            ...remaining.slice(0, 8 - matched.length),
          ]),
          groups: shuffle(selected),
        };
      }
      for (let i = start; i <= choices.length - (size - selected.length); i++) {
        const board = find(i + 1, [...selected, choices[i]]);
        if (board) return board;
      }
      return null;
    };
    const board = find(0, []);
    if (board) return board;
  }
  return null;
}
