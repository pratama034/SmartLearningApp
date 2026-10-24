import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { CreateStudyBlockDto } from './dto/create-study-block.dto.js'
import { UpdateStudyBlockDto } from './dto/update-study-block.dto.js'

@Injectable()
export class StudyBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId?: string, date?: string) {
    const blocks = await this.prisma.studyBlock.findMany({
      where: {
        ...(userId ? { user_id: userId } : {}),
        ...(date ? { date: this.toDatabaseDate(date) } : {}),
      },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    })
    return blocks.map((block) => this.toApi(block))
  }

  async create(dto: CreateStudyBlockDto) {
    const block = await this.prisma.studyBlock.create({
      data: {
        user_id: dto.user_id,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        start_time: this.toDatabaseTime(dto.start_time),
        end_time: this.toDatabaseTime(dto.end_time),
        recurrence_rule: dto.recurrence_rule ?? null,
        date: this.toDatabaseDate(dto.date),
        auto_focus: dto.auto_focus ?? false,
        co_focus_enabled: dto.co_focus_enabled ?? false,
      },
    })
    return this.toApi(block)
  }

  async update(id: string, dto: UpdateStudyBlockDto) {
    const data: Prisma.StudyBlockUpdateInput = {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.start_time !== undefined ? { start_time: this.toDatabaseTime(dto.start_time) } : {}),
      ...(dto.end_time !== undefined ? { end_time: this.toDatabaseTime(dto.end_time) } : {}),
      ...(dto.recurrence_rule !== undefined ? { recurrence_rule: dto.recurrence_rule } : {}),
      ...(dto.date !== undefined ? { date: this.toDatabaseDate(dto.date) } : {}),
      ...(dto.auto_focus !== undefined ? { auto_focus: dto.auto_focus } : {}),
      ...(dto.co_focus_enabled !== undefined ? { co_focus_enabled: dto.co_focus_enabled } : {}),
    }

    try {
      const block = await this.prisma.studyBlock.update({ where: { id }, data })
      return this.toApi(block)
    } catch (error) {
      if (this.isMissingRecord(error)) throw new NotFoundException(`Study block ${id} was not found`)
      throw error
    }
  }

  async remove(id: string) {
    try {
      const block = await this.prisma.studyBlock.delete({ where: { id } })
      return this.toApi(block)
    } catch (error) {
      if (this.isMissingRecord(error)) throw new NotFoundException(`Study block ${id} was not found`)
      throw error
    }
  }

  private toDatabaseDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`)
  }

  private toDatabaseTime(value: string) {
    return new Date(`1970-01-01T${value}:00.000Z`)
  }

  private toApi<T extends { date: Date; start_time: Date; end_time: Date }>(block: T) {
    return {
      ...block,
      date: block.date.toISOString().slice(0, 10),
      start_time: block.start_time.toISOString().slice(11, 16),
      end_time: block.end_time.toISOString().slice(11, 16),
    }
  }

  private isMissingRecord(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  }
}
