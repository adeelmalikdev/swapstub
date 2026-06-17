ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teach_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learn_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_length_min integer;