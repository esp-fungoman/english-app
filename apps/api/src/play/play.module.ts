import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAuthModule } from '../student-auth/student-auth.module';
import { PlayController } from './play.controller';
import { ReportsController } from '../reports/reports.controller';

@Module({
  imports: [PrismaModule, StudentAuthModule],
  controllers: [PlayController, ReportsController],
})
export class PlayModule {}
