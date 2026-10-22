import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ADMIN_COOKIE,
  AdminGuard,
  adminCredentials,
  safeEqual,
  setAdminCookie,
} from './admin.guard';
@Controller('admin/auth')
export class AdminAuthController {
  @Post('login')
  login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const expected = adminCredentials();
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const validUser = safeEqual(username, expected.username);
    const validPassword = safeEqual(password, expected.password);
    if (!validUser || !validPassword)
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    setAdminCookie(res);
    return { ok: true };
  }
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.clearCookie('admin_ok', { path: '/' });
    return { ok: true };
  }
  @Get('me')
  @UseGuards(AdminGuard)
  me() {
    return { ok: true };
  }
}
