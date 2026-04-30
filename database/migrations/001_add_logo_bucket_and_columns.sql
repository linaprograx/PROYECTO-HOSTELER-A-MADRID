-- Add columns to locales table if they don't exist
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS logo_filename text;

-- Create logos bucket in storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Set up RLS policies for logos bucket
-- Allow anyone to read
CREATE POLICY IF NOT EXISTS "Allow public read logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'logos');

-- Allow authenticated users to upload
CREATE POLICY IF NOT EXISTS "Allow authenticated upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'logos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow authenticated users to update
CREATE POLICY IF NOT EXISTS "Allow authenticated update logos"
ON storage.objects
FOR UPDATE
WITH CHECK (
  bucket_id = 'logos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow authenticated users to delete
CREATE POLICY IF NOT EXISTS "Allow authenticated delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'logos' AND
  (auth.role() = 'authenticated' OR auth.role() = 'anon')
);
