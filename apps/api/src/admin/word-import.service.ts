import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalize, searchable } from '../curriculum/words';
import {
  type ImportIssue,
  type ImportWord,
  type ParsedImport,
  parseWordImport,
} from './word-import.parser';

type Client = PrismaService | Prisma.TransactionClient;
type ResolvedWord = ImportWord & { existingId?: string; meaningKey: string };
@Injectable()
export class WordImportService {
  constructor(private readonly prisma: PrismaService) {}
  async run(buffer: Buffer, mode: 'preview' | 'commit') {
    const parsed = await parseWordImport(buffer);
    if (mode === 'preview')
      return (await this.inspect(this.prisma, parsed)).report;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const { report, resolved } = await this.inspect(tx, parsed);
          if (!report.ok) throw new UnprocessableEntityException(report);
          await this.commit(tx, parsed, resolved);
          return { ...report, committed: true };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 60_000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Nội dung vừa thay đổi. Hãy xem trước lại rồi thử tiếp.',
        );
      throw error;
    }
  }
  private async inspect(client: Client, parsed: ParsedImport) {
    const errors: ImportIssue[] = [...parsed.errors];
    const warnings: string[] = [
      'Unit mới chưa có lịch sẽ bị khóa. Category trong từng dòng Words dùng riêng cho unit đó; liên kết đã có được giữ nguyên.',
    ];
    const counts = {
      unitsCreated: 0,
      categoriesCreated: 0,
      wordsCreated: 0,
      wordsSkipped: 0,
      linksCreated: 0,
    };
    const resolved: ResolvedWord[] = [];
    const report = () => ({
      templateVersion: 'vocabulary-import-v1' as const,
      committed: false,
      ok: errors.length === 0,
      counts,
      warnings,
      errors,
    });
    if (errors.length) return { report: report(), resolved };
    const [grades, units, categories, words] = await Promise.all([
      client.grade.findMany(),
      client.unit.findMany(),
      client.category.findMany(),
      client.word.findMany({
        where: {
          lemma: { in: [...new Set(parsed.words.map((word) => word.lemma))] },
        },
        include: { units: true },
      }),
    ]);
    const issue = (
      row: number,
      field: string,
      message: string,
      sheet = 'Words',
    ) => errors.push({ sheet, row, field, code: 'CONTENT_CONFLICT', message });
    const unitByCode = new Map<string, (typeof units)[number]>(
      units.map((unit) => {
        const grade = grades.find((grade) => grade.id === unit.gradeId);
        return [
          `K${grade?.level}-U${String(unit.sortOrder).padStart(2, '0')}`,
          unit,
        ] as const;
      }),
    );
    for (const unit of parsed.units) {
      if (!grades.some((grade) => grade.level === unit.gradeLevel))
        issue(
          unit.row,
          'grade_level',
          'Khối chưa tồn tại. Chạy seed khối 1–5 trước khi nhập.',
          'Units',
        );
      const current = unitByCode.get(unit.code);
      if (!current) counts.unitsCreated++;
      else if (
        current.title !== unit.title ||
        (unit.groupMode && unit.groupMode !== current.groupMode)
      )
        issue(
          unit.row,
          'unit_title',
          'Tên hoặc chế độ unit khác dữ liệu đang có. Sửa file cho khớp.',
          'Units',
        );
    }
    for (const category of parsed.categories) {
      const current = categories.find((item) => item.slug === category.code);
      if (!current) counts.categoriesCreated++;
      else if (current.titleVi !== category.titleVi)
        issue(
          category.row,
          'category_title_vi',
          'Tên category khác dữ liệu đang có.',
          'Categories',
        );
    }
    const seen = new Map<string, ResolvedWord>();
    for (const incoming of parsed.words) {
      const matches = words.filter((word) => word.lemma === incoming.lemma);
      const fileMeanings = [
        ...new Set(
          parsed.words
            .filter((word) => word.lemma === incoming.lemma && word.meaningVi)
            .map((word) => normalize(word.meaningVi)),
        ),
      ];
      let meaningVi = incoming.meaningVi;
      if (!meaningVi) {
        const senses = new Map([
          ...matches.map(
            (word) => [word.meaningKey, word.meaningVi ?? ''] as const,
          ),
          ...parsed.words
            .filter((word) => word.lemma === incoming.lemma && word.meaningVi)
            .map(
              (word) => [normalize(word.meaningVi), word.meaningVi] as const,
            ),
        ]);
        if (senses.size > 1) {
          issue(
            incoming.row,
            'meaning_vi',
            'Có nhiều nghĩa cùng cách viết. Hãy điền nghĩa để chọn đúng hồ sơ.',
          );
          continue;
        }
        meaningVi = [...senses.values()][0] ?? '';
      }
      const meaningKey = normalize(meaningVi);
      const key = `${incoming.lemma}\u0000${meaningKey}`;
      const existing = matches.find((word) => word.meaningKey === meaningKey);
      const current = seen.get(key);
      const word = {
        ...incoming,
        meaningVi,
        meaningKey,
        existingId: existing?.id,
      };
      if (
        existing?.partOfSpeech &&
        incoming.partOfSpeech &&
        existing.partOfSpeech !== incoming.partOfSpeech
      )
        issue(
          incoming.row,
          'part_of_speech',
          'Loại từ khác hồ sơ đang có. Không tự ghi đè.',
        );
      if (current && current.partOfSpeech !== incoming.partOfSpeech)
        issue(
          incoming.row,
          'part_of_speech',
          'Cùng từ và nghĩa nhưng loại từ khác nhau trong file.',
        );
      if (!meaningVi && (matches.length || fileMeanings.length))
        warnings.push(
          `Dòng ${incoming.row}: đang sử dụng hồ sơ cùng cách viết; kiểm tra nghĩa trước khi xác nhận.`,
        );
      if (existing || current) counts.wordsSkipped++;
      else counts.wordsCreated++;
      const unit = unitByCode.get(incoming.unitCode);
      if (
        !existing ||
        !unit ||
        !existing.units.some((link) => link.unitId === unit.id)
      )
        counts.linksCreated++;
      seen.set(key, word);
      resolved.push(word);
    }
    const linkKeys = new Set<string>();
    for (const word of resolved) {
      const key = `${word.unitCode}:${word.lemma}:${word.meaningKey}`;
      if (linkKeys.has(key))
        issue(word.row, 'lemma', 'Trùng từ và nghĩa trong cùng unit.');
      linkKeys.add(key);
    }
    return { report: report(), resolved };
  }
  private async commit(
    tx: Prisma.TransactionClient,
    parsed: ParsedImport,
    resolved: ResolvedWord[],
  ) {
    const unitIds = new Map<string, string>();
    for (const unit of parsed.units) {
      const grade = await tx.grade.findUniqueOrThrow({
        where: { level: unit.gradeLevel },
      });
      const saved = await tx.unit.upsert({
        where: {
          gradeId_sortOrder: { gradeId: grade.id, sortOrder: unit.number },
        },
        create: {
          gradeId: grade.id,
          sortOrder: unit.number,
          title: unit.title,
          groupMode: unit.groupMode ?? 'single',
          activities: {
            create: Object.values(ActivityType).map((activityType) => ({
              activityType,
            })),
          },
        },
        update: {},
      });
      unitIds.set(unit.code, saved.id);
    }
    const categoryIds = new Map<string, string>();
    for (const category of parsed.categories) {
      const saved = await tx.category.upsert({
        where: { slug: category.code },
        create: { slug: category.code, titleVi: category.titleVi },
        update: {},
      });
      categoryIds.set(category.code, saved.id);
    }
    for (const word of resolved) {
      const categories = word.categoryCodes.map(
        (code) => categoryIds.get(code)!,
      );
      const saved = await tx.word.upsert({
        where: {
          lemma_meaningKey: { lemma: word.lemma, meaningKey: word.meaningKey },
        },
        create: {
          lemma: word.lemma,
          meaningKey: word.meaningKey,
          meaningVi: word.meaningVi || null,
          partOfSpeech: word.partOfSpeech || null,
          searchText: searchable(`${word.lemma} ${word.meaningVi}`),
          initial: /^[a-z]/.test(word.lemma)
            ? word.lemma[0].toUpperCase()
            : '#',
          categories: {
            create: categories.map((categoryId) => ({ categoryId })),
          },
        },
        update: {},
      });
      const unitId = unitIds.get(word.unitCode)!;
      // Existing link categories and history survive reimport; detached links are reactivated.
      await tx.unitWord.upsert({
        where: { unitId_wordId: { unitId, wordId: saved.id } },
        create: {
          unitId,
          wordId: saved.id,
          categories: {
            create: categories.map((categoryId) => ({ categoryId })),
          },
        },
        update: { active: true },
      });
    }
  }
}
