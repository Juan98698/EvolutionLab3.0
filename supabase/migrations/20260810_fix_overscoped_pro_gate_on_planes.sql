-- Migration: Corregir sobre-alcance de RLS en planes / dias_plan / ejercicios_plan
-- Date: 2026-08-10 (follow-up de 20260809_enforce_athlete_validity_and_solo_pro_rls.sql)
--
-- PROBLEMA DETECTADO (2 regresiones severas, mismo patrón en ambas):
--
-- 1. La política de UPDATE en `planes` exigía, para el lado del atleta:
--      es_atleta_vigente(auth.uid()) AND es_solo_lifter_pro(auth.uid())
--    Como `datos_plan` es una única columna JSONB compartida entre el guardado normal
--    de progreso de entrenamiento (ActiveSession.tsx, AthleteDashboard.tsx -- funcionalidad
--    básica, gratuita) y las reglas de sobrecarga personalizadas (SoloConfigRules.tsx --
--    funcionalidad premium), exigir "Solo Lifter Pro" para CUALQUIER UPDATE bloqueaba a
--    todo atleta independiente que no paga esa suscripción para guardar su progreso
--    durante una sesión activa. Es decir: rompía el uso básico y gratuito de la app para
--    la inmensa mayoría de atletas solo, no solo la función premium que se quería proteger.
--
-- 2. La misma política (rama del entrenador) y las políticas de `dias_plan`/`ejercicios_plan`
--    exigían es_entrenador_pro(auth.uid()) para que un entrenador pueda editar los planes,
--    días y ejercicios de SUS PROPIOS clientes (creador_id = auth.uid()). Pero
--    es_entrenador_pro() fue creada específicamente para gatear funciones premium
--    (Antropometría, Plantillas) -- nunca para la edición básica de planes, que es la
--    función más fundamental de la app para cualquier entrenador. Esto bloqueaba a todo
--    entrenador sin plan pago activo (incluyendo el nivel gratuito/de entrada) para
--    guardar CUALQUIER cambio en los planes de sus clientes -- PlanPlanner.tsx completo
--    dejaba de funcionar para esos entrenadores.
--
-- FIX: separar "¿puede tocar esta fila en absoluto?" (vigencia del atleta / ser un
-- entrenador registrado) de "¿tiene el nivel premium?" (Solo Lifter Pro / entrenador Pro).
-- Las 3 tablas vuelven a exigir solo lo primero. El gate fino de features premium
-- específicas (reglas de sobrecarga personalizadas) queda pendiente de una solución que
-- no comparta la misma columna JSONB que el guardado básico -- ver nota al final.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'planes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.planes', pol.policyname);
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
END $$;

-- ── planes ───────────────────────────────────────────────────────────────
-- Se restaura "Admin acceso total planes" (existía desde supabase_migration_v2.sql)
-- que se hubiera perdido al recrear todas las políticas de la tabla desde cero.
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

-- ── dias_plan ────────────────────────────────────────────────────────────
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

-- ── ejercicios_plan ──────────────────────────────────────────────────────
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

-- ── Nota sobre "Solo Lifter Pro" ────────────────────────────────────────
-- es_solo_lifter_pro() queda definida pero, tras este fix, sigue sin usarse en ninguna
-- política -- a propósito. SoloConfigRules.tsx guarda las reglas de sobrecarga
-- personalizadas en la MISMA columna `planes.datos_plan` que el guardado básico de
-- progreso, así que no hay forma de exigir "premium" a nivel de fila sin bloquear
-- también el uso gratuito normal (que es justo el bug que este archivo corrige).
-- Para gatear esa función específica en el servidor sin este efecto colateral, hace
-- falta un trigger BEFORE UPDATE que compare el JSONB viejo vs. nuevo y solo rechace el
-- UPDATE si cambiaron específicamente las claves de reglas de sobrecarga y el usuario no
-- es premium -- no una política a nivel de fila. Se deja como tarea aparte, deliberada.
