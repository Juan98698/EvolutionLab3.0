-- ============================================================================
-- EVOLUTION LAB 3.0 — MIGRATION V7: Gestión de Atletas Presenciales
-- ============================================================================
-- Ejecutar DESPUÉS de supabase_migration_v6.sql
-- Propósito: 
--   1. Agregar columna "modalidad" a la tabla profiles para diferenciar 'remoto' de 'presencial'.
--   2. Modificar las políticas RLS en sesiones_historial y sesiones_ejercicios para permitir 
--      que los entrenadores registren entrenamientos en nombre de sus atletas vinculados.
-- ============================================================================

-- 1. Agregar columna de modalidad a profiles con restricción CHECK
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS modalidad text DEFAULT 'remoto' CHECK (modalidad IN ('remoto', 'presencial'));

-- Actualizar la función handle_new_user para capturar "modalidad" de la metadata de registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol, objetivo, vigencia_dias, entrenador_id, modalidad)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', 'Nuevo Atleta'),
    coalesce(new.raw_user_meta_data->>'rol', 'cliente'),
    new.raw_user_meta_data->>'objetivo',
    coalesce((new.raw_user_meta_data->>'vigencia_dias')::integer, 28),
    (new.raw_user_meta_data->>'entrenador_id')::uuid,
    coalesce(new.raw_user_meta_data->>'modalidad', 'remoto')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Modificar políticas de RLS en la tabla sesiones_historial
-- Permitir a los entrenadores leer, insertar, actualizar y borrar el historial de sesiones de sus propios atletas
DROP POLICY IF EXISTS "Entrenadores pueden leer todo el historial de sesiones" ON public.sesiones_historial;
DROP POLICY IF EXISTS "Entrenadores pueden gestionar el historial de sesiones de sus clientes" ON public.sesiones_historial;

CREATE POLICY "Entrenadores pueden gestionar el historial de sesiones de sus clientes"
  ON public.sesiones_historial
  FOR ALL
  TO authenticated
  USING (
    public.es_entrenador(auth.uid()) AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = sesiones_historial.cliente_id AND profiles.entrenador_id = auth.uid()
    )
  )
  WITH CHECK (
    public.es_entrenador(auth.uid()) AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = sesiones_historial.cliente_id AND profiles.entrenador_id = auth.uid()
    )
  );

-- Restaurar lectura general por si acaso, aunque la política anterior de "Atletas pueden ver su propio historial" sigue activa para clientes.
-- Esta política permite a los entrenadores leer todo el historial para auditorías
CREATE POLICY "Entrenadores pueden leer todo el historial de sesiones"
  ON public.sesiones_historial FOR SELECT
  TO authenticated
  USING (public.es_entrenador(auth.uid()));


-- 3. Modificar políticas de RLS en la tabla sesiones_ejercicios (detalles de la sesión)
DROP POLICY IF EXISTS "Entrenadores pueden ver los detalles de todos los ejercicios de sesiones" ON public.sesiones_ejercicios;
DROP POLICY IF EXISTS "Entrenadores pueden gestionar los detalles de ejercicios de sesiones de sus clientes" ON public.sesiones_ejercicios;

CREATE POLICY "Entrenadores pueden gestionar los detalles de ejercicios de sesiones de sus clientes"
  ON public.sesiones_ejercicios
  FOR ALL
  TO authenticated
  USING (
    public.es_entrenador(auth.uid()) AND 
    EXISTS (
      SELECT 1 FROM public.sesiones_historial 
      JOIN public.profiles ON profiles.id = sesiones_historial.cliente_id 
      WHERE sesiones_historial.id = sesiones_ejercicios.sesion_id AND profiles.entrenador_id = auth.uid()
    )
  )
  WITH CHECK (
    public.es_entrenador(auth.uid()) AND 
    EXISTS (
      SELECT 1 FROM public.sesiones_historial 
      JOIN public.profiles ON profiles.id = sesiones_historial.cliente_id 
      WHERE sesiones_historial.id = sesiones_ejercicios.sesion_id AND profiles.entrenador_id = auth.uid()
    )
  );

-- Esta política permite a los entrenadores leer todos los detalles para visualización de gráficas y reportes
CREATE POLICY "Entrenadores pueden ver los detalles de todos los ejercicios de sesiones"
  ON public.sesiones_ejercicios FOR SELECT
  TO authenticated
  USING (public.es_entrenador(auth.uid()));
