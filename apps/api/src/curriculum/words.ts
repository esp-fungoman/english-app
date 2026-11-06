import { ActivityType, Prisma } from '@prisma/client';
import { buildGroupBoard } from '../play/group-board';
import {
  gameLemmaProblem,
  isGameLemma,
  isUsableWord,
  MAX_GAME_LETTERS,
  MAX_GAME_WORD_LETTERS,
  MAX_GAME_WORDS,
  type CategoryChoice,
} from '../play/round';

export const unitWordInclude = {
  word: true,
  categories: { include: { category: true } },
} satisfies Prisma.UnitWordInclude;
export type LinkedWord = Prisma.UnitWordGetPayload<{
  include: typeof unitWordInclude;
}>;
export function flattenWord(link: LinkedWord) {
  return { ...link.word, ...link, vocabularyId: link.word.id };
}
export function choicesFor(
  words: ReturnType<typeof flattenWord>[],
): CategoryChoice[] {
  return [
    ...new Map(
      words.flatMap((word) =>
        word.categories.map(
          (entry) =>
            [
              entry.categoryId,
              {
                id: entry.categoryId,
                titleVi: entry.category.titleVi,
              },
            ] as const,
        ),
      ),
    ).values(),
  ];
}
export function playability(
  word: {
    lemma: string;
    categories: {
      categoryId: string;
      category: { id: string; slug: string; titleVi: string };
    }[];
  },
  choices: CategoryChoice[],
) {
  return Object.fromEntries(
    Object.values(ActivityType).map((activity) => {
      const usable = isUsableWord(activity, word, choices);
      const problem = gameLemmaProblem(word.lemma);
      const reason = usable
        ? null
        : problem === 'letters'
          ? "Trò chơi chỉ hỗ trợ chữ A–Z, dấu cách, gạch nối (-) và dấu nháy (')."
          : problem === 'words'
            ? `Trò chơi hỗ trợ cụm tối đa ${MAX_GAME_WORDS} từ.`
            : problem === 'word-length'
              ? `Mỗi từ trong trò chơi tối đa ${MAX_GAME_WORD_LETTERS} chữ.`
              : problem === 'length'
                ? `Trò chơi hỗ trợ tối đa ${MAX_GAME_LETTERS} chữ cái.`
                : activity === 'group'
                  ? 'Cần nhóm đúng và ít nhất một nhóm sai trong unit.'
                  : 'Cần ít nhất hai chữ cái khác nhau.';
      return [activity, { usable, reason }];
    }),
  ) as Record<ActivityType, { usable: boolean; reason: string | null }>;
}
export function boardAvailable(words: ReturnType<typeof flattenWord>[]) {
  return (
    buildGroupBoard(
      words.filter((word) => isGameLemma(word.lemma)),
      choicesFor(words),
    ) !== null
  );
}
export function normalize(value: string) {
  return cleanLemma(value).toLowerCase();
}
/** Trims and collapses spaces but keeps capitals, so proper nouns like "America" survive. */
export function cleanLemma(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}
export function lemmaInitial(lemma: string) {
  return /^[a-z]/i.test(lemma) ? lemma[0].toUpperCase() : '#';
}
export function searchable(value: string) {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
