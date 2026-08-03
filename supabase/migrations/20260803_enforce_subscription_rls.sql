-- Migration: Enforce Real Paid Subscription in Server (RLS & Postgres)
-- Date: 2026-08-03

-- 1. Función para validar si el usuario es entrenador con plan activo pagado.
-- Replica la misma lógica estricta de 3 factores existente en el cliente (Login.tsx):
-- - rol = 'entrenador'
-- - suscripcion_plan no es nulo ni 'free'/'gratuito'
-- - suscripcion_estado no es 'expirado' ni 'cancelado'
-- - suscripcion_expira_at es nulo o mayor a la fecha actual (NOW())
CREATE OR REPLACE FUNCTION public.es_entrenador_pro(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND rol = 'entrenador'
      AND suscripcion_plan IS NOT NULL
      AND LOWER(suscripcion_plan) NOT IN ('free', 'gratuito')
      AND COALESCE(suscripcion_estado, 'activo') NOT IN ('expirado', 'cancelado')
      AND (suscripcion_expira_at IS NULL OR suscripcion_expira_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Asegurar que RLS esté activo en plantillas_entrenador y valoraciones_antropometricas
ALTER TABLE IF EXISTS plantillas_entrenador ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS valoraciones_antropometricas ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Los entrenadores pueden crear sus propias plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Entrenadores pueden crear sus plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Los entrenadores pueden actualizar sus propias plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Entrenadores pueden actualizar sus plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Los entrenadores pueden eliminar sus propias plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Entrenadores pueden eliminar sus plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Los entrenadores pueden ver sus propias plantillas" ON plantillas_entrenador;
DROP POLICY IF EXISTS "Entrenadores pueden consultar sus plantillas" ON plantillas_entrenador;

-- 4. Nuevas Políticas RLS Asimétricas para plantillas_entrenador
-- Inserción / Edición / Borrado: Exigen que el entrenador tenga plan pagado activo.
CREATE POLICY "Entrenadores Pro pueden crear plantillas"
  ON plantillas_entrenador FOR INSERT
  WITH CHECK (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden actualizar sus plantillas"
  ON plantillas_entrenador FOR UPDATE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden eliminar sus plantillas"
  ON plantillas_entrenador FOR DELETE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

-- Lectura (SELECT): Mantiene el acceso a las plantillas propias creadas por el entrenador
-- para que un downgrade posterior de la suscripción no bloquee sus datos históricos.
CREATE POLICY "Entrenadores pueden consultar sus plantillas creadas"
  ON plantillas_entrenador FOR SELECT
  USING (auth.uid() = trainer_id);

-- 5. Actualizar políticas en valoraciones_antropometricas
DROP POLICY IF EXISTS "Entrenadores pueden registrar valoraciones" ON valoraciones_antropometricas;
DROP POLICY IF EXISTS "Entrenadores Pro pueden registrar valoraciones" ON valoraciones_antropometricas;

CREATE POLICY "Entrenadores Pro pueden registrar valoraciones"
  ON valoraciones_antropometricas FOR INSERT
  WITH CHECK (public.es_entrenador_pro(auth.uid()));
