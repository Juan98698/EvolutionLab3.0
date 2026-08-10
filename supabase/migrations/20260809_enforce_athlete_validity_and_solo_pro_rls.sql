-- Migration: Enforce Athlete Validity and Solo Lifter Pro Subscription in Server RLS
-- Date: 2026-08-09 (Updated)

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

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dias_plan'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.dias_plan', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ejercicios_plan'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ejercicios_plan', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'planes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.planes', pol.policyname);
  END LOOP;
END $$;

-- 6. Habilitar RLS en tablas clave
ALTER TABLE IF EXISTS public.sesiones_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dias_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ejercicios_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.planes ENABLE ROW LEVEL SECURITY;

-- ── 7. POLÍTICAS RLS EN sesiones_historial ─────────────────────────────────
CREATE POLICY "Clientes y entrenadores pueden ver sesiones"
  ON public.sesiones_historial FOR SELECT
  USING (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));

CREATE POLICY "Atletas vigentes pueden registrar sesiones"
  ON public.sesiones_historial FOR INSERT
  WITH CHECK (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

CREATE POLICY "Atletas vigentes pueden actualizar sesiones"
  ON public.sesiones_historial FOR UPDATE
  USING (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

CREATE POLICY "Atletas vigentes pueden eliminar sesiones"
  ON public.sesiones_historial FOR DELETE
  USING (
    (auth.uid() = cliente_id AND public.es_atleta_vigente(auth.uid()))
    OR public.es_entrenador(auth.uid())
  );

-- ── 8. POLÍTICAS RLS EN planes ───────────────────────────────────────────
CREATE POLICY "Admin acceso total planes"
  ON public.planes FOR ALL
  USING (public.es_admin(auth.uid()));

CREATE POLICY "Ver planes propios o de clientes vinculados"
  ON public.planes FOR SELECT
  USING (
    cliente_id = auth.uid()
    OR creador_id = auth.uid()
    OR public.es_entrenador(auth.uid())
  );

CREATE POLICY "Crear planes propios"
  ON public.planes FOR INSERT
  WITH CHECK (
    cliente_id = auth.uid()
    OR (creador_id = auth.uid() AND public.es_entrenador(auth.uid()))
  );

CREATE POLICY "Atletas vigentes y entrenadores actualizan planes"
  ON public.planes FOR UPDATE
  USING (
    (cliente_id = auth.uid() AND public.es_atleta_vigente(auth.uid()))
    OR (creador_id = auth.uid() AND public.es_entrenador(auth.uid()))
  );

CREATE POLICY "Eliminar planes propios"
  ON public.planes FOR DELETE
  USING (
    cliente_id = auth.uid()
    OR (creador_id = auth.uid() AND public.es_entrenador(auth.uid()))
  );

-- ── 9. POLÍTICAS RLS EN dias_plan ─────────────────────────────────────────
CREATE POLICY "Ver dias de plan"
  ON public.dias_plan FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.planes
      WHERE planes.id = dias_plan.plan_id
        AND (planes.cliente_id = auth.uid() OR planes.creador_id = auth.uid() OR public.es_entrenador(auth.uid()))
    )
  );

CREATE POLICY "Atletas vigentes y entrenadores gestionan dias de plan"
  ON public.dias_plan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.planes
      WHERE planes.id = dias_plan.plan_id
        AND (
          (planes.cliente_id = auth.uid() AND public.es_atleta_vigente(auth.uid()))
          OR (planes.creador_id = auth.uid() AND public.es_entrenador(auth.uid()))
        )
    )
  );

-- ── 10. POLÍTICAS RLS EN ejercicios_plan ───────────────────────────────────
CREATE POLICY "Ver ejercicios de plan"
  ON public.ejercicios_plan FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dias_plan
      JOIN public.planes ON planes.id = dias_plan.plan_id
      WHERE dias_plan.id = ejercicios_plan.dia_id
        AND (planes.cliente_id = auth.uid() OR planes.creador_id = auth.uid() OR public.es_entrenador(auth.uid()))
    )
  );

CREATE POLICY "Atletas vigentes y entrenadores gestionan ejercicios de plan"
  ON public.ejercicios_plan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dias_plan
      JOIN public.planes ON planes.id = dias_plan.plan_id
      WHERE dias_plan.id = ejercicios_plan.dia_id
        AND (
          (planes.cliente_id = auth.uid() AND public.es_atleta_vigente(auth.uid()))
          OR (planes.creador_id = auth.uid() AND public.es_entrenador(auth.uid()))
        )
    )
  );
