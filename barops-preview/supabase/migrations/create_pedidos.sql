-- BarOps: Tabla de Pedidos
-- Ejecutar en el SQL Editor de Supabase Dashboard

CREATE TABLE IF NOT EXISTS pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  proveedor TEXT NOT NULL,
  items JSONB NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  canal TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Política permisiva para anon (demo mode)
CREATE POLICY "Allow all for anon" ON pedidos
  FOR ALL USING (true) WITH CHECK (true);
