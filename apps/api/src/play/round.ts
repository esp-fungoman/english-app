import { ActivityType } from '@prisma/client';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export type RoundWord = {
  lemma: string;
  categories: {
    categoryId: string;
    category: { id: string; slug: string; titleVi: string };
  }[];
};

export type CategoryChoice = { id: string; titleVi: string };

export function isUnitOpen(
  opensAt: Date | null,
  manualLock: boolean,
  now = new Date(),
): boolean {
  return !manualLock && opensAt !== null && now.getTime() >= opensAt.getTime();
}

export function unitAccess(unit: {
  opensAt: Date | null;
  manualLock: boolean;
}) {
  const open = isUnitOpen(unit.opensAt, unit.manualLock);
  const lockReason = unit.manualLock
    ? 'Khóa tay'
    : !unit.opensAt
      ? 'Chưa đặt lịch'
      : !open
        ? 'Chờ mở'
        : null;
  return { open, opensAt: unit.opensAt, lockReason };
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Game limits: A–Z words joined by single spaces; spaces are shown, never picked. */
export const MAX_GAME_WORD_LETTERS = 12;
export const MAX_GAME_LETTERS = 16;
export const MAX_GAME_WORDS = 4;

/** Lowercase lemma with single spaces, as games compare and display it. */
export function gameLemma(lemma: string): string {
  return lemma.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Letters to place, without spaces ("fish and chips" → fishandchips). */
function lettersOf(word: string): string[] {
  return gameLemma(word).replace(/ /g, '').split('');
}

/** Letter count of each word, so the UI can group slots ("fish and chips" → [4, 3, 5]). */
function wordLengths(lemma: string): number[] {
  return gameLemma(lemma)
    .split(' ')
    .map((part) => part.length);
}

export function gameLemmaProblem(
  rawLemma: string,
): 'letters' | 'word-length' | 'length' | 'words' | null {
  const lemma = gameLemma(rawLemma);
  if (!/^[a-z]+( [a-z]+)*$/.test(lemma)) return 'letters';
  const lengths = wordLengths(lemma);
  if (lengths.length > MAX_GAME_WORDS) return 'words';
  if (lengths.some((length) => length > MAX_GAME_WORD_LETTERS))
    return 'word-length';
  if (lettersOf(lemma).length > MAX_GAME_LETTERS) return 'length';
  return null;
}

export function isGameLemma(lemma: string): boolean {
  return gameLemmaProblem(lemma) === null;
}

export function isUsableWord(
  activity: ActivityType,
  word: RoundWord,
  allCategories: CategoryChoice[],
): boolean {
  const lemma = gameLemma(word.lemma);
  if (!isGameLemma(lemma)) return false;
  if (activity === ActivityType.group) {
    const accepted = new Set(word.categories.map((c) => c.categoryId));
    return accepted.size > 0 && allCategories.some((c) => !accepted.has(c.id));
  }
  if (activity === ActivityType.scramble)
    return new Set(lettersOf(lemma)).size > 1;
  return true;
}

export function buildPrompt(
  activity: ActivityType,
  word: RoundWord,
  allCategories: CategoryChoice[],
) {
  const lemma = gameLemma(word.lemma);
  if (activity === ActivityType.group) {
    const accepted = word.categories.map((c) => c.categoryId);
    const right = shuffle(
      allCategories.filter((c) => accepted.includes(c.id)),
    )[0];
    const wrong = shuffle(
      allCategories.filter((c) => !accepted.includes(c.id)),
    ).slice(0, 2);
    return {
      mode: 'single',
      lemma,
      acceptedCategoryIds: accepted,
      choices: shuffle([right, ...wrong]),
    };
  }
  if (activity === ActivityType.odd_letter) {
    const extra = shuffle(ALPHABET.filter((c) => !lemma.includes(c)))[0];
    // Spaces stay in `letters` and render as gaps; spaces are single, so the
    // extra letter always sticks to a word.
    const letters = lemma.split('');
    const extraIndex = Math.floor(Math.random() * (letters.length + 1));
    letters.splice(extraIndex, 0, extra);
    return { lemma, extra, extraIndex, letters };
  }
  const lengths = wordLengths(lemma);
  if (activity === ActivityType.scramble) {
    const letters = shuffle(lettersOf(lemma));
    if (letters.join('') === lettersOf(lemma).join('')) {
      const different = letters.findIndex((c) => c !== letters[0]);
      [letters[0], letters[different]] = [letters[different], letters[0]];
    }
    return { lemma, letters, wordLengths: lengths };
  }
  const distractors = shuffle(ALPHABET.filter((c) => !lemma.includes(c))).slice(
    0,
    4,
  );
  return {
    lemma,
    blanks: lettersOf(lemma).length,
    wordLengths: lengths,
    bank: shuffle([...lettersOf(lemma), ...distractors]),
  };
}

export function gradeAnswer(
  activity: ActivityType,
  prompt: Record<string, unknown>,
  answer: Record<string, unknown>,
): boolean {
  const lemma = String(prompt.lemma ?? '');
  if (activity === ActivityType.group) {
    return (
      typeof answer.categoryId === 'string' &&
      (prompt.acceptedCategoryIds as string[]).includes(answer.categoryId)
    );
  }
  if (activity === ActivityType.odd_letter) {
    return (
      Number.isInteger(answer.letterIndex) &&
      answer.letterIndex === prompt.extraIndex
    );
  }
  // Students place letters only; spaces in the phrase are given.
  return (
    typeof answer.word === 'string' &&
    answer.word.toLowerCase().replace(/\s+/g, '') === lemma.replace(/ /g, '')
  );
}

export function correctionFor(
  activity: ActivityType,
  prompt: Record<string, unknown>,
) {
  if (activity === ActivityType.group) {
    const accepted = prompt.acceptedCategoryIds as string[];
    const choices = prompt.choices as CategoryChoice[];
    const choice = choices.find((c) => accepted.includes(c.id));
    return { categoryId: choice?.id ?? '', label: choice?.titleVi ?? '' };
  }
  if (activity === ActivityType.odd_letter) {
    return { letterIndex: prompt.extraIndex, letter: prompt.extra };
  }
  return { word: prompt.lemma };
}
