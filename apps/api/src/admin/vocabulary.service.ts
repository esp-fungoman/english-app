import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  boardAvailable,
  choicesFor,
  flattenWord,
  normalize,
  playability,
  searchable,
  unitWordInclude,
} from '../curriculum/words';

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'determiner',
  'conjunction',
  'interjection',
  'other',
];
const wordInclude = {
  categories: { include: { category: true } },
  units: {
    where: { active: true },
    include: {
      categories: { include: { category: true } },
      unit: {
        include: {
          grade: true,
          activities: true,
          words: { where: { active: true }, include: unitWordInclude },
        },
      },
    },
  },
} satisfies Prisma.WordInclude;
type Entry = Prisma.WordGetPayload<{ include: typeof wordInclude }>;
export type WordInput = {
  lemma: string;
  meaningVi?: string | null;
  partOfSpeech?: string | null;
  imageKey?: string | null;
  audioKey?: string | null;
  categoryIds?: string[];
  units?: { unitId: string; categoryIds?: string[] }[];
};
export function cleanText(
  value: unknown,
  label: string,
  max: number,
  required = false,
) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new BadRequestException(`Cần nhập ${label}`);
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new BadRequestException(`${label} không hợp lệ`);
  return value.trim().replace(/\s+/g, ' ') || null;
}
export function ids(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 500 ||
    value.some((id) => typeof id !== 'string' || !id || id.length > 100)
  )
    throw new BadRequestException('Danh sách lựa chọn không hợp lệ');
  return [...new Set(value)];
}
type UnitContext = { choices: ReturnType<typeof choicesFor>; board: boolean };
function format(word: Entry, cache = new Map<string, UnitContext>()) {
  const usages = word.units.map((link) => {
    let context = cache.get(link.unitId);
    if (!context) {
      const words = link.unit.words.map(flattenWord);
      context = {
        choices: choicesFor(words),
        board: link.unit.groupMode !== 'board' || boardAvailable(words),
      };
      cache.set(link.unitId, context);
    }
    const activities = playability(
      { lemma: word.lemma, categories: link.categories },
      context.choices,
    );
    for (const type of Object.keys(activities) as (keyof typeof activities)[]) {
      if (!link.unit.activities.some((item) => item.activityType === type))
        activities[type] = {
          usable: false,
          reason: 'Hoạt động chưa được bật trong unit.',
        };
    }
    if (!context.board)
      activities.group = {
        usable: false,
        reason: 'Bảng phân nhóm chưa đủ từ và nhóm phù hợp.',
      };
    return {
      id: link.id,
      unitId: link.unitId,
      title: link.unit.title,
      gradeId: link.unit.gradeId,
      gradeLevel: link.unit.grade.level,
      categoryIds: link.categories.map((item) => item.categoryId),
      categories: link.categories.map((item) => item.category),
      activities,
    };
  });
  const lexical = playability({ lemma: word.lemma, categories: [] }, []);
  return {
    id: word.id,
    lemma: word.lemma,
    meaningVi: word.meaningVi,
    partOfSpeech: word.partOfSpeech,
    imageKey: word.imageKey,
    audioKey: word.audioKey,
    initial: word.initial,
    categoryIds: word.categories.map((item) => item.categoryId),
    categories: word.categories.map((item) => item.category),
    units: usages,
    activities: lexical,
    unplayable: !usages.some((usage) =>
      Object.values(usage.activities).some((activity) => activity.usable),
    ),
  };
}
@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService) {}
  async get(id: string) {
    const word = await this.prisma.word.findUnique({
      where: { id },
      include: wordInclude,
    });
    if (!word) throw new NotFoundException('Từ không tồn tại');
    return format(word);
  }
  async list(query: Record<string, string | undefined>) {
    const q = searchable(query.q ?? '');
    const grades = (query.grades ?? '').split(',').filter(Boolean);
    const units = (query.units ?? '').split(',').filter(Boolean);
    const categories = (query.categories ?? '').split(',').filter(Boolean);
    const quick = (query.quick ?? '').split(',').filter(Boolean);
    const words = await this.prisma.word.findMany({
      where: {
        ...(q ? { searchText: { contains: q } } : {}),
        ...(query.lemma ? { lemma: normalize(query.lemma) } : {}),
      },
      include: wordInclude,
      orderBy: [{ lemma: 'asc' }, { meaningKey: 'asc' }, { id: 'asc' }],
    });
    const cache = new Map<string, UnitContext>();
    const filtered = words
      .map((word) => format(word, cache))
      .filter((word) => {
        const scope = grades.length || units.length || categories.length;
        const fits = word.units.some(
          (link) =>
            (!grades.length || grades.includes(link.gradeId)) &&
            (!units.length || units.includes(link.unitId)) &&
            (!categories.length ||
              link.categoryIds.some((id) => categories.includes(id))),
        );
        const unattachedCategory =
          !grades.length &&
          !units.length &&
          !word.units.length &&
          word.categoryIds.some((id) => categories.includes(id));
        return (
          (!scope || fits || unattachedCategory) &&
          (!quick.includes('missing-image') || !word.imageKey) &&
          (!quick.includes('missing-meaning') || !word.meaningVi) &&
          (!quick.includes('unassigned') || !word.units.length) &&
          (!quick.includes('unplayable') || word.unplayable)
        );
      });
    const counts = Object.fromEntries(
      [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map((initial) => [
        initial,
        filtered.filter((word) => word.initial === initial).length,
      ]),
    );
    const offset = Number(query.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0)
      throw new BadRequestException('Vị trí tải không hợp lệ');
    const initial = query.initial ?? '';
    if (initial && !/^[A-Z#]$/.test(initial))
      throw new BadRequestException('Nhóm chữ cái không hợp lệ');
    const group = initial
      ? filtered.filter((word) => word.initial === initial)
      : filtered;
    return {
      total: filtered.length,
      counts,
      orderedIds: filtered.map((word) => word.id),
      groups: !initial
        ? Object.fromEntries(
            Object.keys(counts).map((key) => [
              key,
              filtered.filter((word) => word.initial === key).slice(0, 50),
            ]),
          )
        : undefined,
      items: group.slice(offset, offset + 50),
      hasMore: offset + 50 < group.length,
    };
  }
  async save(input: WordInput, id?: string) {
    if (!input || typeof input !== 'object')
      throw new BadRequestException('Dữ liệu từ không hợp lệ');
    const lemma = normalize(cleanText(input.lemma, 'từ/cụm từ', 120, true)!);
    const meaningVi = cleanText(input.meaningVi, 'nghĩa tiếng Việt', 120);
    const meaningKey = normalize(meaningVi ?? '');
    const partOfSpeech = cleanText(input.partOfSpeech, 'loại từ', 30);
    if (partOfSpeech && !PARTS_OF_SPEECH.includes(partOfSpeech))
      throw new BadRequestException('Loại từ không hợp lệ');
    const imageKey = cleanText(input.imageKey, 'ảnh', 500);
    const audioKey = cleanText(input.audioKey, 'âm thanh', 500);
    for (const key of [imageKey, audioKey])
      if (
        key &&
        (!key.startsWith('uploads/') ||
          key.startsWith('uploads/avatars/') ||
          key.includes('..'))
      )
        throw new BadRequestException('Đường dẫn tài nguyên không hợp lệ');
    const categoryIds = ids(input.categoryIds ?? []);
    if (!Array.isArray(input.units ?? []))
      throw new BadRequestException('Danh sách unit không hợp lệ');
    const usages = input.units ?? [];
    if (
      usages.length > 500 ||
      usages.some(
        (link) => !link || typeof link !== 'object' || Array.isArray(link),
      )
    )
      throw new BadRequestException('Danh sách unit không hợp lệ');
    const unitIds = ids(usages.map((link) => link?.unitId));
    if (unitIds.length !== usages.length)
      throw new BadRequestException('Unit bị trùng');
    const allCategories = ids([
      ...categoryIds,
      ...usages.flatMap((link) =>
        link.categoryIds === undefined ? categoryIds : ids(link.categoryIds),
      ),
    ]);
    try {
      const wordId = await this.prisma.$transaction(
        async (tx) => {
          if (id && !(await tx.word.findUnique({ where: { id } })))
            throw new NotFoundException('Từ không tồn tại');
          if (
            (await tx.unit.count({ where: { id: { in: unitIds } } })) !==
              unitIds.length ||
            (await tx.category.count({
              where: { id: { in: allCategories } },
            })) !== allCategories.length
          )
            throw new BadRequestException('Unit hoặc category không tồn tại');
          if (
            !meaningVi &&
            (await tx.word.count({
              where: { lemma, ...(id ? { id: { not: id } } : {}) },
            }))
          )
            throw new ConflictException(
              'Từ đã có. Hãy chọn hồ sơ có sẵn hoặc nhập nghĩa khác.',
            );
          const data = {
            lemma,
            meaningVi,
            meaningKey,
            searchText: searchable(`${lemma} ${meaningVi ?? ''}`),
            initial: /^[a-z]/.test(lemma) ? lemma[0].toUpperCase() : '#',
            partOfSpeech,
            imageKey,
            audioKey,
          };
          const saved = id
            ? await tx.word.update({ where: { id }, data })
            : await tx.word.create({ data });
          await tx.wordCategory.deleteMany({ where: { wordId: saved.id } });
          await tx.wordCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              wordId: saved.id,
              categoryId,
            })),
          });
          await tx.unitWord.updateMany({
            where: { wordId: saved.id, unitId: { notIn: unitIds } },
            data: { active: false },
          });
          for (const usage of usages) {
            const existing = await tx.unitWord.findUnique({
              where: {
                unitId_wordId: { unitId: usage.unitId, wordId: saved.id },
              },
            });
            const link = await tx.unitWord.upsert({
              where: {
                unitId_wordId: { unitId: usage.unitId, wordId: saved.id },
              },
              create: { unitId: usage.unitId, wordId: saved.id },
              update: { active: true },
            });
            if (!existing || usage.categoryIds !== undefined) {
              await tx.unitWordCategory.deleteMany({
                where: { unitWordId: link.id },
              });
              await tx.unitWordCategory.createMany({
                data: (usage.categoryIds ?? categoryIds).map((categoryId) => ({
                  unitWordId: link.id,
                  categoryId,
                })),
              });
            }
          }
          return saved.id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 60000,
        },
      );
      return this.get(wordId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Từ và nghĩa đã có hoặc dữ liệu vừa thay đổi. Hãy tải lại rồi thử tiếp.',
        );
      throw error;
    }
  }
  async missingImages() {
    return (await this.list({ quick: 'missing-image' })).items;
  }
}
