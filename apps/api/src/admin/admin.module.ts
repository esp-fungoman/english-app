import { VocabularyService } from './vocabulary.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminGuard } from './admin.guard';
import { WordImportController } from './word-import.controller';
import { WordImportService } from './word-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminAuthController,
    AdminContentController,
    WordImportController,
  ],
  providers: [AdminGuard, WordImportService, VocabularyService],
})
export class AdminModule {}
