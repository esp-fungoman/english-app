import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningController } from './learning.controller';

@Module({ imports: [PrismaModule], controllers: [LearningController] })
export class LearningModule {}
