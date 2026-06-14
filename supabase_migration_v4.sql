-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V4: Planes de Suscripción y Estado de Membresía
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v3.sql
-- Propósito: Añadir campos para controlar planes de entrenadores, Solo Lifters,
--            estado de vigencia y fechas de expiración de membresías.
-- ============================================================================

-- 1. AÑADIR COLUMNAS DE SUSCRIPCIÓN A PROFILES (IDEMPOTENTE)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  suscripcion_plan text DEFAULT 'free';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  suscripcion_estado text DEFAULT 'activo';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS 
  suscripcion_expira_at timestamp with time zone DEFAULT (now() + interval '30 days');

-- Comentarios informativos sobre las columnas
COMMENT ON COLUMN public.profiles.suscripcion_plan IS 
  'Plan activo: free, iniciacion, intermedio, profesional, premium';

COMMENT ON COLUMN public.profiles.suscripcion_estado IS 
  'Estado de membresía: activo, expirado, cancelado';

COMMENT ON COLUMN public.profiles.suscripcion_expira_at IS 
  'Fecha límite en que expira la suscripción del usuario';

-- 2. MODIFICAR VIGENCIA DIAS POR DEFECTO A 30 DÍAS (EN COLUMNA Y TRIGGER)
ALTER TABLE public.profiles ALTER COLUMN vigencia_dias SET DEFAULT 30;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol, objetivo, vigencia_dias, entrenador_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo Atleta'),
    COALESCE(new.raw_user_meta_data->>'rol', 'cliente'),
    new.raw_user_meta_data->>'objetivo',
    COALESCE((new.raw_user_meta_data->>'vigencia_dias')::integer, 30),
    (new.raw_user_meta_data->>'entrenador_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTUALIZAR RLS DE EJERCICIOS GLOBALES PARA PERMITIR WRITE A ENTRENADORES Y ADMINS
CREATE OR REPLACE FUNCTION public.es_entrenador_o_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_auth_role boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (rol = 'admin' OR rol = 'entrenador')
  ) INTO is_auth_role;
  RETURN is_auth_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admin puede insertar ejercicios globales" ON public.ejercicios_globales;
CREATE POLICY "Entrenador o Admin puede insertar ejercicios globales"
  ON public.ejercicios_globales FOR INSERT
  WITH CHECK (public.es_entrenador_o_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin puede actualizar ejercicios globales" ON public.ejercicios_globales;
CREATE POLICY "Entrenador o Admin puede actualizar ejercicios globales"
  ON public.ejercicios_globales FOR UPDATE
  USING (public.es_entrenador_o_admin(auth.uid()));


