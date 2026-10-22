import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudentGuard,
  studentIdFromRequest,
} from '../student-auth/student.guard';

/** Keep in sync with libs/shared ACTIVITY_LABELS_VI */
const ACTIVITY_LABELS_VI: Record<string, string> = {
  group: 'Ghép từ theo nhóm',
  odd_letter: 'Tìm chữ cái thừa',
  scramble: 'Sắp xếp chữ cái',
  listen_spell: 'Nghe và chọn chữ cái',
};

const TZ = 'Asia/Ho_Chi_Minh';

function dateKeyInTz(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Start of ISO week (Monday) in Asia/Ho_Chi_Minh, as UTC Date. */
function startOfIsoWeekVn(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dow = map[weekday] ?? 1;
  const mondayOffset = dow - 1;
  return new Date(Date.UTC(year, month - 1, day - mondayOffset, -7, 0, 0, 0));
}

function streakDays(sessionDates: Date[], now = new Date()): number {
  const days = new Set(sessionDates.map(dateKeyInTz));
  let streak = 0;
  const cursor = new Date(now);
  for (;;) {
    const key = dateKeyInTz(cursor);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('weekly')
  @UseGuards(StudentGuard)
  async weekly(@Req() req: Request) {
    const studentId = studentIdFromRequest(req);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { grade: { include: { units: true } } },
    });
    if (!student) throw new NotFoundException();

    const weekStart = startOfIsoWeekVn();
    const sessions = student.gradeId
      ? await this.prisma.practiceSession.findMany({
          where: { studentId, unit: { gradeId: student.gradeId } },
          include: { attempts: true },
        })
      : [];
    const reviewSessions = student.gradeId
      ? await this.prisma.reviewSession.findMany({
          where: { studentId, gradeId: student.gradeId },
          select: { startedAt: true, activeMs: true },
        })
      : [];
    const allPractice = [...sessions, ...reviewSessions];

    const weekMs = allPractice
      .filter((s) => s.startedAt >= weekStart)
      .reduce((sum, s) => sum + s.activeMs, 0);
    const dailyMs = new Map<string, number>();
    for (const session of allPractice) {
      if (session.startedAt < weekStart) continue;
      const key = dateKeyInTz(session.startedAt);
      dailyMs.set(key, (dailyMs.get(key) ?? 0) + session.activeMs);
    }
    const dailyActivity = Array.from({ length: 7 }, (_, day) => {
      const date = dateKeyInTz(
        new Date(weekStart.getTime() + day * 86_400_000),
      );
      return { date, minutes: Math.round((dailyMs.get(date) ?? 0) / 60_000) };
    });

    const byActivity: Record<string, { correct: number; total: number }> = {};
    const correctWords = new Set<string>();
    const unitStats = new Map<
      string,
      Record<string, { c: number; t: number }>
    >();

    for (const s of sessions) {
      byActivity[s.activityType] ??= { correct: 0, total: 0 };
      const u = unitStats.get(s.unitId) ?? {};
      u[s.activityType] ??= { c: 0, t: 0 };
      for (const a of s.attempts) {
        if (a.correct == null) continue;
        byActivity[s.activityType].total += 1;
        u[s.activityType].t += 1;
        if (a.correct) {
          byActivity[s.activityType].correct += 1;
          u[s.activityType].c += 1;
          correctWords.add(a.wordId);
        }
      }
      unitStats.set(s.unitId, u);
    }

    const types = Object.values(ActivityType);
    const unitsCompleted = [...unitStats.values()].filter((acts) =>
      types.every((t) => {
        const x = acts[t];
        return x && x.t > 0 && x.c / x.t >= 0.8;
      }),
    ).length;

    const percents = Object.fromEntries(
      Object.entries(byActivity).map(([k, v]) => [
        k,
        v.total ? Math.round((100 * v.correct) / v.total) : 0,
      ]),
    ) as Record<string, number>;

    const weakest = Object.entries(percents).sort((a, b) => a[1] - b[1])[0];
    const tipLabel = weakest
      ? (ACTIVITY_LABELS_VI[weakest[0]] ?? weakest[0])
      : undefined;

    return {
      studentName: student.displayName,
      minutesThisWeek: Math.round(weekMs / 60000),
      dailyActivity,
      unitsCompleted,
      unitsTotal: student.grade?.units.length ?? 0,
      wordsLearned: correctWords.size,
      streakDays: streakDays([
        ...sessions.map((s) => s.startedAt),
        ...reviewSessions
          .filter((s) => s.activeMs > 0)
          .map((s) => s.startedAt),
      ]),
      activityPercents: percents,
      weakestActivity: weakest?.[0] ?? null,
      tip: tipLabel
        ? `Gợi ý: nên luyện thêm “${tipLabel}”.`
        : 'Hãy chơi một hoạt động để xem báo cáo.',
    };
  }
}
