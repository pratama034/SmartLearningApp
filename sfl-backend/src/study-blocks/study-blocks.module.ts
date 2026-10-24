import { Module } from '@nestjs/common'
import { StudyBlocksController } from './study-blocks.controller.js'
import { StudyBlocksService } from './study-blocks.service.js'

@Module({
  controllers: [StudyBlocksController],
  providers: [StudyBlocksService],
})
export class StudyBlocksModule {}
