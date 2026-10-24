import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator'

export class CreateStudyBlockDto {
  @IsUUID()
  user_id!: string

  @IsIn(['Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian'])
  type!: string

  @IsString()
  title!: string

  @IsString()
  description!: string

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start_time!: string

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end_time!: string

  @IsOptional()
  @IsString()
  recurrence_rule?: string | null

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string

  @IsOptional()
  @IsBoolean()
  auto_focus?: boolean

  @IsOptional()
  @IsBoolean()
  co_focus_enabled?: boolean
}
