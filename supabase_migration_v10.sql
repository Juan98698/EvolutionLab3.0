-- =====================================================================
-- MIGRATION v10: Permitir a entrenadores BUSCAR atletas autónomos (SELECT)
-- =====================================================================
-- Problema: La migración v9 corrigió la política de UPDATE en profiles para
-- permitir vincular atletas autónomos (entrenador_id IS NULL), pero la
-- política de SELECT (definida en la migración v2, "aislamiento
-- multi-entrenador") se quedó con el permiso viejo. Resultado: la función
-- "Vincular Existente" del modal Agregar Atleta nunca encuentra a un atleta
-- autónomo por correo — el SELECT devuelve 0 filas por RLS (aunque el
-- perfil sí exista), así que el flujo nunca llega siquiera al UPDATE que
-- v9 ya dejó funcionando.
--
-- Solución: Ampliar la política SELECT igual que se hizo con UPDATE en v9,
-- agregando "OR entrenador_id IS NULL" para que un entrenador pueda LEER
-- (no modificar) los perfiles de atletas sin entrenador asignado, y así
-- poder encontrarlos y ofrecerles vincularse. No expone clientes de otros
-- entrenadores — esos siguen invisibles (entrenador_id apunta a otro uid).
-- =====================================================================

DROP POLICY IF EXISTS "Entrenadores pueden leer perfiles de sus clientes"
  ON public.profiles;

CREATE POLICY "Entrenadores pueden leer perfiles de sus clientes"
  ON public.profiles FOR SELECT
  USING (
    public.es_entrenador(auth.uid())
    AND (
      id = auth.uid()                  -- propio perfil
      OR entrenador_id = auth.uid()    -- clientes ya vinculados
      OR entrenador_id IS NULL         -- atleta autónomo (para poder buscarlo y vincularlo)
    )
  );
