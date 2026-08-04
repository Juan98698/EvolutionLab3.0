-- Migration: Grant full table permissions to authenticated role for plantillas_entrenador and valoraciones_antropometricas
-- Date: 2026-08-04
--
-- CAUSA RAÍZ ENCONTRADA:
-- Postgres requiere dos niveles de seguridad:
-- 1. Permisos de Tabla (GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated)
-- 2. Políticas de Filas (RLS - Row Level Security)
--
-- Si faltan los permisos de tabla (GRANT), Postgres rechaza las consultas antes de evaluar RLS
-- respondiendo "permission denied for table plantillas_entrenador" (HTTP 403 Forbidden).
--
-- Este script otorga los permisos requeridos al rol 'authenticated' (usuarios con sesión iniciada)
-- y 'service_role' para permitir que el motor RLS gestione el acceso a las filas.

-- 1. Permisos de Tabla para plantillas_entrenador
GRANT ALL ON TABLE public.plantillas_entrenador TO authenticated;
GRANT ALL ON TABLE public.plantillas_entrenador TO service_role;
GRANT ALL ON TABLE public.plantillas_entrenador TO anon;

-- 2. Permisos de Tabla para valoraciones_antropometricas
GRANT ALL ON TABLE public.valoraciones_antropometricas TO authenticated;
GRANT ALL ON TABLE public.valoraciones_antropometricas TO service_role;
GRANT ALL ON TABLE public.valoraciones_antropometricas TO anon;

-- 3. Asegurar que Row Level Security esté activo
ALTER TABLE public.plantillas_entrenador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valoraciones_antropometricas ENABLE ROW LEVEL SECURITY;

-- 4. Reaplicar dinámicamente las políticas RLS idempotentes
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plantillas_entrenador'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.plantillas_entrenador', pol.policyname);
  END LOOP;
END $$;

-- RLS Policies para plantillas_entrenador
CREATE POLICY "Entrenadores Pro pueden crear plantillas"
  ON public.plantillas_entrenador FOR INSERT
  WITH CHECK (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden actualizar sus plantillas"
  ON public.plantillas_entrenador FOR UPDATE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden eliminar sus plantillas"
  ON public.plantillas_entrenador FOR DELETE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores pueden consultar sus plantillas creadas"
  ON public.plantillas_entrenador FOR SELECT
  USING (auth.uid() = trainer_id);
