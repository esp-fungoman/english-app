import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from '../admin/admin.module';
import { HealthModule } from '../health/health.module';
import { LearningModule } from '../learning/learning.module';
import { PlayModule } from '../play/play.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAuthModule } from '../student-auth/student-auth.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    LearningModule,
    AdminModule,
    StudentAuthModule,
    PlayModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
