import { ActivityType, Prisma } from '@prisma/client';
import { buildGroupBoard } from '../play/group-board';
import { isUsableWord, type CategoryChoice } from '../play/round';

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
      const reason = usable
        ? null
        : !/^[a-z]+$/.test(word.lemma)
          ? 'Trò chơi hiện chỉ hỗ trợ từ đơn A–Z.'
          : word.lemma.length > 12
            ? 'Trò chơi hiện hỗ trợ tối đa 12 chữ.'
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
      words.filter((word) => /^[a-z]{1,12}$/.test(word.lemma)),
      choicesFor(words),
    ) !== null
  );
}
export function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}
export function searchable(value: string) {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
