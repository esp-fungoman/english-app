import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import {
  adminCredentials,
  adminIdFromRequest,
  adminSessionSecret,
} from '../admin/admin.guard';
import {
  studentIdFromSignedCookie,
  studentSessionSecret,
} from '../student-auth/student.guard';
import { RateLimiter, positiveEnv, type Limit } from './rate-limit';

export function securityConfig() {
  const production = process.env.NODE_ENV === 'production';
  function origin(name: string, fallback: string) {
    const value = process.env[name] ?? (production ? '' : fallback);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Configure ${name}`);
    }
    if (
      url.origin !== value ||
      (production
        ? url.protocol !== 'https:'
        : !['http:', 'https:'].includes(url.protocol)) ||
      url.username ||
      url.password
    )
      throw new Error(`Invalid ${name}`);
    return value;
  }
  const web = origin('WEB_ORIGIN', 'http://localhost:3000');
  const admin = origin('ADMIN_ORIGIN', 'http://localhost:3001');
  adminCredentials();
  const adminSecret = adminSessionSecret();
  const studentSecret = studentSessionSecret();
  if (production && adminSecret === studentSecret)
    throw new Error('Admin and student secrets must differ');
  const secret = process.env.RATE_LIMIT_SECRET || adminSecret;
  if (secret.length < 32)
    throw new Error('RATE_LIMIT_SECRET must have at least 32 characters');
  // Validate overrides at startup, not on a user's request.
  for (const [key, value] of Object.entries(process.env))
    if (key.startsWith('RATE_LIMIT_') && key !== 'RATE_LIMIT_SECRET' && value)
      positiveEnv(key, 1);
  const proxy = process.env.TRUSTED_PROXIES;
  if (
    proxy &&
    proxy.split(',').some((entry) => {
      const [address, prefix, extra] = entry.trim().split('/');
      const version = isIP(address);
      return (
        !version ||
        extra !== undefined ||
        (prefix !== undefined &&
          (!/^\d+$/.test(prefix) ||
            Number(prefix) < 1 ||
            Number(prefix) > (version === 4 ? 32 : 128)))
      );
    })
  )
    throw new Error(
      'TRUSTED_PROXIES must contain explicit trusted IPs/CIDRs, never all-address networks',
    );
  return {
    web,
    admin,
    studentSecret,
    secret,
    proxy: proxy
      ? proxy
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : (false as const),
  };
}
function validInput(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (typeof value === 'string') return value.length <= 10000;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.length <= 2000 && value.every((v) => validInput(v, depth + 1));
  if (value && typeof value === 'object')
    return (
      Object.keys(value).length <= 100 &&
      Object.entries(value).every(
        ([key, child]) =>
          !['__proto__', 'prototype', 'constructor'].includes(key) &&
          validInput(child, depth + 1),
      )
    );
  return value === null || value === undefined || typeof value === 'boolean';
}
export function requestSecurity(
  config: ReturnType<typeof securityConfig>,
  limiter: RateLimiter,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const started = Date.now();
    const path = req.path.replace(/\/+$/, '') || '/';
    const group = path.startsWith('/api/admin')
      ? 'admin'
      : path.startsWith('/api/student')
        ? 'student'
        : path === '/api/media'
          ? 'media'
          : 'learning';
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () =>
      console.info(
        JSON.stringify({
          requestId,
          group,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - started,
          ...(res.statusCode >= 400 ? { event: 'request_rejected' } : {}),
        }),
      ),
    );
    if (path === '/api/health' && ['GET', 'HEAD'].includes(req.method))
      return next();
    const reject = (status: number, message: string) => {
      res.status(status).json({ statusCode: status, message, requestId });
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expected = group === 'admin' ? config.admin : config.web;
      if (req.get('Origin') !== expected || req.get('X-App-Request') !== '1')
        return reject(403, 'Nguồn yêu cầu không hợp lệ. Hãy tải lại trang.');
      const type = req.get('Content-Type')?.split(';')[0].toLowerCase();
      const multipart = path === '/api/admin/word-import';
      if (
        type &&
        type !== 'application/json' &&
        !(multipart && type === 'multipart/form-data')
      )
        return reject(415, 'Loại dữ liệu không được hỗ trợ');
    }
    if (
      (req.body !== undefined &&
        (req.body === null ||
          typeof req.body !== 'object' ||
          Array.isArray(req.body))) ||
      !validInput(req.body) ||
      !validInput(req.query) ||
      Object.values(req.query).some((value) => typeof value !== 'string')
    )
      return reject(400, 'Dữ liệu yêu cầu không hợp lệ');
    if (
      req.body === undefined &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    )
      req.body = {};
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const student = studentIdFromSignedCookie(req);
    const admin = adminIdFromRequest(req);
    const identity =
      group === 'admin' && admin
        ? `admin:${admin}`
        : student
          ? `student:${student}`
          : '';
    const limits: Limit[] = [];
    const add = (name: string, id: string, limit: number, ttl: number) =>
      limits.push({
        name,
        identity: id,
        limit: positiveEnv(`RATE_LIMIT_${name.toUpperCase()}`, limit),
        ttl,
      });
    add('ip', ip, 3000, 60000);
    if (identity) add('user', identity, 300, 60000);
    const login = /^\/api\/(admin|student)\/auth\/login$/i.test(path);
    const register = path.toLowerCase() === '/api/student/auth/register';
    const upload = /^\/api\/(admin|student)\/uploads\/presign$/i.test(path);
    const importing = path.toLowerCase() === '/api/admin/word-import';
    if (login) {
      const username =
        typeof req.body?.username === 'string'
          ? req.body.username.trim().toLowerCase().slice(0, 100)
          : '';
      add('login_pair', `${group}:${username}:${ip}`, 10, 900000);
      add('login_ip', ip, 300, 900000);
    }
    if (register) {
      add('register_hour', ip, 30, 3600000);
      add('register_day', ip, 100, 86400000);
    }
    if (upload) {
      if (!identity) return reject(401, 'Chưa đăng nhập');
      add(
        group === 'admin' ? 'upload_admin' : 'upload_student',
        identity,
        group === 'admin' ? 120 : 10,
        3600000,
      );
    }
    if (importing) {
      if (!admin) return reject(401, 'Chưa đăng nhập quản trị');
      add('import', admin, 5, 60000);
    }
    if (path.toLowerCase() === '/api/media') add('media', ip, 600, 60000);
    const result = await limiter.consume(
      limits,
      login || register || upload || importing,
    );
    if (result.unavailable)
      return reject(503, 'Hệ thống bảo vệ đang gián đoạn. Hãy thử lại sau.');
    if (result.wait > 0) {
      const seconds = Math.max(1, Math.ceil(result.wait / 1000));
      res.setHeader('Retry-After', seconds);
      return reject(
        429,
        `Bạn thao tác quá nhanh. Hãy thử lại sau ${seconds} giây.`,
      );
    }
    if (importing && admin) {
      try {
        const lock = await limiter.importLock(admin);
        if (lock.busy)
          return reject(
            409,
            'Một lượt nhập Excel đang xử lý. Hãy chờ hoàn tất.',
          );
        let released = false;
        const release = () => {
          if (!released) {
            released = true;
            void lock.release().catch(() => {});
          }
        };
        res.once('finish', release); // On disconnect retain the lock until TTL: parsing/transaction may still run.
      } catch {
        return reject(503, 'Chưa thể nhập Excel. Hãy thử lại sau.');
      }
    }
    next();
  };
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : (error as { status?: number })?.status === 413
          ? 413
          : (error as { status?: number })?.status === 400
            ? 400
            : 500;
    const detail = error instanceof HttpException ? error.getResponse() : null;
    const message =
      status >= 500
        ? status === 501
          ? 'Kho ảnh chưa được cấu hình.'
          : 'Máy chủ gặp lỗi. Hãy thử lại sau.'
        : typeof detail === 'string'
          ? detail
          : detail && typeof detail === 'object' && 'message' in detail
            ? detail.message
            : status === 413
              ? 'Dữ liệu vượt quá giới hạn cho phép.'
              : 'Dữ liệu yêu cầu không hợp lệ.';
    res.status(status).json({
      statusCode: status,
      message,
      requestId: res.getHeader('X-Request-Id'),
    });
  }
}
