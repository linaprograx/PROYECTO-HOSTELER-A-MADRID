-- ─── EXTENSIONES ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLE: locales ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.locales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre text NOT NULL,
  direccion text,
  ciudad text,
  aforo integer,
  tipo text,
  telefono text,
  email text,
  logo_filename text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_locales_ciudad ON public.locales(ciudad);

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locales_ven_su_local" ON public.locales
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: usuarios ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  email text,
  rol text NOT NULL DEFAULT 'staff' CHECK (rol IN ('admin', 'staff')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_usuarios_local_id ON public.usuarios(local_id);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_ven_su_local" ON public.usuarios
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: productos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  categoria text,
  unidad text,
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric DEFAULT 0,
  coste_unitario numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_productos_local_id ON public.productos(local_id);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON public.productos(nombre);

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_ven_su_local" ON public.productos
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: movimientos_stock ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'merma')),
  cantidad numeric NOT NULL,
  motivo text,
  fecha date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto_id ON public.movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_local_id ON public.movimientos_stock(local_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON public.movimientos_stock(fecha);

ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimientos_ven_su_local" ON public.movimientos_stock
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: inventarios_fisicos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventarios_fisicos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  fecha_conteo date NOT NULL,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'completado')),
  notas text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inventarios_local_id ON public.inventarios_fisicos(local_id);
CREATE INDEX IF NOT EXISTS idx_inventarios_fecha ON public.inventarios_fisicos(fecha_conteo);

ALTER TABLE public.inventarios_fisicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventarios_ven_su_local" ON public.inventarios_fisicos
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: inventario_fisico_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventario_fisico_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventario_id uuid NOT NULL REFERENCES public.inventarios_fisicos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad_teorica numeric NOT NULL,
  cantidad_real numeric NOT NULL,
  diferencia numeric GENERATED ALWAYS AS (cantidad_real - cantidad_teorica) STORED,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inv_items_inventario_id ON public.inventario_fisico_items(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_producto_id ON public.inventario_fisico_items(producto_id);

ALTER TABLE public.inventario_fisico_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_items_ven_su_local" ON public.inventario_fisico_items
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: ventas_diarias ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ventas_diarias (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id uuid NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  producto_nombre text NOT NULL,
  cantidad_vendida numeric NOT NULL,
  ingreso_total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ventas_local_id ON public.ventas_diarias(local_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas_diarias(fecha);

ALTER TABLE public.ventas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_ven_su_local" ON public.ventas_diarias
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ─── TABLE: cocteles ─────────────────────────────────────────────────────────
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

-- ─── SEED DATA ─────────────────────────────────────────────────────────────────
INSERT INTO public.locales (id, nombre, direccion, ciudad, aforo)
VALUES ('00000000-0000-0000-0000-000000000001', 'Paradiso Cocktail Bar', 'Calle de las Acacias 15', 'Madrid', 120)
ON CONFLICT DO NOTHING;
