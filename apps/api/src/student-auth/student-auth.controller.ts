import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  clearStudentCookie,
  setStudentCookie,
  StudentGuard,
  studentIdFromRequest,
} from './student.guard';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function publicStudent(s: {
  id: string;
  username: string;
  displayName: string;
  gradeId: string | null;
  school: string | null;
  className: string | null;
  avatarKey: string | null;
}) {
  return {
    id: s.id,
    username: s.username,
    displayName: s.displayName,
    gradeId: s.gradeId,
    school: s.school,
    className: s.className,
    avatarKey: s.avatarKey,
  };
}

@Controller('student/auth')
export class StudentAuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      username?: string;
      password?: string;
      confirmPassword?: string;
      displayName?: string;
      gradeId?: string;
      school?: string;
      className?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = normalizeUsername(body?.username);
    const password = typeof body?.password === 'string' ? body.password : '';
    const displayName =
      typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const gradeId = typeof body?.gradeId === 'string' ? body.gradeId : '';
    const school = typeof body?.school === 'string' ? body.school.trim() : '';
    const className =
      typeof body?.className === 'string' ? body.className.trim() : '';
    if (!USERNAME_RE.test(username)) {
      throw new BadRequestException('Tên đăng nhập 3–20 ký tự: chữ, số hoặc _');
    }
    if (password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException(
        'Mật khẩu cần ít nhất 6 ký tự và tối đa 72 byte',
      );
    }
    if (
      typeof body?.confirmPassword !== 'string' ||
      body.confirmPassword !== password
    ) {
      throw new BadRequestException('Mật khẩu nhập lại chưa khớp');
    }
    if (!displayName || displayName.length > 80) {
      throw new BadRequestException('Tên phải có từ 1 đến 80 ký tự');
    }
    if (school.length > 120 || className.length > 40) {
      throw new BadRequestException('Tên trường hoặc lớp quá dài');
    }
    const grade = gradeId
      ? await this.prisma.grade.findUnique({ where: { id: gradeId } })
      : null;
    if (!grade) throw new BadRequestException('Hãy chọn khối lớp');

    const existing = await this.prisma.student.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('Tên đăng nhập đã dùng');
    }

    const passwordHash = await hash(password, 10);
    try {
      const student = await this.prisma.student.create({
        data: {
          username,
          passwordHash,
          displayName,
          gradeId,
          school: school || null,
          className: className || null,
        },
      });
      setStudentCookie(res, student.id);
      return publicStudent(student);
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code)
          : '';
      if (code === 'P2002') {
        throw new ConflictException('Tên đăng nhập đã dùng');
      }
      throw e;
    }
  }

  @Post('login')
  async login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = normalizeUsername(body?.username);
    const password = typeof body?.password === 'string' ? body.password : '';
    const student = await this.prisma.student.findUnique({
      where: { username },
    });
    const validPassword = await compare(
      password,
      student?.passwordHash ??
        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    );
    if (!student || !validPassword) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    setStudentCookie(res, student.id);
    return publicStudent(student);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearStudentCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(StudentGuard)
  async me(@Req() req: Request) {
    const id = studentIdFromRequest(req);
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }
    return publicStudent(student);
  }
}
