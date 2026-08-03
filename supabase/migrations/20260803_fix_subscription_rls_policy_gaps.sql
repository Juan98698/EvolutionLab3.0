-- Migration: Fix RLS policy-name gaps left by 20260803_enforce_subscription_rls.sql
-- Date: 2026-08-03 (follow-up same day)
--
-- PROBLEMA DETECTADO:
-- La migración anterior intentó borrar la política de INSERT de
-- valoraciones_antropometricas con:
--   DROP POLICY IF EXISTS "Entrenadores pueden registrar valoraciones" ...
--   DROP POLICY IF EXISTS "Entrenadores Pro pueden registrar valoraciones" ...
-- pero la política real (creada en supabase_anthropometry.sql) se llama
-- "Crear valoraciones". Como ningún nombre coincidía, DROP POLICY IF EXISTS
-- no borró nada, y la política vieja (sin chequeo de plan pago) quedó activa
-- en paralelo a la nueva. Postgres combina políticas permisivas del mismo
-- comando con OR, así que el paywall no se aplicaba en absoluto.
--
-- Tampoco se tocó la política de UPDATE ("Actualizar valoraciones"), que
-- según el plan aprobado también debía exigir plan pago.
--
-- Y no hay migración en el repo que documente los nombres originales de las
-- políticas de plantillas_entrenador (se crearon directo en el SQL editor de
-- Supabase), así que no hay forma de confirmar por código que esos DROP
-- también hayan funcionado.
--
-- FIX: en vez de adivinar nombres de nuevo, este script borra dinámicamente
-- TODAS las políticas existentes en ambas tablas (sea cual sea su nombre) y
-- las recrea desde cero. Es idempotente: se puede correr las veces que haga
-- falta sin generar conflictos de "policy already exists".

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'valoraciones_antropometricas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.valoraciones_antropometricas', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plantillas_entrenador'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.plantillas_entrenador', pol.policyname);
  END LOOP;
END $$;

-- ── valoraciones_antropometricas ────────────────────────────────────────
-- SELECT: siempre permitido sobre lo propio (no bloquear historial ya pagado
-- si el plan vence después).
CREATE POLICY "Ver valoraciones propia o de atletas"
  ON public.valoraciones_antropometricas FOR SELECT
  USING (auth.uid() = cliente_id OR public.es_entrenador(auth.uid()));

-- INSERT / UPDATE: exigen entrenador con plan pago activo.
CREATE POLICY "Entrenadores Pro pueden registrar valoraciones"
  ON public.valoraciones_antropometricas FOR INSERT
  WITH CHECK (public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden actualizar valoraciones"
  ON public.valoraciones_antropometricas FOR UPDATE
  USING (auth.uid() = cliente_id OR public.es_entrenador_pro(auth.uid()));

-- ── plantillas_entrenador ────────────────────────────────────────────────
CREATE POLICY "Entrenadores Pro pueden crear plantillas"
  ON public.plantillas_entrenador FOR INSERT
  WITH CHECK (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden actualizar sus plantillas"
  ON public.plantillas_entrenador FOR UPDATE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

CREATE POLICY "Entrenadores Pro pueden eliminar sus plantillas"
  ON public.plantillas_entrenador FOR DELETE
  USING (auth.uid() = trainer_id AND public.es_entrenador_pro(auth.uid()));

-- SELECT: siempre permitido sobre lo propio, mismo criterio que arriba.
CREATE POLICY "Entrenadores pueden consultar sus plantillas creadas"
  ON public.plantillas_entrenador FOR SELECT
  USING (auth.uid() = trainer_id);

-- ── Verificación post-migración (correr a mano en el SQL editor) ─────────
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('valoraciones_antropometricas', 'plantillas_entrenador')
-- ORDER BY tablename, cmd;
-- Debería haber EXACTAMENTE 3 políticas por tabla (valoraciones) y 4 (plantillas) — ninguna repetida.
