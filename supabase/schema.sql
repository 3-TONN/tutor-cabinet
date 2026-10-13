-- ============================================================================
-- Кабинет репетитора — схема базы данных Supabase (PostgreSQL)
-- Выполните целиком в Supabase → SQL Editor → New query → Run.
-- Скрипт можно запускать повторно: он пересоздаёт функции и политики.
-- ============================================================================

-- ---------------------------------------------------------------- таблицы

create table if not exists public.settings (
  id uuid primary key default auth.uid(),          -- = id репетитора
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references public.subjects on delete set null,
  name text not null,
  description text not null default ''
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  section text not null default '',
  name text not null,
  position int not null default 0
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  full_name text not null,
  grade text not null default '',
  goal text not null default '',
  phone text not null default '',
  telegram text not null default '',
  whatsapp text not null default '',
  parent_name text not null default '',
  parent_phone text not null default '',
  parent_telegram text not null default '',
  parent_whatsapp text not null default '',
  price numeric,
  duration int,
  format text not null default 'online' check (format in ('online','offline')),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active','paused','finished')),
  notes text not null default '',
  portal_emails text[] not null default '{}',
  color text not null default '#357e81',
  created_at timestamptz not null default now()
);

create table if not exists public.student_courses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  unique (student_id, course_id)
);

create table if not exists public.student_topics (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  topic_id uuid not null references public.topics on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','passed','review','mastered')),
  updated_at date not null default current_date,
  unique (student_id, topic_id)
);

create table if not exists public.lesson_series (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = понедельник
  time text not null,
  duration int not null,
  start_date date not null,
  end_date date not null
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  series_id uuid references public.lesson_series on delete set null,
  starts_at timestamptz not null,
  duration int not null default 60,
  status text not null default 'planned' check (status in ('planned','done','cancelled_student','cancelled_tutor','no_show')),
  price numeric not null default 0,
  late_cancel boolean not null default false,
  topic_ids uuid[] not null default '{}',
  report_covered text not null default '',
  report_homework text not null default '',
  comment text not null default '',
  grade int check (grade between 1 and 5)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  lessons_total int not null,
  price_total numeric not null,
  start_date date not null,
  expires_at date not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  date date not null default current_date,
  amount numeric not null,
  method text not null default 'transfer' check (method in ('cash','transfer','card')),
  kind text not null default 'single' check (kind in ('single','subscription','other')),
  subscription_id uuid references public.subscriptions on delete set null,
  comment text not null default ''
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  topic_ids uuid[] not null default '{}',
  questions jsonb not null default '[]'::jsonb
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  date date not null default current_date,
  title text not null,
  kind text not null default 'test' check (kind in ('test','control','exam','quiz')),
  topic_ids uuid[] not null default '{}',
  max_score numeric not null,
  score numeric not null,
  comment text not null default '',
  exam_scale text,
  quiz_id uuid references public.quizzes on delete set null,
  answers jsonb,
  question_points jsonb,
  topic_results jsonb
);

create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  lesson_id uuid references public.lessons on delete set null,
  title text not null,
  description text not null default '',
  topic_ids uuid[] not null default '{}',
  assigned_at date not null default current_date,
  due_date date not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'assigned' check (status in ('assigned','submitted','checked','missed')),
  grade int check (grade between 1 and 5),
  comment text not null default ''
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  topic_ids uuid[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references auth.users on delete cascade,
  student_id uuid not null references public.students on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- индексы
create index if not exists lessons_student_idx on public.lessons (student_id, starts_at);
create index if not exists lessons_tutor_idx on public.lessons (tutor_id, starts_at);
create index if not exists payments_student_idx on public.payments (student_id, date);
create index if not exists assessments_student_idx on public.assessments (student_id, date);
create index if not exists homework_student_idx on public.homework (student_id, due_date);
create index if not exists student_topics_student_idx on public.student_topics (student_id);
create index if not exists topics_course_idx on public.topics (course_id, position);

-- ---------------------------------------------------------------- функции доступа

-- id учеников, к которым у текущего пользователя есть доступ как у ученика/родителя
create or replace function public.my_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.students s
  where coalesce(auth.jwt() ->> 'email', '') <> ''
    and lower(auth.jwt() ->> 'email') = any (s.portal_emails)
$$;

-- репетиторы этих учеников
create or replace function public.my_tutor_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct s.tutor_id from public.students s where s.id in (select public.my_student_ids())
$$;

-- роль: репетитор — у кого есть свои ученики; иначе, если e-mail указан в карточке ученика, — ученик/родитель.
-- Так ученик, зарегистрировавшийся раньше, чем репетитор вписал его e-mail, не застревает в роли репетитора.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.students where tutor_id = auth.uid()) then 'tutor'
    when exists (select 1 from public.my_student_ids()) then 'student'
    else 'tutor' end
$$;

-- карточки учеников для личного кабинета — без личных заметок репетитора
create or replace function public.portal_students() returns setof public.students
language sql stable security definer set search_path = public as $$
  select (jsonb_populate_record(null::public.students, to_jsonb(s) || '{"notes": ""}'::jsonb)).*
  from public.students s where s.id in (select public.my_student_ids())
$$;

grant execute on function public.my_student_ids(), public.my_tutor_ids(), public.my_role(), public.portal_students() to authenticated;

-- ---------------------------------------------------------------- RLS

do $$
declare t text;
begin
  -- все таблицы: включаем RLS, репетитор видит и меняет только свои строки
  foreach t in array array['subjects','courses','topics','students','student_courses','student_topics','lesson_series',
                           'lessons','subscriptions','payments','quizzes','assessments','homework','materials','notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tutor_all on public.%I', t);
    execute format('create policy tutor_all on public.%I for all to authenticated using (tutor_id = auth.uid()) with check (tutor_id = auth.uid())', t);
  end loop;

  -- ученик/родитель: только чтение своих данных (заметки, тесты и материалы репетитора скрыты)
  foreach t in array array['student_courses','student_topics','lesson_series','lessons','subscriptions','payments','assessments','homework'] loop
    execute format('drop policy if exists student_read on public.%I', t);
    execute format('create policy student_read on public.%I for select to authenticated using (student_id in (select public.my_student_ids()))', t);
  end loop;

  foreach t in array array['subjects','courses','topics'] loop
    execute format('drop policy if exists student_read on public.%I', t);
    execute format('create policy student_read on public.%I for select to authenticated using (tutor_id in (select public.my_tutor_ids()))', t);
  end loop;
end $$;

alter table public.settings enable row level security;
drop policy if exists tutor_all on public.settings;
create policy tutor_all on public.settings for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists student_read on public.settings;
create policy student_read on public.settings for select to authenticated using (id in (select public.my_tutor_ids()));

-- ---------------------------------------------------------------- хранилище файлов

insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;

drop policy if exists "files tutor all" on storage.objects;
create policy "files tutor all" on storage.objects for all to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "files student read" on storage.objects;
create policy "files student read" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] in (select t::text from public.my_tutor_ids() t));
