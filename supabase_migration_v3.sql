-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V3: Cliente Independiente + Suscripciones + Storage
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v2.sql
-- Propósito: Habilitar la funcionalidad de Cliente Independiente (Solo Lifter),
--            crear la tabla de suscripciones B2C, y políticas de Storage.
-- ============================================================================

-- ============================================================================
-- 1. POLÍTICAS RLS PARA CLIENTES AUTÓNOMOS EN "planes"
-- ============================================================================
-- Permite que un cliente sin entrenador pueda crear, editar y borrar
-- sus propios planes (donde creador_id = auth.uid() o NULL).
-- La política existente "Atletas pueden ver sus propios planes" (SELECT)
-- ya cubre la lectura.
-- ============================================================================

CREATE POLICY "Clientes autónomos crean sus propios planes"
  ON public.planes FOR INSERT
  WITH CHECK (
    cliente_id = auth.uid()
    AND (creador_id IS NULL OR creador_id = auth.uid())
  );

CREATE POLICY "Clientes autónomos editan sus propios planes"
  ON public.planes FOR UPDATE
  USING (
    cliente_id = auth.uid()
    AND (creador_id IS NULL OR creador_id = auth.uid())
  );

CREATE POLICY "Clientes autónomos borran sus propios planes"
  ON public.planes FOR DELETE
  USING (
    cliente_id = auth.uid()
    AND (creador_id IS NULL OR creador_id = auth.uid())
  );

-- ============================================================================
-- 2. POLÍTICAS RLS PARA CLIENTES AUTÓNOMOS EN "dias_plan"
-- ============================================================================
-- Permite gestión completa de los días de un plan propio del cliente.
-- Valida que el plan pertenezca al usuario y sea auto-creado.
-- ============================================================================

CREATE POLICY "Clientes autónomos gestionan dias de sus planes"
  ON public.dias_plan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.planes
      WHERE planes.id = dias_plan.plan_id
        AND planes.cliente_id = auth.uid()
        AND (planes.creador_id IS NULL OR planes.creador_id = auth.uid())
    )
  );

-- ============================================================================
-- 3. POLÍTICAS RLS PARA CLIENTES AUTÓNOMOS EN "ejercicios_plan"
-- ============================================================================
-- Permite gestión completa de los ejercicios dentro de días de un plan propio.
-- Cadena de validación: ejercicio → día → plan → cliente autónomo.
-- ============================================================================

CREATE POLICY "Clientes autónomos gestionan ejercicios de sus planes"
  ON public.ejercicios_plan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dias_plan
      JOIN public.planes ON planes.id = dias_plan.plan_id
      WHERE dias_plan.id = ejercicios_plan.dia_id
        AND planes.cliente_id = auth.uid()
        AND (planes.creador_id IS NULL OR planes.creador_id = auth.uid())
    )
  );

-- ============================================================================
-- 4. TABLA DE SUSCRIPCIONES (Premium B2C)
-- ============================================================================
-- Estructura preparada para monetización futura.
-- El campo 'tipo' determina el nivel de acceso del usuario.
-- Por defecto, todos los usuarios empiezan en 'free'.
-- La pasarela de pagos (Stripe, MercadoPago, etc.) actualizará
-- esta tabla al procesar pagos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('free', 'premium')) DEFAULT 'free',
  estado text NOT NULL CHECK (estado IN ('activa', 'cancelada', 'expirada')) DEFAULT 'activa',
  fecha_inicio timestamptz DEFAULT now(),
  fecha_expiracion timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id)
);

-- RLS para suscripciones
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer su propia suscripción
CREATE POLICY "Usuarios leen su propia suscripcion"
  ON public.suscripciones FOR SELECT
  USING (cliente_id = auth.uid());

-- Solo admin puede gestionar suscripciones
CREATE POLICY "Admin gestiona todas las suscripciones"
  ON public.suscripciones FOR ALL
  USING (es_admin(auth.uid()));

-- Grants de acceso
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suscripciones TO anon, authenticated;

-- ============================================================================
-- 5. POLÍTICAS DE SUPABASE STORAGE (Aislamiento por Entrenador)
-- ============================================================================
-- Organiza los archivos multimedia por entrenador en el bucket 'ejercicios'.
-- Ruta: ejercicios/{trainer_id}/{archivo}
-- ============================================================================

-- Lectura pública para todos los archivos del bucket ejercicios
-- (las imágenes/gifs de ejercicios deben ser accesibles para los clientes)
CREATE POLICY "Lectura publica de ejercicios multimedia"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ejercicios');

-- Los entrenadores solo pueden subir/editar/borrar en su propia carpeta
CREATE POLICY "Entrenadores gestionan su carpeta multimedia"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ejercicios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Entrenadores actualizan su carpeta multimedia"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ejercicios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Entrenadores borran su carpeta multimedia"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ejercicios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- FIN DE MIGRATION V3
-- ============================================================================

-- ============================================================================
-- 6. ACTUALIZACIÓN DEL TRIGGER DE CREACIÓN DE USUARIO (Sincronización de entrenador_id)
-- ============================================================================
-- Se actualiza la función handle_new_user para que capture el entrenador_id
-- desde los metadatos de registro y lo almacene en la tabla de perfiles públicos.
-- ============================================================================

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
    COALESCE((new.raw_user_meta_data->>'vigencia_dias')::integer, 28),
    (new.raw_user_meta_data->>'entrenador_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCIÓN PARA ELIMINAR USUARIO POR ADMINISTRADOR (Con Cascada)
-- ============================================================================
-- Permite que un administrador elimine una cuenta de usuario directamente de
-- auth.users (lo cual gatilla la eliminación en cascada en perfiles, planes,
-- historiales, etc.).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Validar que el ejecutor sea un administrador
  IF NOT public.es_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acceso denegado. Solo los administradores pueden eliminar usuarios.';
  END IF;

  -- Eliminar de auth.users (la base de datos propaga por CASCADE a public.profiles y el resto)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants de acceso para permitir ejecución
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

-- ============================================================================
-- 8. POLÍTICA RLS PARA PERMITIR A CLIENTES LEER PERFILES DE ENTRENADORES/ADMINS
-- ============================================================================
-- Permite que los clientes autenticados puedan leer los datos de marca y
-- filosofía de los entrenadores y administradores para renderizar el branding.
-- ============================================================================

DROP POLICY IF EXISTS "Clientes pueden leer perfiles de entrenadores" ON public.profiles;
CREATE POLICY "Clientes pueden leer perfiles de entrenadores"
  ON public.profiles FOR SELECT
  USING (
    rol IN ('entrenador', 'admin')
  );
