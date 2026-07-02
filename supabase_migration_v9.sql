-- =====================================================================
-- MIGRATION v9: Permitir a entrenadores vincular atletas autónomos
-- =====================================================================
-- Problema: La política RLS de UPDATE en profiles solo permite que un
-- entrenador actualice perfiles donde entrenador_id = auth.uid().
-- Esto bloquea la vinculación de atletas autónomos (entrenador_id = NULL).
--
-- Solución: Ampliar la política UPDATE para también permitir actualizar
-- perfiles donde entrenador_id IS NULL (atleta sin entrenador asignado),
-- pero SOLO si el entrenador está actualizando entrenador_id a su propio ID.
-- Se usa WITH CHECK para restringir qué valores pueden escribirse.
-- =====================================================================

-- 1. Eliminar la política anterior restrictiva
DROP POLICY IF EXISTS "Entrenadores pueden actualizar perfiles de sus clientes"
  ON public.profiles;

-- 2. Crear política nueva que permite vincular atletas sin entrenador
CREATE POLICY "Entrenadores pueden actualizar perfiles de sus clientes"
  ON public.profiles FOR UPDATE
  USING (
    public.es_entrenador(auth.uid())
    AND (
      id = auth.uid()                         -- propio perfil
      OR entrenador_id = auth.uid()           -- clientes ya vinculados
      OR entrenador_id IS NULL                -- atleta autónomo (para vincular)
    )
  )
  WITH CHECK (
    public.es_entrenador(auth.uid())
    AND (
      id = auth.uid()                         -- entrenador actualizando su propio perfil
      OR entrenador_id = auth.uid()           -- vinculando o actualizando cliente propio
    )
  );

-- Nota: WITH CHECK garantiza que después del UPDATE el registro quede con
-- entrenador_id = auth.uid() (el entrenador no puede asignar atletas a otros).
