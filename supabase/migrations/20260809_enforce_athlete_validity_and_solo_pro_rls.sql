-- Migration: Enforce Athlete Validity and Solo Lifter Pro Subscription in Server RLS
-- Date: 2026-08-09

-- 1. Helper function: Validar si el usuario es un entrenador registrado
CREATE OR REPLACE FUNCTION public.es_entrenador(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND rol = 'entrenador'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Helper function: Validar si el usuario es un entrenador con suscripción activa pagada
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

-- 3. Función para validar si un atleta se encuentra dentro de su periodo de vigencia activo.
-- Retorna true si:
-- - vigencia_dias >= 9999 (plan vitalicio / ilimitado)
-- - fecha_inicio es NULL (sin fecha asignada)
-- - la fecha actual (CURRENT_DATE) no ha superado fecha_inicio + vigencia_dias
CREATE OR REPLACE FUNCTION public.es_atleta_vigente(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND (
        COALESCE(vigencia_dias, 0) >= 9999
        OR fecha_inicio IS NULL
        OR (fecha_inicio::DATE + (COALESCE(vigencia_dias, 30) || ' days')::INTERVAL) >= CURRENT_DATE
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Función para validar si un atleta independiente (Solo Lifter) posee el plan pago "Solo Lifter Pro" (premium) activo.
CREATE OR REPLACE FUNCTION public.es_solo_lifter_pro(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND LOWER(suscripcion_plan) = 'premium'
      AND COALESCE(suscripcion_estado, 'activo') NOT IN ('expirado', 'cancelado')
      AND (suscripcion_expira_at IS NULL OR suscripcion_expira_at > NOW())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Limpieza dinámica de políticas preexistentes para asegurar idempotencia
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sesiones_historial'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sesiones_historial', pol.policyname);
  END LOOP;
END $$;

-- 6. Habilitar RLS en sesiones_historial
ALTER TABLE IF EXISTS public.sesiones_historial ENABLE ROW LEVEL SECURITY;

-- Lectura (SELECT): Permitida al cliente propietario o a su entrenador (historial siempre legible)
CREATE POLICY "Clientes y entrenadores pueden ver sesiones"
  ON public.sesiones_historial FOR SELECT
  USING (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));

-- Inserción (INSERT): El atleta debe estar vigente o ser registrado por su entrenador
CREATE POLICY "Atletas vigentes pueden registrar sesiones"
  ON public.sesiones_historial FOR INSERT
  WITH CHECK (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

-- Actualización (UPDATE): El atleta debe estar vigente o ser actualizado por su entrenador
CREATE POLICY "Atletas vigentes pueden actualizar sesiones"
  ON public.sesiones_historial FOR UPDATE
  USING (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

-- Eliminación (DELETE): El atleta debe estar vigente o ser eliminado por su entrenador
CREATE POLICY "Atletas vigentes pueden eliminar sesiones"
  ON public.sesiones_historial FOR DELETE
  USING (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

-- 7. Reforzar actualización en la tabla planes
DROP POLICY IF EXISTS "Atletas pueden actualizar sus propios planes" ON public.planes;
DROP POLICY IF EXISTS "Atletas vigentes pueden actualizar sus propios planes" ON public.planes;

CREATE POLICY "Atletas vigentes pueden actualizar sus propios planes"
  ON public.planes FOR UPDATE
  USING (
    (cliente_id = auth.uid() AND public.es_atleta_vigente(auth.uid()))
    OR (creador_id = auth.uid() AND public.es_entrenador_pro(auth.uid()))
  );
