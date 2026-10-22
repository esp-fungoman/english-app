import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivityType, GroupMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  boardAvailable,
  flattenWord,
  unitWordInclude,
} from '../curriculum/words';
import { unitAccess } from '../play/round';
import { AdminGuard } from './admin.guard';
import {
  cleanText,
  ids,
  VocabularyService,
  type WordInput,
} from './vocabulary.service';

function date(value: unknown): Date | null {
  if (value === null || value === '') return null;
  if (
    typeof value !== 'string' ||
    !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(new Date(value).getTime())
  )
    throw new BadRequestException('Ngày mở cần có múi giờ hợp lệ');
  return new Date(value);
}
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vocabulary: VocabularyService,
  ) {}
  @Get('grades')
  async grades() {
    const grades = await this.prisma.grade.findMany({
      orderBy: { level: 'asc' },
      include: {
        units: {
          orderBy: { sortOrder: 'asc' },
          include: {
            activities: true,
            words: { where: { active: true }, include: unitWordInclude },
          },
        },
      },
    });
    return grades.map((grade) => ({
      ...grade,
      units: grade.units.map(({ words, ...unit }) => ({
        ...unit,
        ...unitAccess(unit),
        wordCount: words.length,
        boardAvailable: boardAvailable(words.map(flattenWord)),
      })),
    }));
  }
  @Post('units')
  async createUnit(
    @Body()
    body: {
      gradeId: string;
      title: string;
      sortOrder: number;
      groupMode?: GroupMode;
      opensAt?: string | null;
      manualLock?: boolean;
      activityTypes?: ActivityType[];
    },
  ) {
    const data = await this.unitData(body, true);
    return this.conflicts(() =>
      this.prisma.unit.create({
        data: {
          gradeId: body.gradeId,
          title: data.title!,
          sortOrder: data.sortOrder!,
          groupMode: data.groupMode,
          opensAt: data.opensAt,
          manualLock: data.manualLock,
          activities: {
            create: (body.activityTypes ?? Object.values(ActivityType)).map(
              (activityType) => ({ activityType }),
            ),
          },
        },
      }),
    );
  }
  @Patch('units/:id')
  async updateUnit(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      sortOrder?: number;
      groupMode?: GroupMode;
      opensAt?: string | null;
      manualLock?: boolean;
      activityTypes?: ActivityType[];
    },
  ) {
    if (!(await this.prisma.unit.findUnique({ where: { id } })))
      throw new NotFoundException('Unit không tồn tại');
    const data = await this.unitData(body);
    return this.conflicts(() =>
      this.prisma.$transaction(async (tx) => {
        const unit = await tx.unit.update({ where: { id }, data });
        if (body.activityTypes !== undefined) {
          await tx.unitActivity.deleteMany({ where: { unitId: id } });
          await tx.unitActivity.createMany({
            data: body.activityTypes.map((activityType) => ({
              unitId: id,
              activityType,
            })),
          });
        }
        return unit;
      }),
    );
  }
  @Post('units/schedule')
  async schedule(@Body() body: { unitIds: string[]; opensAt: string | null }) {
    const unitIds = ids(body.unitIds);
    if (!unitIds.length) throw new BadRequestException('Hãy chọn unit');
    const opensAt = date(body.opensAt);
    return this.prisma.$transaction(async (tx) => {
      if (
        (await tx.unit.count({ where: { id: { in: unitIds } } })) !==
        unitIds.length
      )
        throw new BadRequestException('Unit không tồn tại');
      return tx.unit.updateMany({
        where: { id: { in: unitIds } },
        data: { opensAt },
      });
    });
  }
  @Get('words/missing-images')
  missingImages() {
    return this.vocabulary.missingImages();
  }
  @Get('words')
  words(@Query() query: Record<string, string | undefined>) {
    return this.vocabulary.list(query);
  }
  @Get('words/:id')
  word(@Param('id') id: string) {
    return this.vocabulary.get(id);
  }
  @Post('words')
  createWord(@Body() body: WordInput) {
    return this.vocabulary.save(body);
  }
  @Patch('words/:id')
  async updateWord(@Param('id') id: string, @Body() body: Partial<WordInput>) {
    const current = await this.vocabulary.get(id);
    return this.vocabulary.save(
      {
        ...current,
        ...body,
        units:
          body.units ??
          current.units.map((link) => ({
            unitId: link.unitId,
            categoryIds: link.categoryIds,
          })),
      },
      id,
    );
  }
  @Get('categories')
  categories() {
    return this.prisma.category.findMany({ orderBy: { titleVi: 'asc' } });
  }
  @Post('categories')
  createCategory(@Body() body: { slug: string; titleVi: string }) {
    return this.conflicts(() =>
      this.prisma.category.create({ data: this.categoryData(body) }),
    );
  }
  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { slug: string; titleVi: string },
  ) {
    if (!(await this.prisma.category.findUnique({ where: { id } })))
      throw new NotFoundException('Category không tồn tại');
    return this.conflicts(() =>
      this.prisma.category.update({
        where: { id },
        data: this.categoryData(body),
      }),
    );
  }
  private categoryData(body: { slug: string; titleVi: string }) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Dữ liệu category không hợp lệ');
    const slug = cleanText(body.slug, 'mã category', 50, true)!.toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(slug))
      throw new BadRequestException(
        'Mã category dùng chữ thường, số và gạch ngang',
      );
    return {
      slug,
      titleVi: cleanText(body.titleVi, 'tên category', 80, true)!,
    };
  }
  private async unitData(
    body: {
      gradeId?: string;
      title?: string;
      sortOrder?: number;
      groupMode?: GroupMode;
      opensAt?: string | null;
      manualLock?: boolean;
      activityTypes?: ActivityType[];
    },
    create = false,
  ) {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Dữ liệu unit không hợp lệ');
    if (
      create &&
      (typeof body.gradeId !== 'string' ||
        !body.gradeId ||
        !(await this.prisma.grade.findUnique({ where: { id: body.gradeId } })))
    )
      throw new BadRequestException('Khối không tồn tại');
    if (
      (create || body.sortOrder !== undefined) &&
      (!Number.isInteger(body.sortOrder) ||
        body.sortOrder! < 1 ||
        body.sortOrder! > 10)
    )
      throw new BadRequestException('Số unit từ 1 đến 10');
    if (
      body.groupMode !== undefined &&
      !Object.values(GroupMode).includes(body.groupMode)
    )
      throw new BadRequestException('Chế độ phân nhóm không hợp lệ');
    if (body.manualLock !== undefined && typeof body.manualLock !== 'boolean')
      throw new BadRequestException('Trạng thái khóa không hợp lệ');
    if (
      body.activityTypes !== undefined &&
      (!Array.isArray(body.activityTypes) ||
        body.activityTypes.some(
          (type) => !Object.values(ActivityType).includes(type),
        ) ||
        new Set(body.activityTypes).size !== body.activityTypes.length)
    )
      throw new BadRequestException('Hoạt động không hợp lệ');
    return {
      ...(create || body.title !== undefined
        ? { title: cleanText(body.title, 'tên unit', 120, true)! }
        : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.groupMode !== undefined ? { groupMode: body.groupMode } : {}),
      ...(body.manualLock !== undefined ? { manualLock: body.manualLock } : {}),
      ...(body.opensAt !== undefined ? { opensAt: date(body.opensAt) } : {}),
    };
  }
  private async conflicts<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Mã hoặc số thứ tự đã tồn tại, hoặc dữ liệu vừa thay đổi.',
        );
      throw error;
    }
  }
}
