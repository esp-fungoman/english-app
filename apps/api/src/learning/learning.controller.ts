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
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { isUnitOpen, shuffle } from '../play/round';
import {
  StudentGuard,
  studentIdFromRequest,
} from '../student-auth/student.guard';

import { flattenWord, unitWordInclude } from '../curriculum/words';

const reviewInclude = {
  questions: {
    orderBy: { sortOrder: 'asc' },
    include: { word: { include: { unit: true, word: true } } },
  },
} satisfies Prisma.ReviewSessionInclude;

type ReviewWithQuestions = Prisma.ReviewSessionGetPayload<{
  include: typeof reviewInclude;
}>;

@Controller('learning')
@UseGuards(StudentGuard)
export class LearningController {
  constructor(private readonly prisma: PrismaService) {}

  private async student(req: Request) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentIdFromRequest(req) },
      select: { id: true, gradeId: true },
    });
    if (!student) throw new ForbiddenException('Chưa đăng nhập');
    if (!student.gradeId) throw new ForbiddenException('Hãy chọn khối lớp');
    return { id: student.id, gradeId: student.gradeId };
  }

  private async openUnits(gradeId: string) {
    const units = await this.prisma.unit.findMany({
      where: { gradeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        words: {
          where: { active: true },
          orderBy: { word: { lemma: 'asc' } },
          include: unitWordInclude,
        },
      },
    });
    return units
      .filter((unit) => isUnitOpen(unit.opensAt, unit.manualLock))
      .map((unit) => ({ ...unit, words: unit.words.map(flattenWord) }));
  }

  @Get('wordbook')
  async wordbook(@Req() req: Request) {
    const student = await this.student(req);
    const units = await this.openUnits(student.gradeId);
    const wordIds = units.flatMap((unit) => unit.words.map((word) => word.id));
    const [attempts, reviewAnswers] = wordIds.length
      ? await Promise.all([
          this.prisma.attempt.findMany({
            where: {
              wordId: { in: wordIds },
              correct: { not: null },
              session: { studentId: student.id },
            },
            select: {
              wordId: true,
              correct: true,
              session: { select: { startedAt: true } },
            },
          }),
          this.prisma.reviewQuestion.findMany({
            where: {
              wordId: { in: wordIds },
              correct: { not: null },
              session: { studentId: student.id },
            },
            select: {
              wordId: true,
              correct: true,
              session: { select: { startedAt: true } },
            },
          }),
        ])
      : [[], []];
    const state = new Map<string, { at: number; correct: boolean }>();
    for (const answer of [...attempts, ...reviewAnswers]) {
      if (answer.correct === null) continue;
      const at = answer.session.startedAt.getTime();
      const previous = state.get(answer.wordId);
      if (!previous || at >= previous.at)
        state.set(answer.wordId, { at, correct: answer.correct });
    }
    const eligibleLemmas = new Set<string>();
    const eligibleMeanings = new Set<string>();
    let eligibleCount = 0;
    for (const word of units.flatMap((unit) => unit.words)) {
      const lemma = word.lemma.trim().toLowerCase();
      const meaning = word.meaningVi?.trim().toLowerCase();
      if (
        !lemma ||
        !meaning ||
        eligibleLemmas.has(lemma) ||
        eligibleMeanings.has(meaning)
      )
        continue;
      eligibleLemmas.add(lemma);
      eligibleMeanings.add(meaning);
      eligibleCount += 1;
    }
    return {
      reviewAvailable: eligibleCount >= 3,
      units: units.map((unit) => ({
        id: unit.id,
        title: unit.title,
        sortOrder: unit.sortOrder,
        words: unit.words.map((word) => ({
          id: word.id,
          lemma: word.lemma,
          meaningVi: word.meaningVi,
          partOfSpeech: word.partOfSpeech,
          imageKey: word.imageKey,
          categories: word.categories.map((entry) => entry.category.titleVi),
          practiced: state.has(word.id),
          needsReview: state.get(word.id)?.correct === false,
        })),
      })),
    };
  }

  private async ownReview(req: Request, id: string) {
    const student = await this.student(req);
    const session = await this.prisma.reviewSession.findUnique({
      where: { id },
      include: reviewInclude,
    });
    if (!session) throw new NotFoundException('Lượt ôn không tồn tại');
    if (session.studentId !== student.id || session.gradeId !== student.gradeId)
      throw new ForbiddenException('Lượt ôn không thuộc khối của bạn');
    return session;
  }

  private async publicReview(session: ReviewWithQuestions) {
    const ids = [
      ...new Set(
        session.questions.flatMap((question) =>
          Array.isArray(question.choiceIds)
            ? question.choiceIds.filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
        ),
      ),
    ];
    const choiceWords = await this.prisma.unitWord.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        word: { select: { lemma: true } },
        active: true,
        unit: { select: { opensAt: true, manualLock: true } },
      },
    });
    if (!session.endedAt && choiceWords.length !== ids.length)
      throw new ForbiddenException('Nội dung ôn đã thay đổi. Hãy bắt đầu lại.');
    if (
      !session.endedAt &&
      choiceWords.some(
        (word) =>
          !word.active || !isUnitOpen(word.unit.opensAt, word.unit.manualLock),
      )
    )
      throw new ForbiddenException('Từ của lượt ôn đã bị khóa');
    const byId = new Map(choiceWords.map((word) => [word.id, word.word.lemma]));
    return {
      id: session.id,
      gradeId: session.gradeId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      activeMs: session.activeMs,
      questions: session.questions.map((question) => {
        const snapshot = question.promptJson as {
          meaningVi?: string;
          choices?: { id: string; lemma: string }[];
        } | null;
        return {
          id: question.id,
          meaningVi: snapshot?.meaningVi ?? question.word.word.meaningVi,
          choices: (question.choiceIds as string[]).map((id) => ({
            id,
            lemma:
              snapshot?.choices?.find((choice) => choice.id === id)?.lemma ??
              byId.get(id) ??
              '',
          })),
          selectedWordId: question.selectedWordId,
          correct: question.correct,
          correctWordId: question.correct === null ? null : question.wordId,
        };
      }),
    };
  }

  @Post('review/sessions')
  async startReview(@Req() req: Request) {
    const student = await this.student(req);
    const units = await this.openUnits(student.gradeId);
    const seenLemmas = new Set<string>();
    const seenMeanings = new Set<string>();
    const eligible = shuffle(
      units
        .flatMap((unit) => unit.words)
        .filter((word) => {
          const lemma = word.lemma.trim().toLowerCase();
          const meaning = word.meaningVi?.trim().toLowerCase();
          if (
            !lemma ||
            !meaning ||
            seenLemmas.has(lemma) ||
            seenMeanings.has(meaning)
          )
            return false;
          seenLemmas.add(lemma);
          seenMeanings.add(meaning);
          return true;
        }),
    );
    if (eligible.length < 3)
      throw new BadRequestException('Chưa đủ từ có nghĩa tiếng Việt để ôn');

    const ids = eligible.map((word) => word.id);
    const [attempts, priorReviews] = await Promise.all([
      this.prisma.attempt.findMany({
        where: {
          wordId: { in: ids },
          correct: { not: null },
          session: { studentId: student.id },
        },
        select: {
          wordId: true,
          correct: true,
          session: { select: { startedAt: true } },
        },
      }),
      this.prisma.reviewQuestion.findMany({
        where: {
          wordId: { in: ids },
          correct: { not: null },
          session: { studentId: student.id },
        },
        select: {
          wordId: true,
          correct: true,
          session: { select: { startedAt: true } },
        },
      }),
    ]);
    const scores = new Map<
      string,
      { total: number; correct: number; latest: number; latestCorrect: boolean }
    >();
    for (const attempt of [...attempts, ...priorReviews]) {
      if (attempt.correct === null) continue;
      const score = scores.get(attempt.wordId) ?? {
        total: 0,
        correct: 0,
        latest: 0,
        latestCorrect: true,
      };
      score.total += 1;
      if (attempt.correct) score.correct += 1;
      const at = attempt.session.startedAt.getTime();
      if (at >= score.latest) {
        score.latest = at;
        score.latestCorrect = attempt.correct;
      }
      scores.set(attempt.wordId, score);
    }
    eligible.sort((a, b) => {
      const left = scores.get(a.id);
      const right = scores.get(b.id);
      const rank = (score: typeof left) =>
        !score ? 2 : !score.latestCorrect ? 0 : 1;
      return (
        rank(left) - rank(right) ||
        (left && right
          ? left.correct / left.total - right.correct / right.total
          : 0)
      );
    });
    const targets = eligible.slice(0, 5);
    const session = await this.prisma.reviewSession.create({
      data: {
        studentId: student.id,
        gradeId: student.gradeId,
        questions: {
          create: targets.map((word, sortOrder) => {
            const choices = shuffle([
              word.id,
              ...shuffle(eligible.filter((choice) => choice.id !== word.id))
                .slice(0, 2)
                .map((choice) => choice.id),
            ]);
            return {
              wordId: word.id,
              sortOrder,
              choiceIds: choices,
              promptJson: {
                meaningVi: word.meaningVi,
                choices: choices.map((id) => ({
                  id,
                  lemma:
                    eligible.find((choice) => choice.id === id)?.lemma ?? '',
                })),
              },
            };
          }),
        },
      },
      include: reviewInclude,
    });
    return this.publicReview(session);
  }

  @Get('review/sessions/:id')
  async getReview(@Req() req: Request, @Param('id') id: string) {
    const session = await this.ownReview(req, id);
    if (
      !session.endedAt &&
      session.questions.some(
        (question) =>
          !question.word.active ||
          !isUnitOpen(
            question.word.unit.opensAt,
            question.word.unit.manualLock,
          ),
      )
    )
      throw new ForbiddenException('Từ của lượt ôn đã bị khóa');
    return this.publicReview(session);
  }

  @Post('review/sessions/:id/answers')
  async answerReview(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { questionId?: string; wordId?: string },
  ) {
    if (
      !body ||
      typeof body.questionId !== 'string' ||
      typeof body.wordId !== 'string'
    )
      throw new BadRequestException('Câu trả lời không hợp lệ');
    const session = await this.ownReview(req, id);
    const question = session.questions.find(
      (entry) => entry.id === body.questionId,
    );
    if (!question) throw new NotFoundException('Câu hỏi không tồn tại');
    if (
      !question.word.active ||
      !isUnitOpen(question.word.unit.opensAt, question.word.unit.manualLock)
    )
      throw new ForbiddenException('Từ của lượt ôn đã bị khóa');
    if (
      !Array.isArray(question.choiceIds) ||
      !question.choiceIds.includes(body.wordId)
    )
      throw new BadRequestException('Lựa chọn không hợp lệ');
    const options = await this.prisma.unitWord.findMany({
      where: { id: { in: question.choiceIds as string[] } },
      select: {
        active: true,
        unit: { select: { opensAt: true, manualLock: true } },
      },
    });
    if (
      options.length !== question.choiceIds.length ||
      options.some(
        (word) =>
          !word.active || !isUnitOpen(word.unit.opensAt, word.unit.manualLock),
      )
    )
      throw new ForbiddenException('Nội dung ôn đã thay đổi hoặc bị khóa');
    if (question.selectedWordId === null && !session.endedAt) {
      await this.prisma.reviewQuestion.updateMany({
        where: { id: question.id, sessionId: id, selectedWordId: null },
        data: {
          selectedWordId: body.wordId,
          correct: body.wordId === question.wordId,
        },
      });
    }
    const saved = await this.prisma.reviewQuestion.findUniqueOrThrow({
      where: { id: question.id },
      include: { word: { include: { word: true } } },
    });
    if (saved.selectedWordId === null)
      throw new BadRequestException('Lượt ôn đã kết thúc');
    return {
      questionId: saved.id,
      selectedWordId: saved.selectedWordId,
      correctWordId: saved.wordId,
      correctLemma: saved.word.word.lemma,
      correct: saved.correct,
    };
  }

  @Patch('review/sessions/:id/heartbeat')
  async heartbeat(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { activeMsDelta?: number },
  ) {
    const session = await this.ownReview(req, id);
    if (!session.endedAt) await this.publicReview(session);
    const delta = body?.activeMsDelta;
    if (!Number.isInteger(delta) || delta! < 1 || delta! > 30_000)
      throw new BadRequestException('Thời gian không hợp lệ');
    if (!session.endedAt)
      await this.prisma.reviewSession.updateMany({
        where: { id, endedAt: null },
        data: { activeMs: { increment: delta } },
      });
    return { ok: true };
  }

  @Post('review/sessions/:id/end')
  async endReview(@Req() req: Request, @Param('id') id: string) {
    await this.ownReview(req, id);
    await this.prisma.reviewSession.updateMany({
      where: { id, endedAt: null },
      data: { endedAt: new Date() },
    });
    return { ok: true };
  }
}
