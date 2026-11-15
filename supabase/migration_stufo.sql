-- ====================================================================
-- SKRIP MIGRASI INKREMENTAL: SMART FOCUS -> STUFO (STUDY & FOCUS)
-- Jalankan skrip ini di Supabase SQL Editor tanpa menghapus data yang sudah ada.
-- ====================================================================

-- 1. Tambah kolom focus_started_at dan is_muted pada study_group_members
alter table public.study_group_members
  add column if not exists focus_started_at timestamptz default null,
  add column if not exists is_muted boolean not null default false;

-- Isi focus_started_at untuk anggota yang saat ini berstatus 'fokus'
update public.study_group_members
set focus_started_at = coalesce(focus_started_at, now())
where status = 'fokus' and focus_started_at is null;

-- 2. Tambah kolom read_by (untuk Read Receipt ala WhatsApp) & dukungan lampiran PPT pada group_chat_messages
alter table public.group_chat_messages
  add column if not exists read_by uuid[] not null default '{}'::uuid[];

-- Perbarui constraint file_type agar menerima 'PPT' selain 'PDF', 'Word', 'JPG'
do $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 'group_chat_messages'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%file_type%';

  if con_name is not null then
    execute format('alter table public.group_chat_messages drop constraint %I', con_name);
  end if;
end $$;

alter table public.group_chat_messages
  add constraint group_chat_messages_file_type_check
  check (file_type in ('PDF', 'Word', 'JPG', 'PPT', null));

-- Izinkan anggota grup meng-update status read_by pada pesan di grup mereka
drop policy if exists "Anggota grup dapat memperbarui read_by pesan" on public.group_chat_messages;
create policy "Anggota grup dapat memperbarui read_by pesan"
  on public.group_chat_messages for update
  using (
    exists (
      select 1 from public.study_group_members sgm
      where sgm.group_id = group_chat_messages.group_id
        and sgm.user_id = auth.uid()
    )
  );

-- 3. Fungsi RPC untuk menandai semua pesan di grup sebagai sudah dibaca oleh user saat ini
create or replace function public.mark_group_messages_read(p_group_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.group_chat_messages
  set read_by = array_append(read_by, auth.uid())
  where group_id = p_group_id
    and sender_id <> auth.uid()
    and not (auth.uid() = any(read_by));
end;
$$;

-- 4. Fungsi RPC Leaderboard Peringkat Teman (Total Durasi Belajar Teman)
create or replace function public.get_friends_leaderboard()
returns table (
  user_id uuid,
  full_name text,
  major text,
  university text,
  streak integer,
  total_focus_seconds bigint,
  total_sessions bigint,
  is_group_peer boolean
)
language sql
security definer
as $$
  with my_groups as (
    select group_id
    from public.study_group_members
    where user_id = auth.uid()
  ),
  peer_ids as (
    select distinct sgm.user_id
    from public.study_group_members sgm
    where sgm.group_id in (select group_id from my_groups)
  )
  select
    p.id as user_id,
    coalesce(nullif(trim(p.name), ''), 'Mahasiswa StuFo') as full_name,
    coalesce(nullif(trim(p.major), ''), 'Mahasiswa') as major,
    coalesce(nullif(trim(p.university), ''), 'Kampus') as university,
    coalesce(p.streak, 0) as streak,
    coalesce(sum(fs.actual_duration), 0)::bigint as total_focus_seconds,
    count(fs.id)::bigint as total_sessions,
    (p.id = auth.uid() or p.id in (select user_id from peer_ids)) as is_group_peer
  from public.profiles p
  left join public.focus_sessions fs on fs.user_id = p.id
  where p.id = auth.uid()
     or p.id in (select user_id from peer_ids)
     or p.is_private_profile = false
  group by p.id, p.name, p.major, p.university, p.streak
  order by total_focus_seconds desc, total_sessions desc, full_name asc;
$$;

-- 5. Pastikan kebijakan RLS focus_sessions & profiles mengizinkan pembacaan untuk Leaderboard Teman
drop policy if exists "Semua pengguna login dapat membaca focus_sessions untuk leaderboard" on public.focus_sessions;
create policy "Semua pengguna login dapat membaca focus_sessions untuk leaderboard"
  on public.focus_sessions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Semua pengguna login dapat melihat profil teman" on public.profiles;
create policy "Semua pengguna login dapat melihat profil teman"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- 6. Aktifkan publikasi Realtime untuk study_group_members, group_chat_messages, dan focus_sessions
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'focus_sessions'
  ) then
    alter publication supabase_realtime add table public.focus_sessions;
  end if;
end $$;

-- Segarkan Schema Cache PostgREST Supabase
notify pgrst, 'reload schema';
