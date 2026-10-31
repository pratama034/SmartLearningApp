-- ====================================================================
-- SKRIP RESET & BANGUN ULANG DATABASE SMART FOCUS AKADEMIK (SUPABASE)
-- Salin seluruh isi file ini ke Supabase SQL Editor lalu klik RUN.
-- ====================================================================

-- 0. BERSIHKAN TABEL LAMA (JIKA INGIN MENGULANG DARI AWAL)
drop table if exists public.group_chat_messages cascade;
drop table if exists public.study_group_members cascade;
drop table if exists public.study_groups cascade;
drop table if exists public.session_held_notifications cascade;
drop table if exists public.focus_sessions cascade;
drop table if exists public.study_block_sub_tasks cascade;
drop table if exists public.study_blocks cascade;
drop table if exists public.focus_app_rules cascade;
drop table if exists public.profiles cascade;

-- ====================================================================
-- 1. TABEL PROFILES (Profil Akademik, Gamifikasi & Privasi)
-- Relasi 1-to-1 dengan auth.users bawaan Supabase
-- ====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  nim text not null default '',
  major text not null default 'Teknik Informatika',
  university text not null default 'Universitas Indonesia',
  streak integer not null default 0,
  last_study_date date,
  badges text[] not null default array['Fokus Master', 'Awal yang Baik']::text[],
  is_private_profile boolean not null default false,
  has_seen_onboarding boolean not null default false,
  role text not null default 'mahasiswa' check (role in ('mahasiswa', 'dosen', 'admin')),
  timezone text not null default 'Asia/Jakarta',
  tenant_id text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pastikan kolom last_study_date tersedia untuk database yang sudah running
alter table public.profiles add column if not exists last_study_date date;

-- Trigger otomatis membuat baris di profiles saat user baru Register (signUp)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, email, name, nim, major, university, streak, badges, is_private_profile, has_seen_onboarding
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Mahasiswa'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'nim', ''),
    coalesce(new.raw_user_meta_data->>'major', 'Teknik Informatika'),
    coalesce(new.raw_user_meta_data->>'university', 'Universitas Indonesia'),
    3,
    array['Fokus Master', 'Awal yang Baik'],
    false,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill otomatis untuk akun yang sudah terlanjur terdaftar di auth.users
insert into public.profiles (
  id, email, name, nim, major, university, streak, badges, is_private_profile, has_seen_onboarding
)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data->>'name', split_part(coalesce(email, 'Mahasiswa'), '@', 1)),
  coalesce(raw_user_meta_data->>'nim', ''),
  coalesce(raw_user_meta_data->>'major', 'Teknik Informatika'),
  coalesce(raw_user_meta_data->>'university', 'Universitas Indonesia'),
  3,
  array['Fokus Master', 'Awal yang Baik'],
  false,
  false
from auth.users
on conflict (id) do nothing;


-- ====================================================================
-- 2. TABEL STUDY_BLOCKS (Jadwal & Blok Belajar Harian)
-- Relasi Many-to-1 ke auth.users(id)
-- ====================================================================
create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('Jadwal kuliah', 'Belajar mandiri', 'Kerja kelompok', 'Persiapan ujian')),
  description text not null default '',
  date date not null default current_date,
  start_time time not null,
  end_time time not null,
  recurrence_rule text,
  auto_focus boolean not null default false,
  co_focus_enabled boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_study_blocks_user_date on public.study_blocks (user_id, date);


-- ====================================================================
-- 3. TABEL STUDY_BLOCK_SUB_TASKS (Checklist di Dalam Blok Belajar)
-- Relasi Many-to-1 ke study_blocks(id) dengan ON DELETE CASCADE
-- ====================================================================
create table public.study_block_sub_tasks (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.study_blocks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_sub_tasks_block_id on public.study_block_sub_tasks (block_id);


-- ====================================================================
-- 4. TABEL FOCUS_SESSIONS (Riwayat Timer Fokus & Jurnal Refleksi)
-- Relasi ke auth.users(id) dan opsional ke study_blocks(id)
-- ====================================================================
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_block_id uuid references public.study_blocks(id) on delete set null,
  target_duration integer not null default 0,
  actual_duration integer not null default 0,
  completion_status text not null default 'completed',
  reflection_note text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_focus_sessions_user on public.focus_sessions (user_id, created_at desc);


-- ====================================================================
-- 5. TABEL STUDY_GROUPS (Ruang Belajar Co-Focus dengan Kode 6 Karakter, Maks 10 Orang)
-- ====================================================================
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  join_code varchar(6) not null unique,
  max_members integer not null default 10 check (max_members <= 10),
  host_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_study_groups_join_code on public.study_groups (upper(join_code));


-- ====================================================================
-- 6. TABEL STUDY_GROUP_MEMBERS (Anggota Ruang Belajar, Maks 10 Orang)
-- ====================================================================
create table public.study_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'fokus' check (status in ('fokus', 'istirahat', 'tersedia')),
  course text not null default '',
  joined_at timestamptz not null default now(),
  constraint uq_group_user unique (group_id, user_id)
);

create index idx_group_members_group on public.study_group_members (group_id);

-- Trigger pembatas maksimal 10 orang per grup (atau sesuai sg.max_members)
create or replace function public.check_max_group_members()
returns trigger as $$
declare
  member_count integer;
  max_allowed integer;
begin
  select count(*), coalesce(max(sg.max_members), 10)
  into member_count, max_allowed
  from public.study_group_members sgm
  join public.study_groups sg on sg.id = new.group_id
  where sgm.group_id = new.group_id;

  if member_count >= max_allowed then
    raise exception 'Maaf, ruang belajar sudah penuh (Maks % orang)', max_allowed;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_max_members
  before insert on public.study_group_members
  for each row execute function public.check_max_group_members();


-- ====================================================================
-- 7. TABEL GROUP_CHAT_MESSAGES (Pesan Chat, Balas Pesan & Soft Delete)
-- ====================================================================
create table public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  reply_to_id uuid references public.group_chat_messages(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'image', 'document')),
  text text,
  file_url text,
  file_name text,
  file_type text check (file_type in ('PDF', 'Word', 'JPG', null)),
  file_size text,
  image_url text,
  image_label text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_group_chat_group_time on public.group_chat_messages (group_id, created_at asc);


-- ====================================================================
-- 8. KEBIJAKAN KEAMANAN: ROW LEVEL SECURITY (RLS)
-- ====================================================================
alter table public.profiles enable row level security;
alter table public.study_blocks enable row level security;
alter table public.study_block_sub_tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.group_chat_messages enable row level security;

-- Kebijakan Profiles
create policy "Profil dapat dibaca oleh pemilik atau publik"
  on public.profiles for select
  using (auth.uid() = id or is_private_profile = false);

create policy "Profil dapat dibuat oleh pemilik"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profil dapat diubah oleh pemilik"
  on public.profiles for update
  using (auth.uid() = id);

-- Kebijakan Study Blocks
create policy "Pengguna mengelola study_blocks miliknya sendiri"
  on public.study_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Kebijakan Sub-Tasks
create policy "Pengguna mengelola sub_tasks dari jadwal miliknya"
  on public.study_block_sub_tasks for all
  using (
    exists (
      select 1 from public.study_blocks sb
      where sb.id = study_block_sub_tasks.block_id and sb.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.study_blocks sb
      where sb.id = study_block_sub_tasks.block_id and sb.user_id = auth.uid()
    )
  );

-- Kebijakan Focus Sessions
create policy "Pengguna mengelola focus_sessions miliknya sendiri"
  on public.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Kebijakan Study Groups & Members
create policy "Semua pengguna login dapat melihat study_groups"
  on public.study_groups for select
  using (auth.role() = 'authenticated');

create policy "Pengguna login dapat membuat study_groups"
  on public.study_groups for insert
  with check (auth.uid() = host_id);

create policy "Host dapat menghapus study_groups miliknya"
  on public.study_groups for delete
  using (auth.uid() = host_id);

create policy "Host dapat mengubah study_groups miliknya"
  on public.study_groups for update
  using (auth.uid() = host_id);

create policy "Semua pengguna login dapat melihat anggota grup"
  on public.study_group_members for select
  using (auth.role() = 'authenticated');

create policy "Pengguna dapat bergabung ke grup"
  on public.study_group_members for insert
  with check (auth.uid() = user_id);

create policy "Pengguna dapat mengubah status atau keluar grup"
  on public.study_group_members for update
  using (auth.uid() = user_id);

create policy "Pengguna dapat keluar atau dikeluarkan oleh host"
  on public.study_group_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.study_groups sg
      where sg.id = study_group_members.group_id and sg.host_id = auth.uid()
    )
  );

-- Kebijakan Group Chat Messages
create policy "Anggota grup dapat membaca pesan chat"
  on public.group_chat_messages for select
  using (
    exists (
      select 1 from public.study_group_members sgm
      where sgm.group_id = group_chat_messages.group_id and sgm.user_id = auth.uid()
    )
  );

create policy "Anggota grup dapat mengirim pesan chat"
  on public.group_chat_messages for insert
  with check (auth.uid() = sender_id);

create policy "Pengirim dapat menghapus (soft delete) pesannya sendiri"
  on public.group_chat_messages for update
  using (auth.uid() = sender_id);

-- ====================================================================
-- 9. AKTIFKAN REPLIKASI REALTIME (SUPABASE REALTIME WEBSOCKET)
-- ====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'group_chat_messages'
  ) then
    alter publication supabase_realtime add table public.group_chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'study_group_members'
  ) then
    alter publication supabase_realtime add table public.study_group_members;
  end if;
end $$;

-- Segarkan Schema Cache PostgREST Supabase secara instan
notify pgrst, 'reload schema';
