import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator'

export class UpdateStudyBlockDto {
  @IsOptional()
  @IsIn(['Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian'])
  type?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start_time?: string

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end_time?: string

  @IsOptional()
  @IsString()
  recurrence_rule?: string | null

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string

  @IsOptional()
  @IsBoolean()
  auto_focus?: boolean

  @IsOptional()
  @IsBoolean()
  co_focus_enabled?: boolean
}
