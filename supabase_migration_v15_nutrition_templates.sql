-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRACIÓN V15: Sincronización de Plantillas y Recetas
-- ============================================================================
-- Propósito:
--   1. Añadir columnas faltantes a 'plantillas_nutricionales':
--      - target_proteina_g NUMERIC(6,1)
--      - target_carbohidratos_g NUMERIC(6,1)
--      - target_grasa_g NUMERIC(6,1)
--      - updated_at TIMESTAMPTZ
--   2. Crear la tabla 'recetas_nutricionales' para guardado y reutilización
--      de comidas individuales (Desayuno, Almuerzo, Snacks, etc.)
--   3. Configurar índices, RLS estricto por entrenador y permisos seguros (GRANT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTUALIZAR TABLA: plantillas_nutricionales
-- ----------------------------------------------------------------------------
ALTER TABLE public.plantillas_nutricionales
  ADD COLUMN IF NOT EXISTS target_proteina_g NUMERIC(6,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_carbohidratos_g NUMERIC(6,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_grasa_g NUMERIC(6,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 2. CREAR TABLA: recetas_nutricionales (Plantillas de Comidas Individuales)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recetas_nutricionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrenador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  categoria TEXT,
  horario_sugerido TEXT,
  foods JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Índice para búsquedas rápidas por entrenador
CREATE INDEX IF NOT EXISTS idx_recetas_nutricionales_entrenador 
  ON public.recetas_nutricionales(entrenador_id);

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.recetas_nutricionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar recetas nutricionales propias" ON public.recetas_nutricionales;
CREATE POLICY "Gestionar recetas nutricionales propias"
  ON public.recetas_nutricionales FOR ALL
  TO authenticated
  USING (auth.uid() = entrenador_id)
  WITH CHECK (auth.uid() = entrenador_id);

-- ----------------------------------------------------------------------------
-- 4. PERMISOS DE TABLA (GRANT)
-- ----------------------------------------------------------------------------
-- Revocar TRUNCATE para prevenir eliminación masiva no autorizada
REVOKE ALL ON TABLE public.recetas_nutricionales FROM authenticated;

-- Otorgar operaciones estándar para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recetas_nutricionales TO authenticated;

-- Otorgar acceso completo a service_role para funciones de backend
GRANT ALL ON TABLE public.recetas_nutricionales TO service_role;
