-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRACIÓN V14: Módulo de Planes de Nutrición y Dietas
-- ============================================================================
-- Propósito:
--   1. Crear tablas para planes nutricionales, plantillas y alimentos personalizados.
--   2. Implementar función de trigger única sync_entrenador_from_profile() reutilizada
--      en planes_nutricionales y valoraciones_antropometricas.
--   3. Ejecutar backfill histórico seguro sobre valoraciones_antropometricas.
--   4. Establecer las 4 políticas nombradas estrictas (SELECT, INSERT, UPDATE, DELETE)
--      validando la relación real en profiles.entrenador_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLA: planes_nutricionales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planes_nutricionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entrenador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  valoracion_id UUID REFERENCES public.valoraciones_antropometricas(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL DEFAULT 'Plan Nutricional',
  activo BOOLEAN NOT NULL DEFAULT true,
  modo TEXT NOT NULL DEFAULT 'semanal' CHECK (modo IN ('diario_unico', 'semanal')),
  objetivo TEXT,
  target_calorias INT NOT NULL DEFAULT 2000,
  target_proteina_g NUMERIC(6,1) NOT NULL DEFAULT 150,
  target_carbohidratos_g NUMERIC(6,1) NOT NULL DEFAULT 200,
  target_grasa_g NUMERIC(6,1) NOT NULL DEFAULT 60,
  ajuste_calorico_pct NUMERIC(4,2) DEFAULT 0,
  datos_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  recomendaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Índices para búsquedas rápidas por atleta y entrenador
CREATE INDEX IF NOT EXISTS idx_planes_nutricionales_cliente ON public.planes_nutricionales(cliente_id);
CREATE INDEX IF NOT EXISTS idx_planes_nutricionales_entrenador ON public.planes_nutricionales(entrenador_id);
CREATE INDEX IF NOT EXISTS idx_planes_nutricionales_activo ON public.planes_nutricionales(cliente_id, activo);

-- ----------------------------------------------------------------------------
-- 2. TABLA: plantillas_nutricionales (Dietas modelo del entrenador)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plantillas_nutricionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrenador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  objetivo TEXT,
  target_calorias INT,
  datos_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_plantillas_nutricionales_entrenador ON public.plantillas_nutricionales(entrenador_id);

-- ----------------------------------------------------------------------------
-- 3. TABLA: alimentos_personalizados
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alimentos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT 'Mis Alimentos',
  cantidad_base NUMERIC(6,1) NOT NULL DEFAULT 100,
  unidad TEXT NOT NULL DEFAULT 'gr',
  calorias NUMERIC(6,1) NOT NULL,
  proteina NUMERIC(6,1) NOT NULL,
  carbohidratos NUMERIC(6,1) NOT NULL,
  grasa NUMERIC(6,1) NOT NULL,
  fuente TEXT DEFAULT 'personalizado',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_alimentos_personalizados_creador ON public.alimentos_personalizados(creador_id);

-- ----------------------------------------------------------------------------
-- 4. TRIGGER DETERMINISTA REUTILIZABLE: sync_entrenador_from_profile()
-- ----------------------------------------------------------------------------
-- Este trigger evita la manipulación del payload del cliente poblando
-- automáticamente entrenador_id desde profiles.entrenador_id del cliente_id.
CREATE OR REPLACE FUNCTION public.sync_entrenador_from_profile()
RETURNS trigger AS $$
BEGIN
  SELECT entrenador_id INTO NEW.entrenador_id 
  FROM public.profiles 
  WHERE id = NEW.cliente_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atar a planes_nutricionales
DROP TRIGGER IF EXISTS trg_sync_planes_nutricionales_entrenador ON public.planes_nutricionales;
CREATE TRIGGER trg_sync_planes_nutricionales_entrenador
  BEFORE INSERT OR UPDATE ON public.planes_nutricionales
  FOR EACH ROW EXECUTE FUNCTION public.sync_entrenador_from_profile();

-- Atar a valoraciones_antropometricas
DROP TRIGGER IF EXISTS trg_sync_valoraciones_entrenador ON public.valoraciones_antropometricas;
CREATE TRIGGER trg_sync_valoraciones_entrenador
  BEFORE INSERT OR UPDATE ON public.valoraciones_antropometricas
  FOR EACH ROW EXECUTE FUNCTION public.sync_entrenador_from_profile();

-- ----------------------------------------------------------------------------
-- 5. BACKFILL HISTÓRICO DE valoraciones_antropometricas
-- ----------------------------------------------------------------------------
UPDATE public.valoraciones_antropometricas v 
SET entrenador_id = p.entrenador_id
FROM public.profiles p 
WHERE p.id = v.cliente_id AND (v.entrenador_id IS DISTINCT FROM p.entrenador_id);

-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS NOMBRADAS: planes_nutricionales
-- ----------------------------------------------------------------------------
ALTER TABLE public.planes_nutricionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver planes nutricionales" ON public.planes_nutricionales;
CREATE POLICY "Ver planes nutricionales"
  ON public.planes_nutricionales FOR SELECT
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = planes_nutricionales.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Crear planes nutricionales" ON public.planes_nutricionales;
CREATE POLICY "Crear planes nutricionales"
  ON public.planes_nutricionales FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth.uid() = cliente_id
      AND (
        public.es_atleta_vigente(auth.uid()) 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = cliente_id AND profiles.entrenador_id IS NOT NULL
        )
      )
    )
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = planes_nutricionales.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Actualizar planes nutricionales" ON public.planes_nutricionales;
CREATE POLICY "Actualizar planes nutricionales"
  ON public.planes_nutricionales FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = planes_nutricionales.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Eliminar planes nutricionales" ON public.planes_nutricionales;
CREATE POLICY "Eliminar planes nutricionales"
  ON public.planes_nutricionales FOR DELETE
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = planes_nutricionales.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. CORRECCIÓN DE POLÍTICAS RLS EN valoraciones_antropometricas
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ver valoraciones propia o de atletas" ON public.valoraciones_antropometricas;
DROP POLICY IF EXISTS "Ver valoraciones antropometricas" ON public.valoraciones_antropometricas;
CREATE POLICY "Ver valoraciones antropometricas"
  ON public.valoraciones_antropometricas FOR SELECT
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = valoraciones_antropometricas.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Crear valoraciones" ON public.valoraciones_antropometricas;
DROP POLICY IF EXISTS "Crear valoraciones antropometricas" ON public.valoraciones_antropometricas;
CREATE POLICY "Crear valoraciones antropometricas"
  ON public.valoraciones_antropometricas FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = valoraciones_antropometricas.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Actualizar valoraciones" ON public.valoraciones_antropometricas;
DROP POLICY IF EXISTS "Actualizar valoraciones antropometricas" ON public.valoraciones_antropometricas;
CREATE POLICY "Actualizar valoraciones antropometricas"
  ON public.valoraciones_antropometricas FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = valoraciones_antropometricas.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Eliminar valoraciones antropometricas" ON public.valoraciones_antropometricas;
CREATE POLICY "Eliminar valoraciones antropometricas"
  ON public.valoraciones_antropometricas FOR DELETE
  TO authenticated
  USING (
    auth.uid() = cliente_id
    OR (
      public.es_entrenador(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = valoraciones_antropometricas.cliente_id
          AND profiles.entrenador_id = auth.uid()
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 8. POLÍTICAS RLS: plantillas_nutricionales & alimentos_personalizados
-- ----------------------------------------------------------------------------
ALTER TABLE public.plantillas_nutricionales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar plantillas nutricionales propias" ON public.plantillas_nutricionales;
CREATE POLICY "Gestionar plantillas nutricionales propias"
  ON public.plantillas_nutricionales FOR ALL
  TO authenticated
  USING (auth.uid() = entrenador_id)
  WITH CHECK (auth.uid() = entrenador_id);

ALTER TABLE public.alimentos_personalizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar alimentos personalizados propios" ON public.alimentos_personalizados;
CREATE POLICY "Gestionar alimentos personalizados propios"
  ON public.alimentos_personalizados FOR ALL
  TO authenticated
  USING (auth.uid() = creador_id)
  WITH CHECK (auth.uid() = creador_id);

-- ----------------------------------------------------------------------------
-- 9. PERMISOS DE TABLA (GRANT) PARA ROLES DE SUPABASE
-- ----------------------------------------------------------------------------
-- REGLA CRÍTICA DE SEGURIDAD EN POSTGRESQL:
-- RLS NO aplica sobre sentencias TRUNCATE (limitación por diseño de Postgres).
-- Otorgar 'ALL' a 'authenticated' permitiría a cualquier usuario ejecutar TRUNCATE
-- y vaciar todas las valoraciones o planes ajenos ignorando el RLS.
-- Por ello, revocamos TRUNCATE explícitamente y solo otorgamos SELECT, INSERT, UPDATE, DELETE.

REVOKE ALL ON TABLE public.planes_nutricionales FROM authenticated;
REVOKE ALL ON TABLE public.plantillas_nutricionales FROM authenticated;
REVOKE ALL ON TABLE public.alimentos_personalizados FROM authenticated;
REVOKE ALL ON TABLE public.valoraciones_antropometricas FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planes_nutricionales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.plantillas_nutricionales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.alimentos_personalizados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.valoraciones_antropometricas TO authenticated;

-- service_role es el rol administrativo backend de confianza de Supabase
GRANT ALL ON TABLE public.planes_nutricionales, public.plantillas_nutricionales, public.alimentos_personalizados, public.valoraciones_antropometricas TO service_role;


