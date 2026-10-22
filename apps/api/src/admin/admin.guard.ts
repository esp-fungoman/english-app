import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Request, Response } from 'express';

export const ADMIN_COOKIE = 'admin_session';
const MAX_AGE = 8 * 60 * 60 * 1000;
let localSecret: string | undefined;
export function adminCredentials() {
  const username =
    process.env.ADMIN_USERNAME ??
    (process.env.NODE_ENV === 'production' ? '' : 'admin');
  const password =
    process.env.ADMIN_PASSWORD ??
    (process.env.NODE_ENV === 'production' ? '' : 'admin');
  if (
    !username ||
    !password ||
    (process.env.NODE_ENV === 'production' &&
      username === 'admin' &&
      password === 'admin')
  )
    throw new Error('Configure production admin credentials');
  return { username, password };
}
export function adminSessionSecret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production' || value)
    throw new Error('ADMIN_SESSION_SECRET must have at least 32 characters');
  return (localSecret ??= randomBytes(32).toString('hex'));
}
function signature(value: string) {
  const credentials = adminCredentials();
  return createHmac('sha256', adminSessionSecret())
    .update(JSON.stringify(credentials))
    .update('\0')
    .update(value)
    .digest('base64url');
}
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function adminIdFromRequest(req: Request): string | null {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !safeEqual(parts[1], signature(parts[0])))
    return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (
      payload.v !== 1 ||
      payload.sub !== adminCredentials().username ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Date.now() ||
      payload.exp > Date.now() + MAX_AGE
    )
      return null;
    return payload.sub;
  } catch {
    return null;
  }
}
export function setAdminCookie(res: Response) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      sub: adminCredentials().username,
      exp: Date.now() + MAX_AGE,
      nonce: randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');
  res.clearCookie('admin_ok', { path: '/' });
  res.cookie(ADMIN_COOKIE, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!adminIdFromRequest(context.switchToHttp().getRequest<Request>()))
      throw new UnauthorizedException(
        'Phiên quản trị không hợp lệ hoặc đã hết hạn',
      );
    return true;
  }
}
