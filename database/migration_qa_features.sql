-- ============================================================
-- Migration: QA Features (Run this in Supabase SQL Editor)
-- ============================================================

-- 1. user_profiles table (stores study mode and career semester)
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  study_mode text check (study_mode in ('semestral', 'trimestral')) default 'semestral',
  career_semester int default 1,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

-- Drop existing policy if exists to avoid errors on re-run
drop policy if exists "Users manage own profile" on user_profiles;
create policy "Users manage own profile" on user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Add semester column to subjects (which semester of career this subject belongs to)
alter table subjects add column if not exists semester int default 1;

-- 3. Add academic_year_period to subjects (1 = Jan-Jun, 2 = Jul-Dec)
--    This controls which academic semester of the year the subject belongs to.
alter table subjects add column if not exists academic_year_period int default 1;

-- ============================================================
-- 4. Cleanup orphaned data (run if subjects were deleted manually)
-- ============================================================
-- Delete grades with no matching subject
DELETE FROM grades
WHERE subject_id NOT IN (SELECT id FROM subjects);

-- Delete schedule_classes with no matching subject
DELETE FROM schedule_classes
WHERE subject_id NOT IN (SELECT id FROM subjects);

-- Delete study_checklists with no matching grade
DELETE FROM study_checklists
WHERE grade_id NOT IN (SELECT id FROM grades);

