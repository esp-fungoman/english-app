import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivityType, GroupMode, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudentGuard,
  studentIdFromRequest,
} from '../student-auth/student.guard';
import { publicPrompt } from './prompt-public';
import { buildGroupBoard } from './group-board';
import {
  buildPrompt,
  correctionFor,
  gradeAnswer,
  isUnitOpen,
  unitAccess,
  isUsableWord,
  shuffle,
} from './round';

import { flattenWord, unitWordInclude } from '../curriculum/words';
import { groupWordsForUnit } from '../curriculum/group-words';

const ACTIVITIES = Object.values(ActivityType);
const sessionInclude = {
  attempts: {
    orderBy: { sortOrder: 'asc' },
    include: { word: { include: { word: true } } },
  },
} satisfies Prisma.PracticeSessionInclude;

type SessionWithItems = Prisma.PracticeSessionGetPayload<{
  include: typeof sessionInclude;
}>;
type Counts = Record<string, { correct: number; total: number }>;

function activityCounts(
  sessions: {
    activityType: ActivityType;
    attempts: { correct: boolean | null }[];
  }[],
): Counts {
  const counts: Counts = {};
  for (const activity of ACTIVITIES)
    counts[activity] = { correct: 0, total: 0 };
  for (const session of sessions) {
    for (const attempt of session.attempts) {
      if (attempt.correct === null) continue;
      counts[session.activityType].total += 1;
      if (attempt.correct) counts[session.activityType].correct += 1;
    }
  }
  return counts;
}

function progress(counts: Counts) {
  return Object.fromEntries(
    ACTIVITIES.map((activity) => {
      const { correct, total } = counts[activity];
      return [
        activity,
        {
          correct,
          total,
          percent: total ? Math.round((correct / total) * 100) : 0,
          mastered: total > 0 && correct / total >= 0.8,
        },
      ];
    }),
  );
}

function categoryChoices(
  words: {
    categories: { categoryId: string; category: { titleVi: string } }[];
  }[],
) {
  return [
    ...new Map(
      words.flatMap((word) =>
        word.categories.map(
          (entry) =>
            [
              entry.categoryId,
              { id: entry.categoryId, titleVi: entry.category.titleVi },
            ] as const,
        ),
      ),
    ).values(),
  ];
}

@Controller()
export class PlayController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch('students/:id')
  @UseGuards(StudentGuard)
  async patchStudent(
    @Param('id') id: string,
    @Req() req: Request,
    @Body()
    body: {
      displayName?: string;
      gradeId?: string | null;
      school?: string | null;
      className?: string | null;
      avatarKey?: string | null;
    },
  ) {
    if (studentIdFromRequest(req) !== id)
      throw new ForbiddenException('Không sửa được hồ sơ khác');
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Dữ liệu hồ sơ không hợp lệ');
    if (
      (body.displayName !== undefined &&
        typeof body.displayName !== 'string') ||
      (body.school != null && typeof body.school !== 'string') ||
      (body.className != null && typeof body.className !== 'string') ||
      (body.avatarKey != null && typeof body.avatarKey !== 'string') ||
      (body.gradeId !== undefined && typeof body.gradeId !== 'string')
    )
      throw new BadRequestException('Dữ liệu hồ sơ không hợp lệ');
    const avatarPrefix = `uploads/avatars/${id}/`;
    if (
      typeof body.avatarKey === 'string' &&
      (body.avatarKey.length > 500 ||
        !body.avatarKey.startsWith(avatarPrefix) ||
        body.avatarKey.length <= avatarPrefix.length ||
        body.avatarKey.includes('..'))
    )
      throw new BadRequestException(
        'Ảnh đại diện không hợp lệ hoặc không thuộc tài khoản này',
      );
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Học sinh không tồn tại');
    const displayName = body.displayName?.trim();
    const school = body.school?.trim();
    const className = body.className?.trim();
    if (displayName !== undefined && (!displayName || displayName.length > 80))
      throw new BadRequestException('Tên phải có từ 1 đến 80 ký tự');
    if ((school?.length ?? 0) > 120 || (className?.length ?? 0) > 40)
      throw new BadRequestException('Tên trường hoặc lớp quá dài');
    if (body.gradeId !== undefined) {
      if (!body.gradeId) throw new BadRequestException('Hãy chọn khối lớp');
      const grade = await this.prisma.grade.findUnique({
        where: { id: body.gradeId },
      });
      if (!grade) throw new NotFoundException('Khối không tồn tại');
    }
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(body.gradeId !== undefined ? { gradeId: body.gradeId } : {}),
        ...(body.school !== undefined ? { school: school || null } : {}),
        ...(body.className !== undefined
          ? { className: className || null }
          : {}),
        ...(body.avatarKey !== undefined ? { avatarKey: body.avatarKey } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        gradeId: true,
        school: true,
        className: true,
        avatarKey: true,
      },
    });
  }

  @Get('grades')
  grades() {
    return this.prisma.grade.findMany({ orderBy: { level: 'asc' } });
  }

  private async requireStudentGrade(req: Request, gradeId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentIdFromRequest(req) },
    });
    if (!student) throw new ForbiddenException('Chưa đăng nhập');
    if (student.gradeId !== gradeId)
      throw new ForbiddenException('Unit không thuộc khối của bạn');
    return student;
  }

  @Get('grades/:gradeId/path')
  @UseGuards(StudentGuard)
  async path(@Param('gradeId') gradeId: string, @Req() req: Request) {
    const student = await this.requireStudentGrade(req, gradeId);
    const units = await this.prisma.unit.findMany({
      where: { gradeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        activities: true,
        words: { where: { active: true }, include: unitWordInclude },
        sessions: {
          where: { studentId: student.id },
          include: { attempts: { select: { correct: true } } },
        },
      },
    });
    return units.map((rawUnit) => {
      const unit = { ...rawUnit, words: rawUnit.words.map(flattenWord) };
      const activityProgress = progress(activityCounts(unit.sessions));
      const groupWords = groupWordsForUnit(rawUnit, units);
      const categories = categoryChoices(groupWords);
      const boardAvailable =
        unit.groupMode === GroupMode.board
          ? buildGroupBoard(
              groupWords.filter((word) => /^[a-z]{1,12}$/.test(word.lemma)),
              categories,
              unit.groupIncludePreviousUnits,
            ) !== null
          : false;
      const hasContent = unit.activities.some(({ activityType }) =>
        activityType === ActivityType.group &&
        unit.groupMode === GroupMode.board
          ? boardAvailable
          : (activityType === ActivityType.group
              ? groupWords
              : unit.words
            ).some((word) => isUsableWord(activityType, word, categories)),
      );
      return {
        id: unit.id,
        title: unit.title,
        sortOrder: unit.sortOrder,
        ...unitAccess(unit),
        hasContent,
        stars: Object.values(activityProgress).filter((p) => p.mastered).length,
        complete: Object.values(activityProgress).every((p) => p.mastered),
      };
    });
  }

  @Get('units/:unitId')
  @UseGuards(StudentGuard)
  async unit(@Param('unitId') unitId: string, @Req() req: Request) {
    const rawUnit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        activities: true,
        words: { where: { active: true }, include: unitWordInclude },
        sessions: {
          where: { studentId: studentIdFromRequest(req) },
          include: { attempts: { select: { correct: true } } },
        },
      },
    });
    if (!rawUnit) throw new NotFoundException('Unit không tồn tại');
    const unit = { ...rawUnit, words: rawUnit.words.map(flattenWord) };
    await this.requireStudentGrade(req, unit.gradeId);
    const groupWords = await this.groupWordPool(rawUnit);
    const categories = categoryChoices(groupWords);
    const board =
      unit.groupMode === GroupMode.board
        ? buildGroupBoard(
            groupWords.filter((word) => /^[a-z]{1,12}$/.test(word.lemma)),
            categories,
            unit.groupIncludePreviousUnits,
          )
        : null;
    const boardAvailable = board !== null;
    const activities = ACTIVITIES.filter((type) =>
      unit.activities.some((a) => a.activityType === type),
    ).map((type) => ({
      type,
      available:
        type === ActivityType.group && unit.groupMode === GroupMode.board
          ? boardAvailable
          : (type === ActivityType.group ? groupWords : unit.words).some(
              (word) => isUsableWord(type, word, categories),
            ),
    }));
    return {
      id: unit.id,
      title: unit.title,
      sortOrder: unit.sortOrder,
      gradeId: unit.gradeId,
      groupMode: unit.groupMode,
      ...unitAccess(unit),
      wordCount: unit.words.length,
      groupIncludePreviousUnits: unit.groupIncludePreviousUnits,
      groupWordCount:
        unit.groupMode === GroupMode.board
          ? (board?.words.length ?? 0)
          : groupWords.filter((word) =>
              isUsableWord(ActivityType.group, word, categories),
            ).length,
      categoryTitles: categories.map((category) => category.titleVi),
      activities,
      progress: progress(activityCounts(unit.sessions)),
    };
  }

  @Post('play/sessions')
  @UseGuards(StudentGuard)
  async startSession(
    @Req() req: Request,
    @Body() body: { unitId?: string; activityType?: ActivityType },
  ) {
    if (
      typeof body?.unitId !== 'string' ||
      !body.unitId ||
      !ACTIVITIES.includes(body.activityType as ActivityType)
    ) {
      throw new BadRequestException('Hoạt động không hợp lệ');
    }
    const rawUnit = await this.prisma.unit.findUnique({
      where: { id: body.unitId },
      include: {
        activities: true,
        words: { where: { active: true }, include: unitWordInclude },
      },
    });
    if (!rawUnit) throw new NotFoundException('Unit không tồn tại');
    const unit = { ...rawUnit, words: rawUnit.words.map(flattenWord) };
    const student = await this.requireStudentGrade(req, unit.gradeId);
    if (!isUnitOpen(unit.opensAt, unit.manualLock))
      throw new ForbiddenException('Unit đang khóa');
    const activity = body.activityType as ActivityType;
    if (!unit.activities.some((entry) => entry.activityType === activity)) {
      throw new ForbiddenException('Hoạt động chưa mở');
    }
    const cumulative =
      activity === ActivityType.group && unit.groupIncludePreviousUnits;
    const pool = cumulative ? await this.groupWordPool(rawUnit) : unit.words;
    const categories = categoryChoices(pool);
    const board =
      activity === ActivityType.group && unit.groupMode === GroupMode.board
        ? buildGroupBoard(
            pool.filter((word) => /^[a-z]{1,12}$/.test(word.lemma)),
            categories,
            cumulative,
          )
        : null;
    const words =
      activity === ActivityType.group && unit.groupMode === GroupMode.board
        ? (board?.words ?? [])
        : shuffle(
            pool.filter((word) => isUsableWord(activity, word, categories)),
          ).slice(0, cumulative ? undefined : 8);
    if (!words.length)
      throw new BadRequestException('Hoạt động chưa có đủ nội dung');
    const session = await this.prisma.practiceSession.create({
      data: {
        studentId: student.id,
        unitId: unit.id,
        activityType: activity,
        attempts: {
          create: words.map((word, sortOrder) => ({
            wordId: word.id,
            sortOrder,
            promptJson: board
              ? {
                  mode: GroupMode.board,
                  cumulative,
                  lemma: word.lemma.trim().toLowerCase(),
                  acceptedCategoryIds: word.categories
                    .map((entry) => entry.categoryId)
                    .filter((id) =>
                      board.groups.some((group) => group.id === id),
                    ),
                  choices: board.groups,
                }
              : buildPrompt(activity, word, categories),
          })),
        },
      },
      include: sessionInclude,
    });
    return this.formatSession(session);
  }

  @Get('play/sessions/:id')
  @UseGuards(StudentGuard)
  async getSession(@Param('id') id: string, @Req() req: Request) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Vòng chơi không tồn tại');
    if (session.studentId !== studentIdFromRequest(req))
      throw new ForbiddenException();
    if (!session.endedAt)
      await this.requireSessionAccess(req, session.unitId, session.id);
    return this.formatSession(session);
  }

  @Patch('play/sessions/:id/heartbeat')
  @UseGuards(StudentGuard)
  async heartbeat(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { activeMsDelta?: number },
  ) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException();
    if (session.studentId !== studentIdFromRequest(req))
      throw new ForbiddenException();
    if (session.endedAt) throw new ForbiddenException('Vòng chơi đã kết thúc');
    await this.requireSessionAccess(req, session.unitId, session.id);
    const delta = Number(body?.activeMsDelta);
    if (!Number.isFinite(delta) || delta < 0)
      throw new BadRequestException('Thời gian không hợp lệ');
    return this.prisma.practiceSession.update({
      where: { id },
      data: { activeMs: { increment: Math.min(Math.floor(delta), 30_000) } },
      select: { id: true, activeMs: true },
    });
  }

  @Post('play/sessions/:id/end')
  @UseGuards(StudentGuard)
  async endSession(@Param('id') id: string, @Req() req: Request) {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException();
    if (session.studentId !== studentIdFromRequest(req))
      throw new ForbiddenException();
    if (!session.endedAt) {
      await this.prisma.practiceSession.updateMany({
        where: { id, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
    return this.prisma.practiceSession.findUnique({
      where: { id },
      select: { id: true, endedAt: true, activeMs: true },
    });
  }

  @Post('play/attempts/:attemptId')
  @UseGuards(StudentGuard)
  async submit(
    @Param('attemptId') attemptId: string,
    @Req() req: Request,
    @Body() body: { answer?: Record<string, unknown>; durationMs?: number },
  ) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { session: true },
    });
    if (!attempt) throw new NotFoundException();
    if (attempt.session.studentId !== studentIdFromRequest(req))
      throw new ForbiddenException();
    const prompt = attempt.promptJson as Record<string, unknown>;
    if (prompt.mode === GroupMode.board)
      throw new BadRequestException('Bảng phân nhóm cần kiểm tra cả bảng');
    if (attempt.correct === null) {
      await this.requireSessionAccess(
        req,
        attempt.session.unitId,
        attempt.session.id,
      );
      if (attempt.session.endedAt)
        throw new ForbiddenException('Vòng chơi đã kết thúc');
      const answer = body?.answer;
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
        throw new BadRequestException('Câu trả lời không hợp lệ');
      }
      const duration = Number(body.durationMs);
      const correct = gradeAnswer(attempt.session.activityType, prompt, answer);
      await this.prisma.attempt.updateMany({
        where: { id: attemptId, correct: null },
        data: {
          correct,
          answerJson: answer as Prisma.InputJsonValue,
          durationMs: Number.isFinite(duration)
            ? Math.max(0, Math.min(Math.floor(duration), 120_000))
            : null,
        },
      });
    }
    const recorded = await this.prisma.attempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    return {
      id: recorded.id,
      correct: recorded.correct,
      correction: correctionFor(attempt.session.activityType, prompt),
    };
  }

  @Post('play/sessions/:id/group-board/submit')
  @UseGuards(StudentGuard)
  async submitGroupBoard(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { answers?: { attemptId: string; categoryId: string }[] },
  ) {
    if (!Array.isArray(body?.answers))
      throw new BadRequestException('Bảng trả lời không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM practice_sessions WHERE id = ${id} FOR UPDATE`;
      const session = await tx.practiceSession.findUnique({
        where: { id },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Vòng chơi không tồn tại');
      if (session.studentId !== studentIdFromRequest(req))
        throw new ForbiddenException();
      const prompts = session.attempts.map(
        (attempt) => attempt.promptJson as Record<string, unknown>,
      );
      if (
        session.activityType !== ActivityType.group ||
        prompts.length === 0 ||
        prompts.some((prompt) => prompt.mode !== GroupMode.board)
      )
        throw new BadRequestException('Không phải bảng phân nhóm');

      const groups = prompts[0].choices as { id: string }[] | undefined;
      const groupIds = new Set(groups?.map((group) => group.id));
      if (
        !Array.isArray(groups) ||
        groups.length < 2 ||
        (groups.length > 4 &&
          !prompts.every((prompt) => prompt.cumulative === true)) ||
        groupIds.size !== groups.length ||
        prompts.some((prompt) => {
          const choices = prompt.choices as { id: string }[] | undefined;
          const accepted = prompt.acceptedCategoryIds as string[] | undefined;
          return (
            !Array.isArray(choices) ||
            choices.length !== groups.length ||
            choices.some((choice) => !groupIds.has(choice.id)) ||
            !Array.isArray(accepted) ||
            !accepted.some((categoryId) => groupIds.has(categoryId)) ||
            accepted.filter((categoryId) => groupIds.has(categoryId)).length ===
              groups.length
          );
        }) ||
        groups.some(
          (group) =>
            !prompts.some((prompt) =>
              (prompt.acceptedCategoryIds as string[]).includes(group.id),
            ),
        )
      )
        throw new BadRequestException('Bảng phân nhóm không hợp lệ');

      const submitted = body.answers ?? [];
      const byId = new Map(
        submitted.map((answer) => [answer?.attemptId, answer]),
      );
      if (
        submitted.length !== session.attempts.length ||
        byId.size !== session.attempts.length ||
        session.attempts.some((attempt, index) => {
          const answer = byId.get(attempt.id);
          return !answer || !groupIds.has(answer.categoryId);
        })
      )
        throw new BadRequestException('Hãy xếp mỗi từ vào một nhóm trên bảng');

      if (session.attempts.every((attempt) => attempt.correct !== null))
        return this.formatSession(session);
      if (session.endedAt)
        throw new ForbiddenException('Vòng chơi đã kết thúc');
      await this.requireSessionAccess(req, session.unitId, session.id);
      if (session.attempts.some((attempt) => attempt.correct !== null))
        throw new BadRequestException('Bảng đã được kiểm tra một phần');

      for (const [index, attempt] of session.attempts.entries()) {
        const categoryId = byId.get(attempt.id)!.categoryId;
        await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            answerJson: { categoryId },
            correct: gradeAnswer(ActivityType.group, prompts[index], {
              categoryId,
            }),
          },
        });
      }
      const recorded = await tx.practiceSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      return this.formatSession(recorded);
    });
  }

  private async groupWordPool(
    unit: Prisma.UnitGetPayload<{
      include: { words: { include: typeof unitWordInclude } };
    }>,
  ) {
    if (!unit.groupIncludePreviousUnits) return unit.words.map(flattenWord);
    const sources = await this.prisma.unit.findMany({
      where: { gradeId: unit.gradeId, sortOrder: { lte: unit.sortOrder } },
      include: { words: { where: { active: true }, include: unitWordInclude } },
    });
    return groupWordsForUnit(unit, sources);
  }

  private async requireSessionAccess(
    req: Request,
    unitId: string,
    sessionId: string,
  ) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit không tồn tại');
    await this.requireStudentGrade(req, unit.gradeId);
    if (!isUnitOpen(unit.opensAt, unit.manualLock))
      throw new ForbiddenException('Unit đang khóa hoặc chưa đến giờ mở');
    const lockedSource = await this.prisma.unit.findFirst({
      where: {
        id: { not: unitId },
        words: { some: { attempts: { some: { sessionId, correct: null } } } },
        OR: [
          { manualLock: true },
          { opensAt: null },
          { opensAt: { gt: new Date() } },
        ],
      },
      select: { id: true },
    });
    if (lockedSource)
      throw new ForbiddenException('Unit chứa từ trong lượt chơi đã bị khóa');
  }

  private formatSession(session: SessionWithItems) {
    const firstPrompt = session.attempts[0]?.promptJson as
      | Record<string, unknown>
      | undefined;
    const groupMode =
      session.activityType === ActivityType.group &&
      firstPrompt?.mode === GroupMode.board
        ? GroupMode.board
        : GroupMode.single;
    return {
      id: session.id,
      unitId: session.unitId,
      activityType: session.activityType,
      groupMode,
      boardGroups: groupMode === GroupMode.board ? firstPrompt?.choices : null,
      endedAt: session.endedAt,
      activeMs: session.activeMs,
      items: session.attempts.map((attempt) => {
        const prompt = attempt.promptJson as Record<string, unknown>;
        return {
          attemptId: attempt.id,
          wordId: attempt.wordId,
          sortOrder: attempt.sortOrder,
          correct: attempt.correct,
          correction:
            attempt.correct === null
              ? null
              : correctionFor(session.activityType, prompt),
          selectedCategoryId:
            attempt.correct !== null &&
            session.activityType === ActivityType.group
              ? ((attempt.answerJson as { categoryId?: string } | null)
                  ?.categoryId ?? null)
              : null,
          imageKey: attempt.word.word.imageKey,
          prompt: publicPrompt(session.activityType, prompt),
        };
      }),
    };
  }
}
