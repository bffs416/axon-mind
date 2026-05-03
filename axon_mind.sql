CREATE TABLE IF NOT EXISTS public.inbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  image_url text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'processed', 'parked')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vault_docs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text,
  cover_image text,
  area text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (opcional si es para un solo usuario local, pero recomendado)
ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_docs ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura abiertas para el MVP
CREATE POLICY "Enable all actions for all users" ON public.inbox FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all actions for all users" ON public.vault_docs FOR ALL USING (true) WITH CHECK (true);
