-- Jalankan di Supabase SQL Editor sebelum memakai API Study Block.
create table if not exists public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian')),
  title text not null,
  description text not null default '',
  start_time time not null,
  end_time time not null,
  recurrence_rule text,
  date date not null,
  auto_focus boolean not null default false,
  co_focus_enabled boolean not null default false
);

create index if not exists study_blocks_user_id_date_idx
  on public.study_blocks (user_id, date);
