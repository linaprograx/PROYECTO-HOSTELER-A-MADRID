-- ─── EXTENSIONES ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLE: cocteles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cocteles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'autor' CHECK (tipo IN ('clasico', 'autor')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('activo', 'borrador', 'revision', 'temporada', 'retirado')),
  descripcion text,
  precio numeric NOT NULL DEFAULT 0,
  foto_url text,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cocteles_local_id ON public.cocteles(local_id);
CREATE INDEX IF NOT EXISTS idx_cocteles_estado ON public.cocteles(estado);
CREATE INDEX IF NOT EXISTS idx_cocteles_tipo ON public.cocteles(tipo);

ALTER TABLE public.cocteles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cocteles_ven_su_local" ON public.cocteles
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: coctel_ingredientes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coctel_ingredientes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  coctel_id uuid NOT NULL REFERENCES public.cocteles(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id),
  nombre text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 0,
  unidad text DEFAULT 'cl',
  coste_unitario numeric DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coctel_ing_coctel_id ON public.coctel_ingredientes(coctel_id);
CREATE INDEX IF NOT EXISTS idx_coctel_ing_producto_id ON public.coctel_ingredientes(producto_id);

ALTER TABLE public.coctel_ingredientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coctel_ingredientes_ven_su_local" ON public.coctel_ingredientes
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── SEED DATA: Classic cocktails ──────────────────────────────────────────────
-- Negroni
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Negroni', 'clasico', 'activo', 'Hendrick''s · Campari · Martini Rosso', 12.00)
ON CONFLICT DO NOTHING;

-- Aperol Spritz
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Aperol Spritz', 'clasico', 'activo', 'Aperol · Prosecco · Soda · Naranja', 10.00)
ON CONFLICT DO NOTHING;

-- Gin Tonic Hendrick's
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Gin Tonic Hendrick''s', 'clasico', 'activo', 'Hendrick''s · Tónica Premium · Pepino', 11.00)
ON CONFLICT DO NOTHING;

-- Old Fashioned
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Old Fashioned', 'clasico', 'activo', 'Jameson · Angostura · Azúcar · Naranja', 13.00)
ON CONFLICT DO NOTHING;

-- Mojito
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Mojito', 'clasico', 'activo', 'Ron Diplomatico · Lima · Menta · Soda', 9.50)
ON CONFLICT DO NOTHING;

-- Margarita
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Margarita', 'clasico', 'activo', 'Patrón Silver · Cointreau · Lima · Sal', 12.00)
ON CONFLICT DO NOTHING;

-- Dry Martini
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Dry Martini', 'clasico', 'activo', 'Hendrick''s · Vermut Bianco · Aceituna', 13.00)
ON CONFLICT DO NOTHING;

-- Cosmopolitan
INSERT INTO public.cocteles (id, local_id, nombre, tipo, estado, descripcion, precio)
VALUES ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Cosmopolitan', 'clasico', 'activo', 'Patrón Silver · Cointreau · Cranberry · Lima', 12.50)
ON CONFLICT DO NOTHING;
