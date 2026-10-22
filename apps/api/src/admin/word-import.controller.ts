import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { validateWorkbookZip } from '../security/zip-security';
import { AdminGuard } from './admin.guard';
import { WordImportService } from './word-import.service';

type Upload = {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
};

@Controller('admin/word-import')
@UseGuards(AdminGuard)
export class WordImportController {
  constructor(private readonly importService: WordImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Upload | undefined,
    @Query('mode') mode: string,
  ) {
    if (mode !== 'preview' && mode !== 'commit')
      throw new BadRequestException('Chế độ import không hợp lệ.');
    if (!file) throw new BadRequestException('Hãy chọn file .xlsx.');
    if (file.size > 2 * 1024 * 1024)
      throw new PayloadTooLargeException('File vượt quá 2 MB.');
    if (
      ![
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
        '',
      ].includes(file.mimetype)
    )
      throw new BadRequestException('Loại file không hợp lệ.');
    if (
      !file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.buffer.subarray(0, 4).toString('hex') !== '504b0304'
    )
      throw new BadRequestException('Chỉ hỗ trợ file .xlsx.');
    await validateWorkbookZip(file.buffer);
    return this.importService.run(file.buffer, mode);
  }
}
