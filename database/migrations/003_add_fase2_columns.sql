-- ─── FASE 2: Add columns for EditCocktailModal drawer ──────────────────────────

-- ─── Alter cocteles table ──────────────────────────────────────────────────────
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS fecha_inicio_temporada date;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS fecha_fin_temporada date;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS historia_coctel text;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS instrucciones_preparacion text;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS cristaleria text DEFAULT 'copa';
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS guarnicion text;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS tiempo_preparacion integer DEFAULT 0;
ALTER TABLE public.cocteles ADD COLUMN IF NOT EXISTS alergenos text;

-- ─── Alter coctel_ingredientes table ──────────────────────────────────────────
ALTER TABLE public.coctel_ingredientes ADD COLUMN IF NOT EXISTS opcional boolean DEFAULT false;

-- ─── Create cocteles storage bucket ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('cocteles', 'cocteles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ─── RLS policies for cocteles bucket ──────────────────────────────────────────

-- Allow anyone to read cocteles bucket
DROP POLICY IF EXISTS "Allow public read cocteles" ON storage.objects;
CREATE POLICY "Allow public read cocteles"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cocteles');

-- Allow authenticated users to upload to cocteles bucket
DROP POLICY IF EXISTS "Allow authenticated upload cocteles" ON storage.objects;
CREATE POLICY "Allow authenticated upload cocteles"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cocteles' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow authenticated users to update cocteles bucket
DROP POLICY IF EXISTS "Allow authenticated update cocteles" ON storage.objects;
CREATE POLICY "Allow authenticated update cocteles"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'cocteles' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow authenticated users to delete from cocteles bucket
DROP POLICY IF EXISTS "Allow authenticated delete cocteles" ON storage.objects;
CREATE POLICY "Allow authenticated delete cocteles"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cocteles' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);
