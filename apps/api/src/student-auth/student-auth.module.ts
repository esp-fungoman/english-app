import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAuthController } from './student-auth.controller';
import { StudentGuard } from './student.guard';

@Module({
  imports: [PrismaModule],
  controllers: [StudentAuthController],
  providers: [StudentGuard],
  exports: [StudentGuard],
})
export class StudentAuthModule {}
