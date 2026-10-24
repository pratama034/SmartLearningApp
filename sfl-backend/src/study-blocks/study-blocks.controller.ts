import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { CreateStudyBlockDto } from './dto/create-study-block.dto.js'
import { UpdateStudyBlockDto } from './dto/update-study-block.dto.js'
import { StudyBlocksService } from './study-blocks.service.js'

@Controller('study-blocks')
export class StudyBlocksController {
  constructor(private readonly studyBlocksService: StudyBlocksService) {}

  @Get()
  findAll(@Query('user_id') userId?: string, @Query('date') date?: string) {
    return this.studyBlocksService.findAll(userId, date)
  }

  @Post()
  create(@Body() dto: CreateStudyBlockDto) {
    return this.studyBlocksService.create(dto)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudyBlockDto) {
    return this.studyBlocksService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.studyBlocksService.remove(id)
  }
}
