import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { studentIdFromSignedCookie } from '../student-auth/student.guard';
import { AdminGuard } from '../admin/admin.guard';
import {
  StudentGuard,
  studentIdFromRequest,
} from '../student-auth/student.guard';
import {
  isBucketConfigured,
  MEDIA_URL_SECONDS,
  signGetUrl,
  signPutUrl,
  UPLOAD_URL_SECONDS,
} from './s3';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function imageInput(
  body: { filename?: string; contentType?: string } | undefined,
  fallback: string,
) {
  if (
    !body ||
    typeof body.contentType !== 'string' ||
    !IMAGE_TYPES.includes(body.contentType) ||
    (body.filename !== undefined && typeof body.filename !== 'string')
  )
    throw new BadRequestException('Hãy chọn ảnh JPG, PNG, WebP hoặc GIF');
  const filename = (body.filename || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .slice(0, 120);
  return { filename, contentType: body.contentType };
}

function bucketRequired() {
  if (!isBucketConfigured()) {
    throw new HttpException(
      'Kho ảnh chưa được cấu hình. Vui lòng liên hệ người quản lý.',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}

@Controller()
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}
  @Post('admin/uploads/presign')
  @UseGuards(AdminGuard)
  @Header('Cache-Control', 'no-store')
  async presignPut(@Body() body: { filename?: string; contentType?: string }) {
    const { filename, contentType } = imageInput(body, 'image');
    bucketRequired();
    const key = `uploads/vocabulary/${randomUUID()}-${filename}`;
    const url = await signPutUrl(key, contentType);
    return { url, key, contentType, expiresIn: UPLOAD_URL_SECONDS };
  }

  @Post('student/uploads/presign')
  @UseGuards(StudentGuard)
  @Header('Cache-Control', 'no-store')
  async presignAvatar(
    @Req() req: Request,
    @Body() body: { filename?: string; contentType?: string },
  ) {
    const { filename, contentType } = imageInput(body, 'avatar');
    bucketRequired();
    const key = `uploads/avatars/${studentIdFromRequest(req)}/${randomUUID()}-${filename}`;
    const url = await signPutUrl(key, contentType);
    return { url, key, contentType, expiresIn: UPLOAD_URL_SECONDS };
  }

  /** Short-lived GET for a stored key. */
  @Get('media')
  @Header('Cache-Control', 'no-store')
  async media(@Req() req: Request, @Query('key') key?: string) {
    if (typeof key !== 'string' || !key)
      throw new NotFoundException('Thiếu key');
    if (key.length > 500 || key.includes('..') || !key.startsWith('uploads/')) {
      throw new NotFoundException();
    }
    if (key.startsWith('uploads/avatars/')) {
      const id = studentIdFromSignedCookie(req);
      if (
        !id ||
        !key.startsWith(`uploads/avatars/${id}/`) ||
        !(await this.prisma.student.findFirst({
          where: { id, avatarKey: key },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
    } else if (
      !(await this.prisma.word.findFirst({
        where: { OR: [{ imageKey: key }, { audioKey: key }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    bucketRequired();
    const url = await signGetUrl(key);
    return { url, key, expiresIn: MEDIA_URL_SECONDS };
  }
}
