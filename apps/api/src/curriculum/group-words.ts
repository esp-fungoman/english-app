import { flattenWord, type LinkedWord } from './words';
import { isUnitOpen } from '../play/round';

type SourceUnit = {
  gradeId: string;
  sortOrder: number;
  opensAt: Date | null;
  manualLock: boolean;
  words: LinkedWord[];
};

export function groupWordsForUnit(
  unit: SourceUnit & { groupIncludePreviousUnits: boolean },
  units: SourceUnit[],
  now = new Date(),
) {
  if (!unit.groupIncludePreviousUnits)
    return unit.words.filter((word) => word.active).map(flattenWord);
  // A shared vocabulary profile occurs once. Its latest open unit supplies
  // the category assignment and stable UnitWord ID used for the attempt.
  const words = new Map<string, ReturnType<typeof flattenWord>>();
  for (const source of [...units].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (
      source.gradeId !== unit.gradeId ||
      source.sortOrder > unit.sortOrder ||
      !isUnitOpen(source.opensAt, source.manualLock, now)
    )
      continue;
    for (const word of source.words)
      if (word.active) words.set(word.wordId, flattenWord(word));
  }
  return [...words.values()];
}
