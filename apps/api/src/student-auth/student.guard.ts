import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export const STUDENT_COOKIE = 'student_session';
export const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
let developmentSecret: string | undefined;

export function studentSessionSecret(): string {
  const configured = process.env.STUDENT_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('STUDENT_SESSION_SECRET must be at least 32 characters');
  }
  developmentSecret ??= randomBytes(32).toString('hex');
  return developmentSecret;
}

export function studentIdFromSignedCookie(req: {
  signedCookies?: Record<string, unknown>;
}): string | null {
  const value = req.signedCookies?.[STUDENT_COOKIE];
  if (typeof value !== 'string') return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const expiry = Number(value.slice(separator + 1));
  if (
    !/^[a-z0-9]+$/.test(id) ||
    !Number.isSafeInteger(expiry) ||
    expiry <= Date.now()
  ) {
    return null;
  }
  return id;
}

@Injectable()
export class StudentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      signedCookies?: Record<string, unknown>;
      studentId?: string;
    }>();
    const id = studentIdFromSignedCookie(req);
    if (!id) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }
    req.studentId = id;
    return true;
  }
}

export function studentIdFromRequest(req: Request): string {
  const id = (req as Request & { studentId?: string }).studentId;
  if (!id) {
    throw new UnauthorizedException('Chưa đăng nhập');
  }
  return id;
}

export function setStudentCookie(res: Response, studentId: string) {
  res.cookie(STUDENT_COOKIE, `${studentId}.${Date.now() + COOKIE_MAX_AGE}`, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
  });
}

export function clearStudentCookie(res: Response) {
  res.clearCookie(STUDENT_COOKIE, { path: '/' });
  res.clearCookie('student_id', { path: '/' });
}
