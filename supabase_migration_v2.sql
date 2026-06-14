-- =====================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V2
-- =====================================================================
-- Extends the existing schema with: admin role, branding/philosophy,
-- global exercises catalog, gamification, multi-trainer isolation,
-- and updated RLS policies.
--
-- This migration is designed to be IDEMPOTENT — safe to run multiple
-- times without side effects.
--
-- Run this in the Supabase SQL Editor AFTER supabase_setup.sql has
-- been applied.
-- =====================================================================


-- =====================================================================
-- 1. ADD 'admin' ROLE TO PROFILES CHECK CONSTRAINT
-- =====================================================================
-- The original constraint only allows ('entrenador', 'cliente').
-- We drop it and recreate to also allow 'admin'.

DO $$ BEGIN
  -- Drop the existing check constraint on rol (name may vary)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'profiles_rol_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_rol_check;
  END IF;
END $$;

-- Re-add with admin included
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'profiles_rol_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_rol_check
      CHECK (rol IN ('admin', 'entrenador', 'cliente'));
  END IF;
END $$;


-- =====================================================================
-- 2. ADD BRANDING / PHILOSOPHY COLUMNS TO PROFILES
-- =====================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  filosofia jsonb DEFAULT NULL;
COMMENT ON COLUMN public.profiles.filosofia IS
  'Array of pilar objects: [{id, titulo, descripcion, icono}, ...]';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  marca jsonb DEFAULT NULL;
COMMENT ON COLUMN public.profiles.marca IS
  'Brand config: {nombre_display, color_primario, color_secundario, tipografia, eslogan}';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  logo_url text DEFAULT NULL;
COMMENT ON COLUMN public.profiles.logo_url IS
  'Premium trainers can upload a logo image URL';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  entrenador_id uuid DEFAULT NULL;
COMMENT ON COLUMN public.profiles.entrenador_id IS
  'Links a client to their assigned trainer';

-- Add the FK for entrenador_id idempotently
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND constraint_name = 'profiles_entrenador_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_entrenador_id_fkey
      FOREIGN KEY (entrenador_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- =====================================================================
-- 3. CREATE GLOBAL EXERCISES CATALOG TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ejercicios_globales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    grupo_muscular text NOT NULL,
    imagen_url text,
    descripcion text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    UNIQUE(nombre, grupo_muscular)
);

COMMENT ON TABLE public.ejercicios_globales IS
  'Master catalog of exercises shared across all trainers and clients';


-- =====================================================================
-- 4. CREATE GAMIFICATION TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.gamificacion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('racha', 'insignia', 'logro', 'pr')),
    titulo text NOT NULL,
    descripcion text,
    valor numeric DEFAULT 0,
    fecha timestamp with time zone DEFAULT timezone('utc'::text, now()),
    datos jsonb DEFAULT '{}'::jsonb,
    UNIQUE(cliente_id, tipo, titulo)
);

COMMENT ON TABLE public.gamificacion IS
  'Tracks streaks, badges, achievements, and personal records per client';


-- =====================================================================
-- 5. UPDATE es_entrenador HELPER FUNCTION
-- =====================================================================
-- Now returns TRUE for both 'entrenador' AND 'admin' roles.

CREATE OR REPLACE FUNCTION public.es_entrenador(user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_trainer boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND rol IN ('entrenador', 'admin')
  ) INTO is_trainer;
  RETURN is_trainer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- 6. CREATE es_admin HELPER FUNCTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.es_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND rol = 'admin'
  ) INTO is_admin;
  RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- 7. UPDATE handle_new_user TRIGGER FUNCTION
-- =====================================================================
-- Now validates the incoming role against the expanded list and
-- defaults to 'cliente' if an invalid role is provided.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _rol text;
BEGIN
  _rol := coalesce(new.raw_user_meta_data->>'rol', 'cliente');

  -- Validate the role; fall back to 'cliente' if invalid
  IF _rol NOT IN ('admin', 'entrenador', 'cliente') THEN
    _rol := 'cliente';
  END IF;

  INSERT INTO public.profiles (id, email, nombre, rol, objetivo, vigencia_dias)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', 'Nuevo Atleta'),
    _rol,
    new.raw_user_meta_data->>'objetivo',
    coalesce((new.raw_user_meta_data->>'vigencia_dias')::integer, 28)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- 8. ENABLE RLS ON NEW TABLES
-- =====================================================================

ALTER TABLE public.ejercicios_globales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacion ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- 9. RLS POLICIES — EJERCICIOS_GLOBALES
-- =====================================================================

-- SELECT: any authenticated user
DROP POLICY IF EXISTS "Autenticados pueden ver ejercicios globales"
  ON public.ejercicios_globales;
CREATE POLICY "Autenticados pueden ver ejercicios globales"
  ON public.ejercicios_globales FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: admin only
DROP POLICY IF EXISTS "Admin puede insertar ejercicios globales"
  ON public.ejercicios_globales;
CREATE POLICY "Admin puede insertar ejercicios globales"
  ON public.ejercicios_globales FOR INSERT
  WITH CHECK (public.es_admin(auth.uid()));

-- UPDATE: admin only
DROP POLICY IF EXISTS "Admin puede actualizar ejercicios globales"
  ON public.ejercicios_globales;
CREATE POLICY "Admin puede actualizar ejercicios globales"
  ON public.ejercicios_globales FOR UPDATE
  USING (public.es_admin(auth.uid()));

-- DELETE: admin only
DROP POLICY IF EXISTS "Admin puede borrar ejercicios globales"
  ON public.ejercicios_globales;
CREATE POLICY "Admin puede borrar ejercicios globales"
  ON public.ejercicios_globales FOR DELETE
  USING (public.es_admin(auth.uid()));


-- =====================================================================
-- 10. RLS POLICIES — GAMIFICACION
-- =====================================================================

-- SELECT own records
DROP POLICY IF EXISTS "Clientes pueden ver su propia gamificacion"
  ON public.gamificacion;
CREATE POLICY "Clientes pueden ver su propia gamificacion"
  ON public.gamificacion FOR SELECT
  USING (cliente_id = auth.uid());

-- INSERT own records
DROP POLICY IF EXISTS "Clientes pueden insertar su propia gamificacion"
  ON public.gamificacion;
CREATE POLICY "Clientes pueden insertar su propia gamificacion"
  ON public.gamificacion FOR INSERT
  WITH CHECK (cliente_id = auth.uid());

-- UPDATE own records
DROP POLICY IF EXISTS "Clientes pueden actualizar su propia gamificacion"
  ON public.gamificacion;
CREATE POLICY "Clientes pueden actualizar su propia gamificacion"
  ON public.gamificacion FOR UPDATE
  USING (cliente_id = auth.uid());

-- DELETE own records
DROP POLICY IF EXISTS "Clientes pueden borrar su propia gamificacion"
  ON public.gamificacion;
CREATE POLICY "Clientes pueden borrar su propia gamificacion"
  ON public.gamificacion FOR DELETE
  USING (cliente_id = auth.uid());

-- Trainers can SELECT their linked clients' gamification
DROP POLICY IF EXISTS "Entrenadores pueden ver gamificacion de sus clientes"
  ON public.gamificacion;
CREATE POLICY "Entrenadores pueden ver gamificacion de sus clientes"
  ON public.gamificacion FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = gamificacion.cliente_id
        AND profiles.entrenador_id = auth.uid()
    )
  );

-- Admin can do everything
DROP POLICY IF EXISTS "Admin acceso total gamificacion"
  ON public.gamificacion;
CREATE POLICY "Admin acceso total gamificacion"
  ON public.gamificacion FOR ALL
  USING (public.es_admin(auth.uid()));


-- =====================================================================
-- 11. UPDATE EXISTING RLS POLICIES — PROFILES
-- =====================================================================
-- Original policies:
--   "Permitir lectura de propio perfil"         → KEEP (own row SELECT)
--   "Permitir entrenador leer todos los perfiles" → REPLACE (multi-trainer isolation)
--   "Permitir entrenador crear perfiles"        → KEEP
--   "Permitir entrenador actualizar todos los perfiles" → REPLACE (multi-trainer isolation)
-- New policies:
--   Admin can read ALL profiles
--   Admin can update ALL profiles
--   Trainers can read ONLY their linked clients

-- Remove old broad trainer policies
DROP POLICY IF EXISTS "Permitir entrenador leer todos los perfiles"
  ON public.profiles;
DROP POLICY IF EXISTS "Permitir entrenador actualizar todos los perfiles"
  ON public.profiles;

-- Trainers: read own profile + linked clients only
DROP POLICY IF EXISTS "Entrenadores pueden leer perfiles de sus clientes"
  ON public.profiles;
CREATE POLICY "Entrenadores pueden leer perfiles de sus clientes"
  ON public.profiles FOR SELECT
  USING (
    public.es_entrenador(auth.uid())
    AND (
      id = auth.uid()                  -- own profile
      OR entrenador_id = auth.uid()    -- linked clients
    )
  );

-- Trainers: update only linked clients
DROP POLICY IF EXISTS "Entrenadores pueden actualizar perfiles de sus clientes"
  ON public.profiles;
CREATE POLICY "Entrenadores pueden actualizar perfiles de sus clientes"
  ON public.profiles FOR UPDATE
  USING (
    public.es_entrenador(auth.uid())
    AND (
      id = auth.uid()
      OR entrenador_id = auth.uid()
    )
  );

-- Admin: read ALL profiles
DROP POLICY IF EXISTS "Admin puede leer todos los perfiles"
  ON public.profiles;
CREATE POLICY "Admin puede leer todos los perfiles"
  ON public.profiles FOR SELECT
  USING (public.es_admin(auth.uid()));

-- Admin: update ALL profiles
DROP POLICY IF EXISTS "Admin puede actualizar todos los perfiles"
  ON public.profiles;
CREATE POLICY "Admin puede actualizar todos los perfiles"
  ON public.profiles FOR UPDATE
  USING (public.es_admin(auth.uid()));


-- =====================================================================
-- 12. UPDATE EXISTING RLS POLICIES — PLANES (MULTI-TRAINER ISOLATION)
-- =====================================================================
-- Original policies:
--   "Atletas pueden ver sus propios planes"      → KEEP
--   "Entrenadores pueden leer todos los planes"  → REPLACE (only own-created)
--   "Entrenadores pueden gestionar planes"       → REPLACE (only own-created)

DROP POLICY IF EXISTS "Entrenadores pueden leer todos los planes"
  ON public.planes;
DROP POLICY IF EXISTS "Entrenadores pueden gestionar planes"
  ON public.planes;

-- Trainers can only see plans they created
DROP POLICY IF EXISTS "Entrenadores pueden leer planes que crearon"
  ON public.planes;
CREATE POLICY "Entrenadores pueden leer planes que crearon"
  ON public.planes FOR SELECT
  USING (
    public.es_entrenador(auth.uid())
    AND creador_id = auth.uid()
  );

-- Trainers can only manage (insert/update/delete) plans they created
DROP POLICY IF EXISTS "Entrenadores pueden gestionar planes que crearon"
  ON public.planes;
CREATE POLICY "Entrenadores pueden gestionar planes que crearon"
  ON public.planes FOR ALL
  USING (
    public.es_entrenador(auth.uid())
    AND creador_id = auth.uid()
  );

-- Admin: full access to all plans
DROP POLICY IF EXISTS "Admin acceso total planes"
  ON public.planes;
CREATE POLICY "Admin acceso total planes"
  ON public.planes FOR ALL
  USING (public.es_admin(auth.uid()));


-- =====================================================================
-- 13. GRANTS FOR NEW TABLES AND FUNCTIONS
-- =====================================================================

-- Functions
GRANT EXECUTE ON FUNCTION public.es_admin(uuid) TO anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.es_entrenador(uuid) TO anon, authenticated, public;

-- New tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ejercicios_globales TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamificacion TO anon, authenticated;


-- =====================================================================
-- MIGRATION V2 COMPLETE
-- =====================================================================
-- Summary of changes:
--   ✓ profiles.rol now accepts 'admin', 'entrenador', 'cliente'
--   ✓ profiles has new columns: filosofia, marca, logo_url, entrenador_id
--   ✓ New table: ejercicios_globales (global exercise catalog)
--   ✓ New table: gamificacion (streaks, badges, achievements, PRs)
--   ✓ es_entrenador() now returns true for admin role too
--   ✓ New function: es_admin()
--   ✓ handle_new_user() validates expanded role list
--   ✓ RLS: ejercicios_globales — auth SELECT, admin-only write
--   ✓ RLS: gamificacion — own CRUD, trainer reads linked, admin full
--   ✓ RLS: profiles — multi-trainer isolation via entrenador_id
--   ✓ RLS: planes — trainers see only plans they created
--   ✓ Grants for all new objects
-- =====================================================================
