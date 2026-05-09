-- ============================================================
-- AXON CARDS V2: SRS Migration
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columnas SRS a la tabla existente
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS srs_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review TIMESTAMPTZ;

-- 2. Tabla de sesiones de estudio (para XP y rachas)
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile TEXT DEFAULT 'Pipe',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  cards_studied INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  session_mode TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de progreso de usuario (gamificación)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile TEXT DEFAULT 'Pipe',
  total_xp INTEGER DEFAULT 0,
  polymath_level TEXT DEFAULT 'Novato',
  study_streak INTEGER DEFAULT 0,
  last_study_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_flashcards_srs_level ON public.flashcards(srs_level);
CREATE INDEX IF NOT EXISTS idx_study_sessions_profile ON public.study_sessions(profile);
CREATE INDEX IF NOT EXISTS idx_user_progress_profile ON public.user_progress(profile);

-- 5. RLS
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all for anon" ON public.study_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all for anon" ON public.user_progress FOR ALL USING (true) WITH CHECK (true);
