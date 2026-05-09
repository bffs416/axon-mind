-- ============================================================
-- AXON CARDS V2: Crear tablas base + columnas SRS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 0. Crear tabla flashcards (si no existe)
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    next_review TIMESTAMPTZ DEFAULT NOW(),
    last_interval INTEGER DEFAULT 0,
    srs_level INTEGER DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    last_review TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 0b. Si la tabla ya existía sin columnas SRS, agregarlas
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS srs_level INTEGER DEFAULT 0;
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS last_review TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_flashcards_category ON public.flashcards(category);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON public.flashcards(next_review);
CREATE INDEX IF NOT EXISTS idx_flashcards_srs_level ON public.flashcards(srs_level);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for anon' AND tablename = 'flashcards') THEN
    CREATE POLICY "Allow all for anon" ON public.flashcards FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 0c. Tabla de plantillas semanales (Guardar/Cargar Plan)
CREATE TABLE IF NOT EXISTS public.week_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.week_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for anon' AND tablename = 'week_templates') THEN
    CREATE POLICY "Allow all for anon" ON public.week_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 1. Tabla de sesiones de estudio (para XP y rachas)
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for anon' AND tablename = 'study_sessions') THEN
    CREATE POLICY "Allow all for anon" ON public.study_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for anon' AND tablename = 'user_progress') THEN
    CREATE POLICY "Allow all for anon" ON public.user_progress FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
